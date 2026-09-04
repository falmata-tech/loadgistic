import crypto from 'node:crypto';

export const SMALL_LOCAL_VEHICLE_CONFIGURATIONS=new Set([
  'Cargo van','Pickup truck','Pickup stake body',
  'Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck'
]);

export const LONG_HAUL_VEHICLE_CONFIGURATIONS=new Set([
  'Medium Stake Body Truck','Medium Box Truck','Heavy Rigid Stake Body Truck','Heavy Rigid Stake Body Truck + Trailer'
]);

function stableScore(value){
  return Number.parseInt(crypto.createHash('sha256').update(`loadgistic-market-policy:${value}`).digest('hex').slice(0,12),16);
}

function stableTake(rows,count,keyFor=row=>row.id){
  return new Set([...rows]
    .sort((first,second)=>stableScore(first.id)-stableScore(second.id)||String(first.id).localeCompare(String(second.id)))
    .slice(0,count)
    .map(keyFor));
}

export function applyManagedFixtureMarketPolicy(capacities,vehicles,{localEmptyPublicCount=50,localPartialPublicCount=35}={}){
  const vehicleById=new Map(vehicles.map(vehicle=>[vehicle.id,vehicle]));
  const isLongHaul=capacity=>LONG_HAUL_VEHICLE_CONFIGURATIONS.has(vehicleById.get(capacity.vehicle_id)?.cargo_configuration);
  const localEmptyPublic=stableTake(capacities.filter(capacity=>!isLongHaul(capacity)
    &&String(capacity.market_status||capacity.status)==='EMPTY'),localEmptyPublicCount);
  const localPartialPublic=stableTake(capacities.filter(capacity=>!isLongHaul(capacity)
    &&String(capacity.market_status||capacity.status)==='PARTIAL'),localPartialPublicCount);

  return capacities.map(capacity=>{
    if(isLongHaul(capacity)){
      return {...capacity,status:'EMPTY',market_status:'EMPTY',available_percent:100,visibility:'OPEN',
        accepts_full_load:1,accepts_partial_load:1,planned_space_status:null};
    }
    const publiclyVisible=localEmptyPublic.has(capacity.id)||localPartialPublic.has(capacity.id);
    const locationPrecisionKm=Math.max(1,Math.min(5,Number(capacity.location_precision_km)||3));
    return {...capacity,visibility:publiclyVisible?'OPEN':'PRIVATE',location_precision_km:locationPrecisionKm};
  });
}

export function selectSharedFixtureVehicleIds(capacities,shareRatio=.25){
  const ratio=Math.max(0,Math.min(1,Number(shareRatio)||0));
  const unique=[...new Map(capacities.map(capacity=>[capacity.vehicle_id,capacity])).values()];
  return stableTake(unique,Math.ceil(unique.length*ratio),capacity=>capacity.vehicle_id);
}

export function normalizeDemoSharedEmails(value,{maximum=5}={}){
  const emails=[...new Set(String(value||'').split(',').map(email=>email.trim().toLowerCase()).filter(Boolean))];
  if(emails.length>maximum)throw new Error('DEMO_SHARED_EMAIL_LIMIT_EXCEEDED');
  if(emails.some(email=>!/^\S+@\S+\.\S+$/.test(email)))throw new Error('DEMO_SHARED_EMAIL_INVALID');
  return emails;
}

export function ensureIndependentVehicleAssignments(vehicles,providerProfiles,assignments,{assignedAt}={}){
  const profileById=new Map(providerProfiles.map(profile=>[profile.id,profile]));
  const activeVehicleIds=new Set(assignments
    .filter(assignment=>Number(assignment.active)!==0)
    .map(assignment=>assignment.vehicle_id));
  const additions=vehicles.filter(vehicle=>Number(vehicle.active)!==0&&vehicle.provider_profile_id
    &&!activeVehicleIds.has(vehicle.id)).map(vehicle=>{
    const profile=profileById.get(vehicle.provider_profile_id);
    if(!profile?.user_id)throw new Error(`INDEPENDENT_VEHICLE_OWNER_MISSING:${vehicle.id}`);
    return {
      id:`driver-vehicle-independent-${vehicle.id}`,
      driver_user_id:profile.user_id,
      vehicle_id:vehicle.id,
      assigned_by:profile.user_id,
      assigned_at:assignedAt||vehicle.created_at||profile.created_at,
      active:1
    };
  });
  return [...assignments,...additions];
}
