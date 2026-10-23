import {createHash} from 'node:crypto';

const SUPPORTED_STATUS=new Set(['EMPTY','PARTIAL']);
const SUPPORTED_LOADS=new Set(['FTL','PTL','BOTH']);
const SUPPORTED_COMMANDS=new Set(['capacity.set_status','capacity.set_load_preference','capacity.set_route']);

function routeRefs(capacity){
 let points=capacity?.current_route_points_json;
 if(typeof points==='string'){
  try{points=JSON.parse(points);}catch{throw new Error('DEMO_WORLD_ROUTE_REFUSED');}
 }
 if(!Array.isArray(points)||points.length<2||points.length>5
  ||points.some(point=>typeof point?.place_ref!=='string'||!point.place_ref)
  ||new Set(points.map(point=>point.place_ref)).size!==points.length)throw new Error('DEMO_WORLD_ROUTE_REFUSED');
 return points.map(point=>point.place_ref);
}
function acceptedLoads(capacity){
 const full=capacity?.accepts_full_load===true||capacity?.accepts_full_load===1;
 const partial=capacity?.accepts_partial_load===true||capacity?.accepts_partial_load===1;
 return full&&partial?'BOTH':full?'FTL':partial?'PTL':null;
}

function requireOnlyKeys(value,keys,code){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))throw new Error(code);
}
function uniqueIndex(rows,key,code){
 if(!Array.isArray(rows))throw new Error(code);
 const index=new Map();
 for(const row of rows){
  const value=row?.[key];
  if(typeof value!=='string'||!value||index.has(value))throw new Error(code);
  index.set(value,row);
 }
 return index;
}
function ownedBy(actor,vehicle){
 return Boolean(actor.organization_id&&vehicle.organization_id===actor.organization_id)
  ||Boolean(actor.provider_profile_id&&vehicle.provider_profile_id===actor.provider_profile_id);
}

/** Validate every scenario identity against the checked-in synthetic fixture. */
export function validateDemoWorldManifest(manifest,fixture){
 requireOnlyKeys(manifest,['schema_version','fixture_source','execution_scope','timezone','actors','targets','scenarios'],'DEMO_WORLD_MANIFEST_SHAPE_INVALID');
 if(manifest.schema_version!==1||manifest.fixture_source!=='loadgistic'||manifest.execution_scope!=='local-dry-run'||manifest.timezone!=='UTC')throw new Error('DEMO_WORLD_SCOPE_REFUSED');
 if(fixture?.schema_version!==1||fixture.fixture_source!=='loadgistic'||!fixture.tables)throw new Error('DEMO_WORLD_FIXTURE_REFUSED');

 const users=uniqueIndex(fixture.tables.users,'id','DEMO_WORLD_FIXTURE_USERS_INVALID');
 const vehicles=uniqueIndex(fixture.tables.vehicles,'id','DEMO_WORLD_FIXTURE_VEHICLES_INVALID');
 const capacities=uniqueIndex(fixture.tables.capacities,'id','DEMO_WORLD_FIXTURE_CAPACITIES_INVALID');
 const publicRouteRefs=new Set([...capacities.values()].filter(row=>row.visibility==='OPEN'&&row.availability_geometry==='ROUTE')
  .flatMap(row=>routeRefs(row)));
 const actors=uniqueIndex(manifest.actors,'key','DEMO_WORLD_ACTORS_INVALID');
 const actorFixtureKeys=new Set();
 for(const actor of actors.values()){
  requireOnlyKeys(actor,['key','fixture_user_key','role'],'DEMO_WORLD_ACTOR_SHAPE_INVALID');
  const fixtureActor=users.get(actor.fixture_user_key);
  if(!fixtureActor||fixtureActor.role!==actor.role||!['DRIVER','TRANSPORTER'].includes(actor.role)||actorFixtureKeys.has(actor.fixture_user_key))throw new Error('DEMO_WORLD_ACTOR_NOT_ALLOWLISTED');
  actorFixtureKeys.add(actor.fixture_user_key);
 }

 const targets=uniqueIndex(manifest.targets,'key','DEMO_WORLD_TARGETS_INVALID');
 const vehicleKeys=new Set(),capacityKeys=new Set();
 for(const target of targets.values()){
  requireOnlyKeys(target,['key','actor_key','fixture_vehicle_key','fixture_capacity_key','baseline_status','expected_sharing_mode','alternate_route_refs','mutable'],'DEMO_WORLD_TARGET_SHAPE_INVALID');
  const actor=actors.get(target.actor_key),fixtureActor=actor&&users.get(actor.fixture_user_key);
  const vehicle=vehicles.get(target.fixture_vehicle_key),capacity=capacities.get(target.fixture_capacity_key);
  if(!actor||!fixtureActor||!vehicle||!capacity||!ownedBy(fixtureActor,vehicle)||capacity.vehicle_id!==target.fixture_vehicle_key)throw new Error('DEMO_WORLD_TARGET_NOT_OWNED');
  if(!SUPPORTED_STATUS.has(target.baseline_status)||capacity.status!==target.baseline_status||typeof target.mutable!=='boolean')throw new Error('DEMO_WORLD_BASELINE_MISMATCH');
  if(target.mutable&&!['PUBLIC','PRIVATE','BOTH'].includes(target.expected_sharing_mode)
   ||!target.mutable&&target.expected_sharing_mode!==undefined)throw new Error('DEMO_WORLD_SHARING_REFUSED');
  if(target.alternate_route_refs!==undefined){
   const alternate=target.alternate_route_refs;
   if(capacity.availability_geometry!=='ROUTE'||!Array.isArray(alternate)||alternate.length<2||alternate.length>5
    ||alternate.some(ref=>typeof ref!=='string'||!publicRouteRefs.has(ref))
    ||new Set(alternate).size!==alternate.length
    ||JSON.stringify(alternate)===JSON.stringify(routeRefs(capacity)))throw new Error('DEMO_WORLD_ROUTE_REFUSED');
  }
  if(vehicleKeys.has(target.fixture_vehicle_key)||capacityKeys.has(target.fixture_capacity_key))throw new Error('DEMO_WORLD_TARGET_DUPLICATED');
  vehicleKeys.add(target.fixture_vehicle_key);capacityKeys.add(target.fixture_capacity_key);
 }

 const scenarios=uniqueIndex(manifest.scenarios,'key','DEMO_WORLD_SCENARIOS_INVALID');
 const events=[];
 for(const scenario of scenarios.values()){
  requireOnlyKeys(scenario,['key','command','daily_slots_utc','transitions'],'DEMO_WORLD_SCENARIO_SHAPE_INVALID');
  if(!SUPPORTED_COMMANDS.has(scenario.command)||!Array.isArray(scenario.daily_slots_utc)||!Array.isArray(scenario.transitions)||scenario.daily_slots_utc.length!==scenario.transitions.length||scenario.transitions.length===0)throw new Error('DEMO_WORLD_COMMAND_REFUSED');
  let previousMinute=-1;
  for(let i=0;i<scenario.transitions.length;i++){
   const transition=scenario.transitions[i],minute=scenario.daily_slots_utc[i];
   requireOnlyKeys(transition,scenario.command==='capacity.set_status'?['target_key','from','to']
    :['target_key','when_status','from','to'],'DEMO_WORLD_TRANSITION_SHAPE_INVALID');
   const target=targets.get(transition.target_key);
   if(!target?.mutable||!Number.isInteger(minute)||minute<0||minute>=1440||minute<=previousMinute)throw new Error('DEMO_WORLD_SLOT_INVALID');
   previousMinute=minute;
   if(scenario.command==='capacity.set_status'){
    if(!SUPPORTED_STATUS.has(transition.from)||!SUPPORTED_STATUS.has(transition.to)||transition.from===transition.to)throw new Error('DEMO_WORLD_STATUS_REFUSED');
   }else if(transition.when_status!=='EMPTY')throw new Error('DEMO_WORLD_STATUS_REFUSED');
   else if(scenario.command==='capacity.set_load_preference'){
    if(!SUPPORTED_LOADS.has(transition.from)||!SUPPORTED_LOADS.has(transition.to)||transition.from===transition.to)throw new Error('DEMO_WORLD_LOADS_REFUSED');
   }else if(!target.alternate_route_refs||!['BASELINE','ALTERNATE'].includes(transition.from)
    ||!['BASELINE','ALTERNATE'].includes(transition.to)||transition.from===transition.to)throw new Error('DEMO_WORLD_ROUTE_REFUSED');
   events.push({scenario,transition,minute});
  }
 }
 const stateByTarget=new Map([...targets.values()].map(target=>{
  const capacity=capacities.get(target.fixture_capacity_key);
  return [target.key,{status:target.baseline_status,loads:acceptedLoads(capacity),route:'BASELINE'}];
 }));
 const targetMinutes=new Set(),loadTargets=new Set(),routeTargets=new Set();
 for(const {scenario,transition,minute} of events.sort((a,b)=>a.minute-b.minute)){
  const key=`${transition.target_key}:${minute}`;
  if(targetMinutes.has(key))throw new Error('DEMO_WORLD_SLOT_INVALID');
  targetMinutes.add(key);
  const state=stateByTarget.get(transition.target_key);
  if(scenario.command==='capacity.set_status'){
   if(state.status!==transition.from)throw new Error('DEMO_WORLD_TRANSITION_CHAIN_INVALID');
   state.status=transition.to;
   if(transition.to==='PARTIAL')state.loads='PTL';
  }else if(scenario.command==='capacity.set_load_preference'){
   if(state.status!==transition.when_status||state.loads!==transition.from)throw new Error('DEMO_WORLD_TRANSITION_CHAIN_INVALID');
   loadTargets.add(transition.target_key);state.loads=transition.to;
  }else{
   if(state.status!==transition.when_status||state.route!==transition.from)throw new Error('DEMO_WORLD_TRANSITION_CHAIN_INVALID');
   routeTargets.add(transition.target_key);state.route=transition.to;
  }
 }
 for(const [key,state] of stateByTarget){
  const target=targets.get(key),capacity=capacities.get(target.fixture_capacity_key);
  if(state.status!==target.baseline_status||loadTargets.has(key)&&state.loads!==acceptedLoads(capacity)
   ||routeTargets.has(key)&&state.route!=='BASELINE')throw new Error('DEMO_WORLD_TRANSITION_CHAIN_INVALID');
 }
 for(const target of targets.values()){
  const scheduled=[...scenarios.values()].flatMap(scenario=>scenario.transitions.filter(transition=>transition.target_key===target.key));
  if(target.mutable!==Boolean(scheduled.length))throw new Error('DEMO_WORLD_MUTABILITY_MISMATCH');
 }
 return true;
}

/** Return deterministic dry-run commands for the exact UTC minute supplied. */
export function planDemoWorldSlot({manifest,fixture,at}){
 validateDemoWorldManifest(manifest,fixture);
 const timestamp=at instanceof Date?at.getTime():Date.parse(at);
 if(!Number.isFinite(timestamp))throw new Error('DEMO_WORLD_TIME_INVALID');
 const date=new Date(timestamp);
 if(date.getUTCSeconds()!==0||date.getUTCMilliseconds()!==0)return [];
 const day=date.toISOString().slice(0,10),minute=date.getUTCHours()*60+date.getUTCMinutes();
 const actorByKey=new Map(manifest.actors.map(actor=>[actor.key,actor]));
 const targetByKey=new Map(manifest.targets.map(target=>[target.key,target]));
 const capacityByKey=new Map(fixture.tables.capacities.map(capacity=>[capacity.id,capacity]));
 const plans=[];
 for(const scenario of manifest.scenarios){
  const transitionIndex=scenario.daily_slots_utc.indexOf(minute);
  if(transitionIndex<0)continue;
  const transition=scenario.transitions[transitionIndex],target=targetByKey.get(transition.target_key),actor=actorByKey.get(target.actor_key);
  const slot=`${String(Math.floor(minute/60)).padStart(2,'0')}${String(minute%60).padStart(2,'0')}Z`;
  const transitionId=`v${manifest.schema_version}:${scenario.key}:${target.key}:${day}:${slot}`;
  const idempotencyKey=createHash('sha256').update(`loadgistic-demo-world|${transitionId}`).digest('hex');
  const status=scenario.command==='capacity.set_status';
  const basePlan={
   manifestVersion:manifest.schema_version,
   scenarioKey:scenario.key,
   transitionId,
   idempotencyKey,
   scheduledAt:`${day}T${slot.slice(0,2)}:${slot.slice(2,4)}:00.000Z`,
   actorFixtureKey:actor.fixture_user_key,
   vehicleFixtureKey:target.fixture_vehicle_key,
   capacityFixtureKey:target.fixture_capacity_key,
   expectedSharingMode:target.expected_sharing_mode,
   command:scenario.command,
   expectedStatus:status?transition.from:transition.when_status,
   nextStatus:status?transition.to:transition.when_status
  };
  if(scenario.command==='capacity.set_load_preference'){
   basePlan.expectedLoads=transition.from;basePlan.nextLoads=transition.to;
  }else if(scenario.command==='capacity.set_route'){
   const baseline=routeRefs(capacityByKey.get(target.fixture_capacity_key));
   basePlan.expectedRouteRefs=transition.from==='BASELINE'?baseline:target.alternate_route_refs;
   basePlan.nextRouteRefs=transition.to==='BASELINE'?baseline:target.alternate_route_refs;
  }
  plans.push(Object.freeze(basePlan));
 }
 return plans;
}

/** All exact daily transitions up to a UTC cutoff, ordered for safe replay. */
export function planDemoWorldThrough({manifest,fixture,at}){
 validateDemoWorldManifest(manifest,fixture);
 const timestamp=at instanceof Date?at.getTime():Date.parse(at);
 if(!Number.isFinite(timestamp))throw new Error('DEMO_WORLD_TIME_INVALID');
 const date=new Date(timestamp),day=date.toISOString().slice(0,10);
 const cutoff=date.getUTCHours()*60+date.getUTCMinutes();
 const minutes=new Set(manifest.scenarios.flatMap(scenario=>scenario.daily_slots_utc).filter(minute=>minute<=cutoff));
 return [...minutes].sort((a,b)=>a-b).flatMap(minute=>{
  const hour=String(Math.floor(minute/60)).padStart(2,'0');
  const part=String(minute%60).padStart(2,'0');
  return planDemoWorldSlot({manifest,fixture,at:`${day}T${hour}:${part}:00.000Z`});
 });
}
