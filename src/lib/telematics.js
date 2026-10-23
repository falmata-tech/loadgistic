import {createSupabaseAdminClient} from './supabase-adapter.js';
import {provisionDeviceSchema,assignDeviceSchema,selectLocationSchema,deviceCommandSchema,validateTelemetry,approximateTelematicsPosition} from './telematics-contract.js';
import {verifyGatewayDevice} from './telematics-gateway-auth.js';
import {DEMO_MOTION_COHORT} from './demo-motion-cohort.js';
import {DEMO_ADMIN_SPARE,isDemoAdminSpare} from './demo-admin-spare.js';
import {getAdminOperationRecord} from './platform-admin/supabase.js';

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
/** Confirm that a server-owned gateway is active and physical before any Traccar write. */
export async function assertPhysicalGatewayAvailable(user,gatewayId){
 if(user.role!=='ADMIN'||!user.active)throw new Error('FORBIDDEN');
 const {data,error}=await createSupabaseAdminClient().from('telematics_gateways')
  .select('id,active,synthetic_only').eq('id',gatewayId).maybeSingle();
 if(error||!data?.active||data.synthetic_only)throw new Error('GATEWAY_REGISTRATION_UNAVAILABLE');
}
export async function assertSyntheticGatewayAvailable(user,gatewayId){
 if(user.role!=='ADMIN'||!user.active)throw new Error('FORBIDDEN');
 const {data,error}=await createSupabaseAdminClient().from('telematics_gateways')
  .select('id,active,synthetic_only').eq('id',gatewayId).maybeSingle();
 if(error||!data?.active||!data.synthetic_only)throw new Error('DEMO_GATEWAY_UNAVAILABLE');
}
function demoFixtureLabel(name){return name==='company-truck'?'Synthetic GPS one':name==='personal-truck'?'Synthetic GPS two':`Synthetic fleet GPS ${name.slice(-2)}`;}
const demoFixtures=()=>[...Object.entries(DEMO_MOTION_COHORT),['admin-spare',DEMO_ADMIN_SPARE]];
/** Admin selector contains only fixture vehicles owned by this exact provider. */
export async function getAdminDemoFixtureChoices(user,ownerId,kind){
 if(user.role!=='ADMIN'||!user.active||!['ORGANIZATION','PROVIDER_PROFILE'].includes(kind))throw new Error('FORBIDDEN');
 const authorized=async()=>{
  const owner=await getAdminOperationRecord(user,'WORKSPACES',ownerId,kind);
  if(!owner||owner.id!==ownerId||owner.record_kind!==kind||kind==='ORGANIZATION'&&owner.type!=='TRANSPORT_COMPANY')throw new Error('NOT_FOUND');
 };
 await authorized();
 const fixtures=demoFixtures(),client=createSupabaseAdminClient();
 const vehicles=await client.from('vehicles').select('id,active,organization_id,provider_profile_id').in('id',fixtures.map(([,row])=>row.vehicleId));
 if(vehicles.error)throw new Error('TELEMATICS_UNAVAILABLE');
 const eligible=fixtures.filter(([,row])=>vehicles.data?.some(vehicle=>vehicle.id===row.vehicleId&&vehicle.active
  &&vehicle.organization_id===(kind==='ORGANIZATION'?ownerId:null)
  &&vehicle.provider_profile_id===(kind==='PROVIDER_PROFILE'?ownerId:null)));
 if(!eligible.length){await authorized();return [];}
 const devices=await client.from('telematics_devices').select('imei').in('imei',eligible.map(([,row])=>row.imei));
 if(devices.error)throw new Error('TELEMATICS_UNAVAILABLE');
 await authorized();
 return eligible.map(([name,row])=>({imei:row.imei,label:name==='admin-spare'?row.label:demoFixtureLabel(name),
  registration:name==='admin-spare'?'CREATE':'READ',linked:Boolean(devices.data?.some(device=>device.imei===row.imei))}));
}
/** A synthetic intake must match a named fictional vehicle and its exact provider. */
export async function assertAdminDemoFixtureBinding(user,command){
 if(user.role!=='ADMIN'||!user.active)throw new Error('FORBIDDEN');
 const fixtureEntry=demoFixtures().find(([,row])=>row.imei===command.imei);
 const fixture=fixtureEntry?.[1];
 if(!fixture||command.synthetic!==true||command.protocol!=='gt06'||command.protocolDeviceId!==fixture.imei)
  throw new Error('DEMO_FIXTURE_UNAVAILABLE');
 const {data,error}=await createSupabaseAdminClient().from('vehicles')
  .select('id,active,organization_id,provider_profile_id').eq('id',fixture.vehicleId).maybeSingle();
 if(error||!data?.active||data.organization_id!==(command.ownerOrganizationId||null)
  ||data.provider_profile_id!==(command.ownerProviderProfileId||null))throw new Error('DEMO_FIXTURE_UNAVAILABLE');
 return {label:fixtureEntry[0]==='admin-spare'?fixture.label:demoFixtureLabel(fixtureEntry[0]),
  registration:fixtureEntry[0]==='admin-spare'?'CREATE':'READ'};
}
/** A lost app response may be retried only when every saved identity and owner field still matches. */
export async function reconcileAdminProvisionedDevice(user,command){
 if(user.role!=='ADMIN'||!user.active)throw new Error('FORBIDDEN');
 const ownerId=command.ownerOrganizationId||command.ownerProviderProfileId;
 const kind=command.ownerOrganizationId?'ORGANIZATION':'PROVIDER_PROFILE';
 const authorized=async()=>{
  const owner=await getAdminOperationRecord(user,'WORKSPACES',ownerId,kind);
  if(!owner||owner.id!==ownerId||owner.record_kind!==kind||kind==='ORGANIZATION'&&owner.type!=='TRANSPORT_COMPANY')throw new Error('NOT_FOUND');
 };
 await authorized();
 const {data,error}=await createSupabaseAdminClient().from('telematics_devices')
  .select('id,revision,organization_id,provider_profile_id,imei,protocol,protocol_device_id,label,synthetic,model_profile,active')
  .eq('gateway_id',command.gatewayId).eq('gateway_device_id',command.gatewayDeviceId).maybeSingle();
 if(error)throw new Error('TELEMATICS_UNAVAILABLE');
 await authorized();
 if(!data)return null;
 if(!data.active||data.organization_id!==(command.ownerOrganizationId||null)||data.provider_profile_id!==(command.ownerProviderProfileId||null)
  ||data.imei!==command.imei||data.protocol!==command.protocol||data.protocol_device_id!==command.protocolDeviceId
  ||data.label!==command.label||data.synthetic!==command.synthetic||data.model_profile!==command.modelProfile)throw new Error('DEVICE_BINDING_CONFLICT');
 return {id:data.id,revision:data.revision,reused:true};
}
/** Server-only admin readback for one independently authorized provider. */
export async function getAdminProviderDevices(user,ownerId,kind,page=1){
 if(user.role!=='ADMIN'||!user.active||!['ORGANIZATION','PROVIDER_PROFILE'].includes(kind)
  ||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId))throw new Error('FORBIDDEN');
 const authorized=async()=>{
  const owner=await getAdminOperationRecord(user,'WORKSPACES',ownerId,kind);
  if(!owner||owner.id!==ownerId||owner.record_kind!==kind||kind==='ORGANIZATION'&&owner.type!=='TRANSPORT_COMPANY')throw new Error('NOT_FOUND');
  return owner;
 };
 const owner=await authorized(),client=createSupabaseAdminClient(),pageNumber=Number.isSafeInteger(page)&&page>0?Math.min(page,100000):1;
 const column=kind==='ORGANIZATION'?'organization_id':'provider_profile_id';
 const {data,error,count}=await client.from('telematics_devices').select('id,label,imei,protocol,synthetic,active,last_seen_at,revision',{count:'exact'})
  .eq(column,ownerId).order('revision',{ascending:false}).order('id').range((pageNumber-1)*20,pageNumber*20-1);
 if(error)throw new Error('TELEMATICS_UNAVAILABLE');
 const deviceIds=(data||[]).map(row=>row.id);
 const assignments=deviceIds.length?await client.from('telematics_device_assignments').select('device_id,vehicle_id')
  .in('device_id',deviceIds).is('ended_at',null):{data:[],error:null};
 if(assignments.error)throw new Error('TELEMATICS_UNAVAILABLE');
 const vehicleIds=[...new Set((assignments.data||[]).map(row=>row.vehicle_id))];
 const vehicles=vehicleIds.length?await client.from('vehicles').select('id,platform_number,make,model')
  .in('id',vehicleIds).eq(column,ownerId):{data:[],error:null};
 if(vehicles.error)throw new Error('TELEMATICS_UNAVAILABLE');
 const vehicleById=new Map((vehicles.data||[]).map(row=>[row.id,[row.platform_number,row.make,row.model].filter(Boolean).join(' · ')]));
 const assignmentByDevice=new Map((assignments.data||[]).map(row=>[row.device_id,vehicleById.get(row.vehicle_id)||null]));
 await authorized();
 return {owner,items:(data||[]).map(row=>({...row,assignedVehicleLabel:assignmentByDevice.get(row.id)||null,label:row.synthetic&&row.imei===DEMO_MOTION_COHORT['company-truck'].imei
  &&row.label==='Synthetic GPS one'?'Demo GPS for Truck 01':row.label})),total:count||0,page:pageNumber,pageCount:Math.max(1,Math.ceil((count||0)/20))};
}
/** Search provider tables before paginating; shippers never consume a result slot. */
export async function searchAdminTransportProviders(user,term,page=1,pageSize=8){
 if(user.role!=='ADMIN'||!user.active)throw new Error('FORBIDDEN');
 const client=createSupabaseAdminClient(),verify=async()=>{
  const {data,error}=await client.from('profiles').select('role,active').eq('id',user.id).maybeSingle();
  if(error||data?.role!=='ADMIN'||!data.active)throw new Error('FORBIDDEN');
 };
 await verify();
 const search=String(term||'').trim().slice(0,80);
 if(!search)return {items:[],pagination:{page:1,pageCount:1,total:0}};
 // Keep the installed Admin read audit and its permission check. The result is
 // discarded because WORKSPACES includes shippers and cannot page providers.
 const audited=await client.rpc('managed_admin_operations_page',{actor_user_id:user.id,
  requested_view:'WORKSPACES',search_text:search,requested_offset:0,requested_limit:1});
 if(audited.error)throw new Error(String(audited.error.message).includes('FORBIDDEN')?'FORBIDDEN':'TELEMATICS_UNAVAILABLE');
 const pattern=`%${search.replace(/[\\%_]/g,'\\$&')}%`;
 const organizations=()=>client.from('organizations').select('id,name').eq('type','TRANSPORT_COMPANY').ilike('name',pattern);
 const profiles=()=>client.from('provider_profiles').select('id,business_name').ilike('business_name',pattern);
 const [orgCount,profileCount]=await Promise.all([
  client.from('organizations').select('id',{count:'exact',head:true}).eq('type','TRANSPORT_COMPANY').ilike('name',pattern),
  client.from('provider_profiles').select('id',{count:'exact',head:true}).ilike('business_name',pattern)
 ]);
 if(orgCount.error||profileCount.error)throw new Error('TELEMATICS_UNAVAILABLE');
 const organizationTotal=orgCount.count||0,total=organizationTotal+(profileCount.count||0);
 const size=Number.isSafeInteger(pageSize)?Math.max(1,Math.min(20,pageSize)):8;
 const pageCount=Math.max(1,Math.ceil(total/size));
 const requested=Number.isSafeInteger(Number(page))?Number(page):1;
 const currentPage=Math.max(1,Math.min(requested,pageCount));
 const offset=(currentPage-1)*size;
 const orgStart=Math.min(offset,organizationTotal),orgTake=Math.max(0,Math.min(size,organizationTotal-orgStart));
 const profileStart=Math.max(0,offset-organizationTotal),profileTake=size-orgTake;
 const [orgRows,profileRows]=await Promise.all([
  orgTake?organizations().order('name').order('id').range(orgStart,orgStart+orgTake-1):Promise.resolve({data:[],error:null}),
  profileTake?profiles().order('business_name').order('id').range(profileStart,profileStart+profileTake-1):Promise.resolve({data:[],error:null})
 ]);
 if(orgRows.error||profileRows.error)throw new Error('TELEMATICS_UNAVAILABLE');
 await verify();
 return {items:[...(orgRows.data||[]).map(row=>({id:row.id,name:row.name,record_kind:'ORGANIZATION',type:'TRANSPORT_COMPANY'})),
   ...(profileRows.data||[]).map(row=>({id:row.id,name:row.business_name,record_kind:'PROVIDER_PROFILE',type:'INDEPENDENT_PROVIDER'}))],
  pagination:{page:currentPage,pageCount,total}};
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
export async function requestDeviceCommand(user,input){
 const command=deviceCommandSchema.parse(input);
 const {data,error}=await createSupabaseAdminClient().from('telematics_devices')
  .select('imei,synthetic').eq('id',command.deviceId).maybeSingle();
 if(error)throw new Error('TELEMATICS_UNAVAILABLE');
 // Match the normal missing-device response before the owner-scoped RPC: the
 // server-only lookup must not become a cross-provider device-ID oracle.
 if(isDemoAdminSpare(data))throw new Error('NOT_FOUND');
 return rpc('request_telematics_command',{actor_user_id:user.id,command});
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
export async function authorizeSyntheticEngineStepUp(user,input){
 const deviceId=typeof input?.deviceId==='string'?input.deviceId:'';
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(deviceId))throw new Error('INVALID_TELEMATICS_INPUT');
 const {data,error}=await createSupabaseAdminClient().from('telematics_devices')
  .select('imei,synthetic').eq('id',deviceId).maybeSingle();
 if(error)throw new Error('TELEMATICS_UNAVAILABLE');
 if(isDemoAdminSpare(data))throw new Error('NOT_FOUND');
 return rpc('authorize_synthetic_engine_command',{actor_user_id:user.id,command:input});
}
