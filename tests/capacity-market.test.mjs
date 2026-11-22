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
import {getPlaceCoordinate} from '../src/lib/ethiopia-places.js';

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
const vehiclesById=new Map(tables.vehicles.map(vehicle=>[vehicle.id,vehicle]));
const discoveryByCapacity=new Map(JSON.parse(fs.readFileSync(path.join(root,'resources/fixtures/managed-market-discovery.json'),'utf8')).capacity_choices.map(row=>[row.capacity_id,row]));
const settlementPoints=new Map(JSON.parse(fs.readFileSync(path.join(root,'resources/geo/ethiopia-settlements.json'),'utf8')).elements
  .map(point=>[`osm:${point.type}/${point.id}`,{lat:point.lat??point.center?.lat,lng:point.lon??point.center?.lon}]));
const canonicalPoint=reference=>settlementPoints.get(reference)||getPlaceCoordinate(String(reference).replace(/^builtin:/,''));
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
  assert.equal(tables.company_pages.every(page=>page.published===1),true);
  assert.ok(tables.company_pages.some(page=>page.profile_image_preset));
  assert.ok(tables.company_pages.some(page=>!page.profile_image_preset),'blank demo portraits exercise the intended placeholder');
  assert.deepEqual(new Set(tables.capacities.map(capacity=>capacity.market_status)),new Set(['EMPTY','PARTIAL']));
  assert.equal(tables.capacities.every(capacity=>['OPEN','SAVED_PARTNERS'].includes(capacity.visibility)),true);
});

test('compact freight leads a mixed market with restored couriers and ten heavy pairs',()=>{
  const small=tables.vehicles.filter(vehicle=>smallVehicleTypes.has(vehicle.cargo_configuration));
  const courier=tables.vehicles.filter(vehicle=>vehicle.cargo_configuration==='Courier car');
  assert.equal(small.length,94);
  assert.equal(courier.length,12);
  assert.ok((small.length+courier.length)/tables.vehicles.length>=2/3);
  for(const type of smallVehicleTypes){
    assert.ok(small.some(vehicle=>vehicle.cargo_configuration===type),type);
  }
  const counts=Object.fromEntries([...new Set(tables.vehicles.map(vehicle=>vehicle.cargo_configuration))]
    .map(configuration=>[configuration,tables.vehicles.filter(vehicle=>vehicle.cargo_configuration===configuration).length]));
  assert.equal((counts['Light Stake Body Truck']||0)+(counts['Light Box Truck']||0),18);
  assert.equal((counts['Medium Stake Body Truck']||0)+(counts['Medium Box Truck']||0),9);
  assert.equal(counts['Heavy Rigid Stake Body Truck'],2);
  assert.equal(counts['Heavy Rigid Stake Body Truck + Trailer'],2);
  assert.equal(counts['Tractor + Container Trailer'],2);
  assert.equal(counts['Tractor + Dry Van Trailer'],2);
  assert.equal(counts['Tractor + Heavy Equipment Trailer'],2);
  assert.equal(counts['Courier motorcycle'],undefined);
  assert.equal(counts['Courier car'],12);
  assert.equal(tables.vehicles.filter(vehicle=>vehicle.trailer_interchangeable).every(vehicle=>
    /^(FAW J6P|Shacman X3000|Sinotruk HOWO)$/.test(`${vehicle.make} ${vehicle.model}`)
  ),true);
});

test('managed fixture routes and service areas retain valid place geometry for each status',()=>{
  const partial=tables.capacities.filter(capacity=>capacity.market_status==='PARTIAL');
  const empty=tables.capacities.filter(capacity=>capacity.market_status==='EMPTY');
  assert.ok(partial.length>0&&empty.length>0);
  assert.ok(partial.some(capacity=>capacity.availability_geometry==='ROUTE'));
  assert.ok(empty.some(capacity=>capacity.availability_geometry==='ROUTE'));
  assert.ok(empty.some(capacity=>capacity.availability_geometry==='RADIUS'));

  for(const capacity of tables.capacities){
    if(capacity.availability_geometry==='ROUTE'){
      const points=json(capacity.current_route_points_json);
      assert.ok(points.length>=2&&points.length<=5,capacity.id);
      assert.equal(new Set(points.map(point=>point.place_ref)).size,points.length,capacity.id);
      assert.equal(points.every(point=>point.place_ref&&point.label&&Number.isFinite(point.lat)&&Number.isFinite(point.lng)),true,capacity.id);
    }else{
      assert.ok(['EMPTY','PARTIAL'].includes(capacity.market_status),capacity.id);
      const boundary=json(capacity.capacity_area_boundary_json);
      assert.ok(boundary.length>=3&&boundary.length<=5,capacity.id);
      assert.equal(new Set(boundary.map(point=>point.place_ref)).size,boundary.length,capacity.id);
      assert.equal(serviceAreaGeometryMatch(
        {lat:capacity.capacity_area_center_lat,lng:capacity.capacity_area_center_lng},boundary,{searchRadiusKm:10}
      ).inside,true,capacity.id);
    }
  }
});

test('smaller vehicle signals include local and regional plans with saved availability and privacy',()=>{
  const managedCapacities=applyManagedFixtureMarketPolicy(tables.capacities,tables.vehicles);
  const spans=[];let areas=0;
  for(const capacity of managedCapacities){
    const saved=tables.capacities.find(row=>row.id===capacity.id);
    for(const field of ['market_status','available_percent','accepts_full_load','accepts_partial_load'])assert.deepEqual(capacity[field],saved[field]);
    assert.equal(capacity.location_precision_km,discoveryByCapacity.get(capacity.id)?.location_precision_km??saved.location_precision_km,capacity.id);
    const vehicle=vehiclesById.get(capacity.vehicle_id);
    if(!smallVehicleTypes.has(vehicle?.cargo_configuration)
      &&vehicle?.cargo_configuration!=='Courier car')continue;
    if(capacity.availability_geometry==='ROUTE'){
      const points=json(capacity.current_route_points_json);
      spans.push(points.slice(1).reduce((total,point,index)=>total+distanceBetweenKm(points[index],point),0));
    }else areas++;
  }
  assert.ok(spans.some(distance=>distance<40));assert.ok(spans.some(distance=>distance>100));assert.ok(areas>0);
});

test('demo truck locations are distributed across real markets without diagonal generation',()=>{
  const locationsByPlace=new Map();
  for(const capacity of tables.capacities){
    const anchor=canonicalPoint(capacity.location_place_ref);
    assert.ok(anchor,`${capacity.id} has a real named observation place`);
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

test('current and Preferred plans use canonical settlement geometry',()=>{
  const assertCanonical=(point,id)=>{
    const saved=canonicalPoint(point.place_ref);assert.ok(saved,`${id} has a known place`);
    assert.ok(distanceBetweenKm(point,saved)<=0.01,`${id} retains the place coordinate`);
  };
  for(const capacity of tables.capacities){
    const points=capacity.availability_geometry==='ROUTE'?json(capacity.current_route_points_json):json(capacity.capacity_area_boundary_json);
    for(const point of points)assertCanonical(point,capacity.id);
  }
  for(const regular of tables.profile_routes){
    const points=regular.geometry==='ROUTE'?json(regular.route_points_json):json(regular.area_boundary_json);
    for(const point of points)assertCanonical(point,regular.id);
  }
});

test('primary Driver demo has a coherent Service area attached to the current vehicle',()=>{
  const capacity=tables.capacities.find(item=>item.vehicle_id==='veh-driver-1');
  const regular=tables.profile_routes.find(item=>item.provider_profile_id==='provider-driver');
  assert.ok(capacity&&regular);
  assert.equal(regular.assigned_vehicle_id,'veh-driver-1');assert.equal(regular.assigned_driver_user_id,'user-driver');
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

test('demo Corridor routes and Service areas each belong to one current vehicle/Driver pair',()=>{
  assert.equal(tables.profile_routes.length,30);
  const ownerKeys=tables.profile_routes.map(route=>route.organization_id||route.provider_profile_id);
  assert.equal(new Set(ownerKeys).size,ownerKeys.length);
  const vehicles=new Map(tables.vehicles.map(vehicle=>[vehicle.id,vehicle]));
  const currentDrivers=new Map(tables.driver_vehicle_assignments.filter(assignment=>assignment.active===1).map(assignment=>[assignment.vehicle_id,assignment.driver_user_id]));
  for(const route of tables.profile_routes){
    const vehicle=vehicles.get(route.assigned_vehicle_id);
    assert.ok(vehicle,route.id);
    assert.equal(route.assigned_driver_user_id,currentDrivers.get(vehicle.id),route.id);
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
