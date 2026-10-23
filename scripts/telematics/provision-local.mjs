import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {assertLocalAuthorityFixtureTarget} from '../fixture-provider-authority.mjs';
import {assertDemoDevice,assertLoopback,assertDemoIdentity} from './demo-manifest.mjs';
import {DEMO_MOTION_COHORT,DEMO_MOTION_FLEET_TARGETS} from '../../src/lib/demo-motion-cohort.js';
import {verifyGatewayDevice,gatewayTokenDigest} from '../../src/lib/telematics-gateway-auth.js';
if(process.argv.slice(2).some(value=>value!=='--preflight'))throw new Error('LOCAL_TELEMATICS_ARGUMENT_REFUSED');
const root=path.resolve(import.meta.dirname,'../..'),directory=path.join(root,'.local/telematics');
const managed=JSON.parse(await readFile(path.join(root,'resources/fixtures/managed-market.json'),'utf8'));
if(managed.fixture_source!=='loadgistic'||managed.schema_version!==1)throw new Error('LOCAL_TELEMATICS_FIXTURE_INVALID');
const targetRows=[{imei:'990000000000001',owner:'user-transporter',vehicle:'veh-trans-1'},
 {imei:'990000000000002',owner:'user-driver',vehicle:'veh-driver-1'},
 ...(process.env.LOADGISTIC_DEMO_GPS_COHORT==='true'?DEMO_MOTION_FLEET_TARGETS.map(name=>{
  const row=DEMO_MOTION_COHORT[name];return {imei:row.imei,owner:row.ownerFixtureKey,driver:row.driverFixtureKey,vehicle:row.vehicleFixtureKey};
 }):[])];
function fixtureUuid(value){if(value==null||value==='')return null;const bytes=createHash('sha256').update(`loadgistic-fixture:${value}`).digest().subarray(0,16);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=bytes.toString('hex');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}
function preparedTarget(row,owner,vehicle,command){return {owner,vehicle,command,driverFixtureKey:row.driver||null};}
function sourceSelectionPlan(target,selection){
 if(target.driverFixtureKey&&selection?.source==='MANUAL')throw new Error('LOCAL_TELEMATICS_MANUAL_SOURCE_REFUSED');
 if(selection&&(!target.driverFixtureKey||selection.source==='GPS'))return null;
 return {actor_user_id:target.owner.id,command:{vehicleId:target.vehicle.id,source:'GPS',
  precisionKm:selection?.precision_km||20,expectedRevision:selection?.revision||'1970-01-01T00:00:00Z'}};
}
if(process.argv.includes('--preflight')){
 for(const row of targetRows){
  const demo=assertDemoDevice(row.imei),vehicle=managed.tables.vehicles.find(item=>item.id===row.vehicle);
  if(!vehicle||!managed.tables.users.some(item=>item.id===row.owner))throw new Error('LOCAL_TELEMATICS_TARGET_MISSING');
  if(row.driver&&!managed.tables.driver_vehicle_assignments.some(item=>item.vehicle_id===row.vehicle&&item.driver_user_id===row.driver&&item.active))
   throw new Error('LOCAL_TELEMATICS_DRIVER_CHANGED');
  const target=preparedTarget(row,{id:fixtureUuid(row.owner)},{id:fixtureUuid(row.vehicle)}, {imei:demo.imei});
  const plan=sourceSelectionPlan(target,null);
  if(plan?.command?.vehicleId!==target.vehicle.id||plan.command.source!=='GPS')throw new Error('LOCAL_TELEMATICS_PREFLIGHT_INVALID');
 }
 console.log(JSON.stringify({event:'local_telematics_preflight',targetCount:targetRows.length,wrote:false,network:false}));
 process.exit(0);
}
const url=assertLocalAuthorityFixtureTarget(process.env.SUPABASE_SEED_URL),key=process.env.SUPABASE_SEED_SERVICE_ROLE_KEY;
if(!key)throw new Error('LOCAL_TELEMATICS_CONFIG_MISSING');
const gatewayManifest=JSON.parse(await readFile(path.join(directory,'gateway-devices.json'),'utf8'));
const configurations=JSON.parse(await readFile(path.join(directory,'application-env.json'),'utf8'));
const gateway=configurations.find(row=>row.id===gatewayManifest.gatewayId);if(!gateway)throw new Error('LOCAL_TELEMATICS_GATEWAY_MISSING');assertLoopback(gateway.apiUrl);
const service=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
async function checked(result,code){const {data,error}=await result;if(error)throw new Error(code);return data;}
async function rpc(name,args){return checked(service.rpc(name,args),`LOCAL_TELEMATICS_RPC_FAILED_${name}`);}
const auth=await checked(service.auth.admin.listUsers({page:1,perPage:1000}),'LOCAL_TELEMATICS_IDENTITIES_UNAVAILABLE');
function identity(fixtureId){const source=managed.tables.users.find(row=>row.id===fixtureId),matches=auth.users.filter(user=>user.app_metadata?.fixture_source==='loadgistic'&&user.user_metadata?.fixture_key===fixtureId);
 if(!source||matches.length!==1)throw new Error('LOCAL_TELEMATICS_OWNER_REFUSED');return assertDemoIdentity(matches[0],fixtureId);}
const administrator=identity('user-admin'),adminProfile=await checked(service.from('profiles').select('role,active').eq('id',administrator.id).single(),'LOCAL_TELEMATICS_ADMIN_MISSING');
if(adminProfile.role!=='ADMIN'||!adminProfile.active)throw new Error('LOCAL_TELEMATICS_ADMIN_REFUSED');
// Validate every target before making the first application write.
const targets=[];
for(const row of targetRows){
 const demo=assertDemoDevice(row.imei),binding=gatewayManifest.devices.find(device=>device.imei===row.imei),owner=identity(row.owner);
 const fixtureVehicle=managed.tables.vehicles.find(vehicle=>vehicle.id===row.vehicle);if(!fixtureVehicle||!binding)throw new Error('LOCAL_TELEMATICS_TARGET_MISSING');
 const vehicle=await checked(service.from('vehicles').select('id,organization_id,provider_profile_id,active').eq('id',fixtureUuid(row.vehicle)).single(),'LOCAL_TELEMATICS_VEHICLE_MISSING');
 if(!vehicle.active||vehicle.organization_id!==fixtureUuid(fixtureVehicle.organization_id)||vehicle.provider_profile_id!==fixtureUuid(fixtureVehicle.provider_profile_id))throw new Error('LOCAL_TELEMATICS_VEHICLE_REFUSED');
 const ownerProfile=await checked(service.from('profiles').select('role,active').eq('id',owner.id).single(),'LOCAL_TELEMATICS_OWNER_MISSING');
 if(!ownerProfile.active)throw new Error('LOCAL_TELEMATICS_OWNER_REFUSED');
 if(vehicle.organization_id){
  const member=await checked(service.from('organization_members').select('membership_role').eq('user_id',owner.id).eq('organization_id',vehicle.organization_id).single(),'LOCAL_TELEMATICS_OWNER_REFUSED');
  if(ownerProfile.role!=='TRANSPORTER'||member.membership_role!=='OWNER')throw new Error('LOCAL_TELEMATICS_OWNER_REFUSED');
 }else{const provider=await checked(service.from('provider_profiles').select('user_id').eq('id',vehicle.provider_profile_id).single(),'LOCAL_TELEMATICS_OWNER_REFUSED');
  if(ownerProfile.role!=='DRIVER'||provider.user_id!==owner.id)throw new Error('LOCAL_TELEMATICS_OWNER_REFUSED');}
 if(row.driver){
  const driver=identity(row.driver),assignments=await checked(service.from('driver_vehicle_assignments').select('driver_user_id').eq('vehicle_id',vehicle.id).eq('active',true),'LOCAL_TELEMATICS_DRIVER_READ_FAILED');
  if(assignments.length!==1||assignments[0].driver_user_id!==driver.id)throw new Error('LOCAL_TELEMATICS_DRIVER_CHANGED');
 }
 const command={gatewayId:gateway.id,gatewayDeviceId:binding.gatewayDeviceId,imei:demo.imei,protocol:demo.protocol,protocolDeviceId:demo.protocolDeviceId,
  ...(vehicle.organization_id?{ownerOrganizationId:vehicle.organization_id}:{ownerProviderProfileId:vehicle.provider_profile_id}),label:demo.label,synthetic:true,modelProfile:'SYNTHETIC_GT06'};
 await verifyGatewayDevice(command,configurations);targets.push(preparedTarget(row,owner,vehicle,command));
}
const existingGateway=await checked(service.from('telematics_gateways').select('token_digest,synthetic_only,active').eq('id',gateway.id).maybeSingle(),'LOCAL_TELEMATICS_GATEWAY_READ_FAILED');
if(existingGateway){if(existingGateway.token_digest!==gatewayTokenDigest(gateway.secret)||!existingGateway.synthetic_only||!existingGateway.active)throw new Error('LOCAL_TELEMATICS_GATEWAY_CHANGED');}
else await rpc('register_telematics_gateway',{actor_user_id:administrator.id,gateway_id:gateway.id,gateway_label:'Local fictional GPS gateway',gateway_token_digest:gatewayTokenDigest(gateway.secret),demo_only:true});
const receipt=[];
for(const target of targets){
 const {owner,vehicle,command}=target;
 let device=await checked(service.from('telematics_devices').select('*').eq('imei',command.imei).maybeSingle(),'LOCAL_TELEMATICS_DEVICE_READ_FAILED');
 if(device){if(device.gateway_id!==command.gatewayId||device.gateway_device_id!==command.gatewayDeviceId||device.protocol_device_id!==command.protocolDeviceId
  ||device.organization_id!==vehicle.organization_id||device.provider_profile_id!==vehicle.provider_profile_id||!device.synthetic||device.model_profile!=='SYNTHETIC_GT06')throw new Error('LOCAL_TELEMATICS_DEVICE_CHANGED');}
 else{const created=await rpc('provision_telematics_device',{actor_user_id:administrator.id,command});device={id:created.id,revision:created.revision};}
 const assignment=await checked(service.from('telematics_device_assignments').select('vehicle_id').eq('device_id',device.id).is('ended_at',null).maybeSingle(),'LOCAL_TELEMATICS_ASSIGNMENT_READ_FAILED');
 if(assignment&&assignment.vehicle_id!==vehicle.id)throw new Error('LOCAL_TELEMATICS_ASSIGNMENT_CHANGED');
 if(!assignment)await rpc('assign_telematics_device',{actor_user_id:owner.id,command:{deviceId:device.id,vehicleId:vehicle.id,expectedRevision:device.revision}});
 const selection=await checked(service.from('telematics_location_sources').select('source,revision,precision_km').eq('vehicle_id',vehicle.id).maybeSingle(),'LOCAL_TELEMATICS_SELECTION_READ_FAILED');
 const sourcePlan=sourceSelectionPlan(target,selection);
 if(sourcePlan)await rpc('select_telematics_location_source',sourcePlan);
 receipt.push({ownerId:owner.id,vehicleId:vehicle.id,deviceId:device.id,imei:command.imei});
}
// Preserve the two-target manifest consumed by existing gateway/privacy
// rehearsals. The larger opt-in cohort has a separate exact local receipt.
await writeFile(path.join(directory,'application-demo-manifest.json'),JSON.stringify({purpose:'local-fictional-gps',gatewayId:gateway.id,targets:receipt.slice(0,2)}),{mode:0o600});
if(process.env.LOADGISTIC_DEMO_GPS_COHORT==='true')
 await writeFile(path.join(directory,'application-demo-gps-cohort.json'),JSON.stringify({purpose:'local-fictional-gps-fleet',gatewayId:gateway.id,targets:receipt.slice(2)}),{mode:0o600});
console.log(JSON.stringify({event:'local_telematics_provisioned',deviceCount:receipt.length,productionCustomersTouched:0}));
