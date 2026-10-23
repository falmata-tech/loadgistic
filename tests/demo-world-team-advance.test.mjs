import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {advanceDemoTeam} from '../src/lib/demo-world-team-advance.js';

const workerId='11111111-1111-4111-8111-111111111111';
const lease='22222222-2222-4222-8222-222222222222';
const status={enabled:false,target_bound:false,pending_count:0,exhausted_count:0,last_completed_phase:null};

test('default-off team lane claims nothing and reports bounded status',async()=>{
  const names=[];
  const result=await advanceDemoTeam({rpc:async(name,args)=>{
    names.push({name,args});
    return name==='demo_world_claim_team'?{data:[],error:null}:{data:status,error:null};
  }},{workerId});
  assert.deepEqual(names,[
    {name:'demo_world_claim_team',args:{worker_id:workerId}},
    {name:'demo_world_team_status',args:undefined}
  ]);
  assert.equal(result.team_accepted,0);
  assert.equal(result.team_enabled,false);
});

test('claimed team phase executes only the database-selected job and lease',async()=>{
  const calls=[];
  const result=await advanceDemoTeam({rpc:async(name,args)=>{
    calls.push({name,args});
    if(name==='demo_world_claim_team')return {data:[{job_id:7,lease_token:lease}],error:null};
    if(name==='demo_world_execute_team')return {data:{result:'APPLIED',phase:'CAPACITY_OFF'},error:null};
    return {data:{...status,enabled:true,target_bound:true,last_completed_phase:'CAPACITY_OFF'},error:null};
  }},{workerId});
  assert.deepEqual(calls[1],{name:'demo_world_execute_team',args:{job_id:7,lease_token:lease}});
  assert.equal(result.team_completed,1);
  assert.equal(result.team_last_completed_phase,'CAPACITY_OFF');
});

test('malformed claims, failed steps and invalid status fail closed',async()=>{
  for(const claim of [{data:[{job_id:1,lease_token:'bad'}],error:null},
    {data:[{job_id:1,lease_token:lease},{job_id:2,lease_token:lease}],error:null},
    {data:null,error:{message:'private'}}]){
    let executed=false;
    await assert.rejects(()=>advanceDemoTeam({rpc:async name=>{
      if(name==='demo_world_claim_team')return claim;
      executed=true;return {data:status,error:null};
    }},{workerId}),/DEMO_TEAM_CLAIM_INVALID/);
    assert.equal(executed,false);
  }
  await assert.rejects(()=>advanceDemoTeam({rpc:async name=>
    name==='demo_world_claim_team'?{data:[{job_id:1,lease_token:lease}],error:null}
      :{data:null,error:{message:'private'}}},{workerId}),/DEMO_TEAM_STEP_FAILED/);
  await assert.rejects(()=>advanceDemoTeam({rpc:async name=>
    name==='demo_world_claim_team'?{data:[],error:null}
      :{data:{...status,pending_count:-1},error:null}},{workerId}),/DEMO_TEAM_STATUS_INVALID/);
});

test('checked-in exact fixture, default-off controls and normal command match the migration',()=>{
  const fixture=JSON.parse(readFileSync(new URL('../resources/fixtures/demo-world-broker-staff.json',import.meta.url)));
  const sql=readFileSync(new URL('../supabase/migrations/196_demo_world_broker_staff_permission.sql',import.meta.url),'utf8');
  assert.equal(fixture.state,'inert-unbound');
  assert.equal(fixture.fixture_source,'loadgistic');
  assert.deepEqual(fixture.capacity_phases,['CAPACITY_OFF','CAPACITY_ON']);
  assert.deepEqual(fixture.daily_slots_utc,[600,840]);
  for(const exact of [fixture.workspace_id,fixture.owner_fixture_key,fixture.staff_fixture_key,fixture.staff_email]){
    assert.ok(sql.includes(exact));
  }
  assert.match(sql,/create table public\.demo_world_team_target/);
  assert.match(sql,/create table public\.demo_world_team_receipts/);
  assert.match(sql,/values\('CAPACITY_OFF',600\),\('CAPACITY_ON',840\)/);
  assert.match(sql,/public\.business_workspace_command\(target\.owner_id/);
  assert.match(sql,/not exists\(select 1 from public\.demo_world_control/);
});
