import crypto from 'node:crypto';
import {DEFAULT_FEATURED_SCHEDULE_CONFIG,validateFeaturedScheduleConfig} from '../src/lib/expo-broadcast.js';
import discovery from '../resources/fixtures/managed-market-discovery.json' with {type:'json'};

export function managedFixtureFeaturedSchedule(targetCount){
  const config={...DEFAULT_FEATURED_SCHEDULE_CONFIG,targetCount};
  validateFeaturedScheduleConfig(config);
  return {broadcast_start_time:config.dayStart,broadcast_end_time:config.dayEnd,
    schedule_mode:'AUTO',schedule_config_json:config};
}

export const TRACTOR_TRAILER_CONFIGURATIONS=Object.freeze([
  'Tractor + Container Trailer','Tractor + Dry Van Trailer','Tractor + Heavy Equipment Trailer'
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

const MEDIUM_CONFIGURATIONS=new Set(['Medium Stake Body Truck','Medium Box Truck']);

// Fresh disposable imports only. Existing reviewed physical vehicles must use
// the normal retirement/replacement workflow; this is not a live backfill.
export const MANAGED_COURIER_FIXTURE_VEHICLES=Object.freeze([
  ['veh-public-owner-01','Heavy Rigid Stake Body Truck','Courier car','Toyota','Vitz'],
  ['veh-public-owner-04','Heavy Rigid Stake Body Truck','Courier car','Suzuki','Dzire'],
  ['veh-public-owner-05','Heavy Rigid Stake Body Truck','Courier car','Toyota','Corolla'],
  ['veh-public-owner-09','Heavy Rigid Stake Body Truck + Trailer','Courier car','Toyota','Yaris'],
  ['veh-public-owner-10','Heavy Rigid Stake Body Truck + Trailer','Courier car','Suzuki','Swift'],
  ['veh-public-owner-11','Heavy Rigid Stake Body Truck + Trailer','Courier car','Honda','Fit'],
  ['veh-public-fleet-01-8','Mini Open Body Truck','Courier car','Toyota','Vitz'],
  ['veh-public-fleet-02-3','Mini Open Body Truck','Courier car','Suzuki','Dzire'],
  ['veh-public-fleet-03-5','Mini Open Body Truck','Courier car','Toyota','Corolla'],
  ['veh-public-fleet-04-6','Mini Open Body Truck','Courier car','Toyota','Yaris'],
  ['veh-public-fleet-05-5','Mini Stake Body Truck','Courier car','Suzuki','Swift'],
  ['veh-public-fleet-06-3','Mini Open Body Truck','Courier car','Honda','Fit']
].map(([id,previousConfiguration,configuration,make,model])=>Object.freeze({id,previousConfiguration,configuration,make,model})));

export function applyManagedFixtureVehicleCatalog(vehicles,assignments,users){
  const userById=new Map(users.map(user=>[user.id,user]));
  const driverByVehicleId=new Map(assignments.filter(assignment=>Number(assignment.active)!==0)
    .map(assignment=>[assignment.vehicle_id,assignment.driver_user_id]));
  const iconOnly=vehicle=>!userById.get(driverByVehicleId.get(vehicle.id))?.driver_portrait_preset;
  const tractorSources=[
    ...stableRows(vehicles.filter(vehicle=>iconOnly(vehicle)
      &&MEDIUM_CONFIGURATIONS.has(vehicle.cargo_configuration)),2),
    ...stableRows(vehicles.filter(vehicle=>iconOnly(vehicle)
      &&vehicle.cargo_configuration==='Heavy Rigid Stake Body Truck'),2),
    ...stableRows(vehicles.filter(vehicle=>iconOnly(vehicle)
      &&vehicle.cargo_configuration==='Heavy Rigid Stake Body Truck + Trailer'),2)
  ].sort((first,second)=>stableScore(first.id)-stableScore(second.id)||String(first.id).localeCompare(String(second.id)));
  if(tractorSources.length!==6){
    throw new Error('MANAGED_FIXTURE_VEHICLE_CATALOG_SOURCE_MISSING');
  }
  const tractorConfigurationById=new Map(tractorSources.map((vehicle,index)=>[
    vehicle.id,TRACTOR_TRAILER_CONFIGURATIONS[index%TRACTOR_TRAILER_CONFIGURATIONS.length]
  ]));
  const courierById=new Map(MANAGED_COURIER_FIXTURE_VEHICLES.map(row=>[row.id,row]));
  for(const expected of courierById.values()){
    const vehicle=vehicles.find(row=>row.id===expected.id);
    const suffix=expected.id.replace(/^veh-public-owner-/,'');
    const ownerMatches=expected.id.startsWith('veh-public-owner-')
      ?vehicle?.provider_profile_id===`profile-public-owner-${suffix}`&&!vehicle.organization_id
        &&driverByVehicleId.get(vehicle.id)===`user-public-owner-${suffix}`
      :vehicle?.organization_id===expected.id.replace(/^veh-/,'org-').replace(/-\d+$/,'')
        &&!vehicle.provider_profile_id&&driverByVehicleId.has(vehicle.id);
    if(!vehicle||vehicle.cargo_configuration!==expected.previousConfiguration||!ownerMatches
      ||tractorConfigurationById.has(vehicle.id))throw new Error('MANAGED_FIXTURE_COURIER_SOURCE_MISMATCH');
  }

  return vehicles.map(vehicle=>{
    const courier=courierById.get(vehicle.id);
    if(courier)return {...vehicle,label:`${courier.make} ${courier.model}`,category:courier.configuration,
      make:courier.make,model:courier.model,cargo_configuration:courier.configuration,
      trailer_interchangeable:false,supported_trailer_configurations:[]};
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

export function applyManagedFixtureMarketPolicy(capacities,_vehicles=[]){
  const choices=new Map(discovery.capacity_choices.map(row=>[row.capacity_id,row]));
  return capacities.map(capacity=>{
    const choice=choices.get(capacity.id);
    if(choice&&choice.vehicle_id!==capacity.vehicle_id)throw Error('MANAGED_FIXTURE_DISCOVERY_BINDING_DRIFT');
    // These are saved fixture choices, not a category-dependent publishing rule.
    // In particular, do not turn a larger truck into Empty/100% or infer loads.
    return {...capacity,visibility:choice?.visibility||(capacity.visibility==='OPEN'?'OPEN':'PRIVATE'),
      location_precision_km:choice?.location_precision_km??capacity.location_precision_km};
  });
}

export const HANDOVER_FIXTURE_VEHICLE_IDS=new Set([
  'veh-public-fleet-01-1','veh-public-fleet-01-4'
]);

export function selectSharedFixtureVehicleIds(capacities,shareRatio=.25,{excludedVehicleIds=new Set()}={}){
  const ratio=Math.max(0,Math.min(1,Number(shareRatio)||0));
  const unique=[...new Map(capacities.map(capacity=>[capacity.vehicle_id,capacity])).values()];
  const eligible=unique.filter(capacity=>!excludedVehicleIds.has(capacity.vehicle_id));
  return stableTake(eligible,Math.min(eligible.length,Math.ceil(unique.length*ratio)),capacity=>capacity.vehicle_id);
}

export function managedFixtureSharingPolicies(capacities,sharedVehicleIds){
  const latest=new Map();
  for(const capacity of capacities){
    const previous=latest.get(capacity.vehicle_id);
    if(!previous||String(capacity.updated_at)>String(previous.updated_at)
      ||capacity.updated_at===previous.updated_at&&String(capacity.id)>String(previous.id)){
      latest.set(capacity.vehicle_id,capacity);
    }
  }
  return [...latest.values()].map(capacity=>({vehicle_id:capacity.vehicle_id,
    mode:capacity.visibility==='OPEN'?(sharedVehicleIds.has(capacity.vehicle_id)?'BOTH':'PUBLIC'):'PRIVATE'}));
}

/** @param {Record<string,unknown[]>} tables @returns {Record<string,unknown[]>} */
export function excludeRetiredGuestFixtureTables(tables){
  // Public general-help is retired. Never let a later fixture export restore
  // its conversations or dependent records as active Support work.
  return Object.fromEntries(Object.entries(tables).filter(([table])=>!table.startsWith('guest_support_')));
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
