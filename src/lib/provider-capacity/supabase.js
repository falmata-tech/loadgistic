import {phoneLocationCommand} from '../phone-location-command.js';
import {capacitySignalFreshness} from '../domain.js';
import {createSupabaseAdminClient} from '../supabase-adapter.js';
import {getTruckAuthorities} from '../provider-authority.js';

const MANAGED_ERRORS=[
  'TRUCK_NOT_LIVE','PROVIDER_VERIFICATION_REQUIRED','LOCATION_SOURCE_PENDING','PHONE_LOCATION_UNAVAILABLE','INVALID_PHONE_LOCATION',
  'FORBIDDEN','SUBSCRIPTION_ACCESS_REQUIRED','INVALID_VEHICLE','DRIVER_REQUIRED_FOR_CAPACITY',
  'DEVICE_LOCATION_DRIVER_ONLY','CAPACITY_DRIVER_LOCATION_REQUIRED','CAPACITY_LOCATION_ACTIVE_REQUIRED',
  'CAPACITY_CONFIGURATION_REQUIRED','INVALID_APPROXIMATE_LOCATION','INVALID_CAPACITY_INPUT',
  'INVALID_CAPACITY_STATUS','ACCEPTED_LOADS_REQUIRED','INVALID_AVAILABILITY_GEOMETRY',
  'PARTIAL_CAPACITY_ROUTE_REQUIRED','CAPACITY_ROUTE_POINTS_REQUIRED','CAPACITY_AREA_BOUNDARY_REQUIRED','CAPACITY_AREA_BOUNDARY_INVALID',
  'CAPACITY_PLACE_DUPLICATE','LOCALITY_REQUIRED','REGULAR_CAPACITY_LIMIT','REGULAR_TRUCK_DRIVER_REQUIRED','TRUCK_DRIVER_CHANGED','NOT_FOUND','INVALID_SHARING_MODE','EXCLUSIVE_EMAIL_REQUIRED','EXCLUSIVE_RECIPIENT_ONLY','CONTACT_NAME_REQUIRED'
];

function managedError(code,error){
  const message=String(error?.message||'');
  const known=MANAGED_ERRORS.find(candidate=>message.includes(candidate));
  if(!known){
    // Never log database messages/details: they can include submitted coordinates
    // or contacts. An operation and bounded SQL/PostgREST code are sufficient
    // to distinguish a database outage, stale schema, and validation defect.
    const databaseCode=/^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(String(error?.code||''))?String(error.code):'UNAVAILABLE';
    console.error('[provider-capacity]',{operation:code,databaseCode});
  }
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
  const pairByVehicle=new Map(vehicles.map(vehicle=>[vehicle.id,vehicle.assigned_driver?.id]));
  const seenPairs=new Set();
  const corridors=(Array.isArray(value.corridors)?value.corridors:[]).filter(signal=>{
    if(!signal?.vehicle_id||!signal.driver_user_id||pairByVehicle.get(signal.vehicle_id)!==signal.driver_user_id)return false;
    const key=JSON.stringify([signal.vehicle_id,signal.driver_user_id]);if(seenPairs.has(key))return false;seenPairs.add(key);return true;
  }).map(signal=>{
    const geometry=signal.geometry==='RADIUS'?'RADIUS':'ROUTE';
    return {...signal,geometry,
      route_points:geometry==='ROUTE'?points(signal.route_points,2):[],
      area_boundary:geometry==='RADIUS'?points(signal.area_boundary,3):[]
    };
  });
  const access=value.access&&typeof value.access==='object'?value.access:null;
  return {vehicles,capacities,corridors,access};
}

/** Read source choice only for vehicles already authorized by the workspace RPC.
 * Exact manual/device positions and provider ownership never enter this projection.
 */
export async function getAuthorizedVehicleLocationSelections(client,vehicleIds){
  const ids=[...new Set(vehicleIds.filter(id=>typeof id==='string'&&id))],allowed=new Set(ids),selections=new Map();
  for(let offset=0;offset<ids.length;offset+=100){
    const {data,error}=await client.from('telematics_location_sources')
      .select('vehicle_id,source,selected_at,precision_km,revision').in('vehicle_id',ids.slice(offset,offset+100));
    if(error)throw managedError('SUPABASE_PROVIDER_CAPACITY_WORKSPACE_FAILED',error);
    for(const row of data||[]){
      if(!allowed.has(row.vehicle_id))continue;
      if(!['GPS','MOBILE','MANUAL'].includes(row.source)||![1,3,5,10,20,40].includes(row.precision_km)
        ||!Number.isFinite(Date.parse(row.selected_at))||!Number.isFinite(Date.parse(row.revision)))throw new Error('SUPABASE_PROVIDER_CAPACITY_WORKSPACE_FAILED');
      selections.set(row.vehicle_id,{source:row.source,selectedAt:row.selected_at,precisionKm:row.precision_km,revision:row.revision});
    }
  }
  return selections;
}

export async function getSupabaseProviderCapacityWorkspace(user){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('provider_capacity_workspace',{actor_user_id:user.id});
  if(error)throw managedError('SUPABASE_PROVIDER_CAPACITY_WORKSPACE_FAILED',error);
  const workspace=projectSupabaseProviderCapacityWorkspace(data);
  const vehicleIds=workspace.vehicles.map(vehicle=>vehicle.id).filter(Boolean);
  if(!vehicleIds.length)return workspace;
  const {data:trailerDetails,error:trailerError}=await client.from('vehicles')
    .select('id,trailer_interchangeable,supported_trailer_configurations,use_basis,publication_status').in('id',vehicleIds);
  if(trailerError)throw managedError('SUPABASE_PROVIDER_CAPACITY_WORKSPACE_FAILED',trailerError);
  const detailsById=new Map((trailerDetails||[]).map(vehicle=>[vehicle.id,vehicle]));
  const authorities=new Map();
  for(let offset=0;offset<vehicleIds.length;offset+=100){
    for(const [id,authority] of await getTruckAuthorities(client,vehicleIds.slice(offset,offset+100)))authorities.set(id,authority);
  }
  const selections=await getAuthorizedVehicleLocationSelections(client,vehicleIds);
  return {...workspace,vehicles:workspace.vehicles.map(vehicle=>({...vehicle,...detailsById.get(vehicle.id),authority:authorities.get(vehicle.id),
    location_selection:selections.get(vehicle.id)||{source:'MOBILE',selectedAt:'1970-01-01T00:00:00Z',precisionKm:10,revision:'1970-01-01T00:00:00Z'}}))};
}

function placeCommands(values){
  return (Array.isArray(values)?values:[]).map(value=>({
    place_ref:String(value?.placeRef||value?.place_ref||'').trim()
  }));
}

export async function publishSupabaseProviderCapacity(user,input,photo=/** @type {any} */(null)){
  if(input.sharingMode==='EXCLUSIVE'||input.exclusiveEmail||input.exclusiveName)throw new Error('EMAIL_CAPACITY_RETIRED');
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
  if(input.sharingMode){
    command.sharing_mode=String(input.sharingMode);
  }
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('publish_provider_capacity',{actor_user_id:user.id,command});
  if(error)throw managedError('SUPABASE_PROVIDER_CAPACITY_PUBLISH_FAILED',error);
  return data;
}

export async function refreshSupabaseProviderCapacityLocation(user,input){
  const command={vehicle_id:String(input.vehicleId||''),approximate_lat:input.approximateLat,
    approximate_lng:input.approximateLng,location_precision_km:input.locationPrecisionKm,...(input.phoneInstallation?{phone_installation:phoneLocationCommand(input.phoneInstallation)}:{})};
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('refresh_provider_capacity_location',{actor_user_id:user.id,command});
  if(error)throw managedError('SUPABASE_PROVIDER_CAPACITY_LOCATION_FAILED',error);
  return data;
}

export async function setSupabaseProviderAssignedVehicleDuty(user,vehicleId,onDuty,input={}){
  const command={vehicle_id:String(vehicleId||''),on_duty:Boolean(onDuty),
    location_source:String(input.locationSource||''),approximate_lat:input.approximateLat,
    approximate_lng:input.approximateLng,location_precision_km:input.locationPrecisionKm,...(input.phoneInstallation?{phone_installation:phoneLocationCommand(input.phoneInstallation)}:{})};
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('set_provider_assigned_vehicle_duty',{actor_user_id:user.id,command});
  if(error)throw managedError('SUPABASE_PROVIDER_CAPACITY_DUTY_FAILED',error);
  return data;
}

export async function addSupabaseProviderRegularCapacity(user,input,replaceId=/** @type {string|null} */(null)){
  const command={vehicle_id:String(input.vehicleId||''),expected_driver_id:String(input.expectedDriverId||''),geometry:String(input.geometry||''),route_places:placeCommands(input.routePlaces),
    area_center_place_ref:String(input.areaCenterPlaceRef||''),
    area_boundary_places:placeCommands(input.areaBoundaryPlaces)};
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc(replaceId?'replace_provider_regular_capacity':'add_provider_regular_capacity',{
    actor_user_id:user.id,command,...(replaceId?{target_route_id:String(replaceId)}:{})
  });
  if(error)throw managedError('SUPABASE_PROVIDER_REGULAR_CAPACITY_ADD_FAILED',error);
  return data;
}

export async function removeSupabaseProviderRegularCapacity(user,id,/** @type {{vehicleId:string,expectedDriverId:string}} */ scope){
  const client=createSupabaseAdminClient();
  const {error}=await client.rpc('remove_provider_regular_capacity',{
    actor_user_id:user.id,target_route_id:String(id||''),target_vehicle_id:String(scope?.vehicleId||''),expected_driver_user_id:String(scope?.expectedDriverId||'')
  });
  if(error)throw managedError('SUPABASE_PROVIDER_REGULAR_CAPACITY_REMOVE_FAILED',error);
}
