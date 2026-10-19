// FEAT-GPS-001 / FEAT-TRK-001: prove demo phone/device/vehicle lock order in
// two real sessions. Run only against a disposable, isolated Loadgistic clone.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';

const container='supabase_db_loadgistic-local';
const database=process.env.LOADGISTIC_TEST_DATABASE||'';
const expected=process.argv[2];
assert.match(readFileSync(new URL('../supabase/config.toml',import.meta.url),'utf8'),/^project_id\s*=\s*"loadgistic-local"/m);
assert.match(database,/^loadgistic_(?:provider|telematics|gps)_[a-z0-9_]+$/,
 'Use LOADGISTIC_TEST_DATABASE for an isolated Loadgistic clone');
assert.ok(expected==='old-deadlock'||expected==='ordered','Pass old-deadlock or ordered');
const vehicle='2f22cc5a-d654-4405-98b7-9a1a9cf42fe3'; // Exact synthetic phone demo fixture.
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const active=new Set();

function session(){
 const child=spawn('docker',['exec','-i',container,'psql','-X','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-Atq'],
  {stdio:['pipe','pipe','pipe']});
 let out='',error='';active.add(child);
 const timer=setTimeout(()=>child.kill(),25000);
 child.stdout.on('data',chunk=>out+=chunk);
 child.stderr.on('data',chunk=>error+=chunk);
 const done=new Promise((resolve,reject)=>{
  child.on('error',reject);
  child.on('close',code=>{clearTimeout(timer);active.delete(child);resolve({code,out:out.trim(),error});});
 });
 return {child,done,write:sql=>child.stdin.write(sql+'\n'),end:()=>child.stdin.end(),async until(marker){
  const deadline=Date.now()+10000;
  while(!out.includes(marker)){
   if(Date.now()>deadline||child.exitCode!==null)throw Error('LOCK_ORDER_MARKER_MISSING');
   await new Promise(resolve=>setTimeout(resolve,50));
  }
 }};
}
async function sql(query){
 const s=session();s.write("set statement_timeout='15s';set lock_timeout='10s';"+query);s.end();return s.done;
}
async function checked(query){
 const result=await sql(query);assert.equal(result.code,0,'LOCK_ORDER_SQL_FAILED: '+result.error.slice(0,250));return result.out;
}
async function waiting(tag){
 const deadline=Date.now()+7000;
 while(Date.now()<deadline){
  const value=await checked(`select exists(select 1 from pg_stat_activity where datname=current_database()
   and application_name=${quote(tag)} and wait_event_type='Lock');`);
  if(value==='t')return;
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 throw Error('PHONE_REPORT_DID_NOT_WAIT_ON_DEVICE');
}

let configured=false,created=false,phase='preflight';
try{
 const inspect=spawn('docker',['inspect','--format','{{ index .Config.Labels "com.supabase.cli.project" }}',container]);
 let label='';inspect.stdout.on('data',chunk=>label+=chunk);
 assert.equal((await new Promise(resolve=>inspect.on('close',resolve))),0,'Container unavailable');
 assert.equal(label.trim(),'loadgistic-local','Wrong local project');
 assert.equal(await checked('select current_database()'),database,'Wrong isolated database');
 const body=await checked("select pg_get_functiondef('public.refresh_provider_capacity_location(uuid,jsonb)'::regprocedure)");
 assert.equal(body.includes('refresh_provider_capacity_location_pre_driver172(actor_user_id,command)'),true,
  'Expected the driver-manual wrapper');
 assert.equal(body.includes('result:=public.refresh_provider_capacity_location_pre_driver172'),expected==='ordered',
  'Wrong migration state for requested race');
 const before=await checked(`select exists(select 1 from demo_motion_targets where vehicle_id=${quote(vehicle)})`);
 created=before==='f';
 // The protected fixture validator checks its owner, assignment, device and
 // source. It will reject a real or altered account; do not bypass it.
 const context=JSON.parse(await checked(`select demo_motion_binding(${quote(vehicle)})`));
 assert.equal(context.source,'MOBILE','Synthetic phone demo source required');
 assert.equal(context.vehicleId,vehicle);
 const setup=JSON.parse(await checked(`select configure_demo_motion_target(${quote(vehicle)})`));
 assert.equal(setup.configured,true);
 configured=true;
 const prior=await checked(`select to_jsonb(t)::text from demo_motion_targets t where vehicle_id=${quote(vehicle)}`);
 const tag='capacity-lock-'+randomUUID(),marker='DEVICE_HELD_'+randomUUID();
 const deviceSession=session(),phoneSession=session();
 phase='two-session race';
 try{
  deviceSession.write(`set statement_timeout='15s';set lock_timeout='10s';set deadlock_timeout='300ms';begin;
   select 1 from telematics_devices where id=${quote(context.deviceId)} for update;
   select ${quote(marker)};`);
  await deviceSession.until(marker);
  phoneSession.write(`set application_name=${quote(tag)};set statement_timeout='15s';set lock_timeout='10s';
   set deadlock_timeout='300ms';begin;
   select refresh_provider_capacity_location(${quote(context.driverId)},
    jsonb_build_object('vehicle_id',${quote(vehicle)},'approximate_lat',9.03,'approximate_lng',38.76,
     'location_precision_km',10));rollback;`);
  phoneSession.end();
  await waiting(tag);
  deviceSession.write(`select 1 from vehicles where id=${quote(vehicle)} for update;commit;`);
  deviceSession.end();
  const [deviceResult,phoneResult]=await Promise.all([deviceSession.done,phoneSession.done]);
  const deadlock=/deadlock detected/i.test(deviceResult.error+'\n'+phoneResult.error);
  if(expected==='old-deadlock'){
   assert.equal(deadlock,true,'Old wrapper did not reproduce device/vehicle deadlock');
  }else{
   assert.equal(deadlock,false,'New wrapper still deadlocked');
   assert.equal(deviceResult.code,0,'Demo device-to-vehicle lock failed');
  }
  assert.equal(await checked(`select to_jsonb(t)::text from demo_motion_targets t where vehicle_id=${quote(vehicle)}`),prior,
   'Rejected/rolled-back phone race mutated the demo target');
  console.log(JSON.stringify({ok:true,mode:expected,deadlock,deviceCompleted:deviceResult.code===0,
   phoneCompleted:phoneResult.code===0,target:'isolated Loadgistic clone'}));
 }finally{deviceSession.child.kill();phoneSession.child.kill();}
}catch(error){console.error('FAIL: '+phase+' ('+(error instanceof Error?error.message:'unknown')+')');process.exitCode=1;}
finally{
 for(const child of active)child.kill();
 if(configured&&created){
  try{await checked(`delete from demo_motion_targets where vehicle_id=${quote(vehicle)};
   select not exists(select 1 from demo_motion_targets where vehicle_id=${quote(vehicle)})`);}
  catch{console.error('FAIL: isolated demo target cleanup');process.exitCode=1;}
 }
}
