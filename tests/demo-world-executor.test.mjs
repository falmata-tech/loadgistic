import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {planDemoWorldSlot} from '../src/lib/demo-world-planner.mjs';
import {executeDemoCapacityPlan} from '../src/lib/demo-world-executor.mjs';

const fixture=JSON.parse(readFileSync(new URL('../resources/fixtures/managed-market.json',import.meta.url),'utf8'));
const manifest=JSON.parse(readFileSync(new URL('../resources/fixtures/demo-world-scenarios.json',import.meta.url),'utf8'));
const plan=planDemoWorldSlot({fixture,manifest,at:'2026-10-21T08:00:00.000Z'})[0];
const actorFixture=fixture.tables.users.find(row=>row.id===plan.actorFixtureKey);
const actor={id:'c39ee935-2b9a-484e-9d81-b525955d2c7d',email:actorFixture.email,
 app_metadata:{fixture_source:'loadgistic'},user_metadata:{fixture_key:actorFixture.id}};
const driver={...actor};
const route=[{place_ref:'builtin:sebeta',lat:8.9,lng:38.6},{place_ref:'builtin:adama',lat:8.54,lng:39.27}];
function fixtureUuid(value){
 if(value===null||value===undefined||value==='')return null;
 const bytes=createHash('sha256').update(`loadgistic-fixture:${value}`).digest().subarray(0,16);
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=bytes.toString('hex');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
function fixtureActor(key){
 const row=fixture.tables.users.find(user=>user.id===key);
 return key==='user-driver'?actor:{id:fixtureUuid(`auth:${key}`),email:row.email,
  app_metadata:{fixture_source:'loadgistic'},user_metadata:{fixture_key:key}};
}
function flags(loads){return {accepts_full_load:loads==='FTL'||loads==='BOTH',accepts_partial_load:loads==='PTL'||loads==='BOTH'};}
function clientFor({forPlan=plan,status='PARTIAL',source='DEVICE_OBSCURED',actorUser,driverUser,visibility,
 sharingMode,accepted='PTL',currentRoute=route,receiptId='saved-capacity',recordedCapacity,
 alterSharingAfterWrite=false}={}){
 const selectedSharing=sharingMode||forPlan.expectedSharingMode;
 const selectedVisibility=visibility|| (selectedSharing==='PRIVATE'?'PRIVATE':'OPEN');
 const vehicleFixture=fixture.tables.vehicles.find(vehicle=>vehicle.id===forPlan.vehicleFixtureKey);
 const vehicleId=fixtureUuid(vehicleFixture.id);
 const assignment=fixture.tables.driver_vehicle_assignments.find(row=>row.vehicle_id===vehicleFixture.id&&row.active);
 const selectedActor=actorUser||fixtureActor(forPlan.actorFixtureKey);
 const selectedDriver=driverUser||fixtureActor(assignment?.driver_user_id||forPlan.actorFixtureKey);
 const calls=[];
 const latest={id:'previous-capacity',status,visibility:selectedVisibility,availability_geometry:'ROUTE',current_route_points_json:currentRoute,
  capacity_area_center_place_ref:null,capacity_area_boundary_json:[],...flags(accepted),accepts_multi_pick:true,accepts_multi_drop:false,
  location_source:source,updated_by:selectedActor.id,updated_at:'2026-10-21T07:00:00Z'};
 const rows={profiles:{role:fixture.tables.users.find(user=>user.id===forPlan.actorFixtureKey).role,active:true},
  vehicles:{id:vehicleId,active:true,publication_status:'LIVE',organization_id:fixtureUuid(vehicleFixture.organization_id),
   provider_profile_id:fixtureUuid(vehicleFixture.provider_profile_id)},
  driver_vehicle_assignments:[{driver_user_id:selectedDriver.id}],capacities:latest,vehicle_capacity_sharing:{mode:selectedSharing}};
 const users=selectedDriver.id===selectedActor.id?[selectedActor]:[selectedActor,selectedDriver];
 const client={auth:{admin:{listUsers:async()=>({data:{users},error:null})}},
  from(table){const filters=[];let fields='*';const project=value=>!value||fields==='*'?value:Object.fromEntries(
   fields.split(',').filter(key=>Object.hasOwn(value,key)).map(key=>[key,value[key]]));
   const query={select(value){fields=value;return query;},eq(key,value){filters.push([key,value]);return query;},order(){return query;},limit(){return query;},
   single(){const saved=table==='capacities'&&filters.some(([key,value])=>key==='id'&&value===receiptId);
    const command=calls.at(-1)?.args.command;
    const savedLoads=command?.status==='PARTIAL'?'PTL':command?.accepted_loads||'PTL';
    const value=saved?recordedCapacity||{...latest,id:receiptId,vehicle_id:vehicleId,status:command?.status||'EMPTY',
     current_route_points_json:command?.current_route_places||currentRoute,...flags(savedLoads),updated_by:selectedActor.id}
     :table==='vehicle_capacity_sharing'&&calls.length&&alterSharingAfterWrite?{mode:selectedSharing==='PRIVATE'?'PUBLIC':'PRIVATE'}:rows[table];
    return Promise.resolve({data:project(value),error:null});},
   then(resolve){return Promise.resolve({data:table==='capacities'?[project(latest)]:rows[table],error:null}).then(resolve);}};return query;},
  rpc:async(name,args)=>{calls.push({name,args});return {data:receiptId,error:null};}};
 return {client,calls};
}

test('executes the exact synthetic actor through the ordinary Capacity command and verifies readback',async()=>{
 const {client,calls}=clientFor();
 const result=await executeDemoCapacityPlan({plan,manifest,fixture,client});
 assert.equal(calls.length,1);assert.equal(calls[0].name,'publish_provider_capacity');
 assert.equal(calls[0].args.actor_user_id,actor.id);
 assert.deepEqual(calls[0].args.command.current_route_places,route);
 assert.equal(calls[0].args.command.location_source,'PRESERVE_DRIVER');
 assert.equal(calls[0].args.command.visibility,'PRIVATE');
 assert.equal(calls[0].args.command.sharing_mode,'PRIVATE');
 assert.equal(calls[0].args.command.accepted_loads,'PTL');
 assert.equal(calls[0].args.command.accepts_multi_pick,true);
 assert.equal(result.status,'EMPTY');assert.equal(result.replayed,false);
});

test('rejects stale state, replaced identity and non-fixture driver before any write',async()=>{
 for(const variation of [{status:'EMPTY'},{actorUser:{...actor,email:'stranger@example.com'}},
  {driverUser:{...driver,id:'dfd15eb4-812b-44b9-849e-0716f360394e',app_metadata:{fixture_source:'customer'}}},
  {driverUser:fixtureActor('user-public-fleet-driver-059')}]){
  const {client,calls}=clientFor(variation);
  await assert.rejects(()=>executeDemoCapacityPlan({plan,manifest,fixture,client}));
  assert.equal(calls.length,0);
 }
});

test('receipt replay is read-only after a later transition, but rejects receipt drift',async()=>{
 const {client,calls}=clientFor({status:'PARTIAL',receiptId:'earlier-saved-capacity'});
 const receipt={idempotencyKey:plan.idempotencyKey,transitionId:plan.transitionId,status:'EMPTY',
  vehicleId:'2f22cc5a-d654-4405-98b7-9a1a9cf42fe3',capacityId:'earlier-saved-capacity'};
 assert.equal((await executeDemoCapacityPlan({plan,manifest,fixture,client,priorReceipt:receipt})).replayed,true);
 assert.equal(calls.length,0);
 await assert.rejects(()=>executeDemoCapacityPlan({plan,manifest,fixture,client,priorReceipt:{...receipt,capacityId:'different'}}),
  {message:'DEMO_WORLD_RECEIPT_DRIFT'});
});

test('load and route receipts replay from their historical rows after later changes',async()=>{
 for(const [time,recordedLoads,recordedRoute] of [
  ['2026-10-21T09:15:00.000Z','BOTH',route],
  ['2026-10-21T10:00:00.000Z','PTL',null]
 ]){
  const earlier=planDemoWorldSlot({fixture,manifest,at:time})[0];
  const historicalRoute=(recordedRoute||earlier.nextRouteRefs.map(place_ref=>({place_ref})));
  const receiptId=`saved-${earlier.command}`;
  const vehicleId=fixtureUuid(earlier.vehicleFixtureKey),selectedActor=fixtureActor(earlier.actorFixtureKey);
  const receipt={idempotencyKey:earlier.idempotencyKey,transitionId:earlier.transitionId,
   vehicleId,capacityId:receiptId,status:'EMPTY',sharingMode:earlier.expectedSharingMode,
   acceptedLoads:recordedLoads,routeRefs:historicalRoute.map(point=>point.place_ref)};
  const recordedCapacity={id:receiptId,vehicle_id:vehicleId,status:'EMPTY',
   visibility:earlier.expectedSharingMode==='PRIVATE'?'PRIVATE':'OPEN',
   ...flags(recordedLoads),current_route_points_json:historicalRoute,updated_by:selectedActor.id};
  const {client,calls}=clientFor({forPlan:earlier,status:'PARTIAL',accepted:'PTL',
   currentRoute:route,receiptId,recordedCapacity});
  const result=await executeDemoCapacityPlan({plan:earlier,manifest,fixture,client,priorReceipt:receipt});
  assert.equal(result.replayed,true);assert.equal(calls.length,0);
 }
});

test('refuses a changed sharing policy or exclusive recipient before any Capacity write',async()=>{
 for(const variation of [{visibility:'PRIVATE',sharingMode:'PUBLIC'},{sharingMode:'EXCLUSIVE'}]){
  const {client,calls}=clientFor(variation);
  await assert.rejects(()=>executeDemoCapacityPlan({plan,manifest,fixture,client}),
   {message:'DEMO_WORLD_SHARING_REFUSED'});
  assert.equal(calls.length,0);
 }
});

test('preserves exact public and private-network sharing modes across saves',async()=>{
 for(const [at,mode] of [['2026-10-21T08:15:00.000Z','PUBLIC'],['2026-10-21T08:30:00.000Z','BOTH']]){
  const otherPlan=planDemoWorldSlot({fixture,manifest,at})[0];
  const {client,calls}=clientFor({forPlan:otherPlan});
  const outcome=await executeDemoCapacityPlan({plan:otherPlan,manifest,fixture,client});
  assert.equal(calls[0].args.command.sharing_mode,mode);
  assert.equal(outcome.sharingMode,mode);
  const drifted=clientFor({forPlan:otherPlan,sharingMode:mode==='PUBLIC'?'BOTH':'PUBLIC'});
  await assert.rejects(()=>executeDemoCapacityPlan({plan:otherPlan,manifest,fixture,client:drifted.client}),
   {message:'DEMO_WORLD_SHARING_REFUSED'});
  assert.equal(drifted.calls.length,0);
 }
});

test('refuses forged route, actor or command data even when the vehicle is fixture-marked',async()=>{
 const {client,calls}=clientFor();
 for(const forged of [{...plan,nextStatus:'PARTIAL'},{...plan,command:'capacity.set_route'},
  {...plan,actorFixtureKey:'user-public-owner-02'}]){
  await assert.rejects(()=>executeDemoCapacityPlan({plan:forged,manifest,fixture,client}),{message:'DEMO_WORLD_PLAN_REFUSED'});
 }
 assert.equal(calls.length,0);
});

test('saves the Empty-period accepted-load change and rejects a stale preference',async()=>{
 const loadPlan=planDemoWorldSlot({fixture,manifest,at:'2026-10-21T09:15:00.000Z'})[0];
 assert.equal(loadPlan.command,'capacity.set_load_preference');
 const {client,calls}=clientFor({forPlan:loadPlan,status:'EMPTY'});
 const result=await executeDemoCapacityPlan({plan:loadPlan,manifest,fixture,client});
 assert.equal(calls[0].name,'publish_provider_capacity');
 assert.equal(calls[0].args.command.accepted_loads,'BOTH');
 assert.equal(calls[0].args.command.sharing_mode,'PUBLIC');
 assert.equal(result.acceptedLoads,'BOTH');
 const stale=clientFor({forPlan:loadPlan,status:'EMPTY',accepted:'FTL'});
 await assert.rejects(()=>executeDemoCapacityPlan({plan:loadPlan,manifest,fixture,client:stale.client}),
  {message:'DEMO_WORLD_EXPECTED_STATE_CHANGED'});
 assert.equal(stale.calls.length,0);
});

test('saves the exact alternate fixture route and rejects changed route or source readback',async()=>{
 const routePlan=planDemoWorldSlot({fixture,manifest,at:'2026-10-21T10:00:00.000Z'})[0];
 assert.equal(routePlan.command,'capacity.set_route');
 const baseline=routePlan.expectedRouteRefs.map(place_ref=>({place_ref}));
 const {client,calls}=clientFor({forPlan:routePlan,status:'EMPTY',currentRoute:baseline});
 const result=await executeDemoCapacityPlan({plan:routePlan,manifest,fixture,client});
 assert.deepEqual(calls[0].args.command.current_route_places,routePlan.nextRouteRefs.map(place_ref=>({place_ref})));
 assert.deepEqual(result.routeRefs,routePlan.nextRouteRefs);
 const stale=clientFor({forPlan:routePlan,status:'EMPTY',currentRoute:[{place_ref:'builtin:sebeta'},{place_ref:'builtin:adama'}]});
 await assert.rejects(()=>executeDemoCapacityPlan({plan:routePlan,manifest,fixture,client:stale.client}),
  {message:'DEMO_WORLD_EXPECTED_STATE_CHANGED'});
 assert.equal(stale.calls.length,0);
});

test('detects a sharing policy changed by the downstream command',async()=>{
 const {client,calls}=clientFor({alterSharingAfterWrite:true});
 await assert.rejects(()=>executeDemoCapacityPlan({plan,manifest,fixture,client}),{message:'DEMO_WORLD_READBACK_DRIFT'});
 assert.equal(calls.length,1);
});
