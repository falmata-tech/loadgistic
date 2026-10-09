import {approximateLocationArea} from './approximate-location-area.js';
import {browserRequest} from './browser-request';
import { obscureCoordinate,isValidCoordinate } from './location-privacy.js';

export type DriverLocation={lat:number;lng:number;radius:number;area:string;updatedAt:string};

// Only the obscured point leaves the geolocation callback, even for a draft.
export function readDriverLocation(radius:number):Promise<DriverLocation>{
  return new Promise((resolve,reject)=>{
    if(!window.isSecureContext||!navigator.geolocation){reject(new Error('Use a secure browser with location access to update this truck.'));return;}
    navigator.geolocation.getCurrentPosition(position=>{
      if(!isValidCoordinate(position.coords.latitude,position.coords.longitude)){reject(new Error('Your device returned an invalid location. Try again.'));return;}
      const point=obscureCoordinate(position.coords.latitude,position.coords.longitude,radius);
      resolve({...point,radius,area:approximateLocationArea(point.lat,point.lng),updatedAt:new Date().toISOString()});
    },error=>reject(new Error(error.code===error.PERMISSION_DENIED?'Allow location for Loadgistic in your browser, then try again.':'The device could not provide a location. Please try again.')),{enableHighAccuracy:true,timeout:20000,maximumAge:0});
  });
}

export async function saveDriverLocation(vehicleId:string,location:DriverLocation):Promise<DriverLocation>{
  const {response,data:result}=await capacityRequest<Record<string,unknown>>('/api/capacity/location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vehicleId,approximateLat:location.lat,approximateLng:location.lng,locationPrecisionKm:location.radius})});
  if(!response.ok)throw new Error(String(result.error||'Truck location could not be saved.'));
  return {lat:Number(result.approximateLat),lng:Number(result.approximateLng),radius:Number(result.locationPrecisionKm),area:String(result.locationArea),updatedAt:String(result.locationUpdatedAt)};
}

export async function submitCapacityForm(form:HTMLFormElement){
  // A hidden input named "action" shadows HTMLFormElement.action.
  const endpoint=form.getAttribute('action');
  if(!endpoint)throw new Error('This editor cannot save right now. Please reload it.');
  const {response,data:result}=await capacityRequest<{ok?:boolean;error?:string}>(endpoint,{method:'POST',headers:{Accept:'application/json'},body:new FormData(form)});
  if(!response.ok||!result.ok)throw new Error(result.error||'Changes could not be saved. Please try again.');
}

async function capacityRequest<T>(url:string,init:RequestInit){
  try{return await browserRequest<T>(url,init);}
  catch(error){
    if(error instanceof Error&&error.message==='REQUEST_TIMEOUT')throw new Error('Saving took too long. Refresh to check whether it saved before trying again.');
    if(error instanceof SyntaxError)throw new Error('Your session may have expired. Sign in again, then retry.');
    throw new Error('Connection lost. Refresh to check whether it saved before trying again.');
  }
}
