import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateDemoWorldManifest,planDemoWorldSlot,planDemoWorldThrough,demoWorldPlanForStep,demoWorldCatalogStart,previousDemoWorldPlan} from '../src/lib/demo-world-planner.mjs';
import {DEMO_CORRIDOR_CATALOG,validateDemoCorridorCatalog} from '../src/lib/demo-corridor-catalog.mjs';
const fixture=JSON.parse(readFileSync(new URL('../resources/fixtures/managed-market.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../resources/fixtures/demo-world-scenarios.json',import.meta.url)));
const copy=structuredClone,activatedAt='2026-11-13T12:00:00.000Z',epoch=7;
const targetKey='independent-partial';
const options=extra=>({manifest,fixture,activatedAt,epoch,at:activatedAt,...extra});
const make=extra=>demoWorldPlanForStep({...options(),targetKey,cycleIndex:0,stepIndex:0,...extra});
function receipt(plan,extra={}){return {...plan,vehicleFixtureKey:plan.vehicleFixtureKey,capacityId:'saved-'+plan.targetKey,
 appliedAt:new Date(Date.parse(plan.dueAt)+1000).toISOString(),completedAt:new Date(Date.parse(plan.dueAt)+2000).toISOString(),...extra};}

test('the authored fast catalog is exact, bounded and has twenty preset phases',()=>{
 assert.equal(validateDemoWorldManifest(manifest,fixture),true);
 assert.equal(manifest.mode,'RELATIVE_EPISODES');assert.equal(manifest.scenarios.length,5);
 assert.equal(manifest.scenarios.reduce((n,row)=>n+row.phases.length,0),20);
 assert.deepEqual(manifest.targets.filter(row=>row.mutable).map(row=>row.start_offset_seconds),[0,30,60,90,120]);
 assert.ok(!JSON.stringify(manifest).match(/email|phone|secret|password/i));
 for(const scenario of manifest.scenarios)assert.deepEqual(scenario.phases.map(row=>[row.status,row.available_percent]),[['PARTIAL',80],['PARTIAL',60],['PARTIAL',30],['EMPTY',100]]);
});

test('bootstrap is immediate, staggered and stable across restart rather than a daily wall-clock slot',()=>{
 assert.equal(demoWorldCatalogStart(activatedAt),activatedAt);
 assert.equal(demoWorldCatalogStart('2026-11-13T07:30:00.001Z'),'2026-11-13T07:30:00.001Z');
 assert.equal(planDemoWorldSlot(options()).length,1);
 assert.equal(planDemoWorldSlot(options({at:'2026-11-13T12:00:30.000Z'})).length,2);
 const due=planDemoWorldSlot(options({at:'2026-11-13T12:02:00.000Z'}));
 assert.equal(due.length,5);assert.equal(new Set(due.map(row=>row.vehicleFixtureKey)).size,5);
 assert.deepEqual(due,planDemoWorldSlot(options({at:'2026-11-13T12:02:00.000Z'})));
 for(const plan of due){assert.equal(plan.cycleIndex,0);assert.equal(plan.stepIndex,0);assert.equal(plan.allowUnreportedBootstrap,true);assert.match(plan.transitionId,/:e7:c0:p0$/);}
 assert.throws(()=>planDemoWorldSlot(options({at:'bad'})),/DEMO_WORLD_TIME_INVALID/);
 assert.throws(()=>planDemoWorldSlot(options({activatedAt:undefined})),/DEMO_WORLD_TIME_INVALID/);
});

test('long outage resumes only one next phase with current completion-based spacing and honest nominal audit',()=>{
 const first=make(),saved=receipt(first),history={[targetKey]:saved};
 const later=planDemoWorldThrough(options({at:'2026-11-14T12:00:00.000Z',previousReceiptsByTarget:history}));
 assert.equal(later.length,5,'at most one eligible phase for each target, including untouched bootstrap targets');
 const next=later.find(row=>row.targetKey===targetKey);
 assert.equal(next.stepIndex,1);assert.equal(next.scheduledAt,'2026-11-13T12:02:00.000Z');
 assert.equal(next.dueAt,'2026-11-13T12:02:02.000Z');
 const resumed=receipt(next,{appliedAt:'2026-11-14T12:00:00.100Z',completedAt:'2026-11-14T12:00:01.000Z'});
 const resumedHistory={[targetKey]:resumed};
 assert.equal(planDemoWorldSlot(options({at:'2026-11-14T12:00:01.001Z',previousReceiptsByTarget:resumedHistory})).some(row=>row.targetKey===targetKey),false,'no catch-up burst');
 assert.equal(planDemoWorldSlot(options({at:'2026-11-14T12:02:00.999Z',previousReceiptsByTarget:resumedHistory})).some(row=>row.targetKey===targetKey),false);
 const following=planDemoWorldSlot(options({at:'2026-11-14T12:02:01.000Z',previousReceiptsByTarget:resumedHistory})).find(row=>row.targetKey===targetKey);
 assert.equal(following.stepIndex,2);assert.equal(following.scheduledAt,'2026-11-13T12:04:00.000Z');assert.equal(following.nextAvailablePercent,30);
});

test('relative phase identities progress in order across cycles with no daily reset',()=>{
 let previous=null;
 for(let n=0;n<9;n++){
  const plan=make({cycleIndex:Math.floor(n/4),stepIndex:n%4,previousCompletedAt:previous?.completedAt??null});
  assert.equal(plan.nextAvailablePercent,[80,60,30,100][n%4]);
  if(n===0){assert.equal(previousDemoWorldPlan({manifest,fixture,plan}),null);assert.equal(plan.expectedAvailablePercent,null);}
  else{const prior=previousDemoWorldPlan({manifest,fixture,plan});assert.equal(prior.transitionId,previous.transitionId);assert.equal(plan.dueAt,new Date(Date.parse(previous.completedAt)+120000).toISOString());}
  previous=receipt(plan);
 }
});

test('the fleet04 route changes only with the authored Empty phase every two cycles',()=>{
 const key='fleet-04-partial',baseline=DEMO_CORRIDOR_CATALOG.routes.find(row=>row.key==='cap-public-158').points.map(row=>row.place_ref),alternate=manifest.targets.find(row=>row.key===key).alternate_route_refs;
 const plan=(cycleIndex,stepIndex)=>make({targetKey:key,cycleIndex,stepIndex,previousCompletedAt:new Date(Date.parse(activatedAt)+(90+cycleIndex*480+stepIndex*120)*1000).toISOString()});
 assert.deepEqual(plan(0,3).nextRouteRefs,baseline);assert.deepEqual(plan(1,2).nextRouteRefs,baseline);
 assert.equal(plan(1,3).nextStatus,'EMPTY');assert.deepEqual(plan(1,3).nextRouteRefs,alternate);
 assert.deepEqual(plan(2,0).nextRouteRefs,alternate);assert.deepEqual(plan(3,3).nextRouteRefs,baseline);
});

test('complete ordered city sequences and unchanged source waypoints qualify only for their own target',()=>{
 assert.equal(validateDemoCorridorCatalog(fixture),true);assert.equal(DEMO_CORRIDOR_CATALOG.routes.length,11);
 for(const alternate of [['builtin:addis ababa','builtin:jigjiga','builtin:adigrat'],['builtin:adigrat','builtin:wukro','builtin:mekelle'],['builtin:adama','builtin:awash','builtin:mieso','builtin:dire dawa']]){
  const changed=copy(manifest);changed.targets.find(row=>row.key==='fleet-04-partial').alternate_route_refs=alternate;
  assert.throws(()=>validateDemoWorldManifest(changed,fixture),/DEMO_WORLD_ROUTE_REFUSED/);
 }
 const changed=copy(fixture),row=changed.tables.capacities.find(row=>row.id==='cap-partial'),points=JSON.parse(row.current_route_points_json);
 points[0].lat+=0.001;row.current_route_points_json=JSON.stringify(points);
 assert.throws(()=>validateDemoWorldManifest(manifest,changed),/DEMO_WORLD_ROUTE_REFUSED/);
 const wrong=copy(DEMO_CORRIDOR_CATALOG);wrong.targets.find(row=>row.key==='fleet-04-partial').baseline_route_key='cap-public-221';
 assert.throws(()=>validateDemoCorridorCatalog(fixture,wrong),/DEMO_WORLD_ROUTE_REFUSED/);
});

test('unknown actors, foreign ownership, expanded scope and duplicated targets remain denied',()=>{
 for(const mutate of [m=>{m.fixture_source='customer';},m=>{m.actors[0].fixture_user_key='customer';},m=>{m.actors[0].email='private@example.test';},m=>{m.targets.push({...m.targets[0],key:'duplicate'});},m=>{m.targets.find(row=>row.key===targetKey).start_offset_seconds=5;}]){
  const changed=copy(manifest);mutate(changed);assert.throws(()=>validateDemoWorldManifest(changed,fixture));
 }
 const wrongOwner=copy(fixture);wrongOwner.tables.vehicles.find(row=>row.id==='veh-driver-1').provider_profile_id='foreign';
 assert.throws(()=>validateDemoWorldManifest(manifest,wrongOwner),/DEMO_WORLD_TARGET_NOT_OWNED/);
 const changedBaseline=copy(fixture);changedBaseline.tables.capacities.find(row=>row.id==='cap-partial').status='EMPTY';
 assert.throws(()=>validateDemoWorldManifest(manifest,changedBaseline),/DEMO_WORLD_BASELINE_MISMATCH/);
});

test('free percentages, phases, intervals and commands cannot change a catalog payload',()=>{
 for(const value of [0,25,50,67,99,100,'80',null]){const changed=copy(manifest);changed.scenarios[0].phases[0].available_percent=value;assert.throws(()=>validateDemoWorldManifest(changed,fixture),/DEMO_WORLD_PERCENT_REFUSED/);}
 for(const mutate of [m=>{m.scenarios[0].command='notifications.send';},m=>{m.scenarios[0].phases[0].status='FULL';},m=>{m.scenarios[0].phases[1].offset_seconds=1;},m=>{m.step_seconds=1;}]){const changed=copy(manifest);mutate(changed);assert.throws(()=>validateDemoWorldManifest(changed,fixture));}
});

test('forged receipt target, epoch, phase or actual time cannot schedule a successor',()=>{
 const first=make(),valid=receipt(first);
 for(const patch of [{targetKey:'fleet-01-partial'},{epoch:8},{stepIndex:2},{completedAt:'2026-11-13T11:59:00.000Z'},
  {appliedAt:'2026-11-13T11:59:00.000Z'},{transitionId:'forged'},{scheduledAt:'2026-11-13T12:00:01.000Z'}]){
  assert.throws(()=>planDemoWorldSlot(options({at:'2026-11-14T12:00:00.000Z',previousReceiptsByTarget:{[targetKey]:{...valid,...patch}}})),/DEMO_WORLD_PREDECESSOR_REFUSED/);
 }
});
