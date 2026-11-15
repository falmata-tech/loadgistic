import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {demoCurrentRouteForLocation,demoServiceAreaForLocation,demoRegularRoutesForBase,DEMO_PLACES} from '../src/lib/demo-capacity-geography.js';
import {capacityGeographicMatch} from '../src/lib/capacity-geographic-match.js';
import {distanceBetweenKm} from '../src/lib/domain.js';
import {diversifyFixturePlanning,AUTHORED_DEMO_PLAN_VEHICLES} from '../scripts/fixture-capacity-plans.mjs';
import {applyManagedFixtureMarketPolicy} from '../scripts/fixture-market-policy.mjs';

const record={id:'same-vehicle',location_place_ref:'builtin:addis ababa',location_lat:9.03,location_lng:38.74};
const configs=['Courier car','Courier motorcycle','Cargo van','Pickup truck','Mini Open Body Truck','Light Box Truck','Medium Box Truck','Heavy Rigid Stake Body Truck','Tractor + Container Trailer'];
const span=points=>points.slice(1).reduce((sum,p,index)=>sum+distanceBetweenKm(points[index],p),0);
const place=p=>({center_lat:p.lat,center_lng:p.lng,place_label:p.label});

test('every configuration has the same city and regional planning choices',()=>{
 const baseline=Array.from({length:12},(_,i)=>demoCurrentRouteForLocation(record,i));
 assert.ok(baseline.some(route=>span(route.points)<40));assert.ok(baseline.some(route=>span(route.points)>100));
 for(const cargo_configuration of configs){
  const input={...record,cargo_configuration};
  assert.deepEqual(Array.from({length:12},(_,i)=>demoCurrentRouteForLocation(input,i)),baseline);
  assert.deepEqual(demoRegularRoutesForBase(input,12),demoRegularRoutesForBase(record,12));
  for(const i of [0,1])assert.deepEqual(demoServiceAreaForLocation(input,i),demoServiceAreaForLocation(record,i));
 }
 const areas=[0,1].map(i=>demoServiceAreaForLocation(record,i));
 assert.ok(areas.some(area=>area.radiusKm===20));assert.ok(areas.some(area=>area.radiusKm>20));
 assert.ok(areas.every(area=>area.boundary.length>=3&&area.boundary.every(p=>!p.key.includes('edge'))));
});

test('small long-distance routes match ordered endpoints and refuse reversed or unrelated AND criteria',()=>{
 const chosen=Array.from({length:12},(_,i)=>demoCurrentRouteForLocation(record,i)).find(route=>span(route.points)>100);
 const origin=place(chosen.points[0]),destination=place(chosen.points.at(-1));
 for(const cargo_configuration of configs){
  const item={status:'PARTIAL',cargo_configuration,availability_geometry:'ROUTE',current_route_points:chosen.points};
  const filters={originRadiusKm:2,destinationRadiusKm:2,currentAreaRadiusKm:2,directionMode:'DIRECT'};
  assert.equal(capacityGeographicMatch(item,filters,origin,destination).matched,true);
  assert.equal(capacityGeographicMatch(item,filters,destination,origin).matched,false);
  assert.equal(capacityGeographicMatch(item,filters,origin,destination,place(DEMO_PLACES.moyale)).matched,false);
 }
});

test('Empty and Partial areas support both endpoints and reject an endpoint outside the actual polygon',()=>{
 const area=demoServiceAreaForLocation(record,0),inside=place(area.boundary[0]);
 for(const status of ['EMPTY','PARTIAL'])for(const cargo_configuration of configs){
  const item={status,cargo_configuration,availability_geometry:'RADIUS',capacity_area_boundary:area.boundary};
  assert.equal(capacityGeographicMatch(item,{originRadiusKm:1,destinationRadiusKm:1},inside,inside).matched,true);
  assert.equal(capacityGeographicMatch(item,{originRadiusKm:1,destinationRadiusKm:1},inside,place(DEMO_PLACES.mekelle)).matched,false);
 }
});

test('fixture planning preserves authority, location observations, privacy choices and authored scenario inputs',()=>{
 const original=JSON.parse(readFileSync('resources/fixtures/managed-market.json','utf8')).tables;
 const result=diversifyFixturePlanning(original);
 for(const [table,rows] of Object.entries(original))if(!['capacities','profile_routes'].includes(table))assert.equal(result[table],rows,table);
 for(let index=0;index<original.capacities.length;index++){
  const before=original.capacities[index],after=result.capacities[index];
  if(AUTHORED_DEMO_PLAN_VEHICLES.has(before.vehicle_id))assert.deepEqual(after,before);
  for(const field of ['id','vehicle_id','provider_organization_id','provider_profile_id','status','market_status','available_percent',
   'accepts_full_load','accepts_partial_load','visibility','location_lat','location_lng','location_source','location_updated_at','location_precision_km','updated_at','updated_by','photo_path'])
   assert.deepEqual(after[field],before[field],field);
 }
 const managed=applyManagedFixtureMarketPolicy(result.capacities,original.vehicles);
 const discovery=JSON.parse(readFileSync('resources/fixtures/managed-market-discovery.json','utf8'));
 for(const choice of discovery.capacity_choices){
  const row=managed.find(c=>c.id===choice.capacity_id);
  assert.equal(row.visibility,choice.visibility);assert.equal(row.location_precision_km,choice.location_precision_km);
 }
});
