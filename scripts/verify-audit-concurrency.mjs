import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';

if(!/^project_id = "loadgistic-local"$/m.test(readFileSync('supabase/config.toml','utf8')))throw new Error('LOCAL_LOADGISTIC_REQUIRED');
const container='supabase_db_loadgistic-local';
const literal=value=>`'${String(value).replaceAll("'","''")}'`;
function session(){
 const child=spawn('docker',['exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-Atq','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});
 let output='';child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});
 const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>resolve({code,output}));});
 return {write:sql=>child.stdin.write(sql+'\n'),end:()=>child.stdin.end(),done,child,
  async until(marker){const stop=Date.now()+20000;while(!output.includes(marker)){if(Date.now()>stop||child.exitCode!==null)throw new Error('CONCURRENCY_SESSION_NOT_READY');await new Promise(resolve=>setTimeout(resolve,50));}}};
}
async function sql(command){const connection=session();connection.write(command);connection.end();const result=await connection.done;if(result.code!==0)throw new Error('AUDIT_SQL_FAILED: '+result.output.slice(-1500));return result.output.trim();}
async function queued(command,lockedCommand,afterLock,expected){
 const lock=session();const worker=session();
 try{
  lock.write(`set statement_timeout='25s';begin;${lockedCommand};select 'AUDIT_LOCKED';`);await lock.until('AUDIT_LOCKED');
  const tag='audit-writer-'+randomUUID();worker.write(`set application_name=${literal(tag)};set statement_timeout='20s';${command};`);worker.end();
  const stop=Date.now()+10000;let waiting=false;
  while(Date.now()<stop){
   waiting=(await sql(`select exists(select 1 from pg_stat_activity where application_name=${literal(tag)} and wait_event_type='Lock');`))==='t';
   if(waiting)break;await new Promise(resolve=>setTimeout(resolve,75));
  }
  assert.equal(waiting,true,'Writer must actually wait before the authority change');
  lock.write(afterLock+';commit;');lock.end();assert.equal((await lock.done).code,0,'Recovery/closure transaction must commit');
  const result=await worker.done;assert.notEqual(result.code,0,'Queued stale write must fail');assert.ok(result.output.includes(expected),'Expected current-authority denial');
 }finally{lock.child.kill();worker.child.kill();}
}
const owner=randomUUID(),oldDriver=randomUUID(),newDriver=randomUUID(),closing=randomUUID(),org=randomUUID(),provider=randomUUID(),truck1=randomUUID(),truck2=randomUUID(),tracking=randomUUID();
const actors=[owner,oldDriver,newDriver,closing];const ids=actors.map(literal).join(',');const suffix=randomUUID().slice(0,8);
try{
 await sql(`begin;
 insert into auth.users(id,email,email_confirmed_at,last_sign_in_at,raw_user_meta_data) values ${actors.map(id=>`(${literal(id)},${literal('audit-concurrency-'+id+'@example.invalid')},now(),now(),'{}')`).join(',')};
 update profiles set active=true,role='DRIVER',full_name='Audit concurrency Driver' where id in (${ids});
 update profiles set role='TRANSPORTER' where id=${literal(owner)};
 insert into organizations(id,name,handle,type) values(${literal(org)},'Audit concurrency fleet',${literal('audit-concurrency-'+suffix)},'TRANSPORT_COMPANY');
 insert into organization_members(user_id,organization_id,membership_role) values(${literal(owner)},${literal(org)},'OWNER'),(${literal(oldDriver)},${literal(org)},'DRIVER'),(${literal(newDriver)},${literal(org)},'DRIVER');
 insert into drivers(user_id,organization_id,name,active) values(${literal(oldDriver)},${literal(org)},'Audit old Driver',true),(${literal(newDriver)},${literal(org)},'Audit new Driver',true);
 insert into driver_permissions(user_id,can_manage_tracking) values(${literal(oldDriver)},true),(${literal(newDriver)},true);
 insert into subscriptions(organization_id,plan_id,status,billing_model,starts_at) select ${literal(org)},id,'SPONSORED','SPONSORED_FREE',now() from plans where audience='TRANSPORTER' and active limit 1;
 insert into provider_profiles(id,user_id,business_name,handle) values(${literal(provider)},${literal(closing)},'Audit closing provider',${literal('audit-closing-'+suffix)});
 insert into vehicles(id,organization_id,label,category,make,model,cargo_configuration,plate,platform_number,active) values
 (${literal(truck1)},${literal(org)},'Audit first','Pickup truck','Toyota','First','Pickup truck',${literal('AUDIT-A-'+suffix)},${literal('AUDIT-A-'+suffix)},true),
 (${literal(truck2)},${literal(org)},'Audit second','Pickup truck','Toyota','Second','Pickup truck',${literal('AUDIT-B-'+suffix)},${literal('AUDIT-B-'+suffix)},true);
 insert into driver_vehicle_assignments(driver_user_id,vehicle_id,assigned_by) values(${literal(oldDriver)},${literal(truck1)},${literal(owner)}),(${literal(newDriver)},${literal(truck2)},${literal(owner)});
 select create_provider_tracking_with_recipients(${literal(owner)},jsonb_build_object('id',${literal(tracking)},'code',${literal('LGX-'+suffix.toUpperCase())},'vehicle_id',${literal(truck1)},
 'origin_place_ref',(select id from place_catalog where normalized_name='addis ababa' limit 1),'destination_place_ref',(select id from place_catalog where normalized_name='adama' limit 1),
 'cargo_summary','Concurrency regression','customer_email','audit-concurrency@example.invalid','customer_email_digest',repeat('c',64),'additional_recipients','[]'::jsonb,'tracking_mode','LOCATION_AND_STATUS','tracking_code_hash',repeat('d',64),'review_code_hash',repeat('e',64)));
 commit;`);
 const location={area:'Around Addis Ababa',lat:'9',lng:'38.7',precision_km:'20',source:'DEVICE_OBSCURED'};
 for(const kind of ['status','location']){
  await sql(`update provider_shipments set assigned_vehicle_id=${literal(truck1)},assigned_driver_user_id=${literal(oldDriver)},operational_status=${literal(kind==='status'?'CREATED':'TO_PICKUP')} where id=${literal(tracking)};`);
  const command=kind==='status'?{next_status:'TO_PICKUP',note:'Queued former Driver',location}:location;
  await queued(`select update_provider_tracking_${kind}(${literal(oldDriver)},${literal(tracking)},${literal(JSON.stringify(command))}::jsonb)`,
   `select id from provider_shipments where id=${literal(tracking)} for update`,
   `select recover_provider_tracking(${literal(owner)},${literal(tracking)},jsonb_build_object('action','REASSIGN','revision',(tracking_recovery_context(${literal(owner)},${literal(tracking)})->>'revision'),'reason','Concurrent reassignment regression','vehicle_id',${literal(truck2)}))`,'NOT_FOUND');
  console.log('Queued former-Driver '+kind+' write denied after reassignment.');
 }
 assert.equal(await sql(`select count(*) from provider_shipment_events where shipment_id=${literal(tracking)} and created_by=${literal(oldDriver)};`),'0');
 for(const kind of ['truck','support']){
  await sql(`update profiles set active=true,account_deactivated_at=null where id=${literal(closing)};`);
  const insert=kind==='truck'?`insert into vehicles(provider_profile_id,label,category,platform_number,active) values(${literal(provider)},'Rejected concurrent truck','Pickup truck',${literal('AUDIT-C-'+suffix)},true)`:
   `insert into support_conversations(customer_user_id,category,status) values(${literal(closing)},'ACCOUNT','WAITING')`;
  await queued(insert,`select deactivate_own_account(${literal(closing)},'DEACTIVATE')`,`select 1`,kind==='truck'?'VEHICLE_OWNER_INACTIVE':'FORBIDDEN');
  console.log('Concurrent '+kind+' creation denied after account closure.');
 }
 await sql(`update provider_shipments set operational_status='CANCELLED' where id=${literal(tracking)};
 update driver_vehicle_assignments set active=false where vehicle_id in (${literal(truck1)},${literal(truck2)});`);
 await queued(`insert into driver_vehicle_assignments(driver_user_id,vehicle_id,assigned_by) values(${literal(oldDriver)},${literal(truck1)},${literal(owner)})`,
  `select deactivate_own_account(${literal(oldDriver)},'DEACTIVATE')`,`select 1`,'FORBIDDEN');
 console.log('Concurrent Driver assignment denied after account closure.');
 await sql(`update vehicles set active=false where organization_id=${literal(org)};
 update profiles set active=false where id=${literal(newDriver)};update drivers set active=false where user_id=${literal(newDriver)};`);
 await queued(`select fleet_invite_driver(${literal(owner)},'{"email":"concurrent-invite@example.invalid","name":"Concurrent invitation","phone":"+251911000000"}'::jsonb)`,
  `select deactivate_own_account(${literal(owner)},'DEACTIVATE')`,`select 1`,'FORBIDDEN');
 assert.equal(await sql(`select count(*) from fleet_driver_invitations where organization_id=${literal(org)};`),'0');
 assert.equal(await sql(`select count(*) from provider_tracking_recoveries where shipment_id=${literal(tracking)};`),'2');
 console.log('Concurrent Fleet invitation denied after owner closure; Tracking recovery history retained.');
}finally{
 await sql(`begin;
 delete from provider_tracking_recoveries where shipment_id=${literal(tracking)};
 delete from access_email_deliveries where entity_id=${literal(tracking)};
 delete from audit_logs where actor_user_id in (${ids}) or entity_id=${literal(tracking)};
 delete from provider_shipments where id=${literal(tracking)};
 delete from vehicles where organization_id=${literal(org)} or provider_profile_id=${literal(provider)};
 delete from support_conversations where customer_user_id in (${ids});
 delete from organizations where id=${literal(org)};
 delete from auth.users where id in (${ids});commit;`);
 console.log('Exact synthetic concurrency identities and work removed.');
}
