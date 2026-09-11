import crypto from 'node:crypto';

export const SMALL_LOCAL_VEHICLE_CONFIGURATIONS=new Set([
  'Courier car','Cargo van','Pickup truck','Pickup stake body',
  'Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck'
]);

export const TRACTOR_TRAILER_CONFIGURATIONS=Object.freeze([
  'Tractor + Container Trailer','Tractor + Dry Van Trailer','Tractor + Heavy Equipment Trailer'
]);

export const LONG_HAUL_VEHICLE_CONFIGURATIONS=new Set([
  'Medium Stake Body Truck','Medium Box Truck','Heavy Rigid Stake Body Truck','Heavy Rigid Stake Body Truck + Trailer',
  ...TRACTOR_TRAILER_CONFIGURATIONS
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

function stableRows(rows,count){
  const ids=stableTake(rows,count);
  return rows.filter(row=>ids.has(row.id));
}

const ORIGINAL_SMALL_CONFIGURATIONS=new Set([
  'Cargo van','Pickup truck','Pickup stake body',
  'Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck'
]);
const LIGHT_CONFIGURATIONS=new Set(['Light Stake Body Truck','Light Box Truck']);
const MEDIUM_CONFIGURATIONS=new Set(['Medium Stake Body Truck','Medium Box Truck']);

export function applyManagedFixtureVehicleCatalog(vehicles,assignments,users){
  const userById=new Map(users.map(user=>[user.id,user]));
  const driverByVehicleId=new Map(assignments.filter(assignment=>Number(assignment.active)!==0)
    .map(assignment=>[assignment.vehicle_id,assignment.driver_user_id]));
  const iconOnly=vehicle=>!userById.get(driverByVehicleId.get(vehicle.id))?.driver_portrait_preset;
  const courierLocal=stableTake(vehicles.filter(vehicle=>iconOnly(vehicle)
    &&ORIGINAL_SMALL_CONFIGURATIONS.has(vehicle.cargo_configuration)),9);
  const courierRegional=stableTake(vehicles.filter(vehicle=>iconOnly(vehicle)
    &&LIGHT_CONFIGURATIONS.has(vehicle.cargo_configuration)),3);
  const tractorSources=[
    ...stableRows(vehicles.filter(vehicle=>iconOnly(vehicle)
      &&MEDIUM_CONFIGURATIONS.has(vehicle.cargo_configuration)),2),
    ...stableRows(vehicles.filter(vehicle=>iconOnly(vehicle)
      &&vehicle.cargo_configuration==='Heavy Rigid Stake Body Truck'),2),
    ...stableRows(vehicles.filter(vehicle=>iconOnly(vehicle)
      &&vehicle.cargo_configuration==='Heavy Rigid Stake Body Truck + Trailer'),2)
  ].sort((first,second)=>stableScore(first.id)-stableScore(second.id)||String(first.id).localeCompare(String(second.id)));
  if(courierLocal.size!==9||courierRegional.size!==3||tractorSources.length!==6){
    throw new Error('MANAGED_FIXTURE_VEHICLE_CATALOG_SOURCE_MISSING');
  }
  const courierIds=new Set([...courierLocal,...courierRegional]);
  const tractorConfigurationById=new Map(tractorSources.map((vehicle,index)=>[
    vehicle.id,TRACTOR_TRAILER_CONFIGURATIONS[index%TRACTOR_TRAILER_CONFIGURATIONS.length]
  ]));
  const courierModels=[['Toyota','Corolla'],['Toyota','Vitz'],['Suzuki','Dzire']];

  return vehicles.map(vehicle=>{
    if(courierIds.has(vehicle.id)){
      const [make,model]=courierModels[stableScore(vehicle.id)%courierModels.length];
      return {...vehicle,label:`${make} ${model}`,category:'Courier car',make,model,
        cargo_configuration:'Courier car',trailer_interchangeable:false,
        supported_trailer_configurations:[]};
    }
    const attachedTrailer=tractorConfigurationById.get(vehicle.id);
    if(attachedTrailer){
      const tractorModels=[['FAW','J6P'],['Shacman','X3000'],['Sinotruk','HOWO']];
      const [make,model]=tractorModels[stableScore(vehicle.id)%tractorModels.length];
      return {...vehicle,label:`${make} ${model}`,category:'Tractor',make,model,
        cargo_configuration:attachedTrailer,trailer_interchangeable:true,
        supported_trailer_configurations:[...TRACTOR_TRAILER_CONFIGURATIONS]};
    }
    return {...vehicle,trailer_interchangeable:false,supported_trailer_configurations:[]};
  });
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
