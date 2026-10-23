// FEAT-GPS/IAM/SEC-001: real two-session owner-before-device locking proof.
// Disposable synthetic fixtures only. Never accepts the ordinary local database.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';

const container='supabase_db_loadgistic-local';
const database=process.env.LOADGISTIC_TEST_DATABASE||'';
assert.match(readFileSync(new URL('../supabase/config.toml',import.meta.url),'utf8'),/^project_id\s*=\s*"loadgistic-local"/m);
assert.ok(/^loadgistic_(?:provider|telematics|gps)_[a-z0-9_]+$/.test(database),
 'LOADGISTIC_TEST_DATABASE must name an isolated Loadgistic clone');
const admin=randomUUID(),gateway=randomUUID(),digest=randomBytes(32).toString('hex');
const extraGateways=[randomUUID(),randomUUID()],gatewayIds=[gateway,...extraGateways];
const fixtures=Array.from({length:4},(_,i)=>({owner:randomUUID(),anchor:randomUUID(),company:i%2===1,hardware:800000000+i,truck:null,device:null,request:null}));
const actors=[admin,...fixtures.map(item=>item.owner)];
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const json=value=>quote(JSON.stringify(value))+'::jsonb';
const list=values=>values.map(quote).join(',');
const sessions=new Set();
let stage='target',verified=false,started=false,failed=false;
function session(){
 const child=spawn('docker',['exec','-i',container,'psql','-X','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-Atq'],{stdio:['pipe','pipe','pipe']});
 let out='',error='';sessions.add(child);
 const timer=setTimeout(()=>child.kill(),35000);
 child.stdout.on('data',chunk=>out+=chunk);child.stderr.on('data',chunk=>error+=chunk);
 const done=new Promise((resolve,reject)=>{
  child.on('error',reject);child.on('close',code=>{clearTimeout(timer);sessions.delete(child);resolve({code,out:out.trim(),error});});
 });
 return {child,done,write:source=>child.stdin.write(source+'\n'),end:()=>child.stdin.end(),async until(marker){
  const deadline=Date.now()+15000;
  while(!out.includes(marker)){
   if(Date.now()>deadline||child.exitCode!==null)throw Error('PRIVACY_RACE_MARKER_MISSING');
   await new Promise(resolve=>setTimeout(resolve,50));
  }
 }};
}
async function sql(source){
 const connection=session();connection.write("set statement_timeout='20s';set lock_timeout='15s';"+source);connection.end();return connection.done;
}
async function checked(source){const result=await sql(source);assert.equal(result.code,0,'PRIVACY_RACE_SQL_FAILED');return result.out;}
async function race(firstCommand,secondCommand){
 const first=session(),second=session(),marker='PRIVACY_LOCKED_'+randomUUID(),tag='privacy-race-'+randomUUID();
 try{
  first.write(`set statement_timeout='20s';set lock_timeout='15s';begin;${firstCommand};select ${quote(marker)};`);await first.until(marker);
  second.write(`set application_name=${quote(tag)};set statement_timeout='20s';set lock_timeout='15s';begin;${secondCommand};commit;`);second.end();
  const deadline=Date.now()+10000;let waiting=false;
  while(Date.now()<deadline){
   waiting=await checked(`select exists(select 1 from pg_stat_activity where datname=current_database() and application_name=${quote(tag)} and wait_event_type='Lock');`)==='t';
   if(waiting)break;await new Promise(resolve=>setTimeout(resolve,75));
  }
  assert.equal(waiting,true,'PRIVACY_RACE_DID_NOT_WAIT');
  first.write('commit;');first.end();
  const results=await Promise.all([first.done,second.done]);assert.equal(results[0].code,0,'PRIVACY_FIRST_COMMAND_FAILED');return results[1];
 }finally{first.child.kill();second.child.kill();}
}
const fix=item=>`jsonb_build_object('eventKey',${quote('privacy-race:'+item.owner)},'gatewayDeviceId',${item.hardware},'protocol','gt06',
 'protocolDeviceId',${quote('98'+String(item.hardware).padStart(13,'0'))},'observedAt',clock_timestamp(),'receivedAt',clock_timestamp(),
 'valid',true,'latitude',9.03,'longitude',38.74,'speedKph',0,'attributes','{"ignition":false}'::jsonb)`;
async function cleanup(){
 for(const child of sessions)child.kill();
 await checked(`begin;
 create temporary table privacy_race_devices(id uuid primary key)on commit drop;
 insert into privacy_race_devices select id from telematics_devices where gateway_id=${quote(gateway)};
 create temporary table privacy_race_entities(id uuid primary key)on commit drop;
 insert into privacy_race_entities select id from privacy_race_devices
 union select id from vehicles where organization_id in(${list(fixtures.filter(item=>item.company).map(item=>item.anchor))}) or provider_profile_id in(${list(fixtures.filter(item=>!item.company).map(item=>item.anchor))})
 union select id from telematics_privacy_jobs where subject_user_id in(${list(actors)})
 union select id from telematics_device_assignments where device_id in(select id from privacy_race_devices)
 union select id from telematics_commands where device_id in(select id from privacy_race_devices)
 union select id from account_deletion_requests where subject_user_id in(${list(actors)});
 delete from audit_logs where actor_user_id in(${list(actors)})or entity_id in(select id from privacy_race_entities);
 delete from telematics_privacy_jobs where subject_user_id in(${list(actors)});
 delete from telematics_devices where id in(select id from privacy_race_devices);
 delete from telematics_gateway_requests where gateway_id in(${list(gatewayIds)});
 delete from telematics_gateways where id in(${list(gatewayIds)});
 delete from account_erasure_files where request_id in(select id from account_deletion_requests where subject_user_id in(${list(actors)}));
 delete from account_deletion_requests where subject_user_id in(${list(actors)});
 delete from vehicles where organization_id in(${list(fixtures.filter(item=>item.company).map(item=>item.anchor))})or provider_profile_id in(${list(fixtures.filter(item=>!item.company).map(item=>item.anchor))});
 delete from organizations where id in(${list(fixtures.filter(item=>item.company).map(item=>item.anchor))});
 delete from provider_profiles where id in(${list(fixtures.filter(item=>!item.company).map(item=>item.anchor))});
 delete from auth.users where id in(${list(actors)});commit;`);
 assert.equal(await checked(`select(select count(*)from auth.users where id in(${list(actors)}))+
 (select count(*)from telematics_gateways where id in(${list(gatewayIds)}))+
 (select count(*)from telematics_privacy_jobs where subject_user_id in(${list(actors)}))+
 (select count(*)from audit_logs where actor_user_id in(${list(actors)}));`),'0','PRIVACY_RACE_CLEANUP_INCOMPLETE');
}
try{
 const label=await new Promise((resolve,reject)=>{
  const child=spawn('docker',['inspect','--format','{{ index .Config.Labels "com.supabase.cli.project" }}',container]);let output='';
  const timer=setTimeout(()=>child.kill(),10000);child.stdout.on('data',chunk=>output+=chunk);child.on('error',reject);
  child.on('close',code=>{clearTimeout(timer);resolve({code,output:output.trim()});});
 });
 assert.equal(label.code,0);assert.equal(label.output,'loadgistic-local');
 assert.equal(await checked("select current_database()||':'||(to_regprocedure('public.queue_telematics_account_privacy(uuid,uuid,text)')is not null)::text;"),database+':true');
 verified=true;started=true;stage='synthetic setup';
 await checked(`begin;insert into auth.users(id,email,email_confirmed_at,last_sign_in_at,raw_user_meta_data)values
 (${quote(admin)},${quote('gps-privacy-admin-'+admin+'@example.test')},now(),now(),'{}');
 update profiles set role='ADMIN',active=true where id=${quote(admin)};
 select register_telematics_gateway(${quote(admin)},${quote(gateway)},'Synthetic privacy race gateway',${quote(digest)},true);commit;`);
 for(const item of fixtures){
  const imei='98'+String(item.hardware).padStart(13,'0');
  const scopeKey=item.company?'ownerOrganizationId':'ownerProviderProfileId';
  const result=JSON.parse(await checked(`begin;
 insert into auth.users(id,email,email_confirmed_at,last_sign_in_at,raw_app_meta_data,raw_user_meta_data)values
 (${quote(item.owner)},${quote('falmatad97+gps-privacy-race-'+item.owner+'@gmail.com')},now(),now(),'{"fixture_source":"loadgistic"}',${json({fixture_key:item.company?'user-transporter':'user-driver'})});
 update profiles set role=${quote(item.company?'TRANSPORTER':'DRIVER')}::user_role,active=true,drives_truck=false where id=${quote(item.owner)};
 ${item.company?`insert into organizations(id,name,handle,type)values(${quote(item.anchor)},'Synthetic privacy race fleet',${quote('privacy-race-'+item.anchor)},'TRANSPORT_COMPANY');insert into organization_members(organization_id,user_id,membership_role)values(${quote(item.anchor)},${quote(item.owner)},'OWNER');`:
 `insert into provider_profiles(id,user_id,business_name,handle)values(${quote(item.anchor)},${quote(item.owner)},'Synthetic privacy race provider',${quote('privacy-race-'+item.anchor)});`}
 do $setup$declare truck uuid;device jsonb;begin
 perform accept_content_policy(${quote(item.owner)},'2026-10-09');
 truck:=(create_provider_vehicle(${quote(item.owner)},${json({make:'Synthetic',model:'Privacy race',plate:'PRIVACY-RACE-'+item.owner.slice(0,8),cargo_configuration:'Mini Box Truck',use_basis:'OWNED'})})->>'id')::uuid;
 device:=provision_telematics_device(${quote(admin)},${json({gatewayId:gateway,gatewayDeviceId:item.hardware,imei,protocol:'gt06',protocolDeviceId:imei,label:'Synthetic race tracker',synthetic:true,modelProfile:'SYNTHETIC_GT06',[scopeKey]:item.anchor})});
 perform assign_telematics_device(${quote(item.owner)},jsonb_build_object('deviceId',device->>'id','vehicleId',truck,'expectedRevision',device->>'revision'));
 perform select_telematics_location_source(${quote(item.owner)},jsonb_build_object('vehicleId',truck,'source','MANUAL','precisionKm',20,'manualLatitude',9.03,'manualLongitude',38.74,'expectedRevision','1970-01-01T00:00:00Z'));
 perform set_vehicle_lifecycle(${quote(item.owner)},truck,false,'Synthetic closure race setup');end $setup$;
 select jsonb_build_object('truck',(select id from vehicles where ${item.company?'organization_id':'provider_profile_id'}=${quote(item.anchor)}),
 'device',(select id from telematics_devices where gateway_id=${quote(gateway)}and gateway_device_id=${item.hardware}));commit;`));
  item.truck=result.truck;item.device=result.device;assert.match(item.device,/^[0-9a-f-]{36}$/);
 }
 for(const item of fixtures.slice(0,2)){
  stage=(item.company?'company':'personal')+' closure before ingress';
  const result=await race(`select deactivate_own_account(${quote(item.owner)},'DEACTIVATE')`,
   `select ingest_telematics_position(${quote(digest)},${fix(item)})`);
  assert.notEqual(result.code,0);assert.match(result.error,/ERROR:\s+DEVICE_OWNER_INVALID(?:\r?\n|$)/);
  assert.equal(await checked(`select not p.active and not d.active and not exists(select 1 from telematics_positions where device_id=d.id)
   and not exists(select 1 from telematics_device_assignments where device_id=d.id and ended_at is null)
   and exists(select 1 from telematics_privacy_jobs where device_id=d.id and purpose='DISABLE'and state='PENDING')
   from profiles p join telematics_devices d on d.id=${quote(item.device)}where p.id=${quote(item.owner)};`),'t');
  console.log('PASS: '+stage+' serializes and denies the waiting report without collecting a fix');
 }
 for(const item of fixtures.slice(2)){
  stage=(item.company?'company':'personal')+' ingress before erasure';
  item.request=JSON.parse(await checked(`select request_account_deletion(${quote(item.owner)});`)).id;
  const result=await race(`select ingest_telematics_position(${quote(digest)},${fix(item)})`,
   `select prepare_account_erasure(${quote(admin)},${quote(item.request)})`);
  assert.equal(result.code,0);assert.equal(JSON.parse(result.out).status,'ERASING');
  assert.equal(await checked(`select not p.active and not d.active and(select count(*)from telematics_positions where device_id=d.id)=1
   and not exists(select 1 from telematics_device_assignments where device_id=d.id and ended_at is null)
   and exists(select 1 from telematics_location_sources where vehicle_id=${quote(item.truck)}and manual_latitude is not null)
   and exists(select 1 from telematics_privacy_jobs where device_id=d.id and request_id=${quote(item.request)}and purpose='ERASE'and state='PENDING')
   from profiles p join telematics_devices d on d.id=${quote(item.device)}where p.id=${quote(item.owner)};`),'t');
  const late=await sql(`select ingest_telematics_position(${quote(digest)},${fix(item)})`);
  assert.notEqual(late.code,0);assert.match(late.error,/ERROR:\s+TELEMETRY_BINDING_DENIED(?:\r?\n|$)/);
  console.log('PASS: '+stage+' waits, retires collection and retains private history pending verified cleanup');
 }
 for(const[index,privacyFirst]of[true,false].entries()){
  stage='concurrent '+(privacyFirst?'privacy then ingest':'ingest then privacy')+' credential registration';
  const credential=randomBytes(32).toString('hex');
  const privacy=`select register_telematics_privacy_agent(${quote(admin)},${quote(gateway)},${quote(credential)})`;
  const ingest=`select register_telematics_gateway(${quote(admin)},${quote(extraGateways[index])},'Synthetic credential race',${quote(credential)},true)`;
  const result=await race(privacyFirst?privacy:ingest,privacyFirst?ingest:privacy);
  assert.notEqual(result.code,0);assert.match(result.error,/ERROR:\s+PRIVACY_GATEWAY_UNAVAILABLE(?:\r?\n|$)/);
  assert.equal(await checked('select not exists(select 1 from telematics_gateways ingest join telematics_gateways privacy on ingest.token_digest=privacy.privacy_token_digest);'),'t');
  console.log('PASS: '+stage+' waits and preserves global separation');
 }
}catch(error){failed=true;console.error('FAIL: '+stage+' ('+(error instanceof Error?error.name:'unknown')+')');process.exitCode=1;}
finally{
 if(verified&&started){try{await cleanup();console.log('CLEANUP: exact synthetic privacy fixtures absent');}
 catch{console.error('FAIL: exact privacy fixture cleanup');process.exitCode=1;}}
}
if(!failed&&!process.exitCode)console.log(JSON.stringify({ok:true,races:6,target:'isolated Loadgistic clone',cleanup:true}));
