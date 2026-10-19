// Owner-run local evidence only. The main agent supplies already approved local
// application credentials; no file discovers or prints those credentials.
import {createClient} from '@supabase/supabase-js';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {assertLocalAuthorityFixtureTarget} from '../fixture-provider-authority.mjs';
import {assertDemoDevice,assertLoopback,assertDemoIdentity} from './demo-manifest.mjs';
import {simulate} from './simulator.mjs';
import {signedHeaders,normalizePosition} from '../../infra/telematics/bridge-contract.mjs';
const root=path.resolve(import.meta.dirname,'../..'),directory=path.join(root,'.local/telematics');
const url=assertLocalAuthorityFixtureTarget(process.env.SUPABASE_SEED_URL),key=process.env.SUPABASE_SEED_SERVICE_ROLE_KEY,anonKey=process.env.SUPABASE_SEED_ANON_KEY;
if(!key||!anonKey)throw new Error('LOCAL_BRIDGE_VERIFY_CONFIG_MISSING');
const endpoint=assertLoopback('http://127.0.0.1:3100/api/telematics/gateway');
const manifest=JSON.parse(await readFile(path.join(directory,'application-demo-manifest.json'),'utf8'));
if(manifest.purpose!=='local-fictional-gps'||manifest.targets.length!==2)throw new Error('LOCAL_BRIDGE_MANIFEST_REFUSED');
const configurations=JSON.parse(await readFile(path.join(directory,'application-env.json'),'utf8')),gateway=configurations.find(row=>row.id===manifest.gatewayId);
if(!gateway)throw new Error('LOCAL_BRIDGE_GATEWAY_MISSING');const api=assertLoopback(gateway.apiUrl);
const options={auth:{autoRefreshToken:false,persistSession:false}},service=createClient(url,key,options),auth=createClient(url,anonKey,options);
async function checked(result,code){const {data,error}=await result;if(error){
 const allowed=['FORBIDDEN','NOT_FOUND','ENGINE_CONTROL_UNAVAILABLE','ENGINE_STEP_UP_REQUIRED','ENGINE_INTERLOCK_DENIED','DEVICE_COMMAND_UNSUPPORTED','DEVICE_NOT_ASSIGNED','COMMAND_RATE_LIMITED','COMMAND_CHANGED'];
 throw new Error(`${code}${allowed.includes(error.message)?`:${error.message}`:''}`);
}return data;}
async function rpc(name,args){return checked(service.rpc(name,args),`BRIDGE_VERIFY_RPC_FAILED_${name}`);}
async function waitFor(check,code,attempts=15){for(let i=0;i<attempts;i++){const value=await check();if(value)return value;await new Promise(resolve=>setTimeout(resolve,1000));}throw new Error(code);}
async function gatewayRequest(message,headers){const body=JSON.stringify(message);const response=await fetch(endpoint,{method:'POST',headers:headers||signedHeaders(gateway,body),body,signal:AbortSignal.timeout(10000),redirect:'error'});return {status:response.status,body:await response.json()};}
const targets=[];
for(const target of manifest.targets){
 const demo=assertDemoDevice(target.imei),device=await checked(service.from('telematics_devices').select('id,gateway_id,gateway_device_id,imei,synthetic,model_profile,organization_id,provider_profile_id').eq('id',target.deviceId).single(),'LOCAL_BRIDGE_DEVICE_MISSING');
 const identity=await checked(service.auth.admin.getUserById(target.ownerId),'LOCAL_BRIDGE_OWNER_MISSING');
 assertDemoIdentity(identity.user,target.imei==='990000000000001'?'user-transporter':'user-driver');
 if(device.imei!==demo.imei||device.gateway_id!==gateway.id||!device.synthetic||device.model_profile!=='SYNTHETIC_GT06')throw new Error('LOCAL_BRIDGE_TARGET_REFUSED');
 const vehicle=await checked(service.from('vehicles').select('organization_id,provider_profile_id').eq('id',target.vehicleId).single(),'LOCAL_BRIDGE_VEHICLE_MISSING');
 if(vehicle.organization_id!==device.organization_id||vehicle.provider_profile_id!==device.provider_profile_id)throw new Error('LOCAL_BRIDGE_OWNER_CHANGED');
 targets.push({...target,demo,device,email:identity.user.email});
}
const start=new Date(),simulations=targets.map(target=>simulate({imei:target.imei,durationMs:90000}));
const evidence={checkedAt:start.toISOString(),gatewayVersion:'6.16.0',hardwareCertification:false,devicesIngested:0,commandsAcknowledged:0,syntheticEngineActions:0,
 publishedSourceGPS:false,duplicateIdempotent:false,nonceReplayDenied:false,tamperedSignatureDenied:false,sourceHashes:{}};
try{
 for(const target of targets){
  await waitFor(async()=>{const rows=await checked(service.from('telematics_positions').select('id').eq('device_id',target.deviceId).gte('observed_at',start.toISOString()).limit(1),'BRIDGE_VERIFY_POSITION_READ_FAILED');return rows.length;},'BRIDGE_DID_NOT_INGEST_POSITION');evidence.devicesIngested++;
 }
 const capacities=await checked(service.from('capacities').select('vehicle_id,location_source').in('vehicle_id',targets.map(row=>row.vehicleId)).order('updated_at',{ascending:false}),'BRIDGE_VERIFY_CAPACITY_READ_FAILED');
 evidence.publishedSourceGPS=targets.every(target=>capacities.find(row=>row.vehicle_id===target.vehicleId)?.location_source==='TELEMATICS');
 if(!evidence.publishedSourceGPS)throw new Error('BRIDGE_DID_NOT_PUBLISH_GPS_SOURCE');
 const target=targets[0];
 const link=await checked(service.auth.admin.generateLink({type:'magiclink',email:target.email}),'LOCAL_BRIDGE_FRESH_OWNER_LINK_FAILED');
 await checked(auth.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'magiclink'}),'LOCAL_BRIDGE_FRESH_OWNER_AUTH_FAILED');
 for(const command of ['LOCATE','ENGINE_CUT','ENGINE_RESTORE']){
  let stepUpId;
  if(command.startsWith('ENGINE_')){
   await waitFor(async()=>{const rows=await checked(service.from('telematics_positions').select('valid,speed_kph,attributes,observed_at').eq('device_id',target.deviceId)
    .eq('valid',true).lte('observed_at',new Date().toISOString()).order('observed_at',{ascending:false}).order('id',{ascending:false}).limit(1),'BRIDGE_VERIFY_ENGINE_FIX_READ_FAILED');
    const position=rows[0];return position?.valid===true&&position.speed_kph===0&&position.attributes?.ignition===false&&Date.parse(position.observed_at)>=Date.now()-30000;
   },'BRIDGE_FRESH_STATIONARY_IGNITION_FIX_REQUIRED',12);
   const step=await rpc('authorize_synthetic_engine_command',{actor_user_id:target.ownerId,command:{deviceId:target.deviceId,vehicleId:target.vehicleId,command}});stepUpId=step.id;}
  const result=await rpc('request_telematics_command',{actor_user_id:target.ownerId,command:{deviceId:target.deviceId,command,idempotencyKey:randomUUID(),...(stepUpId?{stepUpId,confirmed:true}:{})}});
  await waitFor(async()=>{const row=await checked(service.from('telematics_commands').select('state').eq('id',result.id).single(),'BRIDGE_VERIFY_COMMAND_READ_FAILED');
   if(['FAILED','EXPIRED','UNKNOWN'].includes(row.state))throw new Error(`BRIDGE_COMMAND_${row.state}`);return row.state==='ACKNOWLEDGED';},'BRIDGE_COMMAND_NOT_ACKNOWLEDGED',20);
  evidence.commandsAcknowledged++;if(stepUpId)evidence.syntheticEngineActions++;
 }
 const from=encodeURIComponent(start.toISOString()),to=encodeURIComponent(new Date().toISOString());
 const response=await fetch(new URL(`positions?deviceId=${target.device.gateway_device_id}&from=${from}&to=${to}`,api),{headers:{Authorization:`Bearer ${gateway.apiToken}`},signal:AbortSignal.timeout(5000),redirect:'error'});
 if(!response.ok)throw new Error('BRIDGE_VERIFY_TRACCAR_READ_FAILED');const raw=(await response.json()).filter(row=>!Object.hasOwn(row.attributes||{},'result')).at(-1);
 if(!raw)throw new Error('BRIDGE_VERIFY_ACTUAL_GPS_FIX_REQUIRED');
 const position=normalizePosition({...raw,uniqueId:target.demo.protocolDeviceId});
 await waitFor(async()=>{const rows=await checked(service.from('telematics_positions').select('id').eq('gateway_id',gateway.id).eq('event_key',position.eventKey),'BRIDGE_VERIFY_EVENT_READ_FAILED');return rows.length===1;},'BRIDGE_EVENT_NOT_DURABLE');
 const replay=await gatewayRequest({action:'POSITION',positions:[position]});evidence.duplicateIdempotent=replay.status===200&&replay.body.data?.[0]?.result?.outcome==='DUPLICATE';
 const message={action:'CLAIM_COMMANDS'},body=JSON.stringify(message),headers=signedHeaders(gateway,body);
 if((await gatewayRequest(message,headers)).status!==200)throw new Error('BRIDGE_VERIFY_AUTH_FAILED');
 evidence.nonceReplayDenied=(await gatewayRequest(message,headers)).status===401;
 evidence.tamperedSignatureDenied=(await gatewayRequest({action:'PRUNE'},signedHeaders(gateway,body))).status===401;
 if(!evidence.duplicateIdempotent||!evidence.nonceReplayDenied||!evidence.tamperedSignatureDenied)throw new Error('BRIDGE_REPLAY_SECURITY_FAILED');
 const outcomes=await Promise.all(simulations);if(outcomes[0].syntheticRelayCut||outcomes[0].commands<3)throw new Error('SYNTHETIC_RELAY_DID_NOT_RESTORE');
 evidence.passed=true;
}finally{
 await auth.auth.signOut({scope:'local'});
 for(const name of ['supabase/migrations/151_gps_telematics.sql','src/app/api/telematics/gateway/route.ts','infra/telematics/worker.mjs','scripts/telematics/simulator.mjs','scripts/telematics/verify-bridge-local.mjs'])
  evidence.sourceHashes[name]=createHash('sha256').update(await readFile(path.join(root,name))).digest('hex');
 await writeFile(path.join(directory,'bridge-verification-evidence.json'),JSON.stringify(evidence),{mode:0o600});
 console.log(JSON.stringify(evidence));
}
