import {removePrivateUpload,storePrivateUpload} from '../private-storage.js';
import {createSupabaseAdminClient} from '../supabase-adapter.js';

const MANAGED_ERRORS=[
  'FORBIDDEN','SUBSCRIPTION_ACCESS_REQUIRED','NOT_FOUND','LOCALITY_REQUIRED','BASE_LOCATION_REQUIRED',
  'PROVIDER_BASE_REGION_REQUIRED','INVALID_PROVIDER_PROFILE_INPUT','INVALID_WEBSITE_URL',
  'PROFILE_IMAGE_REQUIRED','PROFILE_IMAGE_TYPE_INVALID'
];

function managedError(code,error){
  const message=String(error?.message||'');
  const known=MANAGED_ERRORS.find(candidate=>message.includes(candidate));
  return new Error(known||code,{cause:error});
}

function seededTransporterPortraitUrl(filename){
  const value=String(filename||'');
  return /^[a-z0-9-]+\.png$/.test(value)?`/marketing/transporters/${value}`:null;
}

export function projectSupabaseOwnCompanyPage(payload){
  const page=payload&&typeof payload==='object'?payload:null;
  if(!page)return null;
  const handle=String(page.handle||'');
  const custom=Boolean(page.profile_image_is_custom);
  return {
    ...page,
    profile_image_is_custom:custom,
    profile_image_url:custom&&handle
      ?`/api/public/providers/${encodeURIComponent(handle)}/image?v=${encodeURIComponent(page.profile_image_updated_at||'1')}`
      :seededTransporterPortraitUrl(page.profile_image_preset)
  };
}

export async function getSupabaseOwnCompanyPage(user){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('provider_profile_workspace',{actor_user_id:user.id});
  if(error)throw managedError('SUPABASE_PROVIDER_PROFILE_WORKSPACE_FAILED',error);
  return projectSupabaseOwnCompanyPage(data);
}

export async function updateSupabaseCompanyPage(user,input){
  const command={
    headline:String(input.headline||''),about:String(input.about||''),services:String(input.services||''),
    base_place_ref:String(input.basePlaceRef||''),base_region_code:String(input.baseRegionCode||''),
    contact_phone:String(input.contactPhone||''),contact_whatsapp:String(input.contactWhatsapp||''),
    contact_email:String(input.contactEmail||''),contact_website:String(input.contactWebsite||''),
    show_contact_phone:Boolean(input.showContactPhone),show_contact_whatsapp:Boolean(input.showContactWhatsapp),
    show_contact_email:Boolean(input.showContactEmail),show_contact_website:Boolean(input.showContactWebsite),
    published:Boolean(input.published)
  };
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('update_provider_profile_page',{actor_user_id:user.id,command});
  if(error)throw managedError('SUPABASE_PROVIDER_PROFILE_UPDATE_FAILED',error);
  return data;
}

export async function updateSupabaseProviderProfileImage(user,file){
  if(!file||typeof file.arrayBuffer!=='function'||!file.size)throw new Error('PROFILE_IMAGE_REQUIRED');
  if(!['image/jpeg','image/png','image/webp'].includes(String(file.type||'').toLowerCase())){
    throw new Error('PROFILE_IMAGE_TYPE_INVALID');
  }
  const stored=await storePrivateUpload(file,'provider-profile');
  if(!stored)throw new Error('PROFILE_IMAGE_REQUIRED');
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('update_provider_profile_image',{
    actor_user_id:user.id,storage_reference:stored.path,mime_type:stored.mimeType,file_size:stored.size
  });
  if(error){
    await removePrivateUpload(stored.path).catch(()=>undefined);
    throw managedError('SUPABASE_PROVIDER_PROFILE_IMAGE_UPDATE_FAILED',error);
  }
  if(data?.previous_reference){
    await removePrivateUpload(data.previous_reference).catch(()=>undefined);
  }
  return data;
}

export async function removeSupabaseProviderProfileImage(user){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('remove_provider_profile_image',{actor_user_id:user.id});
  if(error)throw managedError('SUPABASE_PROVIDER_PROFILE_IMAGE_REMOVE_FAILED',error);
  if(data?.previous_reference){
    await removePrivateUpload(data.previous_reference).catch(()=>undefined);
  }
  return data;
}
