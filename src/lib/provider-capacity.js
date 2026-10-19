import {
  addSupabaseProviderRegularCapacity,getSupabaseProviderCapacityWorkspace,
  publishSupabaseProviderCapacity,refreshSupabaseProviderCapacityLocation,
  removeSupabaseProviderRegularCapacity,setSupabaseProviderAssignedVehicleDuty
} from './provider-capacity/supabase.js';

/** @typedef {{vehicleId:string,expectedDriverId:string}} RegularCapacityScope */

export async function getProviderCapacityWorkspace(user){
  return getSupabaseProviderCapacityWorkspace(user);
}

/** Read only the caller-authorized selected truck's expected current pair. */
export async function getProviderRegularCapacity(user,/** @type {RegularCapacityScope} */ scope){
  const workspace=await getSupabaseProviderCapacityWorkspace(user);
  const vehicle=workspace.vehicles.find(vehicle=>vehicle.id===scope.vehicleId);
  if(!vehicle)throw new Error('NOT_FOUND');
  if(!scope.expectedDriverId||vehicle.assigned_driver?.id!==scope.expectedDriverId)throw new Error('TRUCK_DRIVER_CHANGED');
  return {corridors:workspace.corridors.filter(signal=>signal.vehicle_id===scope.vehicleId&&signal.driver_user_id===scope.expectedDriverId).slice(0,1)};
}

export async function publishProviderCapacity(user,input,photo=/** @type {any} */(null)){
  return publishSupabaseProviderCapacity(user,input,photo);
}

export async function refreshProviderCapacityLocation(user,input){
  return refreshSupabaseProviderCapacityLocation(user,input);
}

export async function setProviderAssignedVehicleDuty(user,vehicleId,onDuty,input={}){
  return setSupabaseProviderAssignedVehicleDuty(user,vehicleId,onDuty,input);
}

export async function addProviderRegularCapacity(user,input,replaceId=/** @type {string|null} */(null)){
  return addSupabaseProviderRegularCapacity(user,input,replaceId);
}

export async function removeProviderRegularCapacity(user,id,/** @type {RegularCapacityScope} */ scope){
  return removeSupabaseProviderRegularCapacity(user,id,scope);
}
