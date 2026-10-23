import test from 'node:test';
import assert from 'node:assert/strict';
import {getSupabaseFleetDriver} from '../src/lib/fleet/driver-detail-supabase.js';
import {getFleetDriver} from '../src/lib/fleet.js';

const ids={owner:'10000000-0000-4000-8000-000000000001',driver:'10000000-0000-4000-8000-000000000002',org:'10000000-0000-4000-8000-000000000003',vehicle:'10000000-0000-4000-8000-000000000004',other:'10000000-0000-4000-8000-000000000005',provider:'10000000-0000-4000-8000-000000000006'};
const stamp='2026-10-15T15:00:00+00:00';
function scenario(changes={}){
 const scope={organization_id:ids.org,provider_profile_id:null};
 return {target:ids.driver,scope,profile:{id:ids.driver,full_name:'Synthetic Driver',public_callback_phone:'+251900000001',email:'synthetic@example.test',role:'DRIVER',active:true,drives_truck:false},driver:{user_id:ids.driver,name:'Synthetic Driver',phone:'+251900000001',...scope,active:true},permissions:{can_manage_capacity:true,can_manage_tracking:false},assignments:[{driver_user_id:ids.driver,vehicle_id:ids.vehicle,assigned_at:stamp,active:true}],vehicle:{id:ids.vehicle,make:'Synthetic',model:'Truck',plate:'TEST-001',platform_number:'LG-TEST-001',active:true,...scope},...changes};
}
async function withScenario(state,run){
 const previous={fetch:globalThis.fetch,url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY},calls=[],counts={scope:0,matches:0,assignments:0};
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://fleet-detail.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-test-key';
 globalThis.fetch=async(input,init)=>{
  const url=new URL(input),name=url.pathname.split('/').at(-1);calls.push({name,query:Object.fromEntries(url.searchParams),body:init.body?JSON.parse(init.body):null});
  let value,status=200;
  if(url.pathname.includes('/rpc/')){
   const body=JSON.parse(init.body);
   if(name==='fleet_provider_owner_scope'){
    assert.equal(body.actor_user_id,ids.owner);counts.scope++;
    if(state.ownerDenied||state.ownerRevoked&&counts.scope>1){status=403;value={message:'FORBIDDEN',code:'42501'};}
    else value=[counts.scope>1&&state.changedScope?state.changedScope:state.scope];
   }else if(name==='fleet_driver_matches_scope'){
    assert.equal(body.target_driver_id,state.target);assert.equal(body.owner_org,state.scope.organization_id);assert.equal(body.owner_provider,state.scope.provider_profile_id);counts.matches++;
    value=state.targetDenied?false:!(state.targetRevoked&&counts.matches>1);
   }else if(name==='fleet_actor_can_use_vehicle'){
    assert.equal(body.actor_user_id,ids.owner);assert.equal(body.target_vehicle_id,ids.vehicle);assert.equal(body.owner_required,true);value=!state.vehicleRevoked;
   }else throw Error('UNEXPECTED_RPC');
  }else{
   assert.doesNotMatch(url.searchParams.get('select')||'',/storage_path|file_path|metadata|password/);
   if(name==='profiles'){assert.equal(url.searchParams.get('id'),'eq.'+state.target);value=state.profile?[state.profile]:[];}
   else if(name==='drivers'){assert.equal(url.searchParams.get('user_id'),'eq.'+state.target);value=state.driver?[state.driver]:[];}
   else if(name==='driver_permissions'){assert.equal(url.searchParams.get('user_id'),'eq.'+state.target);value=state.permissions?[state.permissions]:[];}
   else if(name==='driver_vehicle_assignments'){
    assert.equal(url.searchParams.get('driver_user_id'),'eq.'+state.target);assert.equal(url.searchParams.get('active'),'eq.true');assert.equal(url.searchParams.get('limit'),'2');counts.assignments++;
    value=counts.assignments>1&&state.changedAssignments?state.changedAssignments:state.assignments;
   }else if(name==='vehicles'){
    assert.equal(url.searchParams.get('id'),'eq.'+ids.vehicle);assert.equal(url.searchParams.get('active'),'eq.true');
    assert.equal(url.searchParams.get('organization_id'),state.scope.organization_id?'eq.'+state.scope.organization_id:'is.null');assert.equal(url.searchParams.get('provider_profile_id'),state.scope.provider_profile_id?'eq.'+state.scope.provider_profile_id:'is.null');value=state.vehicle?[state.vehicle]:[];
   }else if(name==='verification_requests'){
    assert.equal(url.searchParams.get('subject_type'),'eq.DRIVER');assert.equal(url.searchParams.get('subject_id'),'eq.'+state.target);assert.equal(url.searchParams.get('status'),'eq.APPROVED');assert.equal(url.searchParams.get('limit'),'1');
    const type=url.searchParams.get('verification_type').slice(3);assert.ok(['IDENTITY','DRIVER_IDENTITY','VEHICLE_AUTHORIZATION'].includes(type));
    if(type==='VEHICLE_AUTHORIZATION')assert.equal(url.searchParams.get('related_vehicle_id'),'eq.'+ids.vehicle);
    value=[{verification_type:type,reviewed_at:stamp,expires_on:null,related_vehicle_id:type==='VEHICLE_AUTHORIZATION'?ids.vehicle:null,storage_path:'MUST_NOT_ESCAPE'}];
   }else throw Error('UNEXPECTED_TABLE');
  }
  return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 };
 try{await run(calls,counts);}finally{globalThis.fetch=previous.fetch;for(const [key,value]of [['NEXT_PUBLIC_SUPABASE_URL',previous.url],['SUPABASE_SERVICE_ROLE_KEY',previous.key]])if(value===undefined)delete process.env[key];else process.env[key]=value;}
}
test('exact company-fleet detail returns only the named employee and repeats persisted authority',async()=>{
 const state=scenario();await withScenario(state,async(calls,counts)=>{
  const detail=await getSupabaseFleetDriver({id:ids.owner},ids.driver);
  assert.equal(detail.id,ids.driver);assert.equal(detail.name,'Synthetic Driver');assert.equal(detail.is_owner,false);assert.equal(detail.can_manage_tracking,false);assert.equal(detail.assigned_vehicle_id,ids.vehicle);assert.equal(detail.verification_badges.length,2);assert.equal(detail.truck_verification_badges[0].vehicleId,ids.vehicle);
  assert.doesNotMatch(JSON.stringify(detail),/MUST_NOT_ESCAPE|storage_path|driver_documents|authorization_documents/);assert.equal(counts.scope,2);assert.equal(counts.matches,2);assert.equal(counts.assignments,2);assert.ok(calls.every(call=>call.name!=='fleet_driver_page'));
 });
});
test('personal-provider employees use their exact provider anchor, without organization or actor impersonation',async()=>{
 const scope={organization_id:null,provider_profile_id:ids.provider},state=scenario();state.scope=scope;state.driver={...state.driver,...scope};state.vehicle={...state.vehicle,...scope};
 await withScenario(state,async()=>{const result=await getSupabaseFleetDriver({id:ids.owner},ids.driver);assert.equal(result.id,ids.driver);assert.equal(result.is_owner,false);});
});
test('a legacy assigned truck without a platform number keeps its exact driver detail',async()=>{
 const state=scenario();state.vehicle.platform_number=null;
 await withScenario(state,async()=>{const result=await getSupabaseFleetDriver({id:ids.owner},ids.driver);assert.equal(result.assigned_vehicle_id,ids.vehicle);assert.equal(result.assigned_vehicles,'Synthetic Truck · TEST-001');assert.equal(result.assigned_vehicles.includes('null'),false);});
});
test('the driving owner retains full owner controls without querying employee permissions',async()=>{
 const state=scenario({target:ids.owner,assignments:[]});state.profile={...state.profile,id:ids.owner,role:'TRANSPORTER',drives_truck:true};
 await withScenario(state,async calls=>{const result=await getSupabaseFleetDriver({id:ids.owner},ids.owner);assert.equal(result.is_owner,true);assert.equal(result.can_manage_capacity,true);assert.equal(result.can_manage_tracking,true);assert.equal(result.assigned_vehicle_id,null);assert.ok(calls.every(call=>!['drivers','driver_permissions','vehicles'].includes(call.name)));});
});
test('foreign actor or target denial occurs before exact private table reads',async()=>{
 for(const state of [scenario({ownerDenied:true}),scenario({targetDenied:true})])await withScenario(state,async calls=>{await assert.rejects(()=>getSupabaseFleetDriver({id:ids.owner},ids.driver),/FORBIDDEN|NOT_FOUND/);assert.ok(calls.every(call=>call.body));});
});
test('target suspension, wrong employer scope and ambiguous active assignments fail closed',async()=>{
 for(const kind of ['inactive','employer','ambiguous']){
  const state=scenario();if(kind==='inactive')state.profile.active=false;if(kind==='employer')state.driver.organization_id=ids.other;if(kind==='ambiguous')state.assignments.push({...state.assignments[0],vehicle_id:ids.other});
  await withScenario(state,async()=>{await assert.rejects(()=>getSupabaseFleetDriver({id:ids.owner},ids.driver),/NOT_FOUND|SUPABASE_FLEET_DRIVER_DETAIL_FAILED/);});
 }
});
test('an assigned foreign truck is never returned as owned Fleet detail',async()=>{
 const state=scenario();state.vehicle.organization_id=ids.other;await withScenario(state,async()=>{await assert.rejects(()=>getSupabaseFleetDriver({id:ids.owner},ids.driver),/NOT_FOUND/);});
});
test('owner, membership, vehicle and assignment changes during the read cannot return old private detail',async()=>{
 for(const change of [{ownerRevoked:true},{targetRevoked:true},{vehicleRevoked:true},{changedScope:{organization_id:ids.other,provider_profile_id:null}},{changedAssignments:[]}])await withScenario(scenario(change),async()=>{await assert.rejects(()=>getSupabaseFleetDriver({id:ids.owner},ids.driver),/FORBIDDEN|NOT_FOUND|FLEET_DRIVER_CONTEXT_CHANGED/);});
});
test('invalid target IDs and employee application callers cannot start an owner detail read',async()=>{
 await withScenario(scenario(),async calls=>{await assert.rejects(()=>getSupabaseFleetDriver({id:ids.owner},'not-a-driver'));assert.equal(calls.length,0);await assert.rejects(()=>getFleetDriver({id:ids.driver,role:'DRIVER',active:true,driver_kind:'COMPANY',organization_id:ids.org},ids.owner),/FORBIDDEN/);assert.equal(calls.length,0);});
});
