import {createClient} from '@supabase/supabase-js';

const url=String(process.env.SUPABASE_SEED_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').trim();
const serviceRoleKey=String(process.env.SUPABASE_SEED_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
const anonKey=String(process.env.SUPABASE_SEED_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'').trim();
if(!url||!serviceRoleKey||!anonKey)throw new Error('SUPABASE_PROVIDER_CAPACITY_VERIFY_CONFIG_MISSING');
const endpoint=new URL(url);
if(!new Set(['127.0.0.1','localhost','::1']).has(endpoint.hostname))throw new Error('REMOTE_PROVIDER_CAPACITY_VERIFY_REFUSED');

process.env.NEXT_PUBLIC_SUPABASE_URL=url;
process.env.SUPABASE_SERVICE_ROLE_KEY=serviceRoleKey;

const service=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
const anon=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false}});
const {
  addProviderRegularCapacity,getProviderCapacityWorkspace,publishProviderCapacity,
  refreshProviderCapacityLocation,removeProviderRegularCapacity,setProviderAssignedVehicleDuty
}=await import('../src/lib/provider-capacity.js');

async function fixtureUser(email){
  const {data:profile,error}=await service.from('profiles').select('id,email,role').eq('email',email).maybeSingle();
  if(error||!profile)throw new Error(`SUPABASE_PROVIDER_CAPACITY_FIXTURE_MISSING:${email}:${error?.message||''}`);
  return profile;
}

async function expectRejected(action,code){
  try{await action();}
  catch(error){
    if(String(error?.message||error).includes(code))return;
    throw error;
  }
  throw new Error(`SUPABASE_PROVIDER_CAPACITY_EXPECTED_REJECTION_MISSING:${code}`);
}

function publishInput(current,vehicleId){
  const status=current.status==='EMPTY'?'EMPTY':'PARTIAL';
  const geometry=current.availability_geometry==='RADIUS'?'RADIUS':'ROUTE';
  const input={
    vehicleId,status,acceptedLoads:status==='EMPTY'?'BOTH':'PTL',availabilityGeometry:geometry,
    visibility:current.visibility==='PRIVATE'?'PRIVATE':'OPEN',locationSource:'DEVICE_OBSCURED',
    approximateLat:Number(current.location_lat),approximateLng:Number(current.location_lng),
    locationPrecisionKm:Number(current.location_precision_km),acceptsMultiPick:true,acceptsMultiDrop:false
  };
  if(!Number.isFinite(input.approximateLat)||!Number.isFinite(input.approximateLng)||!Number.isFinite(input.locationPrecisionKm)){
    throw new Error('SUPABASE_PROVIDER_CAPACITY_FIXTURE_LOCATION_MISSING');
  }
  if(geometry==='ROUTE')input.currentRoutePlaces=current.current_route_points.map(point=>({placeRef:point.place_ref,label:point.label}));
  else{
    input.capacityAreaCenterPlaceRef=current.capacity_area_center_place_ref;
    input.capacityAreaBoundaryPlaces=current.capacity_area_boundary.map(point=>({placeRef:point.place_ref,label:point.label}));
  }
  return input;
}

async function snapshotVehicleCapacity(vehicleId){
  const {data,error}=await service.from('capacities').select('id,expires_at').eq('vehicle_id',vehicleId);
  if(error)throw error;
  return data||[];
}

async function restoreVehicleCapacity(snapshot,createdIds){
  if(createdIds.length){
    await service.from('audit_logs').delete().in('entity_id',createdIds);
    const {error}=await service.from('capacities').delete().in('id',createdIds);
    if(error)throw error;
  }
  for(const row of snapshot){
    const {error}=await service.from('capacities').update({expires_at:row.expires_at}).eq('id',row.id);
    if(error)throw error;
  }
}

const transporter=await fixtureUser('transporter@loadgistic.local');
const companyDriver=await fixtureUser('company-driver@loadgistic.local');
const selfDriver=await fixtureUser('driver@loadgistic.local');
const transporterWorkspace=await getProviderCapacityWorkspace(transporter);
const companyWorkspace=await getProviderCapacityWorkspace(companyDriver);
const selfWorkspace=await getProviderCapacityWorkspace(selfDriver);
if(!transporterWorkspace.vehicles.length||!transporterWorkspace.capacities.length)throw new Error('SUPABASE_PROVIDER_CAPACITY_TRANSPORTER_WORKSPACE_FAILED');
if(companyWorkspace.access?.kind!=='COMPANY'||!companyWorkspace.vehicles.length)throw new Error('SUPABASE_PROVIDER_CAPACITY_COMPANY_WORKSPACE_FAILED');
if(selfWorkspace.access?.kind!=='SELF_MANAGED'||!selfWorkspace.vehicles.length)throw new Error('SUPABASE_PROVIDER_CAPACITY_SELF_WORKSPACE_FAILED');
if(companyWorkspace.vehicles.some(vehicle=>!companyWorkspace.capacities.some(capacity=>capacity.vehicle_id===vehicle.id)))throw new Error('SUPABASE_PROVIDER_CAPACITY_ASSIGNMENT_PROJECTION_FAILED');

const {error:anonWorkspaceError}=await anon.rpc('provider_capacity_workspace',{actor_user_id:selfDriver.id});
if(!anonWorkspaceError)throw new Error('SUPABASE_PROVIDER_CAPACITY_ANONYMOUS_RPC_ALLOWED');

const selfVehicle=selfWorkspace.vehicles[0];
const selfCurrent=selfWorkspace.capacities.find(capacity=>capacity.vehicle_id===selfVehicle.id);
if(!selfCurrent)throw new Error('SUPABASE_PROVIDER_CAPACITY_SELF_SIGNAL_MISSING');
const selfSnapshot=await snapshotVehicleCapacity(selfVehicle.id);
const selfCreated=[];
try{
  const otherVehicle=companyWorkspace.vehicles[0];
  await expectRejected(()=>publishProviderCapacity(selfDriver,publishInput(selfCurrent,otherVehicle.id)),'INVALID_VEHICLE');
  const capacityId=await publishProviderCapacity(selfDriver,publishInput(selfCurrent,selfVehicle.id));
  selfCreated.push(capacityId);
  const refreshed=await refreshProviderCapacityLocation(selfDriver,{
    vehicleId:selfVehicle.id,approximateLat:Number(selfCurrent.location_lat),
    approximateLng:Number(selfCurrent.location_lng),locationPrecisionKm:Number(selfCurrent.location_precision_km)
  });
  if(refreshed.capacityId!==capacityId||refreshed.vehicleId!==selfVehicle.id)throw new Error('SUPABASE_PROVIDER_CAPACITY_REFRESH_FAILED');
  const after=await getProviderCapacityWorkspace(selfDriver);
  if(after.capacities[0]?.id!==capacityId||after.capacities[0]?.location_source!=='DEVICE_OBSCURED')throw new Error('SUPABASE_PROVIDER_CAPACITY_PUBLISH_FAILED');
}finally{
  await restoreVehicleCapacity(selfSnapshot,selfCreated);
}

const companyVehicle=companyWorkspace.vehicles[0];
const companyCurrent=companyWorkspace.capacities.find(capacity=>capacity.vehicle_id===companyVehicle.id);
if(!companyCurrent)throw new Error('SUPABASE_PROVIDER_CAPACITY_COMPANY_SIGNAL_MISSING');
const companySnapshot=await snapshotVehicleCapacity(companyVehicle.id);
const companyCreated=[];
const {data:permission,error:permissionError}=await service.from('driver_permissions').select('can_manage_capacity').eq('user_id',companyDriver.id).maybeSingle();
if(permissionError||!permission)throw new Error('SUPABASE_PROVIDER_CAPACITY_PERMISSION_FIXTURE_MISSING');
try{
  await service.from('driver_permissions').update({can_manage_capacity:false}).eq('user_id',companyDriver.id).throwOnError();
  await expectRejected(()=>publishProviderCapacity(companyDriver,publishInput(companyCurrent,companyVehicle.id)),'FORBIDDEN');
  companyCreated.push(await setProviderAssignedVehicleDuty(companyDriver,companyVehicle.id,false));
  companyCreated.push(await setProviderAssignedVehicleDuty(companyDriver,companyVehicle.id,true,{
    locationSource:'DEVICE_OBSCURED',approximateLat:Number(companyCurrent.location_lat),
    approximateLng:Number(companyCurrent.location_lng),locationPrecisionKm:Number(companyCurrent.location_precision_km)
  }));
  const dutyWorkspace=await getProviderCapacityWorkspace(companyDriver);
  if(dutyWorkspace.capacities[0]?.id!==companyCreated[1]||dutyWorkspace.capacities[0]?.status==='OFF_DUTY')throw new Error('SUPABASE_PROVIDER_CAPACITY_DUTY_FAILED');
}finally{
  await service.from('driver_permissions').update({can_manage_capacity:permission.can_manage_capacity}).eq('user_id',companyDriver.id);
  await restoreVehicleCapacity(companySnapshot,companyCreated);
}

const mutableRouteColumns=[
  'id','organization_id','provider_profile_id','origin','destination','created_by','created_at',
  'origin_place_ref','origin_lat','origin_lng','destination_place_ref','destination_lat','destination_lng',
  'route_points_json','geometry','area_center_place_ref','area_center_label','area_center_lat','area_center_lng',
  'area_boundary_json','assigned_vehicle_id','assigned_driver_user_id'
].join(',');
const {data:originalRoutes,error:routeError}=await service.from('profile_routes').select(mutableRouteColumns)
  .eq('provider_profile_id',selfWorkspace.capacities[0].provider_profile_id);
if(routeError)throw routeError;
let createdRouteId=null;
try{
  if(originalRoutes?.length)await service.from('profile_routes').delete().in('id',originalRoutes.map(route=>route.id)).throwOnError();
  const source=originalRoutes?.[0]||selfWorkspace.corridors[0];
  if(!source)throw new Error('SUPABASE_PROVIDER_CAPACITY_REGULAR_FIXTURE_MISSING');
  const input=source.geometry==='RADIUS'?{
    geometry:'RADIUS',areaCenterPlaceRef:source.area_center_place_ref,
    areaBoundaryPlaces:(source.area_boundary_json||source.area_boundary).map(point=>({placeRef:point.place_ref,label:point.label}))
  }:{
    geometry:'ROUTE',routePlaces:(source.route_points_json||source.route_points).map(point=>({placeRef:point.place_ref,label:point.label}))
  };
  createdRouteId=await addProviderRegularCapacity(selfDriver,input);
  if(!(await getProviderCapacityWorkspace(selfDriver)).corridors.some(route=>route.id===createdRouteId))throw new Error('SUPABASE_PROVIDER_CAPACITY_REGULAR_ADD_FAILED');
  await removeProviderRegularCapacity(selfDriver,createdRouteId);
  if((await getProviderCapacityWorkspace(selfDriver)).corridors.some(route=>route.id===createdRouteId))throw new Error('SUPABASE_PROVIDER_CAPACITY_REGULAR_REMOVE_FAILED');
}finally{
  if(createdRouteId){
    await service.from('profile_routes').delete().eq('id',createdRouteId);
    await service.from('audit_logs').delete().eq('entity_id',createdRouteId);
  }
  if(originalRoutes?.length)await service.from('profile_routes').upsert(originalRoutes).throwOnError();
}

process.stdout.write('Supabase provider Capacity workspace, publication, location, duty, regular-service, scope, and browser-denial checks passed.\n');
