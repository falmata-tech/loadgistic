import {createHash,randomBytes} from 'node:crypto';
import {z} from 'zod';
import {createSupabaseAdminClient} from '@/lib/supabase-adapter.js';
import {MobileError} from './server';
export const deviceLeaseCommand=z.object({shipmentId:z.string().uuid(),deviceId:z.string().uuid(),radius:z.number().refine(value=>[1,3,5,10,20].includes(value))}).strict();
export const deviceLocationCommand=z.object({latitude:z.number().finite().min(-90).max(90),longitude:z.number().finite().min(-180).max(180),radius:z.number().refine(value=>[1,3,5,10,20].includes(value)),observedAt:z.number().int().nonnegative().max(8640000000000000)}).strict();
export function trackingDeviceDigest(token:string){return createHash('sha256').update(token).digest('hex');}
export function trackingDeviceToken(header:string|null){const token=header?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];if(!token)throw new MobileError(401,'DEVICE_UNAVAILABLE','Open the app to restore shipment location reporting.');return token;}
export async function deviceRpc(name:string,args:Record<string,unknown>):Promise<unknown>{
 const {data,error}=await createSupabaseAdminClient().rpc(name,args);
 if(error){const message=String(error.message||'');
  if(/NOT_FOUND|TRACKING_DEVICE_UNAVAILABLE|ASSIGNED_DRIVER_LOCATION_REQUIRED|TRACKING_LOCATION_NOT_ENABLED/.test(message))throw new MobileError(401,'DEVICE_UNAVAILABLE','Open the app to restore shipment location reporting.');
  if(/INVALID_TRACKING_DEVICE/.test(message))throw new MobileError(400,'INVALID_INPUT','A recent approximate location is required.');
  throw new MobileError(503,'LOCATION_UNAVAILABLE','Location reporting could not be confirmed.');
 }return data;
}
export async function issueDeviceLease(actorId:string,input:z.infer<typeof deviceLeaseCommand>){
 const token=Buffer.from(randomBytes(32)).toString('base64url');
 const data=await deviceRpc('issue_tracking_device_lease',{actor_user_id:actorId,target_shipment_id:input.shipmentId,target_device_id:input.deviceId,capability_digest:trackingDeviceDigest(token),privacy_radius:input.radius});
 const parsed=z.object({shipmentId:z.string().uuid(),radius:z.number().refine(value=>[1,3,5,10,20].includes(value)),expiresAt:z.string().datetime({offset:true}),absoluteExpiresAt:z.string().datetime({offset:true})}).strip().safeParse(data);
 if(!parsed.success)throw new MobileError(503,'LOCATION_UNAVAILABLE','Location reporting could not be confirmed.');
 return {...parsed.data,token};
}
