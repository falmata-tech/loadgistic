import {getSupabaseFleetDriverPage,updateSupabaseFleetDriverAccess} from './fleet/supabase.js';
import {createSupabaseProviderVehicle} from './fleet/vehicles-supabase.js';

export function canManageProviderVehicles(user){
  return user?.role==='TRANSPORTER'||user?.role==='DRIVER'&&user?.driver_kind!=='COMPANY'&&Boolean(user?.provider_profile_id);
}

export async function getFleetDriverPage(user,options={}){
  return getSupabaseFleetDriverPage(user,options);
}

export async function updateFleetDriverAccess(user,driverUserId,input){
  return updateSupabaseFleetDriverAccess(user,driverUserId,input);
}

export async function createProviderVehicle(user,input){
  if(!canManageProviderVehicles(user))throw new Error('FORBIDDEN');
  return createSupabaseProviderVehicle(user,input);
}
