import {createSupabaseAdminClient} from './supabase-adapter.js';

function settingsError(error){
  const known=['FORBIDDEN','INVALID_PLATFORM_CONTROLS','ACCESS_ACTIVATION_CONFIRMATION_REQUIRED'];
  return new Error(known.find(code=>String(error?.message||'').includes(code))||'PLATFORM_CONTROLS_FAILED',{cause:error});
}

export async function getPlatformControls(user){
  if(user?.role!=='ADMIN')throw new Error('FORBIDDEN');
  const {data,error}=await createSupabaseAdminClient().rpc('managed_platform_controls',{actor_user_id:user.id});
  if(error)throw settingsError(error);
  return data;
}

export async function savePlatformControls(user,command){
  if(user?.role!=='ADMIN')throw new Error('FORBIDDEN');
  const {data,error}=await createSupabaseAdminClient().rpc('save_managed_platform_controls',{actor_user_id:user.id,command});
  if(error)throw settingsError(error);
  return data;
}
