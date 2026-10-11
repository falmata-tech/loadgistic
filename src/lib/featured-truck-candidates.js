import {featuredTruckTypeForDate} from './featured-trucks.js';
import {driverPortraitUrl,uploadedDriverPortraitUrl} from './driver-portraits.js';

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
  const [assignments,capacities]=await Promise.all([
    readFeaturedRows(()=>client.rpc('featured_eligible_truck_links',{configurations:theme.configurations}).order('vehicle_id'),
      'SUPABASE_FEATURED_DRIVERS_FAILED'),
    readIdentifiers(vehicleIds,ids=>client.from('capacities')
      .select('id,vehicle_id,visibility,market_status,status,updated_at').in('vehicle_id',ids).order('updated_at',{ascending:false}).order('id',{ascending:false}),
      'SUPABASE_FEATURED_CAPACITY_FAILED')
  ]);
  const assignmentByVehicle=new Map();
  for(const assignment of assignments||[])if(!assignmentByVehicle.has(assignment.vehicle_id))assignmentByVehicle.set(assignment.vehicle_id,assignment);
  const capacityByVehicle=new Map();
  for(const capacity of capacities||[])if(!capacityByVehicle.has(capacity.vehicle_id))capacityByVehicle.set(capacity.vehicle_id,capacity);
  const driverIds=[...new Set([...assignmentByVehicle.values()].map(item=>item.driver_user_id))];
  if(!driverIds.length)return [];
  const [profiles,fleetDrivers,portraits]=await Promise.all([
    readIdentifiers(driverIds,ids=>client.from('profiles').select('id,full_name,active,driver_portrait_preset').in('id',ids).order('id'),'SUPABASE_FEATURED_DRIVERS_FAILED'),
    readIdentifiers(driverIds,ids=>client.from('drivers').select('user_id,name,active').in('user_id',ids).order('user_id'),'SUPABASE_FEATURED_DRIVERS_FAILED'),
    readIdentifiers(driverIds,ids=>client.from('driver_portrait_uploads').select('user_id,id').eq('state','ACTIVE').in('user_id',ids).order('id'),'SUPABASE_FEATURED_DRIVERS_FAILED')
  ]);
  const portraitByDriver=new Map((portraits||[]).map(portrait=>[portrait.user_id,portrait.id]));
  const profileById=new Map((profiles||[]).map(profile=>[profile.id,profile]));
  const fleetDriverById=new Map((fleetDrivers||[]).map(driver=>[driver.user_id,driver]));
  const providerByKey=new Map(providers.map(provider=>[providerKey(provider),provider]));
  return (vehicles||[]).flatMap(vehicle=>{
    const ownerKey=vehicle.organization_id?`organization:${vehicle.organization_id}`:`profile:${vehicle.provider_profile_id}`;
    const provider=providerByKey.get(ownerKey);const assignment=assignmentByVehicle.get(vehicle.id);const profile=assignment?profileById.get(assignment.driver_user_id):null;const fleetDriver=assignment?fleetDriverById.get(assignment.driver_user_id):null;
    if(!provider?.eligible||!assignment||!profile?.active||(vehicle.organization_id&&!fleetDriver?.active))return [];
    const driverName=String(fleetDriver?.name||profile.full_name||'Driver').trim();
    const driverKind=vehicle.organization_id?'COMPANY_DRIVER':provider.provider_kind;
    const capacity=capacityByVehicle.get(vehicle.id);
    const capacityStatus=String(capacity?.market_status||capacity?.status||'').toUpperCase();
    return [{
      ...provider,
      provider_key:ownerKey,
      truck_key:`vehicle:${vehicle.id}`,
      vehicle_id:vehicle.id,
      driver_user_id:assignment.driver_user_id,
      driver_first_name:driverName.split(/\s+/)[0]||'Driver',
      driver_portrait_url:uploadedDriverPortraitUrl(portraitByDriver.get(profile.id))||driverPortraitUrl(profile.driver_portrait_preset),
      driver_kind:driverKind,
      driver_kind_label:driverKind==='COMPANY_DRIVER'?'Company driver':provider.provider_kind_label,
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
