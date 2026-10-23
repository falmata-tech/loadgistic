import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateDemoWorldManifest,planDemoWorldSlot,planDemoWorldThrough} from '../src/lib/demo-world-planner.mjs';

const fixture=JSON.parse(readFileSync(new URL('../resources/fixtures/managed-market.json',import.meta.url),'utf8'));
const manifest=JSON.parse(readFileSync(new URL('../resources/fixtures/demo-world-scenarios.json',import.meta.url),'utf8'));
const copy=value=>structuredClone(value);

test('demo-world manifest is bound to exact synthetic fixture ownership and capacity rows',()=>{
 assert.equal(validateDemoWorldManifest(manifest,fixture),true);
 assert.equal(manifest.execution_scope,'local-dry-run');
 assert.ok(!JSON.stringify(manifest).match(/email|phone|secret|password/i));
});

test('capacity scenario produces deterministic, replay-stable plans at its two daily slots',()=>{
 const first=planDemoWorldSlot({manifest,fixture,at:'2026-10-21T08:00:00.000Z'});
 const replay=planDemoWorldSlot({manifest,fixture,at:new Date('2026-10-21T08:00:00.000Z')});
 const second=planDemoWorldSlot({manifest,fixture,at:'2026-10-21T14:00:00.000Z'});
 assert.deepEqual(first,replay);
 assert.equal(first.length,1);
 assert.equal(first[0].expectedStatus,'PARTIAL');
 assert.equal(first[0].nextStatus,'EMPTY');
 assert.equal(first[0].command,'capacity.set_status');
 assert.match(first[0].idempotencyKey,/^[a-f0-9]{64}$/);
 assert.notEqual(first[0].idempotencyKey,second[0].idempotencyKey);
 assert.equal(second[0].expectedStatus,'EMPTY');
 assert.equal(second[0].nextStatus,'PARTIAL');
});

test('unscheduled and non-minute instants produce no action',()=>{
 assert.deepEqual(planDemoWorldSlot({manifest,fixture,at:'2026-10-21T09:10:00.000Z'}),[]);
 assert.deepEqual(planDemoWorldSlot({manifest,fixture,at:'2026-10-21T08:00:01.000Z'}),[]);
 assert.throws(()=>planDemoWorldSlot({manifest,fixture,at:'not-a-date'}),{message:'DEMO_WORLD_TIME_INVALID'});
});

test('bounded daily plan covers five exact demo vehicles in order and can be replayed',()=>{
 const morning=planDemoWorldThrough({manifest,fixture,at:'2026-10-22T09:00:00.000Z'});
 const afternoon=planDemoWorldThrough({manifest,fixture,at:'2026-10-22T15:00:00.000Z'});
 assert.equal(morning.length,5);
 assert.equal(afternoon.length,14);
 assert.deepEqual(afternoon.slice(0,5),morning);
 assert.equal(new Set(afternoon.map(item=>item.vehicleFixtureKey)).size,5);
 assert.deepEqual(afternoon.map(item=>item.scheduledAt),[...afternoon.map(item=>item.scheduledAt)].sort());
 assert.deepEqual(planDemoWorldThrough({manifest,fixture,at:'2026-10-22T15:00:00.000Z'}),afternoon);
});

test('Empty-period load preference and route steps are ordered and return to baseline',()=>{
 const plans=planDemoWorldThrough({manifest,fixture,at:'2026-10-22T15:00:00.000Z'});
 const loads=plans.filter(item=>item.command==='capacity.set_load_preference');
 const routes=plans.filter(item=>item.command==='capacity.set_route');
 assert.deepEqual(loads.map(item=>[item.expectedStatus,item.nextStatus,item.expectedLoads,item.nextLoads]),
  [['EMPTY','EMPTY','PTL','BOTH'],['EMPTY','EMPTY','BOTH','PTL']]);
 assert.deepEqual(routes.map(item=>[item.expectedStatus,item.nextStatus]),[['EMPTY','EMPTY'],['EMPTY','EMPTY']]);
 assert.deepEqual(routes[0].expectedRouteRefs,routes[1].nextRouteRefs);
 assert.deepEqual(routes[0].nextRouteRefs,routes[1].expectedRouteRefs);
 assert.ok(routes[0].nextRouteRefs.includes('builtin:adigrat'));
 assert.ok(new Set(plans.map(item=>item.idempotencyKey)).size===plans.length);
});

test('the planner leaves the curated stable Empty and Partial examples outside the transition',()=>{
 const plan=planDemoWorldSlot({manifest,fixture,at:'2026-10-21T08:00:00.000Z'});
 assert.deepEqual(plan.map(item=>item.vehicleFixtureKey),['veh-driver-1']);
 for(const target of manifest.targets.filter(item=>!item.mutable)){
  const capacity=fixture.tables.capacities.find(row=>row.id===target.fixture_capacity_key);
  assert.equal(capacity.status,target.baseline_status);
 }
});

test('rejects non-synthetic scope, mismatched owner links, and fixture drift',()=>{
 const wrongScope=copy(manifest);wrongScope.fixture_source='another-app';
 assert.throws(()=>validateDemoWorldManifest(wrongScope,fixture),{message:'DEMO_WORLD_SCOPE_REFUSED'});
 const wrongOwner=copy(fixture);wrongOwner.tables.vehicles.find(row=>row.id==='veh-driver-1').provider_profile_id='profile-public-owner-02';
 assert.throws(()=>validateDemoWorldManifest(manifest,wrongOwner),{message:'DEMO_WORLD_TARGET_NOT_OWNED'});
 const changedBaseline=copy(fixture);changedBaseline.tables.capacities.find(row=>row.id==='cap-partial').status='EMPTY';
 assert.throws(()=>validateDemoWorldManifest(manifest,changedBaseline),{message:'DEMO_WORLD_BASELINE_MISMATCH'});
});

test('rejects unknown actors, duplicated targets, and commands outside the narrow allowlist',()=>{
 const unknownActor=copy(manifest);unknownActor.actors[0].fixture_user_key='real-customer';
 assert.throws(()=>validateDemoWorldManifest(unknownActor,fixture),{message:'DEMO_WORLD_ACTOR_NOT_ALLOWLISTED'});
 const duplicateTarget=copy(manifest);duplicateTarget.targets.push({...duplicateTarget.targets[0],key:'duplicate'});
 assert.throws(()=>validateDemoWorldManifest(duplicateTarget,fixture),{message:'DEMO_WORLD_TARGET_DUPLICATED'});
 const outboundCommand=copy(manifest);outboundCommand.scenarios[0].command='notifications.send';
 assert.throws(()=>validateDemoWorldManifest(outboundCommand,fixture),{message:'DEMO_WORLD_COMMAND_REFUSED'});
 const extraContact=copy(manifest);extraContact.actors[0].email='someone@example.com';
 assert.throws(()=>validateDemoWorldManifest(extraContact,fixture),{message:'DEMO_WORLD_ACTOR_SHAPE_INVALID'});
});

test('rejects invalid statuses, broken transition chains and unsupported schedule slots',()=>{
 const invalidStatus=copy(manifest);invalidStatus.scenarios[0].transitions[0].to='OFF_DUTY';
 assert.throws(()=>validateDemoWorldManifest(invalidStatus,fixture),{message:'DEMO_WORLD_STATUS_REFUSED'});
 const brokenChain=copy(manifest);brokenChain.scenarios[0].transitions[1].from='PARTIAL';brokenChain.scenarios[0].transitions[1].to='EMPTY';
 assert.throws(()=>validateDemoWorldManifest(brokenChain,fixture),{message:'DEMO_WORLD_TRANSITION_CHAIN_INVALID'});
 const invalidSlot=copy(manifest);invalidSlot.scenarios[0].daily_slots_utc[0]=1440;
 assert.throws(()=>validateDemoWorldManifest(invalidSlot,fixture),{message:'DEMO_WORLD_SLOT_INVALID'});
});

test('rejects a route outside the fixture, preference drift, or editing after the status returns Partial',()=>{
 const unknownPlace=copy(manifest);
 unknownPlace.targets.find(target=>target.key==='fleet-04-partial').alternate_route_refs[2]='unlisted:somewhere';
 assert.throws(()=>validateDemoWorldManifest(unknownPlace,fixture),{message:'DEMO_WORLD_ROUTE_REFUSED'});
 const driftedLoad=copy(manifest);
 driftedLoad.scenarios.find(scenario=>scenario.key==='fleet-01-load-preference').transitions[0].from='FTL';
 assert.throws(()=>validateDemoWorldManifest(driftedLoad,fixture),{message:'DEMO_WORLD_TRANSITION_CHAIN_INVALID'});
 const afterPartial=copy(manifest);
 afterPartial.scenarios.find(scenario=>scenario.key==='fleet-04-route').daily_slots_utc[1]=900;
 assert.throws(()=>validateDemoWorldManifest(afterPartial,fixture),{message:'DEMO_WORLD_TRANSITION_CHAIN_INVALID'});
 const duplicate=copy(manifest);
 duplicate.scenarios.find(scenario=>scenario.key==='fleet-04-route').daily_slots_utc[0]=525;
 assert.throws(()=>validateDemoWorldManifest(duplicate,fixture),{message:'DEMO_WORLD_SLOT_INVALID'});
});
