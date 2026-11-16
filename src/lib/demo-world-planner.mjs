import {createHash} from 'node:crypto';
import {approvedDemoCorridor,validateDemoCorridorCatalog} from './demo-corridor-catalog.mjs';

const PHASES=Object.freeze([['PARTIAL',80],['PARTIAL',60],['PARTIAL',30],['EMPTY',100]]);
const TARGETS=Object.freeze(['independent-partial','fleet-01-partial','fleet-02-partial','fleet-04-partial','fleet-06-partial']);
const fail=code=>{throw Error(code);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function only(value,keys,code){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))fail(code);
}
function index(rows,key,code){
 if(!Array.isArray(rows))fail(code);const result=new Map();
 for(const row of rows){if(typeof row?.[key]!=='string'||!row[key]||result.has(row[key]))fail(code);result.set(row[key],row);}
 return result;
}
function routeRefs(capacity){
 let points=capacity?.current_route_points_json;
 if(typeof points==='string'){try{points=JSON.parse(points);}catch{fail('DEMO_WORLD_ROUTE_REFUSED');}}
 if(!Array.isArray(points)||points.length<2||points.length>5||points.some(point=>!point?.place_ref)
  ||new Set(points.map(point=>point.place_ref)).size!==points.length)fail('DEMO_WORLD_ROUTE_REFUSED');
 return points.map(point=>point.place_ref);
}
function instant(value){
 const stamp=value instanceof Date?value.getTime():Date.parse(value);
 if(!Number.isFinite(stamp))fail('DEMO_WORLD_TIME_INVALID');return stamp;
}

/** This is authored exact-target business data, not a random payload generator. */
export function validateDemoWorldManifest(manifest,fixture){
 only(manifest,['schema_version','catalog_version','fixture_source','execution_scope','timezone','mode','step_seconds','cycle_seconds','actors','targets','scenarios'],'DEMO_WORLD_MANIFEST_SHAPE_INVALID');
 if(manifest.schema_version!==1||manifest.catalog_version!==2||manifest.fixture_source!=='loadgistic'
  ||manifest.execution_scope!=='local-dry-run'||manifest.timezone!=='UTC'||manifest.mode!=='RELATIVE_EPISODES'
  ||manifest.step_seconds!==120||manifest.cycle_seconds!==480)fail('DEMO_WORLD_SCOPE_REFUSED');
 if(fixture?.schema_version!==1||fixture.fixture_source!=='loadgistic'||!fixture.tables)fail('DEMO_WORLD_FIXTURE_REFUSED');
 const users=index(fixture.tables.users,'id','DEMO_WORLD_FIXTURE_USERS_INVALID');
 const vehicles=index(fixture.tables.vehicles,'id','DEMO_WORLD_FIXTURE_VEHICLES_INVALID');
 const capacities=index(fixture.tables.capacities,'id','DEMO_WORLD_FIXTURE_CAPACITIES_INVALID');
 const actors=index(manifest.actors,'key','DEMO_WORLD_ACTORS_INVALID'),actorKeys=new Set();
 for(const actor of actors.values()){
  only(actor,['key','fixture_user_key','role'],'DEMO_WORLD_ACTOR_SHAPE_INVALID');
  if(!users.has(actor.fixture_user_key)||users.get(actor.fixture_user_key).role!==actor.role
   ||!['DRIVER','TRANSPORTER'].includes(actor.role)||actorKeys.has(actor.fixture_user_key))fail('DEMO_WORLD_ACTOR_NOT_ALLOWLISTED');
  actorKeys.add(actor.fixture_user_key);
 }
 const targets=index(manifest.targets,'key','DEMO_WORLD_TARGETS_INVALID'),vehicleKeys=new Set(),capacityKeys=new Set();
 for(const target of targets.values()){
  only(target,['key','actor_key','fixture_vehicle_key','fixture_capacity_key','baseline_status','baseline_available_percent','start_offset_seconds','expected_sharing_mode','alternate_route_refs','mutable'],'DEMO_WORLD_TARGET_SHAPE_INVALID');
  const actor=actors.get(target.actor_key),owner=actor&&users.get(actor.fixture_user_key),vehicle=vehicles.get(target.fixture_vehicle_key),capacity=capacities.get(target.fixture_capacity_key);
  if(!owner||!vehicle||!capacity||capacity.vehicle_id!==target.fixture_vehicle_key
   ||!(owner.organization_id&&owner.organization_id===vehicle.organization_id)
    &&!(owner.provider_profile_id&&owner.provider_profile_id===vehicle.provider_profile_id))fail('DEMO_WORLD_TARGET_NOT_OWNED');
  if(!['EMPTY','PARTIAL'].includes(target.baseline_status)||capacity.status!==target.baseline_status||typeof target.mutable!=='boolean')fail('DEMO_WORLD_BASELINE_MISMATCH');
  if(vehicleKeys.has(target.fixture_vehicle_key)||capacityKeys.has(target.fixture_capacity_key))fail('DEMO_WORLD_TARGET_DUPLICATED');
  vehicleKeys.add(target.fixture_vehicle_key);capacityKeys.add(target.fixture_capacity_key);
  if(target.mutable){
   const position=TARGETS.indexOf(target.key);
   if(position<0||target.baseline_status!=='PARTIAL'||target.baseline_available_percent!==null||target.start_offset_seconds!==position*30)fail('DEMO_WORLD_TARGET_NOT_ALLOWLISTED');
   if(!['PUBLIC','PRIVATE','BOTH'].includes(target.expected_sharing_mode))fail('DEMO_WORLD_SHARING_REFUSED');
  }else if(target.expected_sharing_mode!==undefined||target.start_offset_seconds!==undefined||target.baseline_available_percent!==undefined)fail('DEMO_WORLD_MUTABILITY_MISMATCH');
  if(capacity.availability_geometry==='ROUTE'&&!approvedDemoCorridor(target.key,target.fixture_vehicle_key,routeRefs(capacity)))fail('DEMO_WORLD_ROUTE_REFUSED');
  if(target.alternate_route_refs!==undefined&&(!approvedDemoCorridor(target.key,target.fixture_vehicle_key,target.alternate_route_refs,{alternate:true})
   ||same(target.alternate_route_refs,routeRefs(capacity))))fail('DEMO_WORLD_ROUTE_REFUSED');
 }
 if(TARGETS.some(key=>!targets.get(key)?.mutable)||[...targets.values()].filter(row=>row.mutable).length!==5)fail('DEMO_WORLD_MUTABILITY_MISMATCH');
 validateDemoCorridorCatalog(fixture);
 const scenarios=index(manifest.scenarios,'key','DEMO_WORLD_SCENARIOS_INVALID'),seen=new Set();
 for(const scenario of scenarios.values()){
  only(scenario,['key','target_key','command','phases','route_toggle_every_cycles'],'DEMO_WORLD_SCENARIO_SHAPE_INVALID');
  const target=targets.get(scenario.target_key);
  if(!target?.mutable||scenario.command!=='capacity.publish_phase'||scenario.key!==`${target.key}-capacity-episode`||seen.has(target.key)||!Array.isArray(scenario.phases)||scenario.phases.length!==4)fail('DEMO_WORLD_SCENARIO_REFUSED');
  seen.add(target.key);
  scenario.phases.forEach((phase,i)=>{
   only(phase,['step_index','offset_seconds','status','available_percent'],'DEMO_WORLD_TRANSITION_SHAPE_INVALID');
   if(phase.step_index!==i||phase.offset_seconds!==i*120||phase.status!==PHASES[i][0]||phase.available_percent!==PHASES[i][1])fail('DEMO_WORLD_PERCENT_REFUSED');
  });
  if(target.alternate_route_refs?scenario.route_toggle_every_cycles!==2:scenario.route_toggle_every_cycles!==undefined)fail('DEMO_WORLD_ROUTE_REFUSED');
 }
 if(seen.size!==5)fail('DEMO_WORLD_MUTABILITY_MISMATCH');return true;
}

/** Begin immediately; no daily wall-clock activation or delayed catch-up window. */
export function demoWorldCatalogStart(activatedAt){return new Date(instant(activatedAt)).toISOString();}
function identity(target,scenario,activatedAt,epoch,cycleIndex,stepIndex){
 const scheduledAt=new Date(instant(activatedAt)+(target.start_offset_seconds+cycleIndex*480+stepIndex*120)*1000).toISOString();
 const transitionId=`v1:c2:${scenario.key}:${target.key}:e${epoch}:c${cycleIndex}:p${stepIndex}`;
 return {transitionId,idempotencyKey:createHash('sha256').update(`loadgistic-demo-world|${transitionId}`).digest('hex'),scheduledAt};
}
function context(manifest,fixture,targetKey){
 const target=manifest.targets.find(row=>row.key===targetKey&&row.mutable),scenario=manifest.scenarios.find(row=>row.target_key===targetKey);
 if(!target||!scenario)fail('DEMO_WORLD_PLAN_REFUSED');
 const actor=manifest.actors.find(row=>row.key===target.actor_key),capacity=fixture.tables.capacities.find(row=>row.id===target.fixture_capacity_key);
 return {target,scenario,actor,capacity};
}
function expectedRoute(target,capacity,cycleIndex){
 const baseline=routeRefs(capacity);
 return target.alternate_route_refs&&Math.floor(cycleIndex/2)%2?target.alternate_route_refs:baseline;
}

/** One immutable step. Recovery time derives from the real previous completion. */
export function demoWorldPlanForStep({manifest,fixture,activatedAt,epoch,targetKey,cycleIndex,stepIndex,previousCompletedAt=null}){
 validateDemoWorldManifest(manifest,fixture);activatedAt=demoWorldCatalogStart(activatedAt);
 if(!Number.isSafeInteger(epoch)||epoch<1||!Number.isSafeInteger(cycleIndex)||cycleIndex<0||!Number.isInteger(stepIndex)||stepIndex<0||stepIndex>3)fail('DEMO_WORLD_PLAN_REFUSED');
 const {target,scenario,actor,capacity}=context(manifest,fixture,targetKey),first=cycleIndex===0&&stepIndex===0;
 const identifiers=identity(target,scenario,activatedAt,epoch,cycleIndex,stepIndex);
 if(first?previousCompletedAt!==null:previousCompletedAt===null)fail('DEMO_WORLD_PREDECESSOR_REFUSED');
 const dueAt=first?identifiers.scheduledAt:new Date(instant(previousCompletedAt)+120000).toISOString();
 if(instant(dueAt)<instant(identifiers.scheduledAt))fail('DEMO_WORLD_PREDECESSOR_REFUSED');
 const expectedStatus=first?'PARTIAL':stepIndex===0?'EMPTY':'PARTIAL',phase=scenario.phases[stepIndex];
 const expectedAvailablePercent=first?null:stepIndex===0?100:PHASES[stepIndex-1][1];
 const expectedRouteRefs=expectedRoute(target,capacity,cycleIndex);
 const nextRouteRefs=stepIndex===3&&target.alternate_route_refs&&cycleIndex%2===1
  ?same(expectedRouteRefs,target.alternate_route_refs)?routeRefs(capacity):target.alternate_route_refs:expectedRouteRefs;
 return Object.freeze({manifestVersion:1,catalogVersion:2,mode:'RELATIVE_EPISODES',activatedAt,epoch,targetKey,
  scenarioKey:scenario.key,cycleIndex,stepIndex,previousCompletedAt,dueAt,...identifiers,
  actorFixtureKey:actor.fixture_user_key,vehicleFixtureKey:target.fixture_vehicle_key,capacityFixtureKey:target.fixture_capacity_key,
  expectedSharingMode:target.expected_sharing_mode,command:'capacity.publish_phase',
  expectedStatus,nextStatus:phase.status,expectedAvailablePercent,nextAvailablePercent:phase.available_percent,
  allowUnreportedBootstrap:first,expectedRouteRefs,nextRouteRefs});
}

/** Prior identity only: never fabricate an actual historical completion time. */
export function previousDemoWorldPlan({manifest,fixture,plan}){
 const {target,scenario}=context(manifest,fixture,plan.targetKey);
 if(plan.cycleIndex===0&&plan.stepIndex===0)return null;
 const cycleIndex=plan.stepIndex===0?plan.cycleIndex-1:plan.cycleIndex,stepIndex=(plan.stepIndex+3)%4;
 return {...identity(target,scenario,plan.activatedAt,plan.epoch,cycleIndex,stepIndex),cycleIndex,stepIndex};
}
function lastReceipt(value,manifest,fixture,target,activatedAt,epoch){
 if(!value||value.catalogVersion!==2||value.targetKey!==target.key||value.epoch!==epoch||value.activatedAt!==activatedAt
  ||value.vehicleFixtureKey!==target.fixture_vehicle_key||typeof value.capacityId!=='string'||!value.capacityId
  ||!Number.isSafeInteger(value.cycleIndex)||value.cycleIndex<0||!Number.isInteger(value.stepIndex)||value.stepIndex<0||value.stepIndex>3)fail('DEMO_WORLD_PREDECESSOR_REFUSED');
 const {scenario}=context(manifest,fixture,target.key),expected=identity(target,scenario,activatedAt,epoch,value.cycleIndex,value.stepIndex);
 if(value.scenarioKey!==scenario.key||value.transitionId!==expected.transitionId||value.idempotencyKey!==expected.idempotencyKey
  ||value.scheduledAt!==expected.scheduledAt||instant(value.appliedAt)<instant(value.dueAt)
  ||instant(value.completedAt)<instant(value.appliedAt)||instant(value.dueAt)<instant(value.scheduledAt))fail('DEMO_WORLD_PREDECESSOR_REFUSED');
 return value;
}

/** At most one next step per target. Outages never produce catch-up bursts. */
export function planDemoWorldSlot({manifest,fixture,activatedAt,epoch,at,previousReceiptsByTarget={}}){
 validateDemoWorldManifest(manifest,fixture);activatedAt=demoWorldCatalogStart(activatedAt);const now=instant(at);
 if(!Number.isSafeInteger(epoch)||epoch<1)fail('DEMO_WORLD_PLAN_REFUSED');
 const plans=[];
 for(const target of manifest.targets.filter(row=>row.mutable)){
  const raw=previousReceiptsByTarget instanceof Map?previousReceiptsByTarget.get(target.key):previousReceiptsByTarget[target.key];
  const last=raw?lastReceipt(raw,manifest,fixture,target,activatedAt,epoch):null;
  const stepIndex=last?(last.stepIndex+1)%4:0,cycleIndex=last?last.cycleIndex+Number(stepIndex===0):0;
  const plan=demoWorldPlanForStep({manifest,fixture,activatedAt,epoch,targetKey:target.key,cycleIndex,stepIndex,previousCompletedAt:last?.completedAt??null});
  if(instant(plan.dueAt)<=now)plans.push(plan);
 }
 return plans.sort((a,b)=>a.dueAt.localeCompare(b.dueAt)||a.targetKey.localeCompare(b.targetKey));
}

/** Compatibility name: only the next eligible step, never every missed phase. */
export function planDemoWorldThrough(options){return planDemoWorldSlot(options);}
