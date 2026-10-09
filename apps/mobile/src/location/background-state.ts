export type TrackingLease={actorId:string;shipmentId:string;token:string;radius:number;expiresAt:string;absoluteExpiresAt:string;lastAttempt:number};
export function trackingLeases(value:unknown,now=Date.now()):TrackingLease[]{
 if(!Array.isArray(value))return[];
 return value.flatMap(raw=>{
  if(!raw||typeof raw!=='object')return[];const item=raw as Record<string,unknown>;
  if(typeof item.actorId!=='string'||!/^[0-9a-f-]{36}$/i.test(item.actorId)||typeof item.shipmentId!=='string'||!/^[0-9a-f-]{36}$/i.test(item.shipmentId)||typeof item.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(item.token)
   ||typeof item.radius!=='number'||![1,3,5,10,20].includes(item.radius)||typeof item.expiresAt!=='string'||typeof item.absoluteExpiresAt!=='string'
   ||!Number.isFinite(Date.parse(item.expiresAt))||Date.parse(item.expiresAt)<=now||!Number.isFinite(Date.parse(item.absoluteExpiresAt))||Date.parse(item.absoluteExpiresAt)<=now)return[];
  return[{actorId:item.actorId,shipmentId:item.shipmentId,token:item.token,radius:item.radius,expiresAt:item.expiresAt,absoluteExpiresAt:item.absoluteExpiresAt,lastAttempt:typeof item.lastAttempt==='number'&&Number.isFinite(item.lastAttempt)?item.lastAttempt:0}];
 });
}
export function freshBackgroundFix(value:{latitude:number;longitude:number;accuracy:number|null;timestamp:number},now=Date.now()){
 return Number.isFinite(value.latitude)&&Math.abs(value.latitude)<=90&&Number.isFinite(value.longitude)&&Math.abs(value.longitude)<=180
 &&typeof value.accuracy==='number'&&Number.isFinite(value.accuracy)&&value.accuracy>=0&&value.accuracy<=1000
 &&Number.isFinite(value.timestamp)&&value.timestamp>=now-120000&&value.timestamp<=now+30000;
}
export function backgroundLocationDue(lease:TrackingLease,now=Date.now()){return Date.parse(lease.expiresAt)>now&&Date.parse(lease.absoluteExpiresAt)>now&&now-lease.lastAttempt>=600000;}
