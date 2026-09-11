import {
  getSupabaseOwnCompanyPage,removeSupabaseProviderProfileImage,
  updateSupabaseCompanyPage,updateSupabaseProviderProfileImage
} from './provider-profile/supabase.js';

export async function getOwnCompanyPage(user){
  return getSupabaseOwnCompanyPage(user);
}

export async function updateCompanyPage(user,input){
  return updateSupabaseCompanyPage(user,input);
}

export async function updateProviderProfileImage(user,file){
  return updateSupabaseProviderProfileImage(user,file);
}

export async function removeProviderProfileImage(user){
  return removeSupabaseProviderProfileImage(user);
}
