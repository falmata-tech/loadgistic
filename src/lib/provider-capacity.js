function usesManagedData(){
  return process.env.DATA_BACKEND==='supabase';
}

async function managed(){
  return import('./provider-capacity/supabase.js');
}

async function legacy(){
  return import('./repository.js');
}

export async function getProviderCapacityWorkspace(user){
  if(usesManagedData())return (await managed()).getSupabaseProviderCapacityWorkspace(user);
  const repository=await legacy();
  const [vehicles,capacities,corridors,access]=await Promise.all([
    repository.listOwnVehicles(user),repository.listOwnCapacity(user),
    repository.listOwnRecurringCorridors(user),repository.getDriverAccess(user)
  ]);
  return {vehicles,capacities,corridors,access};
}

export async function publishProviderCapacity(user,input,photo=/** @type {any} */(null)){
  if(usesManagedData())return (await managed()).publishSupabaseProviderCapacity(user,input,photo);
  return (await legacy()).publishCapacity(user,input,photo);
}

export async function refreshProviderCapacityLocation(user,input){
  if(usesManagedData())return (await managed()).refreshSupabaseProviderCapacityLocation(user,input);
  return (await legacy()).refreshCapacityLocation(user,input);
}

export async function setProviderAssignedVehicleDuty(user,vehicleId,onDuty,input={}){
  if(usesManagedData())return (await managed()).setSupabaseProviderAssignedVehicleDuty(user,vehicleId,onDuty,input);
  return (await legacy()).setAssignedVehicleDuty(user,vehicleId,onDuty,input);
}

export async function addProviderRegularCapacity(user,input){
  if(usesManagedData())return (await managed()).addSupabaseProviderRegularCapacity(user,input);
  return (await legacy()).addRecurringCorridor(user,input);
}

export async function removeProviderRegularCapacity(user,id){
  if(usesManagedData())return (await managed()).removeSupabaseProviderRegularCapacity(user,id);
  return (await legacy()).removeRecurringCorridor(user,id);
}
