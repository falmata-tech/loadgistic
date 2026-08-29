import {getSupabasePublicProvider,getSupabasePublicProviderProfileImage} from './repository/supabase.js';

export async function getPublicProvider(handle){
  return getSupabasePublicProvider(handle);
}

export async function getPublicProviderProfileImage(handle){
  return getSupabasePublicProviderProfileImage(handle);
}
