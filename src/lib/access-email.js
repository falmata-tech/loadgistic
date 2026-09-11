import {
  claimSupabaseAccessEmailDelivery,
  isSupabaseAccessEmailDeliveryDeliverable,
  listSupabasePendingAccessEmailDeliveries,
  purgeSupabaseSharedCapacityAccess,
  recordSupabaseAccessEmailDeliveryAttempt
} from './repository/supabase.js';

export async function listPendingAccessEmailDeliveries(limit=20){
  return listSupabasePendingAccessEmailDeliveries(limit);
}

export async function claimAccessEmailDelivery(kind,entityId){
  return claimSupabaseAccessEmailDelivery(kind,entityId);
}

export async function recordAccessEmailDeliveryAttempt(id,result={}){
  return recordSupabaseAccessEmailDeliveryAttempt(id,result);
}

export async function accessEmailDeliveryIsDeliverable(id,leaseToken){
  return isSupabaseAccessEmailDeliveryDeliverable(id,leaseToken);
}

export async function purgeExpiredSharedCapacityAccess(limit=100){
  return purgeSupabaseSharedCapacityAccess(limit);
}
