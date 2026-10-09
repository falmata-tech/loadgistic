// Account identity describes who works; ownership belongs to the current truck.
export const INDEPENDENT_DRIVER_MODEL='SELF_MANAGED_DRIVER';
export const TRUCK_USE_BASES=Object.freeze(['OWNED','PERMISSION']);
export function independentOperatingModel(model){
  return ['OWNER_OPERATOR','SELF_MANAGED_DRIVER'].includes(model)?INDEPENDENT_DRIVER_MODEL:model;
}
export function isIndependentDriver(user){
  return user?.role==='DRIVER'&&Boolean(user.provider_profile_id)&&user.driver_kind!=='COMPANY';
}
export function truckUseBasisLabel(basis){
  return basis==='OWNED'?'I own this truck':basis==='PERMISSION'?"I rent it or have the owner's permission":'Choose how you use this truck';
}
