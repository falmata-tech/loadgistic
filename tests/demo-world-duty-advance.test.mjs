import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {advanceDemoDuty} from '../src/lib/demo-world-duty-advance.js';

const workerId='11111111-1111-4111-8111-111111111111';
const lease='22222222-2222-4222-8222-222222222222';
const status={enabled:false,pending_count:0,exhausted_count:0,last_completed_phase:null};

test('disabled duty lane claims nothing and reports bounded status',async()=>{
  const calls=[];
  const result=await advanceDemoDuty({rpc:async(name,args)=>{
    calls.push({name,args});
    return name==='demo_world_claim_duty'?{data:[],error:null}:{data:status,error:null};
  }},{workerId});
  assert.deepEqual(calls,[
    {name:'demo_world_claim_duty',args:{worker_id:workerId}},
    {name:'demo_world_duty_status',args:undefined}
  ]);
  assert.equal(result.duty_accepted,0);
  assert.equal(result.duty_enabled,false);
});

test('a due phase executes only the database-selected job and lease',async()=>{
  const calls=[];
  const result=await advanceDemoDuty({rpc:async(name,args)=>{
    calls.push({name,args});
    if(name==='demo_world_claim_duty')return {data:[{job_id:7,lease_token:lease}],error:null};
    if(name==='demo_world_execute_duty')return {data:{result:'APPLIED',phase:'OFF_DUTY'},error:null};
    return {data:{...status,enabled:true,last_completed_phase:'OFF_DUTY'},error:null};
  }},{workerId});
  assert.deepEqual(calls[1],{name:'demo_world_execute_duty',args:{job_id:7,lease_token:lease}});
  assert.equal(result.duty_completed,1);
  assert.equal(result.duty_last_completed_phase,'OFF_DUTY');
});

test('invalid worker, claim, result or status fails closed',async()=>{
  await assert.rejects(()=>advanceDemoDuty({rpc:async()=>{throw Error('SHOULD_NOT_OPEN');}},
    {workerId:'bad'}),/DEMO_DUTY_WORKER_INVALID/);
  for(const claim of [{data:[{job_id:1,lease_token:'bad'}],error:null},
    {data:[{job_id:1,lease_token:lease},{job_id:2,lease_token:lease}],error:null},
    {data:null,error:{message:'private'}}]){
    let executed=false;
    await assert.rejects(()=>advanceDemoDuty({rpc:async name=>{
      if(name==='demo_world_claim_duty')return claim;
      executed=true;return {data:status,error:null};
    }},{workerId}),/DEMO_DUTY_CLAIM_INVALID/);
    assert.equal(executed,false);
  }
  await assert.rejects(()=>advanceDemoDuty({rpc:async name=>
    name==='demo_world_claim_duty'?{data:[{job_id:1,lease_token:lease}],error:null}
      :{data:{result:'APPLIED',phase:'OTHER'},error:null}},{workerId}),/DEMO_DUTY_STEP_FAILED/);
  await assert.rejects(()=>advanceDemoDuty({rpc:async name=>
    name==='demo_world_claim_duty'?{data:[],error:null}
      :{data:{...status,pending_count:-1},error:null}},{workerId}),/DEMO_DUTY_STATUS_INVALID/);
});

test('exact duty manifest matches the checked-in synthetic vehicle, assignment and migration',()=>{
  const fixture=JSON.parse(readFileSync(new URL('../resources/fixtures/managed-market.json',import.meta.url)));
  const manifest=JSON.parse(readFileSync(new URL('../resources/fixtures/demo-world-duty.json',import.meta.url)));
  const sql=readFileSync(new URL('../supabase/migrations/198_demo_world_vehicle_duty.sql',import.meta.url),'utf8');
  const vehicle=fixture.tables.vehicles.find(row=>row.id===manifest.vehicle_key);
  const assignment=fixture.tables.driver_vehicle_assignments.find(row=>row.vehicle_id===vehicle.id&&row.active);
  const capacity=fixture.tables.capacities.find(row=>row.vehicle_id===vehicle.id);
  assert.equal(vehicle.organization_id,manifest.organization_key);
  assert.equal(vehicle.platform_number,manifest.platform_number);
  assert.equal(assignment.driver_user_id,manifest.driver_key);
  assert.equal(capacity.status,manifest.baseline_status);
  assert.equal(capacity.visibility,'OPEN');
  assert.deepEqual(manifest.daily_slots_utc,[630,650]);
  for(const value of [manifest.vehicle_id,manifest.organization_id,manifest.platform_number,
    manifest.owner_key,manifest.driver_key])assert.ok(sql.includes(value));
  assert.match(sql,/public\.publish_provider_capacity\(owner_id,next_command\)/);
  assert.match(sql,/demo_world_duty_receipt_immutable/);
  assert.match(sql,/DEMO_DUTY_BASELINE_REFUSED/);
});
