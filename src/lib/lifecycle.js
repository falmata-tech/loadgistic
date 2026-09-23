import {z} from 'zod';
import {createSupabaseAdminClient} from './supabase-adapter.js';
import {trackingRecoveryActions} from './domain.js';
const uuid=z.string().uuid();
const reason=z.string().trim().min(5).max(500);
const revision=z.string().datetime({offset:true});
const date=z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/);
const base={reason,revision};
const correction=z.object({...base,action:z.literal('CORRECT'),cargo_summary:z.string().trim().min(3).max(500),
  origin_place_ref:z.string().min(1).max(100),destination_place_ref:z.string().min(1).max(100),
  expected_pickup_date:date,expected_delivery_date:date}).strict();
const reassign=z.object({...base,action:z.literal('REASSIGN'),vehicle_id:z.string().trim().min(1).max(50)}).strict();
const cancel=z.object({...base,action:z.literal('CANCEL'),confirm:z.literal('CANCEL')}).strict();
const input=z.discriminatedUnion('action',[correction,reassign,cancel]);
const allowed=['VEHICLE_OWNER_INACTIVE','NOT_FOUND','FORBIDDEN','INVALID_LIFECYCLE_COMMAND','TRUCK_HAS_ACTIVE_TRACKING','TRACKING_TERMINAL',
  'TRACKING_CHANGED','LIFECYCLE_CONFIRMATION_REQUIRED','INVALID_VEHICLE','DRIVER_REQUIRED_FOR_SHIPMENT',
  'TRACKING_ASSIGNMENT_UNCHANGED','INVALID_CARGO_SUMMARY','INVALID_DELIVERY_DATE','LOCALITY_REQUIRED',
  'ROUTE_LOCATIONS_MUST_DIFFER','TRACKING_ROUTE_LOCKED','INVALID_WORKSPACE_CORRECTION','WORKSPACE_CHANGED'];
async function rpc(name,args){const {data,error}=await createSupabaseAdminClient().rpc(name,args);
  if(error)throw new Error(allowed.includes(error.message)?error.message:'LIFECYCLE_OPERATION_FAILED');return data;}
export function lifecycleCommand(value){
 const result=input.safeParse(value);if(!result.success)throw new Error('INVALID_LIFECYCLE_COMMAND');
 if(result.data.action==='CORRECT'){
  if(result.data.origin_place_ref===result.data.destination_place_ref)throw new Error('ROUTE_LOCATIONS_MUST_DIFFER');
  if(result.data.expected_pickup_date&&result.data.expected_delivery_date&&result.data.expected_delivery_date<result.data.expected_pickup_date)throw new Error('INVALID_DELIVERY_DATE');
 }
 return result.data;
}
export async function getTrackingRecovery(user,id){
 const data=await rpc('tracking_recovery_context',{actor_user_id:user.id,target_shipment_id:uuid.parse(id)});
 return data?{...data,actions:trackingRecoveryActions(data.status)}:null;
}
export async function recoverTracking(user,id,value){return rpc('recover_provider_tracking',{
 actor_user_id:user.id,target_shipment_id:uuid.parse(id),command:lifecycleCommand(value)});}
export async function setVehicleLifecycle(user,id,value){
 const parsed=z.object({active:z.boolean(),reason}).strict().safeParse(value);
 if(!parsed.success)throw new Error('INVALID_LIFECYCLE_COMMAND');
 return rpc('set_vehicle_lifecycle',{actor_user_id:user.id,target_vehicle_id:uuid.parse(id),desired_active:parsed.data.active,reason:parsed.data.reason});
}
export async function retiredVehiclePage(user,page=1){
 const number=Number(page);const current=Number.isSafeInteger(number)&&number>0?number:1;
 const result=await rpc('retired_provider_vehicle_page',{actor_user_id:user.id,requested_offset:(Math.min(current,1000000)-1)*10,requested_limit:10});
 return {...result,page:current,pageCount:Math.max(1,Math.ceil(result.total/10))};
}

export async function adminTrackingLocation(user,id){return rpc('admin_tracking_location',{actor_user_id:user.id,target_shipment_id:uuid.parse(id)});}
export async function correctWorkspace(user,id,value){
 const parsed=z.object({kind:z.enum(['ORGANIZATION','PROVIDER_PROFILE']),name:z.string().trim().min(2).max(120),previous_name:z.string().max(120),reason}).strict().safeParse(value);
 if(!parsed.success)throw new Error('INVALID_WORKSPACE_CORRECTION');
 return rpc('correct_admin_workspace',{actor_user_id:user.id,target_id:uuid.parse(id),command:parsed.data});
}
