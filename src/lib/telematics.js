import {createSupabaseAdminClient} from './supabase-adapter.js';
import {provisionDeviceSchema,assignDeviceSchema,selectLocationSchema,deviceCommandSchema,validateTelemetry,approximateTelematicsPosition} from './telematics-contract.js';
import {verifyGatewayDevice} from './telematics-gateway-auth.js';

const errors=['FORBIDDEN','NOT_FOUND','TELEMATICS_CHANGED','DEVICE_BINDING_CONFLICT','DEVICE_OWNER_INVALID','GATEWAY_UNAVAILABLE',
 'DEVICE_UNAVAILABLE','DEVICE_NOT_ASSIGNED','DEVICE_COMMAND_UNSUPPORTED','ENGINE_CONTROL_UNAVAILABLE','ENGINE_STEP_UP_REQUIRED',
 'ENGINE_INTERLOCK_DENIED','COMMAND_EXPIRED','COMMAND_CHANGED','COMMAND_RATE_LIMITED','TELEMETRY_TIME_INVALID','TELEMETRY_BINDING_DENIED',
 'TELEMETRY_EVENT_CONFLICT','INVALID_TELEMATICS_INPUT','LOCATION_SOURCE_PENDING','DRIVER_LOCATION_CHOICE_LOCKED'];
async function rpc(name,args){
 const {data,error}=await createSupabaseAdminClient().rpc(name,args);
 if(error)throw new Error(errors.find(code=>String(error.message).includes(code))||'TELEMATICS_UNAVAILABLE');
 return data;
}
/** @param {{id:string}} user @param {{page?:number}} [options] */
export function getTelematicsWorkspace(user,options={}){
 return rpc('telematics_workspace',{actor_user_id:user.id,requested_page:Math.max(1,Math.floor(Number(options.page)||1))});
}
/** Private, driver-or-owner editor. Device identifiers and raw GPS fixes stay out. */
export function getCapacityLocationEditor(user,vehicleId){
 return rpc('capacity_location_editor',{actor_user_id:user.id,target_vehicle_id:vehicleId});
}
/** Admin-only port; PostgreSQL repeats actor, owner and exact binding checks. */
export async function adminProvisionDevice(user,input){
 const command=provisionDeviceSchema.parse(input);await verifyGatewayDevice(command);
 return rpc('provision_telematics_device',{actor_user_id:user.id,command});
}
export function assignOwnedDevice(user,input){
 return rpc('assign_telematics_device',{actor_user_id:user.id,command:assignDeviceSchema.parse(input)});
}
export function selectVehicleLocationSource(user,input){
 const command=selectLocationSchema.parse(input);
 if(command.source==='MANUAL'){
  const approximate=approximateTelematicsPosition(command.manualLatitude,command.manualLongitude,command.precisionKm);
  return rpc('select_telematics_location_source',{actor_user_id:user.id,command:{...command,approximateLatitude:approximate.lat,approximateLongitude:approximate.lng}});
 }
 return rpc('select_telematics_location_source',{actor_user_id:user.id,command});
}
export function requestDeviceCommand(user,input){
 return rpc('request_telematics_command',{actor_user_id:user.id,command:deviceCommandSchema.parse(input)});
}
/** Internal port: gatewayDigest is derived from authenticated gateway credentials, never request JSON. */
export function ingestGatewayPosition(gatewayDigest,input){
 const command=validateTelemetry(input);
 return rpc('ingest_telematics_position',{gateway_digest:gatewayDigest,command});
}
/** Internal worker ports; each claim is scoped to its authenticated gateway. */
export function claimGatewayCommands(gatewayDigest){return rpc('claim_telematics_commands',{gateway_digest:gatewayDigest});}
export function authorizeGatewayRequest(auth){return rpc('authorize_telematics_gateway_request',{gateway_digest:auth.digest,request_nonce:auth.nonce,request_body_digest:auth.bodyDigest,request_issued_at:auth.issuedAt});}
export function pruneGatewayHistory(gatewayDigest){return rpc('prune_telematics_history',{gateway_digest:gatewayDigest});}
export function recordGatewayCommandResult(gatewayDigest,command){return rpc('record_telematics_command_result',{gateway_digest:gatewayDigest,command});}
/** The owner identity must have been freshly verified by the existing Auth adapter. */
export function authorizeSyntheticEngineStepUp(user,input){
 return rpc('authorize_synthetic_engine_command',{actor_user_id:user.id,command:input});
}
