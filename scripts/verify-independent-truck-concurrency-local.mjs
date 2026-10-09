import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
assert.match(readFileSync('supabase/config.toml','utf8'),/^project_id\s*=\s*"loadgistic-local"/m);
const actor=randomUUID(),provider=randomUUID();
let stage='setup';
function sql(input){
 return new Promise((resolve,reject)=>{
  const child=spawn('docker',['exec','-i','supabase_db_loadgistic-local','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],{stdio:['pipe','pipe','pipe']});
  let out='',error='';child.stdout.on('data',data=>out+=data);child.stderr.on('data',data=>error+=data);
  child.on('error',reject);child.on('close',code=>resolve({code,out:out.trim(),error}));child.stdin.end(input);
 });
}
async function checked(input){const result=await sql(input);assert.equal(result.code,0,'Local fixture/check operation failed');return result.out;}
const command={make:'Toyota',model:'Race fixture',plate:'SINGLE-RACE',cargo_configuration:'Pickup truck',use_basis:'OWNED'};
const quoted=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
const raceInput=value=>`begin; select public.create_provider_vehicle('${actor}',${quoted(value)}); select pg_sleep(0.25); commit;`;
try{
 await checked(`begin;
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values('${actor}','${actor}@example.test',now(),'{}','{}');
 update public.profiles set role='DRIVER',active=true where id='${actor}';
 insert into public.provider_profiles(id,user_id,business_name,handle) values('${provider}','${actor}','Disposable race fixture','race-${actor}'); commit;`);
 stage='concurrent initial additions';
 const additions=await Promise.all([sql(raceInput(command)),sql(raceInput(command))]);
 assert.equal(additions.filter(result=>result.code===0).length,1);assert.equal(additions.filter(result=>result.code!==0&&/ERROR:\s+SINGLE_TRUCK_LIMIT/.test(result.error)).length,1);
 assert.equal(await checked(`select count(*) from public.vehicles where provider_profile_id='${provider}' and active;`),'1');
 const oldId=await checked(`select id from public.vehicles where provider_profile_id='${provider}' and active;`);assert.match(oldId,/^[0-9a-f-]{36}$/);
 stage='concurrent same-truck replacements';
 const replacement={...command,replace_vehicle_id:oldId,replacement_confirmed:true,use_basis:'PERMISSION'};
 const changes=await Promise.all([sql(raceInput({...replacement,model:'Replacement A'})),sql(raceInput({...replacement,model:'Replacement B'}))]);
 assert.equal(changes.filter(result=>result.code===0).length,1);assert.equal(changes.filter(result=>result.code!==0&&/ERROR:\s+TRUCK_CHANGED/.test(result.error)).length,1);
 assert.equal(await checked(`select count(*)||':'||count(*)filter(where active) from public.vehicles where provider_profile_id='${provider}';`),'2:1');
 console.log('PASS: actual concurrent additions yield one current truck; concurrent replacements yield one replacement and one stale rejection; old history remains');
}catch(error){console.error(`FAIL: ${stage} (${error instanceof Error?error.name:'unknown'})`);process.exitCode=1;}
finally{
 await checked(`begin;
 delete from public.audit_logs where actor_user_id='${actor}';
 delete from public.capacities where provider_profile_id='${provider}';
 delete from public.vehicles where provider_profile_id='${provider}';
 delete from auth.users where id='${actor}';commit;`);
 console.log('CLEANUP: exact disposable local actor/provider/truck fixtures only');
}
