export const INDEPENDENT_DRIVER_MODEL:'SELF_MANAGED_DRIVER';
export const TRUCK_USE_BASES:readonly ('OWNED'|'PERMISSION')[];
export function independentOperatingModel(model:string|null|undefined):string|null|undefined;
export function isIndependentDriver(user:{role?:string;provider_profile_id?:string|null;driver_kind?:string|null}|null|undefined):boolean;
export function truckUseBasisLabel(basis:unknown):string;
