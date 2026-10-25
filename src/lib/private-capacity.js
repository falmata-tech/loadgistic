import {
  grantSupabasePrivateCapacityAccess,
  listSupabaseAccountCapacity,
  nameSupabasePrivateCapacityContact,
  listSupabaseLoadgisticSharedCapacity,
  listSupabasePrivateCapacityNetwork,
  revokeSupabasePrivateCapacityAccess,
  setSupabaseLoadgisticCapacityAccess,
} from './repository/supabase.js';
import {privateContactDigest} from './security.js';

export const listPrivateCapacityNetwork=listSupabasePrivateCapacityNetwork;
export const grantPrivateCapacityAccess=grantSupabasePrivateCapacityAccess;
export const namePrivateCapacityContact=nameSupabasePrivateCapacityContact;
export const setLoadgisticCapacityAccess=setSupabaseLoadgisticCapacityAccess;
export const revokePrivateCapacityAccess=revokeSupabasePrivateCapacityAccess;

export function listAccountCapacity(user,filters={}){
  if(!user?.id||!user?.email||!user?.active)throw new Error('ACCOUNT_CAPACITY_FORBIDDEN');
  return listSupabaseAccountCapacity(user.id,privateContactDigest(user.email),filters,{pageSize:100,cursor:filters.cursor});
}

export function listLoadgisticSharedCapacity(user,filters={}){
  return listSupabaseLoadgisticSharedCapacity(user,filters,{pageSize:100,cursor:filters.cursor});
}
