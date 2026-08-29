import {listSupabasePendingAccessEmailDeliveries,recordSupabaseAccessEmailDeliveryAttempt} from './repository/supabase.js';

export async function listPendingAccessEmailDeliveries(limit=20){
  return listSupabasePendingAccessEmailDeliveries(limit);
}

export async function recordAccessEmailDeliveryAttempt(id,result={}){
  return recordSupabaseAccessEmailDeliveryAttempt(id,result);
}
