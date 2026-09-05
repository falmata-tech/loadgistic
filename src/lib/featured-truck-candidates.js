import {featuredTruckTypeForDate} from './featured-trucks.js';
import {driverPortraitUrl} from './driver-portraits.js';

function providerKey(candidate){return candidate.provider_organization_id?`organization:${candidate.provider_organization_id}`:`profile:${candidate.provider_profile_id}`;}

export async function loadFeaturedTruckCandidates(client,date,providers){
  const theme=featuredTruckTypeForDate(date);
  const {data:vehicles,error:vehicleError}=await client.from('vehicles')
    .select('id,organization_id,provider_profile_id,platform_number,label,category,make,model,cargo_configuration,active')
    .eq('active',true).in('cargo_configuration',theme.configurations).order('platform_number');
  if(vehicleError)throw new Error('SUPABASE_FEATURED_TRUCKS_FAILED',{cause:vehicleError});
  const vehicleIds=(vehicles||[]).map(vehicle=>vehicle.id);
  if(!vehicleIds.length)return [];
  const {data:assignments,error:assignmentError}=await client.from('driver_vehicle_assignments')
    .select('id,vehicle_id,driver_user_id,assigned_at,active').eq('active',true).in('vehicle_id',vehicleIds).order('assigned_at',{ascending:false});
  if(assignmentError)throw new Error('SUPABASE_FEATURED_DRIVERS_FAILED',{cause:assignmentError});
  const assignmentByVehicle=new Map();
  for(const assignment of assignments||[])if(!assignmentByVehicle.has(assignment.vehicle_id))assignmentByVehicle.set(assignment.vehicle_id,assignment);
  const driverIds=[...new Set([...assignmentByVehicle.values()].map(item=>item.driver_user_id))];
  if(!driverIds.length)return [];
  const [{data:profiles,error:profileError},{data:fleetDrivers,error:fleetDriverError}]=await Promise.all([
    client.from('profiles').select('id,full_name,active,driver_portrait_preset').in('id',driverIds),
    client.from('drivers').select('user_id,name,active').in('user_id',driverIds)
  ]);
  if(profileError||fleetDriverError)throw new Error('SUPABASE_FEATURED_DRIVERS_FAILED',{cause:profileError||fleetDriverError});
  const profileById=new Map((profiles||[]).map(profile=>[profile.id,profile]));
  const fleetDriverById=new Map((fleetDrivers||[]).map(driver=>[driver.user_id,driver]));
  const providerByKey=new Map(providers.map(provider=>[providerKey(provider),provider]));
  return (vehicles||[]).flatMap(vehicle=>{
    const ownerKey=vehicle.organization_id?`organization:${vehicle.organization_id}`:`profile:${vehicle.provider_profile_id}`;
    const provider=providerByKey.get(ownerKey);const assignment=assignmentByVehicle.get(vehicle.id);const profile=assignment?profileById.get(assignment.driver_user_id):null;const fleetDriver=assignment?fleetDriverById.get(assignment.driver_user_id):null;
    if(!provider?.eligible||!assignment||!profile?.active||(vehicle.organization_id&&!fleetDriver?.active))return [];
    const driverName=String(fleetDriver?.name||profile.full_name||'Driver').trim();
    const driverKind=vehicle.organization_id?'COMPANY_DRIVER':provider.provider_kind;
    return [{
      ...provider,
      provider_key:ownerKey,
      truck_key:`vehicle:${vehicle.id}`,
      vehicle_id:vehicle.id,
      driver_user_id:assignment.driver_user_id,
      driver_first_name:driverName.split(/\s+/)[0]||'Driver',
      driver_portrait_url:driverPortraitUrl(profile.driver_portrait_preset),
      driver_kind:driverKind,
      driver_kind_label:driverKind==='COMPANY_DRIVER'?'Company driver':provider.provider_kind_label,
      platform_number:vehicle.platform_number,
      vehicle_label:vehicle.label,
      vehicle_category:vehicle.category,
      vehicle_make:vehicle.make,
      vehicle_model:vehicle.model,
      cargo_configuration:vehicle.cargo_configuration,
      eligible:true,
      theme
    }];
  });
}
