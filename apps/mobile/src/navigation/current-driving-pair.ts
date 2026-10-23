// The authorized workspace response carries current assignments. Sign-in truck
// IDs are snapshots and must not override a later owner/employee reassignment.
export function currentDrivingTruck<T extends {id:string;driverId:string}>(vehicles:readonly T[]|null|undefined,actorId:string|undefined):T|undefined{
 if(!actorId)return undefined;
 const current=vehicles?.filter(truck=>truck.driverId===actorId)||[];
 return current.length===1?current[0]:undefined;
}

// Remount an editor only when the server returns changed persisted fields.
// A reload retains old data while pending; a local counter would reset the
// user's just-saved selection to that old response before the new read arrives.
export function fleetDriverEditorKey(driver:{id:string;vehicleId:string;canManageCapacity:boolean;canManageTracking:boolean;name:string;phone:string;email:string}):string{
 return JSON.stringify([driver.id,driver.vehicleId,driver.canManageCapacity,driver.canManageTracking,driver.name,driver.phone,driver.email]);
}
