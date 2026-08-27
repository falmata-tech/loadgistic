import {getSupabaseFleetDriverPage,updateSupabaseFleetDriverAccess} from './fleet/supabase.js';

export async function getFleetDriverPage(user,options={}){
  return getSupabaseFleetDriverPage(user,options);
}

export async function updateFleetDriverAccess(user,driverUserId,input){
  return updateSupabaseFleetDriverAccess(user,driverUserId,input);
}
