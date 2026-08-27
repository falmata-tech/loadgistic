import {
  grantSupabasePrivateCapacityAccess,
  listSupabaseLoadgisticSharedCapacity,
  listSupabasePrivateCapacityNetwork,
  listSupabaseSharedCapacity,
  requestSupabaseSharedCapacityOtp,
  revokeSupabasePrivateCapacityAccess,
  setSupabaseLoadgisticCapacityAccess,
  verifySupabaseSharedCapacityAccess
} from './repository/supabase.js';

export const listPrivateCapacityNetwork=listSupabasePrivateCapacityNetwork;
export const grantPrivateCapacityAccess=grantSupabasePrivateCapacityAccess;
export const setLoadgisticCapacityAccess=setSupabaseLoadgisticCapacityAccess;
export const revokePrivateCapacityAccess=revokeSupabasePrivateCapacityAccess;
export const requestSharedCapacityOtp=requestSupabaseSharedCapacityOtp;
export const verifySharedCapacityAccess=verifySupabaseSharedCapacityAccess;

export function listSharedCapacity(emailDigest,filters={}){
  return listSupabaseSharedCapacity(emailDigest,filters,{pageSize:100,cursor:filters.cursor});
}

export function listLoadgisticSharedCapacity(user,filters={}){
  return listSupabaseLoadgisticSharedCapacity(user,filters,{pageSize:100,cursor:filters.cursor});
}
