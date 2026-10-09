import {z} from 'zod';
import {deviceLocationCommand,deviceRpc,trackingDeviceDigest,trackingDeviceToken} from '@/lib/mobile/tracking-device-server';
import {mobileBody,mobileFailure,mobileJson,MobileError} from '@/lib/mobile/server';
import {approximateLocationArea} from '@/lib/approximate-location-area.js';
export const runtime='nodejs';
export async function POST(request:Request){try{const digest=trackingDeviceDigest(trackingDeviceToken(request.headers.get('authorization'))),body=await mobileBody(request);
 if(body.action==='STOP'&&Object.keys(body).length===1){await deviceRpc('revoke_tracking_device_lease',{capability_digest:digest});return mobileJson({ok:true});}
 const parsed=deviceLocationCommand.safeParse(body);if(!parsed.success)throw new MobileError(400,'INVALID_INPUT','A recent approximate location is required.');const input=parsed.data;
 const result=await deviceRpc('report_tracking_device_location',{capability_digest:digest,command:{lat:input.latitude,lng:input.longitude,precision_km:input.radius,observed_at:new Date(input.observedAt).toISOString(),area:approximateLocationArea(input.latitude,input.longitude),source:'DEVICE_OBSCURED'}});
 const response=z.union([z.object({recorded:z.literal(true)}).strip(),z.object({recorded:z.literal(false),reason:z.literal('THROTTLED')}).strip()]).safeParse(result);
 if(!response.success)throw new MobileError(503,'LOCATION_UNAVAILABLE','Location reporting could not be confirmed.');return mobileJson(response.data);
 }catch(error){return mobileFailure(error);}}
