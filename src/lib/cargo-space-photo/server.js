import {createSupabaseAdminClient} from '../supabase-adapter.js';
import {createPrivateUploadReference,storePrivateUpload,readPrivateUpload,removePrivateUpload} from '../private-storage.js';
import {prepareCargoSpacePhoto} from './image.js';
import {privateUploadMaxBytes} from '../upload-policy.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHOTO_REFERENCE=/^supabase:\/\/capacity-photo\/capacity\/[0-9]{4}-[0-9]{2}-[0-9]{2}\/[a-f0-9-]{36}\.jpg$/i;
const codes=new Set(['CARGO_PHOTO_INVALID','CARGO_PHOTO_FORBIDDEN','CARGO_PHOTO_NOT_FOUND','CARGO_PHOTO_RATE_LIMITED']);

export class CargoPhotoError extends Error{
 constructor(code){super(code);this.code=code;}
}

function validId(value){if(typeof value!=='string'||!UUID.test(value))throw new CargoPhotoError('CARGO_PHOTO_INVALID');return value;}
function publicPhoto(value){
 if(!value||typeof value!=='object')return null;
 const {id,vehicleId,receivedAt,cameraCapturedAt,source}=value;
 if(!UUID.test(String(id))||!UUID.test(String(vehicleId))||!receivedAt)throw new CargoPhotoError('CARGO_PHOTO_UNAVAILABLE');
 return {id,vehicleId,receivedAt,cameraCapturedAt:cameraCapturedAt||null,source};
}
function rpcError(error){
 const message=String(error?.message||'');
 for(const code of codes)if(message.includes(code))throw new CargoPhotoError(code);
 throw new CargoPhotoError('CARGO_PHOTO_UNAVAILABLE');
}
function cameraTime(value,source){
 if(value==null||value==='')return null;
 if(source!=='CAMERA'||typeof value!=='string'||value.length>40)throw new CargoPhotoError('CARGO_PHOTO_INVALID');
 const parsed=new Date(value);
 if(!Number.isFinite(parsed.getTime()))throw new CargoPhotoError('CARGO_PHOTO_INVALID');
 return parsed.toISOString();
}

/** Server-only photo port. Dependencies may be substituted in focused tests. */
export function cargoPhotoService({client=createSupabaseAdminClient(),store=storePrivateUpload,
 read=readPrivateUpload,remove=removePrivateUpload,prepare=prepareCargoSpacePhoto,
 reference=createPrivateUploadReference}={}){
 async function rpc(name,args){
  const {data,error}=await client.rpc(name,args);
  if(error)rpcError(error);
  return data;
 }
 async function cleanup(limit=10){
  const candidates=await rpc('cargo_photo_cleanup_candidates',{requested_limit:limit});
  if(!Array.isArray(candidates))throw new CargoPhotoError('CARGO_PHOTO_UNAVAILABLE');
  let deleted=0;
  for(const candidate of candidates){
   if(!UUID.test(String(candidate.id))||typeof candidate.storage_path!=='string')continue;
   try{
    try{await remove(candidate.storage_path,{timeoutMs:30000});}
    catch(error){
     // A prior attempt may have removed the object before its metadata write
     // failed. Only a confirmed Storage 404 is safe to treat as deleted.
     const existing=await read(candidate.storage_path,{timeoutMs:30000}).catch(()=>undefined);
     if(existing!==null)throw error;
    }
    // Fulfilled requests retain this photo ID for their audit history. Once the
    // private object is gone, keep an inaccessible terminal metadata tombstone.
    const {error}=await client.from('cargo_space_photos').update({state:'DELETED'})
     .eq('id',candidate.id).eq('state','DELETING').eq('storage_path',candidate.storage_path);
    if(error)throw error;
    deleted++;
   }catch{ /* State is already invisible; a later cleanup retries object deletion. */ }
  }
  return {attempted:candidates.length,deleted};
 }
 async function authorizedFile(name,args){
  const file=await rpc(name,args);
  if(!file||typeof file.storagePath!=='string'||!PHOTO_REFERENCE.test(file.storagePath))
   throw new CargoPhotoError('CARGO_PHOTO_UNAVAILABLE');
  const bytes=await read(file.storagePath,{timeoutMs:30000});
  if(!bytes)throw new CargoPhotoError('CARGO_PHOTO_NOT_FOUND');
  if(bytes.length>privateUploadMaxBytes())throw new CargoPhotoError('CARGO_PHOTO_UNAVAILABLE');
  // Recheck after the Storage read; a grant or assignment could change during it.
  await rpc(name,args);
  return {bytes,mimeType:'image/jpeg',receivedAt:file.receivedAt};
 }
 return {
  async upload(actorId,command,file){
   validId(actorId);
   const vehicleId=validId(command?.vehicleId),source=command?.source;
   if(source!=='CAMERA'&&source!=='UPLOAD')throw new CargoPhotoError('CARGO_PHOTO_INVALID');
   const capturedAt=cameraTime(command?.cameraCapturedAt,source);
   const assignment=await rpc('cargo_photo_driver_assignment',{actor_user_id:actorId,target_vehicle_id:vehicleId});
   if(!assignment)throw new CargoPhotoError('CARGO_PHOTO_FORBIDDEN');
   const normalized=await prepare(file);
   const path=reference('capacity','image/jpeg');
   const photoId=validId(await rpc('cargo_photo_reserve',{actor_user_id:actorId,target_vehicle_id:vehicleId,
    target_storage_path:path,target_source:source,target_camera_captured_at:capturedAt,target_byte_size:normalized.size}));
   try{
    await store(normalized,'capacity',{reference:path,timeoutMs:30000});
    const active=await rpc('cargo_photo_activate',{actor_user_id:actorId,target_photo_id:photoId});
    return publicPhoto(active);
   }catch(error){
    // An ambiguous activation may already have committed. The DB only returns a
    // cleanup path while this reservation is still PENDING, never when ACTIVE.
    const discarded=await rpc('cargo_photo_discard_pending',{
     actor_user_id:actorId,target_photo_id:photoId}).catch(()=>null);
    if(typeof discarded==='string')await remove(discarded,{timeoutMs:30000}).catch(()=>undefined);
    throw error;
   }
  },
  async providerState(actorId,vehicleId){
   const data=await rpc('cargo_photo_provider_state',{actor_user_id:validId(actorId),target_vehicle_id:validId(vehicleId)});
   const photo=publicPhoto(data?.photo);
   return {photo:photo?{...photo,contentPath:`/api/capacity/cargo-space-photos/${photo.id}`}:null,
    requests:Array.isArray(data?.requests)?data.requests.map(request=>({
    id:request.id,workspaceId:request.workspaceId,requestedAt:request.requestedAt})):[]};
  },
  async remove(actorId,photoId){
   const result=await rpc('cargo_photo_mark_delete',{actor_user_id:validId(actorId),target_photo_id:validId(photoId)});
   return {id:result.id,vehicleId:result.vehicleId,removed:true};
  },
  async businessState(actorId,workspaceId,vehicleId){
   const data=await rpc('cargo_photo_business_summary',{actor_user_id:validId(actorId),
    target_workspace_id:validId(workspaceId),target_vehicle_id:validId(vehicleId)});
   const photo=publicPhoto(data?.photo);
   return {photo:photo?{...photo,contentPath:`/api/business-workspaces/${workspaceId}/capacity/photos/${photo.id}`}:null,
    request:data?.request?{id:data.request.id,status:data.request.status,
    requestedAt:data.request.requestedAt}:null};
  },
  async request(actorId,workspaceId,vehicleId,idempotencyKey){
   const result=await rpc('cargo_photo_request',{actor_user_id:validId(actorId),
    target_workspace_id:validId(workspaceId),target_vehicle_id:validId(vehicleId),
    target_idempotency_key:validId(idempotencyKey)});
   return {id:result.id,status:result.status,requestedAt:result.requestedAt,created:Boolean(result.created)};
  },
  async businessFile(actorId,workspaceId,photoId){
   const args={actor_user_id:validId(actorId),target_workspace_id:validId(workspaceId),target_photo_id:validId(photoId)};
   return authorizedFile('cargo_photo_business_file',args);
  },
  async providerFile(actorId,photoId){
   const args={actor_user_id:validId(actorId),target_photo_id:validId(photoId)};
   return authorizedFile('cargo_photo_provider_file',args);
  },
  cleanup
 };
}
