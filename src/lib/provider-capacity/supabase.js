import {capacitySignalFreshness} from '../domain.js';
import {createSupabaseAdminClient} from '../supabase-adapter.js';

const MANAGED_ERRORS=[
  'FORBIDDEN','SUBSCRIPTION_ACCESS_REQUIRED','INVALID_VEHICLE','DRIVER_REQUIRED_FOR_CAPACITY',
  'DEVICE_LOCATION_DRIVER_ONLY','CAPACITY_DRIVER_LOCATION_REQUIRED','CAPACITY_LOCATION_ACTIVE_REQUIRED',
  'CAPACITY_CONFIGURATION_REQUIRED','INVALID_APPROXIMATE_LOCATION','INVALID_CAPACITY_INPUT',
  'INVALID_CAPACITY_STATUS','ACCEPTED_LOADS_REQUIRED','INVALID_AVAILABILITY_GEOMETRY',
  'PARTIAL_CAPACITY_ROUTE_REQUIRED','CAPACITY_ROUTE_POINTS_REQUIRED','CAPACITY_AREA_BOUNDARY_REQUIRED',
  'CAPACITY_PLACE_DUPLICATE','LOCALITY_REQUIRED','REGULAR_CAPACITY_LIMIT','NOT_FOUND'
];

function managedError(code,error){
  const message=String(error?.message||'');
  const known=MANAGED_ERRORS.find(candidate=>message.includes(candidate));
  return new Error(known||code,{cause:error});
}

function points(value,minimum){
  if(!Array.isArray(value))return [];
  const result=value.slice(0,5).map(point=>({
    place_ref:String(point?.place_ref||''),label:String(point?.label||''),
    lat:Number(point?.lat),lng:Number(point?.lng)
  })).filter(point=>point.place_ref&&point.label&&Number.isFinite(point.lat)&&Number.isFinite(point.lng));
  return result.length>=minimum?result:[];
}

export function projectSupabaseProviderCapacityWorkspace(payload){
  const value=payload&&typeof payload==='object'?payload:{};
  const vehicles=Array.isArray(value.vehicles)?value.vehicles:[];
  const capacities=(Array.isArray(value.capacities)?value.capacities:[]).map(capacity=>{
    const status=String(capacity.market_status||capacity.status||'OFF_DUTY');
    const geometry=capacity.availability_geometry==='RADIUS'?'RADIUS':capacity.availability_geometry==='ROUTE'?'ROUTE':null;
    return {
      ...capacity,status,availability_geometry:geometry,
      current_route_points:geometry==='ROUTE'?points(capacity.current_route_points,2):[],
      capacity_area_boundary:geometry==='RADIUS'?points(capacity.capacity_area_boundary,3):[],
      proof_available:Boolean(capacity.proof_available||capacity.photo_storage_path),
      freshness:capacitySignalFreshness(status,capacity.updated_at,null,Number(process.env.CAPACITY_FRESH_HOURS||12)),
      expiry_state:'CURRENT',isOwn:true
    };
  });
  const corridors=(Array.isArray(value.corridors)?value.corridors:[]).slice(0,1).map(signal=>{
    const geometry=signal.geometry==='RADIUS'?'RADIUS':'ROUTE';
    return {...signal,geometry,
      route_points:geometry==='ROUTE'?points(signal.route_points,2):[],
      area_boundary:geometry==='RADIUS'?points(signal.area_boundary,3):[]
    };
  });
  const access=value.access&&typeof value.access==='object'?value.access:null;
  return {vehicles,capacities,corridors,access};
}

export async function getSupabaseProviderCapacityWorkspace(user){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('provider_capacity_workspace',{actor_user_id:user.id});
  if(error)throw managedError('SUPABASE_PROVIDER_CAPACITY_WORKSPACE_FAILED',error);
  return projectSupabaseProviderCapacityWorkspace(data);
}

function placeCommands(values){
  return (Array.isArray(values)?values:[]).map(value=>({
    place_ref:String(value?.placeRef||value?.place_ref||'').trim()
  }));
}

export async function publishSupabaseProviderCapacity(user,input,photo=/** @type {any} */(null)){
  const command={
    vehicle_id:String(input.vehicleId||''),status:String(input.status||''),
    accepted_loads:String(input.acceptedLoads||''),availability_geometry:String(input.availabilityGeometry||''),
    visibility:input.visibility==='PRIVATE'?'PRIVATE':'OPEN',location_source:String(input.locationSource||''),
    approximate_lat:input.approximateLat,approximate_lng:input.approximateLng,
    location_precision_km:input.locationPrecisionKm,
    current_route_places:placeCommands(input.currentRoutePlaces),
    capacity_area_center_place_ref:String(input.capacityAreaCenterPlaceRef||''),
    capacity_area_boundary_places:placeCommands(input.capacityAreaBoundaryPlaces),
    accepts_multi_pick:Boolean(input.acceptsMultiPick||input.acceptsMultiStop),
    accepts_multi_drop:Boolean(input.acceptsMultiDrop||input.acceptsMultiStop),
    photo_storage_path:photo?.path||null
  };
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('publish_provider_capacity',{actor_user_id:user.id,command});
  if(error)throw managedError('SUPABASE_PROVIDER_CAPACITY_PUBLISH_FAILED',error);
  return data;
}

export async function refreshSupabaseProviderCapacityLocation(user,input){
  const command={vehicle_id:String(input.vehicleId||''),approximate_lat:input.approximateLat,
    approximate_lng:input.approximateLng,location_precision_km:input.locationPrecisionKm};
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('refresh_provider_capacity_location',{actor_user_id:user.id,command});
  if(error)throw managedError('SUPABASE_PROVIDER_CAPACITY_LOCATION_FAILED',error);
  return data;
}

export async function setSupabaseProviderAssignedVehicleDuty(user,vehicleId,onDuty,input={}){
  const command={vehicle_id:String(vehicleId||''),on_duty:Boolean(onDuty),
    location_source:String(input.locationSource||''),approximate_lat:input.approximateLat,
    approximate_lng:input.approximateLng,location_precision_km:input.locationPrecisionKm};
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('set_provider_assigned_vehicle_duty',{actor_user_id:user.id,command});
  if(error)throw managedError('SUPABASE_PROVIDER_CAPACITY_DUTY_FAILED',error);
  return data;
}

export async function addSupabaseProviderRegularCapacity(user,input){
  const command={geometry:String(input.geometry||''),route_places:placeCommands(input.routePlaces),
    area_center_place_ref:String(input.areaCenterPlaceRef||''),
    area_boundary_places:placeCommands(input.areaBoundaryPlaces)};
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('add_provider_regular_capacity',{actor_user_id:user.id,command});
  if(error)throw managedError('SUPABASE_PROVIDER_REGULAR_CAPACITY_ADD_FAILED',error);
  return data;
}

export async function removeSupabaseProviderRegularCapacity(user,id){
  const client=createSupabaseAdminClient();
  const {error}=await client.rpc('remove_provider_regular_capacity',{
    actor_user_id:user.id,target_route_id:String(id||'')
  });
  if(error)throw managedError('SUPABASE_PROVIDER_REGULAR_CAPACITY_REMOVE_FAILED',error);
}
