import {z} from 'zod';
import {createSupabaseAdminClient} from './supabase-adapter.js';
import {createPrivateUploadReference,storePrivateUpload,removePrivateUpload} from './private-storage.js';
import {prepareDriverPortrait} from './driver-portrait-image.js';
import {driverPortraitUrl,uploadedDriverPortraitUrl} from './driver-portraits.js';

const workspace=z.object({public_id:z.string().uuid().nullable(),preset:z.string().nullable()});
const cleanupRows=z.array(z.object({id:z.string().uuid(),file_path:z.string()}));
const knownErrors=['FORBIDDEN','NOT_FOUND','PORTRAIT_CONSENT_REQUIRED','PORTRAIT_UPLOAD_BUSY'];
async function command(name,args){
  const {data,error}=await createSupabaseAdminClient().rpc(name,args);
  if(error)throw new Error(knownErrors.find(code=>error.message===code)||'PORTRAIT_OPERATION_FAILED');
  return data;
}

/** @param {{id:string,role:string,active:boolean}} actor */
export async function getDriverPortraitWorkspace(actor){
  if(!actor.active||actor.role!=='DRIVER')throw new Error('FORBIDDEN');
  const data=workspace.parse(await command('driver_portrait_workspace',{actor_user_id:actor.id}));
  const imageUrl=uploadedDriverPortraitUrl(data.public_id)||driverPortraitUrl(data.preset);
  return {imageUrl,hasPortrait:Boolean(imageUrl),custom:Boolean(data.public_id)};
}

/** @param {{id:string,role:string,active:boolean}} actor @param {File} file @param {boolean} consent */
export async function updateDriverPortrait(actor,file,consent){
  await getDriverPortraitWorkspace(actor); // Persisted permission before decoding or Storage.
  if(consent!==true)throw new Error('PORTRAIT_CONSENT_REQUIRED');
  const normalized=await prepareDriverPortrait(file);
  const reference=createPrivateUploadReference('driver-portrait','image/jpeg');
  const id=z.string().uuid().parse(await command('reserve_driver_portrait',{
    actor_user_id:actor.id,storage_reference:reference,file_size:normalized.size
  }));
  try{
    await storePrivateUpload(normalized,'driver-portrait',{reference,timeoutMs:30000});
    await command('activate_driver_portrait',{actor_user_id:actor.id,upload_id:id,public_consent:true});
  }catch(error){
    // ACTIVE survives an ambiguous activation response. Stale PENDING retries later.
    await command('discard_pending_driver_portrait',{actor_user_id:actor.id,upload_id:id}).catch(()=>undefined);
    await cleanupDriverPortraitUploads().catch(()=>undefined);
    throw error;
  }
  await cleanupDriverPortraitUploads().catch(()=>undefined);
}

/** @param {{id:string,role:string,active:boolean}} actor */
export async function removeDriverPortrait(actor){
  await getDriverPortraitWorkspace(actor);
  await command('remove_driver_portrait',{actor_user_id:actor.id});
  await cleanupDriverPortraitUploads().catch(()=>undefined);
}

export async function getPublicDriverPortraitFile(id){
  if(!uploadedDriverPortraitUrl(id))return null;
  const data=await command('public_driver_portrait_file',{portrait_id:id});
  return data?z.object({file_path:z.string(),mime_type:z.literal('image/jpeg')}).parse(data):null;
}

// Dependencies permit failure/lease tests without contacting any Storage service.
export async function cleanupDriverPortraitUploads(limit=20,{client=createSupabaseAdminClient(),remove=reference=>removePrivateUpload(reference,{timeoutMs:30000})}={}){
  const {data,error}=await client.rpc('claim_driver_portrait_cleanup',{requested_limit:Math.max(1,Math.min(20,Number(limit)||20))});
  if(error)throw new Error('PORTRAIT_CLEANUP_FAILED');
  const rows=cleanupRows.parse(data);let deleted=0;let failed=0;
  for(const row of rows){
    try{
      await remove(row.file_path);
      const result=await client.from('driver_portrait_uploads').delete().eq('id',row.id).eq('state','DELETING');
      if(result.error)throw new Error('PORTRAIT_CLEANUP_FAILED');
      deleted++;
    }catch{failed++;}
  }
  return {attempted:rows.length,deleted,failed};
}
