import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import {obscureCoordinate} from '../../../../src/lib/location-privacy';
import {apiOrigin} from '../api/http';
import {backgroundLocationDue,freshBackgroundFix,trackingLeases,type TrackingLease} from './background-state';
export const taskName='loadgistic.shipment-location.v1';
const leaseKey='loadgistic.shipment.location.leases.v1',deviceKey='loadgistic.shipment.location.device.v1';
let storageFlight:Promise<unknown>=Promise.resolve();
let epoch=0;
function serial<T>(work:()=>Promise<T>):Promise<T>{const next=storageFlight.then(work,work);storageFlight=next.catch(()=>undefined);return next;}
const write=(leases:TrackingLease[])=>SecureStore.setItemAsync(leaseKey,JSON.stringify(leases),{keychainAccessible:SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY});
export const readTrackingLeases=()=>serial(async()=>{const raw=await SecureStore.getItemAsync(leaseKey);try{return trackingLeases(raw?JSON.parse(raw):[]);}catch{return[];}});
export function replaceTrackingLeases(leases:TrackingLease[]){epoch++;return serial(()=>write(leases));}
export async function deviceTrackingId(){return serial(async()=>{const saved=await SecureStore.getItemAsync(deviceKey);if(saved)return saved;const {randomUUID}=await import('expo-crypto');const id=randomUUID();await SecureStore.setItemAsync(deviceKey,id,{keychainAccessible:SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY});return id;});}
async function send(token:string,body:unknown){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{
 const response=await fetch(`${apiOrigin}/api/mobile/tracking-device`,{method:'POST',credentials:'omit',redirect:'error',signal:controller.signal,headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
 const data:unknown=response.ok?await response.json():null;
 return {status:response.status,ok:response.ok,data};
 }finally{clearTimeout(timer);}}
export async function revokeTrackingLease(lease:TrackingLease){await send(lease.token,{action:'STOP'}).catch(()=>undefined);}
export async function stopBackgroundTracking(){epoch++;
 if(await Location.hasStartedLocationUpdatesAsync(taskName))await Location.stopLocationUpdatesAsync(taskName);
 const leases=await readTrackingLeases();
 try{await replaceTrackingLeases([]);}finally{await Promise.all(leases.map(revokeTrackingLease));}
}
export async function startBackgroundTracking(copy:{title:string;body:string}){
 if(!await TaskManager.isAvailableAsync())throw Error('Background location is unavailable in this app build.');
 if(!await Location.hasStartedLocationUpdatesAsync(taskName))await Location.startLocationUpdatesAsync(taskName,{accuracy:Location.Accuracy.Balanced,timeInterval:600000,distanceInterval:0,deferredUpdatesInterval:600000,pausesUpdatesAutomatically:false,showsBackgroundLocationIndicator:true,foregroundService:{notificationTitle:copy.title,notificationBody:copy.body,notificationColor:'#0c7275',killServiceOnDestroy:false}});
}
// Imported from the application entry, so Android/iOS can run without mounting a screen.
TaskManager.defineTask<{locations:Location.LocationObject[]}>(taskName,async({data,error})=>{
 if(error||!Array.isArray(data?.locations))return;
 const fix=[...data.locations].sort((a,b)=>b.timestamp-a.timestamp)[0];if(!fix||!freshBackgroundFix({...fix.coords,timestamp:fix.timestamp}))return;
 const version=epoch,leases=await readTrackingLeases();
 if(!leases.length){if(await Location.hasStartedLocationUpdatesAsync(taskName))await Location.stopLocationUpdatesAsync(taskName);return;}
 const next:TrackingLease[]=[];
 for(const lease of leases){if(version!==epoch)return;if(!backgroundLocationDue(lease)){next.push(lease);continue;}
  const now=Date.now(),point=obscureCoordinate(fix.coords.latitude,fix.coords.longitude,lease.radius);
  try{const response=await send(lease.token,{latitude:point.lat,longitude:point.lng,radius:lease.radius,observedAt:fix.timestamp});
   if([401,403,404].includes(response.status))continue;
   const result=response.ok&&response.data&&typeof response.data==='object'&&'recorded' in response.data&&typeof response.data.recorded==='boolean'?response.data:null;
   next.push({...lease,lastAttempt:now,expiresAt:result?new Date(Math.min(now+86400000,Date.parse(lease.absoluteExpiresAt))).toISOString():lease.expiresAt});
  }catch{next.push({...lease,lastAttempt:now});}
 }
 if(version===epoch)await serial(async()=>{if(version===epoch)await write(next);});
 if(!next.length&&version===epoch&&await Location.hasStartedLocationUpdatesAsync(taskName))await Location.stopLocationUpdatesAsync(taskName);
});
