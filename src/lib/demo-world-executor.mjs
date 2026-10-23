import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {planDemoWorldSlot} from './demo-world-planner.mjs';

function fixtureUuid(value){
 if(value===null||value===undefined||value==='')return null;
 const bytes=createHash('sha256').update(`loadgistic-fixture:${value}`).digest().subarray(0,16);
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=bytes.toString('hex');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

function exact(value,expected,code){if(value!==expected)throw Error(code);}
function checked(result,code){
 if(result.error){
  const detail=/^[A-Z][A-Z0-9_]{2,79}$/.test(result.error.message||'')?result.error.message
   :/^[0-9A-Z]{5}$/.test(result.error.code||'')?result.error.code:null;
  throw Error(detail?`${code}_${detail}`:code);
 }
 return result.data;
}
function routeRefs(value){
 if(!Array.isArray(value)||value.length<2||value.length>5||value.some(point=>typeof point?.place_ref!=='string'||!point.place_ref))throw Error('DEMO_WORLD_ROUTE_REFUSED');
 return value.map(point=>point.place_ref);
}
function acceptedLoads(value){
 return value.accepts_full_load&&value.accepts_partial_load?'BOTH':value.accepts_full_load?'FTL':value.accepts_partial_load?'PTL':null;
}

/** A local-only command adapter. It does not accept an arbitrary actor or vehicle. */
export async function executeDemoCapacityPlan({plan,manifest,fixture,client,priorReceipt}){
 if(!['capacity.set_status','capacity.set_load_preference','capacity.set_route'].includes(plan?.command)
  ||!['EMPTY','PARTIAL'].includes(plan.expectedStatus)
  ||!['EMPTY','PARTIAL'].includes(plan.nextStatus)||!plan.actorFixtureKey||!plan.vehicleFixtureKey
  ||!plan.capacityFixtureKey||!/^[a-f0-9]{64}$/.test(plan.idempotencyKey||''))throw Error('DEMO_WORLD_PLAN_REFUSED');
 const canonical=planDemoWorldSlot({manifest,fixture,at:plan.scheduledAt})
  .find(candidate=>candidate.transitionId===plan.transitionId);
 if(!canonical||!isDeepStrictEqual(plan,canonical))throw Error('DEMO_WORLD_PLAN_REFUSED');
 const actorFixture=fixture.tables.users.find(row=>row.id===plan.actorFixtureKey);
 const vehicleFixture=fixture.tables.vehicles.find(row=>row.id===plan.vehicleFixtureKey);
 const capacityFixture=fixture.tables.capacities.find(row=>row.id===plan.capacityFixtureKey);
 if(!actorFixture||!vehicleFixture||!capacityFixture||capacityFixture.vehicle_id!==vehicleFixture.id
  ||!['EMPTY','PARTIAL'].includes(capacityFixture.status)||!['DRIVER','TRANSPORTER'].includes(actorFixture.role)
  ||!(actorFixture.organization_id&&actorFixture.organization_id===vehicleFixture.organization_id)
    &&!(actorFixture.provider_profile_id&&actorFixture.provider_profile_id===vehicleFixture.provider_profile_id))throw Error('DEMO_WORLD_FIXTURE_REFUSED');
 const vehicleId=fixtureUuid(vehicleFixture.id);
 const auth=checked(await client.auth.admin.listUsers({page:1,perPage:1000}),'DEMO_WORLD_AUTH_UNAVAILABLE');
 const actors=auth.users.filter(user=>user.app_metadata?.fixture_source==='loadgistic'
  &&user.user_metadata?.fixture_key===actorFixture.id);
 const approvedAlias=/^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$/;
 if(actors.length!==1||!(actors[0].email?.toLowerCase()===actorFixture.email.toLowerCase()
  ||approvedAlias.test(actors[0].email?.toLowerCase()||'')))throw Error('DEMO_WORLD_ACTOR_REFUSED');
 const actor=actors[0];
 const profile=checked(await client.from('profiles').select('role,active').eq('id',actor.id).single(),'DEMO_WORLD_ACTOR_REFUSED');
 if(!profile.active||profile.role!==actorFixture.role)throw Error('DEMO_WORLD_ACTOR_REFUSED');
 const vehicle=checked(await client.from('vehicles').select('id,active,publication_status,organization_id,provider_profile_id').eq('id',vehicleId).single(),'DEMO_WORLD_VEHICLE_REFUSED');
 if(!vehicle.active||vehicle.publication_status!=='LIVE'||vehicle.organization_id!==fixtureUuid(vehicleFixture.organization_id)
  ||vehicle.provider_profile_id!==fixtureUuid(vehicleFixture.provider_profile_id))throw Error('DEMO_WORLD_VEHICLE_REFUSED');
 const assignment=checked(await client.from('driver_vehicle_assignments').select('driver_user_id').eq('vehicle_id',vehicleId).eq('active',true),'DEMO_WORLD_DRIVER_REFUSED');
 if(assignment.length!==1)throw Error('DEMO_WORLD_DRIVER_REFUSED');
 const driver=auth.users.find(user=>user.id===assignment[0].driver_user_id);
 const driverFixture=fixture.tables.users.find(user=>user.id===driver?.user_metadata?.fixture_key);
 if(driver?.app_metadata?.fixture_source!=='loadgistic'||driverFixture?.role!=='DRIVER'
  ||driverFixture.organization_id!==vehicleFixture.organization_id
  ||driverFixture.provider_profile_id!==vehicleFixture.provider_profile_id)throw Error('DEMO_WORLD_DRIVER_REFUSED');
 const sharing=checked(await client.from('vehicle_capacity_sharing').select('mode').eq('vehicle_id',vehicleId).single(),'DEMO_WORLD_SHARING_REFUSED');
 if(sharing?.mode!==plan.expectedSharingMode)throw Error('DEMO_WORLD_SHARING_REFUSED');
 if(priorReceipt){
  if(priorReceipt.idempotencyKey!==plan.idempotencyKey||priorReceipt.transitionId!==plan.transitionId
   ||priorReceipt.vehicleId!==vehicleId||priorReceipt.status!==plan.nextStatus)throw Error('DEMO_WORLD_RECEIPT_DRIFT');
  const recorded=checked(await client.from('capacities').select('id,vehicle_id,status,visibility,accepts_full_load,accepts_partial_load,current_route_points_json,updated_by')
   .eq('id',priorReceipt.capacityId).single(),'DEMO_WORLD_RECEIPT_DRIFT');
  if(recorded.id!==priorReceipt.capacityId||recorded.vehicle_id!==vehicleId||recorded.status!==plan.nextStatus
   ||recorded.updated_by!==actor.id||priorReceipt.sharingMode&&priorReceipt.sharingMode!==sharing.mode
   ||priorReceipt.acceptedLoads&&acceptedLoads(recorded)!==priorReceipt.acceptedLoads
   ||priorReceipt.routeRefs&&!isDeepStrictEqual(routeRefs(recorded.current_route_points_json),priorReceipt.routeRefs))throw Error('DEMO_WORLD_RECEIPT_DRIFT');
  return {...priorReceipt,replayed:true};
 }
 const rows=checked(await client.from('capacities').select('id,status,visibility,availability_geometry,current_route_points_json,capacity_area_center_place_ref,capacity_area_boundary_json,accepts_full_load,accepts_partial_load,accepts_multi_pick,accepts_multi_drop,photo_storage_path,location_source,updated_by,updated_at')
  .eq('vehicle_id',vehicleId).order('updated_at',{ascending:false}).order('id',{ascending:false}).limit(1),'DEMO_WORLD_CAPACITY_REFUSED');
 const current=rows[0];if(!current)throw Error('DEMO_WORLD_CAPACITY_REFUSED');
 exact(current.status,plan.expectedStatus,'DEMO_WORLD_EXPECTED_STATE_CHANGED');
 if(!['OPEN','PRIVATE'].includes(current.visibility)||!['ROUTE','RADIUS'].includes(current.availability_geometry)
  ||!['DEVICE_OBSCURED','TELEMATICS','MANUAL_ADMIN'].includes(current.location_source))throw Error('DEMO_WORLD_CAPACITY_REFUSED');
 if(current.photo_storage_path)throw Error('DEMO_WORLD_PROOF_REFUSED');
 if(current.visibility!==(sharing.mode==='PRIVATE'?'PRIVATE':'OPEN'))throw Error('DEMO_WORLD_SHARING_REFUSED');
 const places=current.current_route_points_json;
 const boundary=current.capacity_area_boundary_json;
 if(current.availability_geometry==='ROUTE'&&(!Array.isArray(places)||places.length<2||places.some(point=>!point.place_ref)))throw Error('DEMO_WORLD_ROUTE_REFUSED');
 if(current.availability_geometry==='RADIUS'&&(!current.capacity_area_center_place_ref||!Array.isArray(boundary)||boundary.length<3))throw Error('DEMO_WORLD_AREA_REFUSED');
 const previousLoads=acceptedLoads(current);
 if(!previousLoads)throw Error('DEMO_WORLD_LOADS_REFUSED');
 if(plan.command==='capacity.set_load_preference'&&(current.status!=='EMPTY'||previousLoads!==plan.expectedLoads))throw Error('DEMO_WORLD_EXPECTED_STATE_CHANGED');
 if(plan.command==='capacity.set_route'&&(current.status!=='EMPTY'||current.availability_geometry!=='ROUTE'
  ||!isDeepStrictEqual(routeRefs(places),plan.expectedRouteRefs)))throw Error('DEMO_WORLD_EXPECTED_STATE_CHANGED');
 const nextRoute=plan.command==='capacity.set_route'?plan.nextRouteRefs.map(place_ref=>({place_ref})):places;
 const command={vehicle_id:vehicleId,status:plan.nextStatus,visibility:current.visibility,sharing_mode:sharing.mode,
  accepted_loads:plan.command==='capacity.set_load_preference'?plan.nextLoads:previousLoads,
  availability_geometry:current.availability_geometry,location_source:'PRESERVE_DRIVER',
  accepts_multi_pick:Boolean(current.accepts_multi_pick),accepts_multi_drop:Boolean(current.accepts_multi_drop),
  ...(current.availability_geometry==='ROUTE'?{current_route_places:nextRoute}
   :{capacity_area_center_place_ref:current.capacity_area_center_place_ref,capacity_area_boundary_places:boundary})};
 const capacityId=checked(await client.rpc('publish_provider_capacity',{actor_user_id:actor.id,command}),'DEMO_WORLD_COMMAND_FAILED');
 const saved=checked(await client.from('capacities').select('id,status,visibility,availability_geometry,current_route_points_json,accepts_full_load,accepts_partial_load,accepts_multi_pick,accepts_multi_drop,location_source,updated_by')
  .eq('id',capacityId).single(),'DEMO_WORLD_READBACK_FAILED');
 const savedSharing=checked(await client.from('vehicle_capacity_sharing').select('mode').eq('vehicle_id',vehicleId).single(),'DEMO_WORLD_READBACK_FAILED');
 const expectedLoads=plan.nextStatus==='PARTIAL'?'PTL':command.accepted_loads;
 if(saved.status!==plan.nextStatus||saved.visibility!==current.visibility||saved.availability_geometry!==current.availability_geometry
  ||saved.location_source!==current.location_source||saved.updated_by!==actor.id||savedSharing.mode!==sharing.mode
  ||acceptedLoads(saved)!==expectedLoads||Boolean(saved.accepts_multi_pick)!==Boolean(current.accepts_multi_pick)
  ||Boolean(saved.accepts_multi_drop)!==Boolean(current.accepts_multi_drop)
  ||current.availability_geometry==='ROUTE'&&!isDeepStrictEqual(routeRefs(saved.current_route_points_json),routeRefs(nextRoute)))throw Error('DEMO_WORLD_READBACK_DRIFT');
 return {transitionId:plan.transitionId,idempotencyKey:plan.idempotencyKey,actorFixtureKey:actorFixture.id,
  vehicleFixtureKey:vehicleFixture.id,vehicleId,previousCapacityId:current.id,capacityId,
  previousStatus:current.status,status:saved.status,visibility:saved.visibility,sharingMode:savedSharing.mode,
  acceptedLoads:acceptedLoads(saved),routeRefs:current.availability_geometry==='ROUTE'?routeRefs(saved.current_route_points_json):null,
  locationSource:saved.location_source,replayed:false};
}
