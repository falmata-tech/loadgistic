// Root-run only. Creates/closes/deletes one NEW fictional account; never an existing owner.
import {createClient} from '@supabase/supabase-js';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {assertLocalAuthorityFixtureTarget} from '../fixture-provider-authority.mjs';
import {assertDemoIdentity,assertLoopback} from './demo-manifest.mjs';
import {assertPrivacyDemoBinding,sendPrivacyDemoFix} from './privacy-simulator.mjs';
import {verifyGatewayDevice,gatewayTokenDigest} from '../../src/lib/telematics-gateway-auth.js';
import {signedHeaders} from '../../infra/telematics/bridge-contract.mjs';
import {signedPrivacyHeaders} from '../../infra/telematics/privacy-contract.mjs';
const root=path.resolve(import.meta.dirname,'../..'),directory=path.join(root,'.local/telematics');
const statePath=path.join(directory,'privacy-application-fixture.json'),receiptPath=path.join(directory,'privacy-verification-evidence.json');
const options={auth:{autoRefreshToken:false,persistSession:false}},evidence={checkedAt:new Date().toISOString(),passed:false,
 createdNewOwner:false,actualProtocolFix:false,disableVerified:false,historyRetained:false,ingestCredentialDenied:false,
 bindingDenied:false,privacyNonceReplayDenied:false,unfinishedErasureHeld:false,collectionRetired:false,upstreamAbsent:false,appErased:false,primaryDevicesUnchanged:false,sourceHashes:{}};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let auth,state,stage='LOCAL_CONFIGURATION';
async function main(){
 const url=assertLocalAuthorityFixtureTarget(process.env.SUPABASE_SEED_URL),key=process.env.SUPABASE_SEED_SERVICE_ROLE_KEY,anon=process.env.SUPABASE_SEED_ANON_KEY;
 if(!key||!anon)throw new Error('PRIVACY_VERIFY_LOCAL_CONFIG_REQUIRED');
 const service=createClient(url,key,options);auth=createClient(url,anon,options);
 stage='GATEWAY_MANIFESTS';
 const binding=assertPrivacyDemoBinding(JSON.parse(await readFile(path.join(directory,'privacy-gateway-device.json'),'utf8')));
 const gateways=JSON.parse(await readFile(path.join(directory,'application-env.json'),'utf8'));
 const gateway=gateways.find(row=>row.id===binding.gatewayId);if(!gateway)throw new Error('PRIVACY_VERIFY_GATEWAY_REQUIRED');assertLoopback(gateway.apiUrl);
 const privacyRows=JSON.parse(await readFile(path.join(directory,'application-privacy-env.json'),'utf8'));
 const privacy=privacyRows.find(row=>row.id===binding.gatewayId);if(!privacy)throw new Error('PRIVACY_VERIFY_GATEWAY_REQUIRED');
 const base=JSON.parse(await readFile(path.join(directory,'application-demo-manifest.json'),'utf8'));
 if(base.purpose!=='local-fictional-gps'||base.gatewayId!==binding.gatewayId||base.targets.length!==2
  ||base.targets.some(row=>!['990000000000001','990000000000002'].includes(row.imei)))throw new Error('PRIVACY_VERIFY_PRIMARY_MANIFEST_REFUSED');
 async function checked(result,code){const {data,error}=await result;if(error)throw new Error(code);return data;}
 const rpc=(name,args)=>checked(service.rpc(name,args),`PRIVACY_VERIFY_RPC_${name.toUpperCase()}`);
 const save=()=>writeFile(statePath,JSON.stringify(state),{mode:0o600});
 async function apiGet(route){const response=await fetch(new URL(route,gateway.apiUrl),{headers:{Authorization:`Bearer ${gateway.apiToken}`},signal:AbortSignal.timeout(5000),redirect:'error'});
  if(!response.ok)throw new Error('PRIVACY_VERIFY_UPSTREAM_READ_FAILED');return response.json();}
 const primaryFields='id,organization_id,provider_profile_id,gateway_id,gateway_device_id,imei,protocol,protocol_device_id,active,synthetic,model_profile';
 async function primarySnapshot(){
  const rows=await checked(service.from('telematics_devices').select(primaryFields).in('id',base.targets.map(row=>row.deviceId)).order('id'),'PRIVACY_VERIFY_PRIMARY_READ_FAILED');
  if(rows.length!==2)throw new Error('PRIVACY_VERIFY_PRIMARY_MISSING');
  const upstream=[];for(const row of rows){const item=await apiGet(`devices/${row.gateway_device_id}`);
   upstream.push({id:item.id,uniqueId:item.uniqueId,disabled:item.disabled,attributes:item.attributes});}
  return createHash('sha256').update(JSON.stringify({rows,upstream})).digest('hex');
 }
 stage='PRIMARY_SNAPSHOT';
 const currentPrimary=await primarySnapshot();
 stage='OWNED_FIXTURE_JOURNAL';
 try{state=JSON.parse(await readFile(statePath,'utf8'));if(!process.argv.includes('--resume'))throw new Error('PRIVACY_VERIFY_ALREADY_STARTED_USE_RESUME');}
 catch(error){if(error.code!=='ENOENT')throw error;state={purpose:'local-fictional-gps-privacy',runId:randomUUID(),gatewayId:binding.gatewayId,
  gatewayDeviceId:binding.gatewayDeviceId,primaryDigest:currentPrimary};await writeFile(statePath,JSON.stringify(state),{mode:0o600,flag:'wx'});}
 if(state.purpose!=='local-fictional-gps-privacy'||!uuid.test(state.runId)||state.gatewayId!==binding.gatewayId
  ||state.gatewayDeviceId!==binding.gatewayDeviceId||state.primaryDigest!==currentPrimary)throw new Error('PRIVACY_VERIFY_OWNED_FIXTURE_CHANGED');
 for(const key of ['ownerId','organizationId','vehicleId','deviceId','requestId'])if(state[key]&&!uuid.test(state[key]))throw new Error('PRIVACY_VERIFY_OWNED_FIXTURE_CHANGED');
 stage='ADMIN_IDENTITY';
 const identities=await checked(service.auth.admin.listUsers({page:1,perPage:1000}),'PRIVACY_VERIFY_ADMIN_READ_FAILED');
 const admins=identities.users.filter(row=>row.app_metadata?.fixture_source==='loadgistic'&&row.user_metadata?.fixture_key==='user-admin');
 if(admins.length!==1)throw new Error('PRIVACY_VERIFY_ADMIN_REFUSED');const administrator=assertDemoIdentity(admins[0],'user-admin');
 const adminProfile=await checked(service.from('profiles').select('role,active').eq('id',administrator.id).single(),'PRIVACY_VERIFY_ADMIN_REFUSED');
 if(adminProfile.role!=='ADMIN'||!adminProfile.active)throw new Error('PRIVACY_VERIFY_ADMIN_REFUSED');
 stage='GATEWAY_AUTHORITY';
 const registered=await checked(service.from('telematics_gateways').select('token_digest,privacy_token_digest,synthetic_only,active').eq('id',binding.gatewayId).single(),'PRIVACY_VERIFY_GATEWAY_REQUIRED');
 if(!registered.active||!registered.synthetic_only||registered.token_digest!==gatewayTokenDigest(gateway.secret))throw new Error('PRIVACY_VERIFY_GATEWAY_CHANGED');
 if(registered.privacy_token_digest&&registered.privacy_token_digest!==gatewayTokenDigest(privacy.secret))throw new Error('PRIVACY_VERIFY_GATEWAY_CHANGED');
 if(!registered.privacy_token_digest)await rpc('register_telematics_privacy_agent',{actor_user_id:administrator.id,target_gateway_id:binding.gatewayId,privacy_digest:gatewayTokenDigest(privacy.secret)});
 stage='QUEUE_SCOPE';
 const pending=await checked(service.from('telematics_privacy_jobs').select('id,subject_user_id').eq('gateway_id',binding.gatewayId).in('state',['PENDING','LEASED']).is('local_erased_at',null),'PRIVACY_VERIFY_QUEUE_READ_FAILED');
 if(pending.some(row=>row.subject_user_id!==state.ownerId))throw new Error('PRIVACY_VERIFY_UNRELATED_QUEUE_REFUSED');
 // A nonexistent exact job is denied without leasing or touching any real queue item.
 stage='PRIVACY_AUTH_PROBE';
 const privacyEndpoint=assertLoopback('http://127.0.0.1:3100/api/telematics/privacy');
 const probe=JSON.stringify({action:'COMPLETE',command:{jobId:randomUUID(),leaseId:randomUUID(),bindingDigest:'e'.repeat(64),verified:true}});
 const probeHeaders=signedPrivacyHeaders(privacy,probe);
 for(const expected of [409,401]){
  const response=await fetch(privacyEndpoint,{method:'POST',body:probe,headers:probeHeaders,signal:AbortSignal.timeout(5000),redirect:'error'});
  if(response.status!==expected)throw new Error('PRIVACY_VERIFY_AUTH_OR_REPLAY_FAILED');await response.body?.cancel();
 }
 evidence.privacyNonceReplayDenied=true;
 stage='OWNED_OWNER_SETUP';
 if(!state.ownerId){
  const created=await checked(service.auth.admin.createUser({email:`falmatad97+gps-privacy-${state.runId}@gmail.com`,email_confirm:true,
   app_metadata:{fixture_source:'loadgistic',fixture_purpose:'telematics-privacy-rehearsal',fixture_instance:state.runId},
   user_metadata:{fixture_key:'user-transporter',name:'Fictional disposable GPS privacy owner'}}),'PRIVACY_VERIFY_CREATE_OWNER_FAILED');
  state.ownerId=created.user.id;state.email=created.user.email;await save();
 }
 if(!uuid.test(state.ownerId))throw new Error('PRIVACY_VERIFY_OWNED_FIXTURE_CHANGED');
 if(state.ownerId===administrator.id||base.targets.some(row=>row.ownerId===state.ownerId))throw new Error('PRIVACY_VERIFY_EXISTING_OWNER_REFUSED');
 if(!state.authErased){
  const identity=await checked(service.auth.admin.getUserById(state.ownerId),'PRIVACY_VERIFY_OWNED_FIXTURE_CHANGED');
  assertDemoIdentity(identity.user,'user-transporter');
  if(identity.user.app_metadata.fixture_purpose!=='telematics-privacy-rehearsal'||identity.user.app_metadata.fixture_instance!==state.runId
   ||identity.user.email!==state.email)throw new Error('PRIVACY_VERIFY_OWNED_FIXTURE_CHANGED');
  if(!state.organizationId){state.organizationId=randomUUID();await save();}
  let organization=await checked(service.from('organizations').select('id,handle,type').eq('id',state.organizationId).maybeSingle(),'PRIVACY_VERIFY_ORGANIZATION_SETUP_FAILED');
  if(!organization){
   await checked(service.from('profiles').update({role:'TRANSPORTER',active:true,drives_truck:false}).eq('id',state.ownerId),'PRIVACY_VERIFY_PROFILE_SETUP_FAILED');
   organization=await checked(service.from('organizations').insert({id:state.organizationId,name:'Fictional disposable privacy company',handle:`gps-privacy-${state.runId}`,type:'TRANSPORT_COMPANY'}).select('id,handle,type').single(),'PRIVACY_VERIFY_ORGANIZATION_SETUP_FAILED');
  }
  if(organization.handle!==`gps-privacy-${state.runId}`||organization.type!=='TRANSPORT_COMPANY')throw new Error('PRIVACY_VERIFY_OWNED_FIXTURE_CHANGED');
  let membership=await checked(service.from('organization_members').select('membership_role').eq('organization_id',state.organizationId).eq('user_id',state.ownerId).maybeSingle(),'PRIVACY_VERIFY_OWNED_FIXTURE_CHANGED');
  if(!membership)membership=await checked(service.from('organization_members').insert({organization_id:state.organizationId,user_id:state.ownerId,membership_role:'OWNER'}).select('membership_role').single(),'PRIVACY_VERIFY_MEMBERSHIP_SETUP_FAILED');
  if(membership.membership_role!=='OWNER')throw new Error('PRIVACY_VERIFY_OWNED_FIXTURE_CHANGED');
  await rpc('accept_content_policy',{actor_user_id:state.ownerId,policy_version:'2026-10-09'});
  if(!state.vehicleId){const result=await rpc('create_provider_vehicle',{actor_user_id:state.ownerId,command:{make:'Synthetic',model:'Privacy rehearsal',
   plate:`GPS-P-${state.runId.slice(0,8)}`,cargo_configuration:'Mini Box Truck',use_basis:'OWNED'}});state.vehicleId=result.id;await save();}
  if(!state.deviceId){
   const command={...binding,ownerOrganizationId:state.organizationId,label:'Fictional disposable privacy device',modelProfile:'SYNTHETIC_GT06'};
   await verifyGatewayDevice(command,gateways);
   const created=await rpc('provision_telematics_device',{actor_user_id:administrator.id,command});state.deviceId=created.id;await save();
  }
  if(!state.disabled){
   const current=await checked(service.from('telematics_devices').select('revision,active').eq('id',state.deviceId).single(),'PRIVACY_VERIFY_OWNED_DEVICE_MISSING');
   if(current.active){
    const assignment=await checked(service.from('telematics_device_assignments').select('vehicle_id').eq('device_id',state.deviceId).is('ended_at',null).maybeSingle(),'PRIVACY_VERIFY_ASSIGNMENT_READ_FAILED');
    if(assignment&&assignment.vehicle_id!==state.vehicleId)throw new Error('PRIVACY_VERIFY_OWNED_FIXTURE_CHANGED');
    if(!assignment)await rpc('assign_telematics_device',{actor_user_id:state.ownerId,command:{deviceId:state.deviceId,vehicleId:state.vehicleId,expectedRevision:current.revision}});
    const selection=await checked(service.from('telematics_location_sources').select('source,manual_latitude,manual_longitude').eq('vehicle_id',state.vehicleId).maybeSingle(),'PRIVACY_VERIFY_SOURCE_READ_FAILED');
    if(selection&&(selection.source!=='MANUAL'||selection.manual_latitude!==9.031||selection.manual_longitude!==38.748))throw new Error('PRIVACY_VERIFY_OWNED_FIXTURE_CHANGED');
    if(!selection)await rpc('select_telematics_location_source',{actor_user_id:state.ownerId,command:{vehicleId:state.vehicleId,source:'MANUAL',precisionKm:20,
     manualLatitude:9.031,manualLongitude:38.748,expectedRevision:'1970-01-01T00:00:00Z'}});
   }
  }
 }
 evidence.createdNewOwner=true;stage='OWNED_DEVICE_CHECK';
 const device=await checked(service.from('telematics_devices').select(primaryFields).eq('id',state.deviceId).maybeSingle(),'PRIVACY_VERIFY_OWNED_DEVICE_MISSING');
 if((!device&&!state.upstreamErased)||(device&&(device.organization_id!==state.organizationId||device.provider_profile_id!==null||device.gateway_device_id!==binding.gatewayDeviceId
  ||device.imei!==binding.imei||device.protocol_device_id!==binding.protocolDeviceId||!device.synthetic)))throw new Error('PRIVACY_VERIFY_OWNED_FIXTURE_CHANGED');
 stage='ACTUAL_PROTOCOL_HISTORY';
 if(!state.historyCount){
  await sendPrivacyDemoFix(binding);const end=Date.now()+20000;
  for(;;){const rows=await checked(service.from('telematics_positions').select('id').eq('device_id',state.deviceId),'PRIVACY_VERIFY_HISTORY_READ_FAILED');
   if(rows.length){state.historyCount=rows.length;break;}if(Date.now()>end)throw new Error('PRIVACY_VERIFY_REAL_FIX_NOT_INGESTED');await new Promise(resolve=>setTimeout(resolve,500));}
  state.upstreamHistoryCount=(await apiGet(`positions?deviceId=${binding.gatewayDeviceId}&from=2026-01-01T00:00:00Z&to=2099-01-01T00:00:00Z`)).length;
  if(state.upstreamHistoryCount<1)throw new Error('PRIVACY_VERIFY_REAL_FIX_NOT_STORED');await save();
 }
 evidence.actualProtocolFix=true;
 stage='FRESH_OWNER_AUTH';
 if(!state.authErased){
  const link=await checked(service.auth.admin.generateLink({type:'magiclink',email:state.email}),'PRIVACY_VERIFY_FRESH_AUTH_FAILED');
  await checked(auth.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'magiclink'}),'PRIVACY_VERIFY_FRESH_AUTH_FAILED');
 }
 async function ownJob(purpose){return checked(service.from('telematics_privacy_jobs').select('*').eq('device_id',state.deviceId).eq('purpose',purpose).single(),'PRIVACY_VERIFY_JOB_MISSING');}
 function docker(args,input){const child=spawnSync('docker',['compose','--env-file',path.join(directory,'compose.env'),'-f',path.join(root,'infra/telematics/compose.yml'),...args],
  {cwd:root,input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:55000});if(child.status!==0){
   const codes=['PRIVACY_SCOPE_DENIED','PRIVACY_BINDING_CHANGED','PRIVACY_ABSENCE_UNVERIFIED','PRIVACY_CASCADE_UNVERIFIED','PRIVACY_DISABLE_UNVERIFIED','PRIVACY_LEASE_EXPIRED','PRIVACY_UPSTREAM_UNAVAILABLE','PRIVACY_APPLICATION_UNAVAILABLE'];
   const code=codes.find(value=>`${child.stdout}\n${child.stderr}`.includes(value));
   throw new Error(code?`PRIVACY_VERIFY_JANITOR_${code}`:'PRIVACY_VERIFY_JANITOR_OR_PROOF_FAILED');}return child.stdout;}
 async function runOwnedJob(purpose){
  let job=await ownJob(purpose);if(job.state==='VERIFIED')return job;
  const waitUntil=Date.now()+65000;
  while(job.state==='LEASED'&&Date.parse(job.lease_until)>Date.now()){
   if(Date.now()>waitUntil)throw new Error('PRIVACY_VERIFY_LEASE_WAIT_EXCEEDED');
   await new Promise(resolve=>setTimeout(resolve,1000));job=await ownJob(purpose);
  }
  const queue=await checked(service.from('telematics_privacy_jobs').select('id,subject_user_id').eq('gateway_id',binding.gatewayId).in('state',['PENDING','LEASED']).is('local_erased_at',null),'PRIVACY_VERIFY_QUEUE_READ_FAILED');
  if(queue.length!==1||queue[0].id!==job.id||queue[0].subject_user_id!==state.ownerId)throw new Error('PRIVACY_VERIFY_UNRELATED_QUEUE_REFUSED');
  docker(['--profile','privacy','run','--rm','--no-deps','janitor']);job=await ownJob(purpose);
  if(job.state!=='VERIFIED')throw new Error('PRIVACY_VERIFY_UPSTREAM_NOT_VERIFIED');return job;
 }
 stage='DISABLE_OWNED_ACCOUNT';
 if(!state.disabled){
  const vehicle=await checked(service.from('vehicles').select('active,organization_id').eq('id',state.vehicleId).single(),'PRIVACY_VERIFY_OWNED_FIXTURE_CHANGED');
  if(vehicle.organization_id!==state.organizationId)throw new Error('PRIVACY_VERIFY_OWNED_FIXTURE_CHANGED');
  if(vehicle.active)await rpc('set_vehicle_lifecycle',{actor_user_id:state.ownerId,target_vehicle_id:state.vehicleId,desired_active:false,reason:'Disposable fictional privacy rehearsal'});
  const profile=await checked(service.from('profiles').select('active').eq('id',state.ownerId).single(),'PRIVACY_VERIFY_PROFILE_MISSING');
  if(profile.active)await rpc('deactivate_own_account',{actor_user_id:state.ownerId,confirmation:'DEACTIVATE'});
  await runOwnedJob('DISABLE');
  const disabled=await apiGet(`devices/${binding.gatewayDeviceId}`);
  if(!disabled.disabled||disabled.uniqueId!==binding.protocolDeviceId)throw new Error('PRIVACY_VERIFY_DISABLE_FAILED');
  const history=await checked(service.from('telematics_positions').select('id').eq('device_id',state.deviceId),'PRIVACY_VERIFY_HISTORY_READ_FAILED');
  const upstreamHistory=await apiGet(`positions?deviceId=${binding.gatewayDeviceId}&from=2026-01-01T00:00:00Z&to=2099-01-01T00:00:00Z`);
  const manual=await checked(service.from('telematics_location_sources').select('manual_latitude,manual_longitude').eq('vehicle_id',state.vehicleId).single(),'PRIVACY_VERIFY_MANUAL_HISTORY_MISSING');
  if(history.length<state.historyCount||upstreamHistory.length<state.upstreamHistoryCount||manual.manual_latitude!==9.031||manual.manual_longitude!==38.748)
   throw new Error('PRIVACY_VERIFY_DISABLE_LOST_HISTORY');
  state.disabled=true;await save();
 }
 evidence.disableVerified=true;evidence.historyRetained=true;
 stage='INGEST_CREDENTIAL_DENIALS';
 const wrongCredential=await service.rpc('claim_telematics_privacy_jobs',{gateway_digest:gatewayTokenDigest(gateway.secret)});
 if(wrongCredential.error?.message!=='PRIVACY_GATEWAY_UNAVAILABLE')throw new Error('PRIVACY_VERIFY_INGEST_CREDENTIAL_ACCEPTED');
 const disabledJob=await ownJob('DISABLE');
 const wrongAttestation=await service.rpc('complete_telematics_privacy_job',{gateway_digest:gatewayTokenDigest(gateway.secret),
  command:{jobId:disabledJob.id,leaseId:disabledJob.lease_id,bindingDigest:disabledJob.binding_digest,verified:true}});
 if(wrongAttestation.error?.message!=='PRIVACY_GATEWAY_UNAVAILABLE')throw new Error('PRIVACY_VERIFY_INGEST_CREDENTIAL_ACCEPTED');
 const claimBody=JSON.stringify({action:'CLAIM'}),response=await fetch(assertLoopback('http://127.0.0.1:3100/api/telematics/privacy'),{method:'POST',body:claimBody,
  headers:signedHeaders(gateway,claimBody),signal:AbortSignal.timeout(5000),redirect:'error'});
 if(response.status!==401)throw new Error('PRIVACY_VERIFY_INGEST_CREDENTIAL_ACCEPTED');await response.body?.cancel();evidence.ingestCredentialDenied=true;
 stage='PREPARE_OWNED_ERASURE';
 if(!state.requestId){state.requestId=(await rpc('request_account_deletion',{actor_user_id:state.ownerId})).id;await save();}
 const deletion=await checked(service.from('account_deletion_requests').select('subject_user_id').eq('id',state.requestId).single(),'PRIVACY_VERIFY_REQUEST_SCOPE_FAILED');
 if(deletion.subject_user_id!==state.ownerId)throw new Error('PRIVACY_VERIFY_REQUEST_SCOPE_FAILED');
 const prepared=await rpc('prepare_account_erasure',{actor_user_id:administrator.id,target_request_id:state.requestId});
 if(!['ERASING','COMPLETED'].includes(prepared.status))throw new Error('PRIVACY_VERIFY_ERASURE_NOT_PREPARED');
 stage='ERASE_OWNED_AUTH';
 if(!state.authErased){await checked(service.auth.admin.deleteUser(state.ownerId,true),'PRIVACY_VERIFY_AUTH_ERASURE_FAILED');state.authErased=true;await save();}
 stage='UNFINISHED_ERASURE_AND_BINDING_DENIALS';
 const eraseJob=await ownJob('ERASE');
 if(eraseJob.state!=='VERIFIED'){
  const unfinished=await rpc('finish_account_erasure',{actor_user_id:administrator.id,target_request_id:state.requestId});
  if(unfinished.status!=='ERASING')throw new Error('PRIVACY_VERIFY_UNVERIFIED_ERASURE_COMPLETED');
  const wrong={id:eraseJob.id,purpose:'ERASE',gatewayId:binding.gatewayId,gatewayDeviceId:binding.gatewayDeviceId,
   imei:'990000000000004',protocol:'gt06',protocolDeviceId:binding.protocolDeviceId,bindingDigest:eraseJob.binding_digest};
  const proofSql=`do $$ begin begin perform loadgistic_bridge.prepare_privacy_job('${JSON.stringify(wrong)}'::jsonb);exception when others then
if sqlerrm in('PRIVACY_SCOPE_DENIED','PRIVACY_BINDING_CHANGED') then return;end if;raise;end;raise exception 'PRIVACY_DENIAL_MISSING';end $$;`;
  docker(['exec','-T','database','psql','-X','-q','-v','ON_ERROR_STOP=1','-U','loadgistic_janitor','-d','traccar'],proofSql);
  state.bindingDenied=true;state.unfinishedErasureHeld=true;await save();
 }
 evidence.bindingDenied=state.bindingDenied===true;evidence.unfinishedErasureHeld=state.unfinishedErasureHeld===true;
 stage='ERASE_JANITOR';
 await runOwnedJob('ERASE');
 // Real BEFORE INSERT rejection protects against a cached TCP session after device deletion.
 // Both attempted rows are only for the exact disposable numeric ID; an unexpected acceptance rolls back the DO block.
 stage='RETIRED_COLLECTION_REJECTIONS';
 const retiredSql=`do $$ declare position_denied boolean:=false;event_denied boolean:=false;begin
begin insert into public.tc_positions(protocol,deviceid,servertime,devicetime,fixtime,valid,latitude,longitude,altitude,speed,course,attributes,accuracy,network)
values('gt06',${binding.gatewayDeviceId},clock_timestamp(),clock_timestamp(),clock_timestamp(),true,9.031,38.748,0,0,0,'{}',0,'{}');
exception when others then if sqlerrm='TELEMATICS_COLLECTION_RETIRED' then position_denied:=true;else raise;end if;end;
begin insert into public.tc_events(type,eventtime,deviceid,attributes) values('deviceOnline',clock_timestamp(),${binding.gatewayDeviceId},'{}');
exception when others then if sqlerrm='TELEMATICS_COLLECTION_RETIRED' then event_denied:=true;else raise;end if;end;
if not position_denied or not event_denied then raise exception 'PRIVACY_RETIRED_COLLECTION_NOT_BLOCKED';end if;end $$;`;
 docker(['exec','-T','database','psql','-X','-q','-v','ON_ERROR_STOP=1','-U','traccar','-d','traccar'],retiredSql);
 evidence.collectionRetired=true;
 stage='UPSTREAM_ABSENCE';
 const absenceSql=`select json_build_object('devices',(select count(*) from tc_devices where id=${binding.gatewayDeviceId} or uniqueid='990000000000003'),
'positions',(select count(*) from tc_positions where deviceid=${binding.gatewayDeviceId}),'events',(select count(*) from tc_events where deviceid=${binding.gatewayDeviceId}),
'outbox',(select count(*) from loadgistic_bridge.outbox where payload->>'deviceId'='${binding.gatewayDeviceId}'),
'dispatches',(select count(*) from loadgistic_bridge.dispatches where gateway_device_id=${binding.gatewayDeviceId}));`;
 const absence=JSON.parse(docker(['exec','-T','database','psql','-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-U','traccar','-d','traccar'],absenceSql).trim());
 if(Object.values(absence).some(value=>value!==0))throw new Error('PRIVACY_VERIFY_UPSTREAM_REMAINS');evidence.upstreamAbsent=true;
 state.upstreamErased=true;await save();
 stage='FINISH_APP_ERASURE';
 const finished=await rpc('finish_account_erasure',{actor_user_id:administrator.id,target_request_id:state.requestId});
 if(finished.status!=='COMPLETED')throw new Error('PRIVACY_VERIFY_ERASURE_NOT_COMPLETED');
 for(const [table,column,value] of [['telematics_devices','id',state.deviceId],['telematics_positions','device_id',state.deviceId],
  ['telematics_commands','device_id',state.deviceId],['telematics_location_sources','vehicle_id',state.vehicleId]]){
  const rows=await checked(service.from(table).select(column).eq(column,value),'PRIVACY_VERIFY_ERASURE_READ_FAILED');
  if(rows.length)throw new Error('PRIVACY_VERIFY_APP_PRIVATE_DATA_REMAINS');
 }
 const jobs=await checked(service.from('telematics_privacy_jobs').select('state,gateway_device_id,imei,protocol_device_id,local_erased_at').eq('device_id',state.deviceId),'PRIVACY_VERIFY_ERASURE_READ_FAILED');
 if(jobs.length!==2||jobs.some(row=>row.state!=='VERIFIED'||row.gateway_device_id!==null||row.imei!==null||row.protocol_device_id!==null||!row.local_erased_at))
  throw new Error('PRIVACY_VERIFY_HARDWARE_SNAPSHOT_REMAINS');
 stage='FINAL_ISOLATION';
 evidence.appErased=true;evidence.primaryDevicesUnchanged=(await primarySnapshot())===state.primaryDigest;
 if((await rpc('finish_account_erasure',{actor_user_id:administrator.id,target_request_id:state.requestId})).status!=='COMPLETED')throw new Error('PRIVACY_VERIFY_ERASURE_REPLAY_FAILED');
 if(!evidence.primaryDevicesUnchanged||!evidence.bindingDenied||!evidence.unfinishedErasureHeld||!evidence.collectionRetired)throw new Error('PRIVACY_VERIFY_ISOLATION_OR_DENIAL_FAILED');
 state.completed=true;await save();evidence.passed=true;
}
try{await main();}catch(error){const message=String(error?.message);
 evidence.failureCode=/^[A-Z_]{1,100}$/.test(message)?message:'PRIVACY_VERIFY_FAILED';
 evidence.failureStage=stage;
 evidence.errorName=/^[A-Za-z][A-Za-z0-9]{0,40}$/.test(error?.name||'')?error.name:'Error';
 if(/^[A-Z0-9_]{1,40}$/.test(error?.cause?.code||''))evidence.causeCode=error.cause.code;
 evidence.sourceLine=Number(String(error?.stack).match(/verify-privacy-local\.mjs:(\d+):\d+/)?.[1])||null;
 process.exitCode=1;}
finally{
 if(auth)await auth.auth.signOut({scope:'local'}).catch(()=>{});
 for(const file of ['scripts/telematics/verify-privacy-local.mjs','scripts/telematics/privacy-simulator.mjs','infra/telematics/janitor.mjs',
  'infra/telematics/gateway-privacy.sql','supabase/migrations/154_telematics_account_privacy.sql']){
  evidence.sourceHashes[file]=createHash('sha256').update(await readFile(path.join(root,file))).digest('hex');
 }
 await writeFile(receiptPath,JSON.stringify(evidence),{mode:0o600});console.log(JSON.stringify(evidence));
}
