import {featuredTruckTypeForDate} from './featured-trucks.js';

export function featuredTruckMapHref(candidate){
  if(!candidate.public_capacity_available||!candidate.public_capacity_id||!candidate.handle)return null;
  return `/?q=${encodeURIComponent(candidate.handle)}&truck=${encodeURIComponent(candidate.public_capacity_id)}`;
}

function providerKey(candidate){return candidate.provider_organization_id?`organization:${candidate.provider_organization_id}`:`profile:${candidate.provider_profile_id}`;}

// PostgREST limits both URL length and response rows. Keep UUID lists small,
// and paginate history so an older public signal cannot replace the latest one.
const identifierBatchSize=100,pageSize=500;
export async function readFeaturedRows(query,errorCode){
  const rows=[];
  for(let start=0;;start+=pageSize){
    const {data,error}=await query().range(start,start+pageSize-1);
    if(error)throw new Error(errorCode,{cause:error});
    rows.push(...(data||[]));
    if((data||[]).length<pageSize)return rows;
  }
}
async function readIdentifiers(ids,query,errorCode){
  const rows=[];
  for(let index=0;index<ids.length;index+=identifierBatchSize){
    const batch=ids.slice(index,index+identifierBatchSize);
    rows.push(...await readFeaturedRows(()=>query(batch),errorCode));
  }
  return rows;
}

export async function loadFeaturedTruckCandidates(client,date,providers){
  const theme=featuredTruckTypeForDate(date);
  const vehicles=await readFeaturedRows(()=>client.from('vehicles')
    .select('id,organization_id,provider_profile_id,platform_number,label,category,make,model,cargo_configuration,active')
    .eq('active',true).in('cargo_configuration',theme.configurations).order('platform_number').order('id'),
    'SUPABASE_FEATURED_TRUCKS_FAILED');
  const vehicleIds=(vehicles||[]).map(vehicle=>vehicle.id);
  if(!vehicleIds.length)return [];
  const [assignments,capacities,regularSignals]=await Promise.all([
    readFeaturedRows(()=>client.rpc('featured_eligible_truck_links',{configurations:theme.configurations}).order('vehicle_id'),
      'SUPABASE_FEATURED_DRIVERS_FAILED'),
    readIdentifiers(vehicleIds,ids=>client.from('capacities')
      .select('id,vehicle_id,visibility,market_status,status,updated_at').in('vehicle_id',ids).order('updated_at',{ascending:false}).order('id',{ascending:false}),
      'SUPABASE_FEATURED_CAPACITY_FAILED'),
    readIdentifiers(vehicleIds,ids=>client.rpc('featured_truck_regular_signals',{requested_vehicle_ids:ids}).order('vehicle_id'),
      'SUPABASE_FEATURED_REGULAR_FAILED')
  ]);
  const assignmentByVehicle=new Map();
  for(const assignment of assignments||[])if(!assignmentByVehicle.has(assignment.vehicle_id))assignmentByVehicle.set(assignment.vehicle_id,assignment);
  const capacityByVehicle=new Map();
  for(const capacity of capacities||[])if(!capacityByVehicle.has(capacity.vehicle_id))capacityByVehicle.set(capacity.vehicle_id,capacity);
  const regularByVehicle=new Map((regularSignals||[]).map(row=>[row.vehicle_id,row]));
  const driverIds=[...new Set([...assignmentByVehicle.values()].map(item=>item.driver_user_id))];
  if(!driverIds.length)return [];
  const profiles=await readIdentifiers(driverIds,ids=>client.rpc('public_person_identities',{requested_user_ids:ids}),'SUPABASE_FEATURED_DRIVERS_FAILED');
  const profileById=new Map((profiles||[]).map(profile=>[profile.id,profile]));
  const providerByKey=new Map(providers.map(provider=>[providerKey(provider),provider]));
  return (vehicles||[]).flatMap(vehicle=>{
    const ownerKey=vehicle.organization_id?`organization:${vehicle.organization_id}`:`profile:${vehicle.provider_profile_id}`;
    const provider=providerByKey.get(ownerKey);const assignment=assignmentByVehicle.get(vehicle.id);const profile=assignment?profileById.get(assignment.driver_user_id):null;
    // The eligible-link command checks the current owner/employee relationship.
    // A provider owner who drives does not have an employee-directory row.
    if(!provider?.eligible||!assignment||!profile)return [];
    const driverKind=vehicle.organization_id?'COMPANY_DRIVER':provider.provider_kind;
    const capacity=capacityByVehicle.get(vehicle.id);
    const capacityStatus=String(capacity?.market_status||capacity?.status||'').toUpperCase();
    const scopedRegular=regularByVehicle.get(vehicle.id);
    const sourceSignal=scopedRegular?.driver_user_id===assignment.driver_user_id?scopedRegular.regular_signal:null;
    const placeLabels=value=>Array.isArray(value)?value.slice(0,5).map(point=>String(point?.label||'')).filter(Boolean).map(label=>({label})):[];
    const regularSignal=sourceSignal?.geometry==='ROUTE'?{geometry:'ROUTE',route_points:placeLabels(sourceSignal.route_points)}
      :sourceSignal?.geometry==='RADIUS'?{geometry:'RADIUS',area_center_label:String(sourceSignal.area_center_label||''),area_boundary:placeLabels(sourceSignal.area_boundary)}:null;
    const regularLabel=regularSignal?.geometry==='ROUTE'?regularSignal.route_points.map(point=>point.label).join(' ↔ ')
      :regularSignal?[regularSignal.area_center_label,...regularSignal.area_boundary.map(point=>point.label)].filter(Boolean).join(' · '):'';
    return [{
      ...provider,
      services:'',regular_signal:regularSignal,corridors:regularLabel?[regularLabel]:[],
      provider_key:ownerKey,
      truck_key:`vehicle:${vehicle.id}`,
      vehicle_id:vehicle.id,
      driver_user_id:assignment.driver_user_id,
      driver_first_name:profile.first_name||'Driver',
      driver_portrait_url:profile.portrait_url||null,
      driver_kind:driverKind,
      driver_kind_label:'Driver',
      platform_number:vehicle.platform_number,
      vehicle_label:vehicle.label,
      vehicle_category:vehicle.category,
      vehicle_make:vehicle.make,
      vehicle_model:vehicle.model,
      cargo_configuration:vehicle.cargo_configuration,
      public_capacity_id:capacity?.visibility==='OPEN'&&['EMPTY','PARTIAL'].includes(capacityStatus)?capacity.id:null,
      public_capacity_available:capacity?.visibility==='OPEN'&&['EMPTY','PARTIAL'].includes(capacityStatus),
      eligible:true,
      theme
    }];
  });
}
