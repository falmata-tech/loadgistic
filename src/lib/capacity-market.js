export async function listPublicCapacityCursor(filters={},options={}){
  if(process.env.DATA_BACKEND==='supabase'){
    const {listSupabasePublicCapacityCursor}=await import('./repository/supabase.js');
    return listSupabasePublicCapacityCursor(filters,options);
  }
  const repository=await import('./repository.js');
  return repository.listPublicCapacityCursor(filters,options);
}
