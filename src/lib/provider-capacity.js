import {
  addSupabaseProviderRegularCapacity,getSupabaseProviderCapacityWorkspace,
  publishSupabaseProviderCapacity,refreshSupabaseProviderCapacityLocation,
  removeSupabaseProviderRegularCapacity,setSupabaseProviderAssignedVehicleDuty
} from './provider-capacity/supabase.js';

export async function getProviderCapacityWorkspace(user){
  return getSupabaseProviderCapacityWorkspace(user);
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

export async function addProviderRegularCapacity(user,input){
  return addSupabaseProviderRegularCapacity(user,input);
}

export async function removeProviderRegularCapacity(user,id){
  return removeSupabaseProviderRegularCapacity(user,id);
}
