import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {advanceDemoProfile} from '../src/lib/demo-world-profile-advance.js';

const workerId='11111111-1111-4111-8111-111111111111';
const lease='22222222-2222-4222-8222-222222222222';
const status={enabled:false,target_bound:false,pending_count:0,exhausted_count:0,last_completed_phase:null};

test('disabled profile lane claims nothing and reports bounded status',async()=>{
  const names=[];
  const result=await advanceDemoProfile({rpc:async(name,args)=>{
    names.push({name,args});
    return name==='demo_world_claim_profile'?{data:[],error:null}:{data:status,error:null};
  }},{workerId});
  assert.deepEqual(names,[
    {name:'demo_world_claim_profile',args:{worker_id:workerId}},
    {name:'demo_world_profile_status',args:undefined}
  ]);
  assert.equal(result.profile_accepted,0);
  assert.equal(result.profile_enabled,false);
});

test('a claimed phase uses only the database-selected job and lease',async()=>{
  const calls=[];
  const result=await advanceDemoProfile({rpc:async(name,args)=>{
    calls.push({name,args});
    if(name==='demo_world_claim_profile')return {data:[{job_id:7,lease_token:lease}],error:null};
    if(name==='demo_world_execute_profile')return {data:{result:'APPLIED',phase:'SHOW_DEMO'},error:null};
    return {data:{...status,enabled:true,target_bound:true,last_completed_phase:'SHOW_DEMO'},error:null};
  }},{workerId});
  assert.deepEqual(calls[1],{name:'demo_world_execute_profile',args:{job_id:7,lease_token:lease}});
  assert.equal(result.profile_completed,1);
  assert.equal(result.profile_last_completed_phase,'SHOW_DEMO');
});

test('malformed claims, failed steps and invalid status fail closed',async()=>{
  for(const claim of [{data:[{job_id:1,lease_token:'bad'}],error:null},
    {data:[{job_id:1,lease_token:lease},{job_id:2,lease_token:lease}],error:null},
    {data:null,error:{message:'private'}}]){
    let executed=false;
    await assert.rejects(()=>advanceDemoProfile({rpc:async name=>{
      if(name==='demo_world_claim_profile')return claim;
      executed=true;return {data:status,error:null};
    }},{workerId}),/DEMO_PROFILE_CLAIM_INVALID/);
    assert.equal(executed,false);
  }
  await assert.rejects(()=>advanceDemoProfile({rpc:async name=>
    name==='demo_world_claim_profile'?{data:[{job_id:1,lease_token:lease}],error:null}
      :{data:null,error:{message:'private'}}},{workerId}),/DEMO_PROFILE_STEP_FAILED/);
  await assert.rejects(()=>advanceDemoProfile({rpc:async name=>
    name==='demo_world_claim_profile'?{data:[],error:null}
      :{data:{...status,pending_count:-1},error:null}},{workerId}),/DEMO_PROFILE_STATUS_INVALID/);
});

test('checked-in profile target and schedule match the managed demo fixture',()=>{
  const fixture=JSON.parse(readFileSync(new URL('../resources/fixtures/managed-market.json',import.meta.url)));
  const contract=JSON.parse(readFileSync(new URL('../resources/fixtures/demo-world-profile.json',import.meta.url)));
  const page=fixture.tables.company_pages.find(row=>row.id===contract.page_key);
  const provider=fixture.tables.organizations.find(row=>row.id===contract.organization_key);
  const actor=fixture.tables.users.find(row=>row.id===contract.actor_key);
  const originalSql=readFileSync(new URL('../supabase/migrations/195_demo_world_provider_profile.sql',import.meta.url),'utf8');
  const v2Sql=readFileSync(new URL('../supabase/migrations/197_demo_world_provider_profile_copy_v2.sql',import.meta.url),'utf8');
  assert.equal(actor.organization_id,provider.id);
  assert.equal(page.organization_id,provider.id);
  assert.equal(page.published,1);
  assert.equal(page.headline,contract.baseline.headline);
  assert.equal(page.about,contract.baseline.about);
  assert.deepEqual(contract.daily_slots_utc,[540,900]);
  assert.equal(contract.schema_version,2);
  for(const value of [contract.organization_id,contract.page_id,
    contract.baseline.headline,contract.baseline.about,
    contract.alternate.headline,contract.alternate.about,
    contract.previous_baseline.headline,contract.previous_baseline.about]){
    assert.ok(v2Sql.includes(value.replaceAll("'","''")));
  }
  assert.ok(v2Sql.includes(`page.headline='${page.headline}'`));
  assert.match(v2Sql,/page\.about='Around Addis Ababa, Sheger Freight Network works/);
  assert.match(originalSql,/create table public\.demo_world_profile_target/);
  assert.match(originalSql,/create table public\.demo_world_profile_receipts/);
  assert.match(originalSql,/values\('SHOW_DEMO',540\),\('RESTORE',900\)\)/);
  assert.match(originalSql,/public\.update_provider_profile_page\(target\.actor_id/);
  assert.match(v2Sql,/add column copy_version integer not null default 1/);
  assert.match(v2Sql,/alter column copy_version set default 2/);
  assert.match(v2Sql,/public\.update_provider_profile_page\(target\.actor_id/);
  assert.match(v2Sql,/DEMO_PROFILE_V2_HISTORY_REFUSED/);
  assert.ok(originalSql.includes(contract.previous_baseline.headline));
  assert.ok(originalSql.includes(contract.previous_baseline.about));
});
