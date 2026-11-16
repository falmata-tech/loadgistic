import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {advanceDemoDuty} from '../src/lib/demo-world-duty-advance.js';

const workerId='11111111-1111-4111-8111-111111111111';
const status={enabled:false,pending_count:0,exhausted_count:0,last_completed_phase:null};

test('held duty lane reads status without claiming or mutating any job',async()=>{
  for(const enabled of [false,true]){
    const saved={enabled,pending_count:3,exhausted_count:1,last_completed_phase:'OFF_DUTY'};
    const before=structuredClone(saved),calls=[];
    const result=await advanceDemoDuty({rpc:async(name,args)=>{
      calls.push({name,args});assert.equal(name,'demo_world_duty_status');return {data:saved,error:null};
    }},{workerId});
    assert.deepEqual(calls,[{name:'demo_world_duty_status',args:undefined}]);
    assert.deepEqual(saved,before);
    assert.equal(result.duty_accepted,0);assert.equal(result.duty_completed,0);assert.equal(result.duty_replayed,0);
    assert.equal(result.duty_enabled,enabled);assert.equal(result.duty_pending_count,3);assert.equal(result.duty_exhausted_count,1);
    assert.equal(result.duty_last_completed_phase,'OFF_DUTY');
    assert.equal(result.duty_state,'HELD');assert.equal(result.duty_hold_reason,'MANUAL_LOCATION_RETIRED');
  }
});

test('held duty invalid worker and malformed readonly status still fail closed',async()=>{
  await assert.rejects(()=>advanceDemoDuty({rpc:async()=>{throw Error('SHOULD_NOT_OPEN');}},
    {workerId:'bad'}),/DEMO_DUTY_WORKER_INVALID/);
  for(const data of [null,{...status,pending_count:-1},{...status,exhausted_count:'1'},
    {...status,enabled:'true'},{...status,last_completed_phase:'FORGED'}]){
    const calls=[];
    await assert.rejects(()=>advanceDemoDuty({rpc:async name=>{
      calls.push(name);return {data,error:null};
    }},{workerId}),/DEMO_DUTY_STATUS_INVALID/);
    assert.deepEqual(calls,['demo_world_duty_status']);
  }
  await assert.rejects(()=>advanceDemoDuty({rpc:async()=>({data:status,error:{message:'private'}})},
    {workerId}),/DEMO_DUTY_STATUS_INVALID/);
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
