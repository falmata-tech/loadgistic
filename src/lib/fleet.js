import {getSupabaseFleetDriverPage,updateSupabaseFleetDriverAccess} from './fleet/supabase.js';
import {getSupabaseFleetDriver} from './fleet/driver-detail-supabase.js';
import {createSupabaseProviderVehicle,setSupabaseProviderVehicleAttachedTrailer,updateSupabaseProviderVehicleDetails} from './fleet/vehicles-supabase.js';
import {TRUCK_USE_BASES} from './independent-driver.js';

export function canManageProviderFleet(user){
  if(!user||user.active===false)return false;
  // These capabilities are projected by the caller-bound identity RPC. The
  // fallback supports the unchanged local preview until migration rollout;
  // employer links never establish owner authority in either representation.
  const ownerAnchor=user.role==='TRANSPORTER'&&Boolean(user.organization_id)
    ||user.role==='DRIVER'&&user.driver_kind!=='COMPANY'&&Boolean(user.provider_profile_id);
  if(typeof user.can_manage_fleet==='boolean')return ownerAnchor&&user.can_manage_fleet&&user.owns_provider_account===true;
  return ownerAnchor;
}
export const canManageProviderVehicles=canManageProviderFleet;

export async function getFleetDriverPage(user,options={}){
  if(!canManageProviderFleet(user))throw new Error('FORBIDDEN');
  return getSupabaseFleetDriverPage(user,options);
}

export async function getFleetDriver(user,driverId){
  if(!canManageProviderFleet(user))throw new Error('FORBIDDEN');
  return getSupabaseFleetDriver(user,driverId);
}

export async function updateFleetDriverAccess(user,driverUserId,input){
  if(!canManageProviderFleet(user))throw new Error('FORBIDDEN');
  return updateSupabaseFleetDriverAccess(user,driverUserId,input);
}

export async function createProviderVehicle(user,input){
  if(!canManageProviderVehicles(user))throw new Error('FORBIDDEN');
  if(!TRUCK_USE_BASES.includes(input.useBasis))throw new Error('INVALID_VEHICLE_USE_BASIS');
  if(input.replaceVehicleId)throw new Error('TRUCK_CHANGE_REQUIRED');
  return createSupabaseProviderVehicle(user,input);
}

export async function updateProviderVehicleDetails(user,vehicleId,input){
  if(!canManageProviderVehicles(user))throw new Error('FORBIDDEN');
  if(!TRUCK_USE_BASES.includes(input.useBasis))throw new Error('INVALID_VEHICLE_USE_BASIS');
  return updateSupabaseProviderVehicleDetails(user,vehicleId,input);
}

export async function setProviderVehicleAttachedTrailer(user,vehicleId,cargoConfiguration){
  if(!canManageProviderVehicles(user))throw new Error('FORBIDDEN');
  return setSupabaseProviderVehicleAttachedTrailer(user,vehicleId,cargoConfiguration);
}
