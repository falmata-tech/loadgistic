import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {distanceBetweenKm} from '../src/lib/domain.js';
import {serviceAreaGeometryMatch} from '../src/lib/route-matching.js';

const root=process.cwd();
const fixture=JSON.parse(fs.readFileSync(path.join(root,'resources/fixtures/managed-market.json'),'utf8'));
const tables=fixture.tables;
const vehiclesById=new Map(tables.vehicles.map(vehicle=>[vehicle.id,vehicle]));
const smallVehicleTypes=new Set([
  'Courier motorcycle','Courier car','Cargo van','Pickup truck','Pickup stake body',
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

test('small local vehicles make up seventy percent of fixture capacity',()=>{
  const small=tables.vehicles.filter(vehicle=>smallVehicleTypes.has(vehicle.cargo_configuration));
  assert.equal(small.length,100);
  assert.ok(small.length/tables.vehicles.length>=0.69);
  for(const type of smallVehicleTypes){
    assert.ok(small.some(vehicle=>vehicle.cargo_configuration===type),type);
  }
  assert.ok(fs.existsSync(path.join(root,'public/vehicle-configurations/courier-motorcycle.jpg')));
  assert.ok(fs.existsSync(path.join(root,'public/vehicle-configurations/courier-car.jpg')));
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
  for(const capacity of tables.capacities){
    const vehicle=vehiclesById.get(capacity.vehicle_id);
    if(!smallVehicleTypes.has(vehicle?.cargo_configuration))continue;
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
  assert.equal(assignedVehicleIds.size,122);
  assert.equal(tables.drivers.length,122);
  assert.equal(tables.driver_permissions.length,122);
  assert.equal(tables.verification_requests.some(request=>request.subject_type==='DRIVER'),true);
  assert.equal(tables.verification_requests.some(request=>request.related_vehicle_id),true);
  assert.equal(tables.verification_requests.some(request=>request.status==='APPROVED'),true);
});
