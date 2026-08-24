export async function getDailyFeaturedProviders(date){
  if(process.env.DATA_BACKEND==='supabase'){
    const {getSupabaseDailyFeaturedProviders}=await import('./repository/supabase.js');
    return getSupabaseDailyFeaturedProviders(date);
  }
  return (await import('./repository.js')).getDailyFeaturedProviders(date);
}
