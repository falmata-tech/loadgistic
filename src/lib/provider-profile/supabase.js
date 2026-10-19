import {normalizePublicAccountIdentity} from '../provider-public-identity.js';
import {commitPrivateUpload} from '../private-upload-commit.js';
import {readPrivateUpload,removePrivateUpload,storePrivateUpload} from '../private-storage.js';
import {createSupabaseAdminClient} from '../supabase-adapter.js';

const MANAGED_ERRORS=[
  'FORBIDDEN','SUBSCRIPTION_ACCESS_REQUIRED','NOT_FOUND','LOCALITY_REQUIRED','BASE_LOCATION_REQUIRED',
  'PROVIDER_BASE_REGION_REQUIRED','INVALID_PROVIDER_PROFILE_INPUT','INVALID_WEBSITE_URL',
  'ACCOUNT_HANDLE_UNAVAILABLE','INVALID_ACCOUNT_HANDLE','INVALID_PUBLIC_ACCOUNT_NAME','INVALID_PUBLIC_ACCOUNT_IDENTITY','PROFILE_IMAGE_REQUIRED','PROFILE_IMAGE_TYPE_INVALID'
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
    services:'',
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

export function providerProfileCommand(input){
  if(Object.hasOwn(input,'managerName')||Object.hasOwn(input,'manager_name'))throw Error('INVALID_PUBLIC_ACCOUNT_IDENTITY');
  const identity=normalizePublicAccountIdentity(input);
  const command={...(identity.accountName?{account_name:identity.accountName,handle:identity.handle}:{})};
  for(const [source,target] of Object.entries({headline:'headline',about:'about',basePlaceRef:'base_place_ref',baseRegionCode:'base_region_code',contactPhone:'contact_phone',contactWhatsapp:'contact_whatsapp',contactEmail:'contact_email',contactWebsite:'contact_website'})){
    if(Object.hasOwn(input,source))command[target]=String(input[source]||'');
  }
  for(const [source,target] of Object.entries({showContactPhone:'show_contact_phone',showContactWhatsapp:'show_contact_whatsapp',showContactEmail:'show_contact_email',showContactWebsite:'show_contact_website',published:'published'})){
    if(Object.hasOwn(input,source))command[target]=Boolean(input[source]);
  }
  return command;
}
export async function updateSupabaseCompanyPage(user,input){
  const command=providerProfileCommand(input);
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('update_provider_profile_page',{actor_user_id:user.id,command});
  if(error)throw managedError('SUPABASE_PROVIDER_PROFILE_UPDATE_FAILED',error);
  return data;
}

export async function updateSupabaseProviderProfileImage(user,file){
  const {requireContentPolicy}=await import('../privacy/content-policy.js');await requireContentPolicy(user.id);
  if(!file||typeof file.arrayBuffer!=='function'||!file.size)throw new Error('PROFILE_IMAGE_REQUIRED');
  if(!['image/jpeg','image/png','image/webp'].includes(String(file.type||'').toLowerCase())){
    throw new Error('PROFILE_IMAGE_TYPE_INVALID');
  }
  const stored=await storePrivateUpload(file,'provider-profile');
  if(!stored)throw new Error('PROFILE_IMAGE_REQUIRED');
  const client=createSupabaseAdminClient();
  const data=await commitPrivateUpload(stored,async()=>{
    const {data,error}=await client.rpc('update_provider_profile_image',{
    actor_user_id:user.id,storage_reference:stored.path,mime_type:stored.mimeType,file_size:stored.size
  });
    if(error)throw managedError('SUPABASE_PROVIDER_PROFILE_IMAGE_UPDATE_FAILED',error);
    return data;
  },removePrivateUpload);
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

// Authorize through the managed workspace before reading an owner's unpublished image.
// The page ID comes from the actor-scoped RPC, never from a client parameter.
export async function readSupabaseOwnProviderProfileImage(user){
  const page=await getSupabaseOwnCompanyPage(user);
  if(!page?.id||!page.profile_image_is_custom)return null;
  const {data,error}=await createSupabaseAdminClient().from('company_pages')
    .select('profile_image_path,profile_image_mime').eq('id',page.id).maybeSingle();
  if(error)throw new Error('SUPABASE_PROVIDER_IMAGE_READ_FAILED',{cause:error});
  if(!data?.profile_image_path)return null;
  const bytes=await readPrivateUpload(data.profile_image_path);
  return bytes?{bytes,mimeType:data.profile_image_mime}:null;
}
