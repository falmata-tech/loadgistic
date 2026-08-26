function usesManagedData(){
  return process.env.DATA_BACKEND==='supabase';
}

export async function listPendingAccessEmailDeliveries(limit=20){
  if(usesManagedData()){
    const adapter=await import('./repository/supabase.js');
    return adapter.listSupabasePendingAccessEmailDeliveries(limit);
  }
  return (await import('./repository.js')).listPendingAccessEmailDeliveries(limit);
}

export async function recordAccessEmailDeliveryAttempt(id,result={}){
  if(usesManagedData()){
    const adapter=await import('./repository/supabase.js');
    return adapter.recordSupabaseAccessEmailDeliveryAttempt(id,result);
  }
  return (await import('./repository.js')).recordAccessEmailDeliveryAttempt(id,result);
}
