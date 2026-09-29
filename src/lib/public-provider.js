import {getSupabasePublicProvider,getSupabasePublicProviderProfileImage} from './repository/supabase.js';

export async function getPublicProvider(handle,options={}){
  return getSupabasePublicProvider(handle,options);
}

export async function getPublicProviderProfileImage(handle){
  return getSupabasePublicProviderProfileImage(handle);
}
