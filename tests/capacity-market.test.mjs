import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {distanceBetweenKm} from '../src/lib/domain.js';
import {capacityRoutePointMatch,serviceAreaGeometryMatch} from '../src/lib/route-matching.js';
import {
  applyManagedFixtureMarketPolicy,applyManagedFixtureVehicleCatalog,ensureIndependentVehicleAssignments
} from '../scripts/fixture-market-policy.mjs';
import {assignFixtureDriverPortraits} from '../scripts/fixture-driver-portraits.mjs';

const root=process.cwd();
const fixture=JSON.parse(fs.readFileSync(path.join(root,'resources/fixtures/managed-market.json'),'utf8'));
const rawTables=fixture.tables;
const projectedUsers=assignFixtureDriverPortraits(rawTables.users);
const projectedAssignments=ensureIndependentVehicleAssignments(
  rawTables.vehicles,rawTables.provider_profiles,rawTables.driver_vehicle_assignments
);
const projectedVehicles=applyManagedFixtureVehicleCatalog(
  rawTables.vehicles,projectedAssignments,projectedUsers
);
const tables={...rawTables,users:projectedUsers,vehicles:projectedVehicles,
  driver_vehicle_assignments:projectedAssignments};
const originalVehiclesById=new Map(rawTables.vehicles.map(vehicle=>[vehicle.id,vehicle]));
const vehiclesById=new Map(tables.vehicles.map(vehicle=>[vehicle.id,vehicle]));
const smallVehicleTypes=new Set([
  'Cargo van','Pickup truck','Pickup stake body',
  'Mini Open Body Truck','Mini Stake Body Truck','Mini Box Truck'
]);

function json(value,fallback=[]){
  if(Array.isArray(value)||value&&typeof value==='object')return value;
  try{return JSON.parse(value||'');}catch{return fallback;}
}

test('managed fixture presents a busy, supply-only Ethiopian freight market',()=>{
  assert.equal(fixture.schema_version,1);
  assert.equal(tables.provider_profiles.length,21);
  assert.equal(tables.organizations.length,9);
  assert.equal(tables.company_pages.length,30);
  assert.equal(tables.vehicles.length,143);
  assert.equal(tables.capacities.length,143);
  assert.equal(tables.profile_routes.length,30);
  assert.equal(tables.verification_requests.length,335);
  for(const retired of ['shipments','partner_relationships','shipment_interests','business_reviews']){
    assert.equal(Object.hasOwn(tables,retired),false);
  }
  assert.equal(tables.company_pages.every(page=>page.published===1&&page.profile_image_preset),true);
  assert.deepEqual(new Set(tables.capacities.map(capacity=>capacity.market_status)),new Set(['EMPTY','PARTIAL']));
  assert.equal(tables.capacities.every(capacity=>['OPEN','SAVED_PARTNERS'].includes(capacity.visibility)),true);
});

test('mini trucks lead a compact-delivery mix that includes courier cars but no motorcycles',()=>{
  const small=tables.vehicles.filter(vehicle=>smallVehicleTypes.has(vehicle.cargo_configuration));
  const courier=tables.vehicles.filter(vehicle=>vehicle.cargo_configuration==='Courier car');
  assert.equal(small.length,91);
  assert.equal(courier.length,12);
  assert.ok((small.length+courier.length)/tables.vehicles.length>=0.7);
  for(const type of smallVehicleTypes){
    assert.ok(small.some(vehicle=>vehicle.cargo_configuration===type),type);
  }
  const counts=Object.fromEntries([...new Set(tables.vehicles.map(vehicle=>vehicle.cargo_configuration))]
    .map(configuration=>[configuration,tables.vehicles.filter(vehicle=>vehicle.cargo_configuration===configuration).length]));
  assert.equal((counts['Light Stake Body Truck']||0)+(counts['Light Box Truck']||0),15);
  assert.equal((counts['Medium Stake Body Truck']||0)+(counts['Medium Box Truck']||0),9);
  assert.equal(counts['Heavy Rigid Stake Body Truck'],5);
  assert.equal(counts['Heavy Rigid Stake Body Truck + Trailer'],5);
  assert.equal(counts['Tractor + Container Trailer'],2);
  assert.equal(counts['Tractor + Dry Van Trailer'],2);
  assert.equal(counts['Tractor + Heavy Equipment Trailer'],2);
  assert.equal(counts['Courier motorcycle'],undefined);
  assert.equal(counts['Courier car'],12);
  assert.equal(JSON.stringify(tables).includes('Courier motorcycle'),false);
  assert.equal(tables.vehicles.filter(vehicle=>vehicle.trailer_interchangeable).every(vehicle=>
    /^(FAW J6P|Shacman X3000|Sinotruk HOWO)$/.test(`${vehicle.make} ${vehicle.model}`)
  ),true);
});

test('Partial capacity is route-only while Empty capacity may use a route or Service area',()=>{
  const partial=tables.capacities.filter(capacity=>capacity.market_status==='PARTIAL');
  const empty=tables.capacities.filter(capacity=>capacity.market_status==='EMPTY');
  assert.ok(partial.length>0&&empty.length>0);
  assert.equal(partial.every(capacity=>capacity.availability_geometry==='ROUTE'),true);
  assert.ok(empty.some(capacity=>capacity.availability_geometry==='ROUTE'));
  assert.ok(empty.some(capacity=>capacity.availability_geometry==='RADIUS'));

  for(const capacity of tables.capacities){
    if(capacity.availability_geometry==='ROUTE'){
      const points=json(capacity.current_route_points_json);
      assert.ok(points.length>=2&&points.length<=5,capacity.id);
      assert.equal(new Set(points.map(point=>point.place_ref)).size,points.length,capacity.id);
      assert.equal(points.every(point=>point.place_ref&&point.label&&Number.isFinite(point.lat)&&Number.isFinite(point.lng)),true,capacity.id);
    }else{
      assert.equal(capacity.market_status,'EMPTY',capacity.id);
      const boundary=json(capacity.capacity_area_boundary_json);
      assert.ok(boundary.length>=3&&boundary.length<=5,capacity.id);
      assert.equal(new Set(boundary.map(point=>point.place_ref)).size,boundary.length,capacity.id);
      assert.equal(serviceAreaGeometryMatch(
        {lat:capacity.capacity_area_center_lat,lng:capacity.capacity_area_center_lng},boundary,{searchRadiusKm:10}
      ).inside,true,capacity.id);
    }
  }
});

test('local-vehicle signals remain local to their truck and connected market',()=>{
  const managedCapacities=applyManagedFixtureMarketPolicy(tables.capacities,tables.vehicles);
  for(const capacity of managedCapacities){
    const vehicle=vehiclesById.get(capacity.vehicle_id);
    const originalConfiguration=originalVehiclesById.get(vehicle?.id)?.cargo_configuration;
    if(!smallVehicleTypes.has(vehicle?.cargo_configuration)
      &&!(vehicle?.cargo_configuration==='Courier car'&&smallVehicleTypes.has(originalConfiguration)))continue;
    assert.ok(capacity.location_precision_km<=5,`${capacity.id} has an oversized local privacy area`);
    const points=capacity.availability_geometry==='ROUTE'
      ?json(capacity.current_route_points_json)
      :[{lat:capacity.capacity_area_center_lat,lng:capacity.capacity_area_center_lng}];
    const distanceToSignal=distanceBetweenKm(
      {lat:capacity.location_lat,lng:capacity.location_lng},points[0]
    );
    assert.ok(distanceToSignal<=35,`${capacity.id} starts ${distanceToSignal.toFixed(1)} km from its truck`);
    if(capacity.availability_geometry==='ROUTE'){
      const routeDistance=points.slice(1).reduce((total,point,index)=>
        total+distanceBetweenKm(points[index],point),0);
      assert.ok(routeDistance<=30,`${capacity.id} spans ${routeDistance.toFixed(1)} km`);
    }
  }
});

test('demo truck locations are distributed across real markets without diagonal generation',()=>{
  const locationsByPlace=new Map();
  for(const capacity of tables.capacities){
    const currentPoints=json(capacity.current_route_points_json);
    const anchor=capacity.availability_geometry==='ROUTE'
      ?currentPoints[0]
      :{lat:capacity.capacity_area_center_lat,lng:capacity.capacity_area_center_lng};
    const distanceToNamedPlace=distanceBetweenKm(
      {lat:capacity.location_lat,lng:capacity.location_lng},anchor
    );
    assert.ok(distanceToNamedPlace<=3.1,`${capacity.id} is ${distanceToNamedPlace.toFixed(1)} km from its named place`);
    const rows=locationsByPlace.get(capacity.location_place_ref)||[];
    rows.push(capacity);
    locationsByPlace.set(capacity.location_place_ref,rows);
  }

  assert.ok(locationsByPlace.size>=40,`only ${locationsByPlace.size} distinct truck locations`);
  assert.ok(Math.max(...[...locationsByPlace.values()].map(rows=>rows.length))<=6);
  for(const [placeRef,rows] of locationsByPlace){
    if(rows.length<3)continue;
    const diagonalConstants=new Set(rows.map(row=>(row.location_lat+row.location_lng).toFixed(5)));
    assert.ok(diagonalConstants.size>1,`${placeRef} uses one repeated diagonal offset`);
  }

  for(const organization of tables.organizations.filter(item=>item.id.startsWith('org-public-fleet-'))){
    const distinct=new Set(tables.capacities
      .filter(capacity=>capacity.provider_organization_id===organization.id)
      .map(capacity=>capacity.location_place_ref));
    assert.ok(distinct.size>=4,`${organization.name} repeats only ${distinct.size} nearby locations`);
  }

  const publicSignals=applyManagedFixtureMarketPolicy(tables.capacities,tables.vehicles)
    .filter(capacity=>capacity.visibility==='OPEN');
  const publicByPlace=new Map();
  for(const capacity of publicSignals)publicByPlace.set(capacity.location_place_ref,(publicByPlace.get(capacity.location_place_ref)||0)+1);
  assert.ok(publicByPlace.size>=20,`public demo capacity reaches only ${publicByPlace.size} locations`);
  assert.ok(Math.max(...publicByPlace.values())<=6);
});

test('every truck location and current signal stays on or beside its regular service',()=>{
  const regularByOwner=new Map(tables.profile_routes
    .map(route=>[route.organization_id||route.provider_profile_id,route]));
  for(const capacity of tables.capacities){
    const regular=regularByOwner.get(capacity.provider_organization_id||capacity.provider_profile_id);
    assert.ok(regular,capacity.id);
    const distanceToRegular=point=>{
      if(regular.geometry==='ROUTE')return capacityRoutePointMatch(point,json(regular.route_points_json),{radiusKm:10}).distance_km;
      const match=serviceAreaGeometryMatch(point,json(regular.area_boundary_json),{searchRadiusKm:10});
      return match.inside?0:match.distance_km;
    };
    const locationDistance=distanceToRegular({lat:capacity.location_lat,lng:capacity.location_lng});
    assert.ok(locationDistance!==null&&locationDistance<=3.1,`${capacity.id} location is ${locationDistance} km from regular service`);
    const currentPoints=capacity.availability_geometry==='ROUTE'
      ?json(capacity.current_route_points_json)
      :[{lat:capacity.capacity_area_center_lat,lng:capacity.capacity_area_center_lng}];
    for(const point of currentPoints){
      const currentDistance=distanceToRegular(point);
      assert.ok(currentDistance!==null&&currentDistance<=3.1,`${capacity.id} current signal is ${currentDistance} km from regular service`);
    }
  }
});

test('primary Driver demo keeps location, current capacity, and regular work in one local market',()=>{
  const capacity=tables.capacities.find(item=>item.vehicle_id==='veh-driver-1');
  const regular=tables.profile_routes.find(item=>item.provider_profile_id==='provider-driver');
  assert.ok(capacity&&regular);
  const location={lat:capacity.location_lat,lng:capacity.location_lng};
  const currentPoints=json(capacity.current_route_points_json);
  assert.equal(capacity.location_place_ref,'builtin:sebeta');
  assert.equal(capacity.location_precision_km,3);
  assert.ok(distanceBetweenKm(location,currentPoints[0])<=5);
  assert.ok(currentPoints.slice(1).reduce((total,point,index)=>
    total+distanceBetweenKm(currentPoints[index],point),0)<=10);
  assert.equal(currentPoints.at(-1).label,'Alem Gena, Ethiopia');
  assert.equal(regular.geometry,'RADIUS');
  assert.equal(regular.area_center_place_ref,'builtin:sebeta');
  assert.ok(distanceBetweenKm(location,{lat:regular.area_center_lat,lng:regular.area_center_lng})<=5);
  assert.equal(serviceAreaGeometryMatch(location,json(regular.area_boundary_json),{searchRadiusKm:0}).inside,true);
});

test('each transporter fixture has one regular route or Service area record',()=>{
  assert.equal(tables.profile_routes.length,30);
  const ownerKeys=tables.profile_routes.map(route=>route.organization_id||route.provider_profile_id);
  assert.equal(new Set(ownerKeys).size,ownerKeys.length);
  for(const route of tables.profile_routes){
    assert.ok(['ROUTE','RADIUS'].includes(route.geometry));
    if(route.geometry==='ROUTE'){
      const points=json(route.route_points_json);
      assert.ok(points.length>=2&&points.length<=5,route.id);
    }else{
      const boundary=json(route.area_boundary_json);
      assert.ok(boundary.length>=3&&boundary.length<=5,route.id);
      assert.equal(serviceAreaGeometryMatch(
        {lat:route.area_center_lat,lng:route.area_center_lng},boundary,{searchRadiusKm:5}
      ).inside,true,route.id);
    }
  }
});

test('driver and truck evidence is attached to every published fixture vehicle',()=>{
  const assignedVehicleIds=new Set(tables.driver_vehicle_assignments
    .filter(assignment=>assignment.active===1)
    .map(assignment=>assignment.vehicle_id));
  assert.equal(assignedVehicleIds.size,143);
  assert.equal(tables.drivers.length,122);
  assert.equal(tables.driver_permissions.length,122);
  assert.equal(tables.verification_requests.some(request=>request.subject_type==='DRIVER'),true);
  assert.equal(tables.verification_requests.some(request=>request.related_vehicle_id),true);
  assert.equal(tables.verification_requests.some(request=>request.status==='APPROVED'),true);
});
