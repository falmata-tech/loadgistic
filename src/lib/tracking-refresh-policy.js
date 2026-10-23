export const TRACKING_REFRESH_INTERVAL_MS=60_000;
export function trackingShipmentActiveStatus(status){
 return ['CREATED','TO_PICKUP','LOADING','IN_TRANSIT','UNLOADING','ISSUE'].includes(status);
}
export function trackingRefreshAllowed({active,visible,expiresAt,now}){
 return active===true&&visible===true&&Number.isFinite(expiresAt)&&now<expiresAt;
}
export function trackingRefreshDelay(failures=0){
 return Math.min(240_000,TRACKING_REFRESH_INTERVAL_MS*2**Math.max(0,Math.min(2,failures)));
}
