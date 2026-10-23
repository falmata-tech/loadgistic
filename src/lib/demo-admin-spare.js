// Admin-selectable fictional spare. Deliberately absent from demo motion targets.
export const DEMO_ADMIN_SPARE=Object.freeze({
 vehicleId:'76bea7fa-03b2-42f0-af51-fff05c62cbc7',
 imei:'990000000000013',
 label:'Demo GPS for Truck 02',
 model:'Loadgistic synthetic GT06'
});
export function isDemoAdminSpare(device){
 return device?.synthetic===true&&device.imei===DEMO_ADMIN_SPARE.imei;
}
// A tracker may be reassigned, so its display name cannot imply a fixed truck.
export function gpsDeviceDisplayLabel(device){
 return isDemoAdminSpare(device)?'Demo GPS 02':device.label;
}
