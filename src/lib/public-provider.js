export async function getPublicProvider(handle){
  if(process.env.DATA_BACKEND==='supabase'){
    const {getSupabasePublicProvider}=await import('./repository/supabase.js');
    return getSupabasePublicProvider(handle);
  }
  return (await import('./repository.js')).getPublicProvider(handle);
}

export async function getPublicProviderProfileImage(handle){
  if(process.env.DATA_BACKEND==='supabase'){
    const {getSupabasePublicProviderProfileImage}=await import('./repository/supabase.js');
    return getSupabasePublicProviderProfileImage(handle);
  }
  return (await import('./repository.js')).getPublicProviderProfileImage(handle);
}
