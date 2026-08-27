function usesManagedData(){
  return process.env.DATA_BACKEND==='supabase';
}

async function managed(){
  return import('./provider-profile/supabase.js');
}

async function legacy(){
  return import('./repository.js');
}

export async function getOwnCompanyPage(user){
  if(usesManagedData())return (await managed()).getSupabaseOwnCompanyPage(user);
  return (await legacy()).getOwnCompanyPage(user);
}

export async function updateCompanyPage(user,input){
  if(usesManagedData())return (await managed()).updateSupabaseCompanyPage(user,input);
  return (await legacy()).updateCompanyPage(user,input);
}

export async function updateProviderProfileImage(user,file){
  if(usesManagedData())return (await managed()).updateSupabaseProviderProfileImage(user,file);
  return (await legacy()).updateProviderProfileImage(user,file);
}

export async function removeProviderProfileImage(user){
  if(usesManagedData())return (await managed()).removeSupabaseProviderProfileImage(user);
  return (await legacy()).removeProviderProfileImage(user);
}
