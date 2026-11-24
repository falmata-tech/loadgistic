import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {demoCurrentRouteForLocation,demoServiceAreaForLocation,demoRegularRoutesForBase,DEMO_PLACES} from '../src/lib/demo-capacity-geography.js';
import {capacityGeographicMatch} from '../src/lib/capacity-geographic-match.js';
import {distanceBetweenKm} from '../src/lib/domain.js';
import {serviceAreaGeometryMatch} from '../src/lib/route-matching.js';
import {diversifyFixturePlanning,AUTHORED_DEMO_PLAN_VEHICLES} from '../scripts/fixture-capacity-plans.mjs';
import {applyManagedFixtureMarketPolicy,MANAGED_COURIER_FIXTURE_VEHICLES} from '../scripts/fixture-market-policy.mjs';
import {DEMO_CORRIDOR_CATALOG,validateDemoCorridorCatalog} from '../src/lib/demo-corridor-catalog.mjs';
import {demoWorldPlanForStep} from '../src/lib/demo-world-planner.mjs';

const record={id:'same-vehicle',location_place_ref:'builtin:addis ababa',location_lat:9.03,location_lng:38.74};
const configs=['Courier car','Cargo van','Pickup truck','Mini Open Body Truck','Light Box Truck','Medium Box Truck','Heavy Rigid Stake Body Truck','Tractor + Container Trailer'];
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
 assert.ok(areas.every(area=>area&&area.boundary.length>=3&&area.boundary.length<=5));
 assert.equal(new Set(areas.map(area=>JSON.stringify(area.boundary))).size,2);
 for(const area of areas){
  assert.equal(serviceAreaGeometryMatch(area.center,area.boundary).inside,true);
  assert.ok(Number.isFinite(area.radiusKm)&&area.radiusKm>0);
  assert.ok(area.boundary.every(p=>!p.key.includes('edge')&&distanceBetweenKm(area.center,p)<=area.radiusKm));
 }
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

test('Empty and Partial trucks with Preferred areas support both endpoints and reject an endpoint outside the actual polygon',()=>{
 const area=demoServiceAreaForLocation(record,0),inside=place(area.boundary[0]);
 for(const status of ['EMPTY','PARTIAL'])for(const cargo_configuration of configs){
  const item={status,cargo_configuration,recurring_corridors:[{geometry:'RADIUS',area_boundary:area.boundary}]};
  assert.equal(capacityGeographicMatch(item,{originRadiusKm:1,destinationRadiusKm:1},inside,inside).matched,true);
  assert.equal(capacityGeographicMatch(item,{originRadiusKm:1,destinationRadiusKm:1},inside,place(DEMO_PLACES.mekelle)).matched,false);
 }
});

test('the saved public market has a usable mix of short and long routes and local and broad areas',()=>{
 const {tables,captured_at}=JSON.parse(readFileSync('resources/fixtures/managed-market.json','utf8'));
 const open=applyManagedFixtureMarketPolicy(tables.capacities).filter(row=>
  row.visibility==='OPEN'&&['EMPTY','PARTIAL'].includes(row.market_status||row.status));
 const routeDistance=row=>{
  const points=JSON.parse(row.current_route_points_json);
  return distanceBetweenKm(points[0],points.at(-1));
 };
 const areaDistance=row=>Math.max(...JSON.parse(row.capacity_area_boundary_json).map(point=>
  distanceBetweenKm({lat:row.capacity_area_center_lat,lng:row.capacity_area_center_lng},point)));
 for(const status of ['EMPTY','PARTIAL']){
  const signals=open.filter(row=>(row.market_status||row.status)===status);
  const routes=signals.filter(row=>row.availability_geometry==='ROUTE');
  const areas=signals.filter(row=>row.availability_geometry==='RADIUS');
  assert.ok(routes.filter(row=>routeDistance(row)>=100).length>=10,status+' long routes');
  assert.ok(routes.filter(row=>routeDistance(row)<100).length>=10,status+' short routes');
  assert.ok(areas.filter(row=>areaDistance(row)>=45).length>=4,status+' broad areas');
  assert.ok(areas.filter(row=>areaDistance(row)<45).length>=2,status+' local areas');
  const recent=signals.filter(row=>{
   const hours=(Date.parse(captured_at)-Date.parse(row.updated_at))/3_600_000;
   return hours>=0&&hours<12;
  });
  assert.ok(recent.some(row=>row.availability_geometry==='ROUTE'),status+' recent route');
  assert.ok(recent.some(row=>row.availability_geometry==='RADIUS'),status+' recent area');
 }
 const reports=tables.capacities.filter(row=>(row.market_status||row.status)==='PARTIAL');
 assert.ok(reports.every(row=>Number.isInteger(row.available_percent)&&row.available_percent>=1&&row.available_percent<=99));
 assert.ok(reports.some(row=>row.available_percent>=75));
 assert.ok(reports.some(row=>row.available_percent>=50&&row.available_percent<75));
 assert.ok(reports.some(row=>row.available_percent>=25&&row.available_percent<50));
 for(const row of reports){
  assert.equal(row.status,'PARTIAL');
  assert.equal(row.available_percent_reported_at,row.updated_at);
  assert.equal(row.available_percent_reported_by,row.updated_by);
  const assignment=tables.driver_vehicle_assignments.find(assignment=>assignment.active&&assignment.vehicle_id===row.vehicle_id);
  const vehicle=tables.vehicles.find(vehicle=>vehicle.id===row.vehicle_id);
  const owner=tables.provider_profiles.find(profile=>profile.id===vehicle.provider_profile_id);
  assert.equal(row.available_percent_reported_driver_id,assignment?.driver_user_id||owner?.user_id);
 }
 const configuration=new Map(tables.vehicles.map(row=>[row.id,row.cargo_configuration]));
 for(const vehicle of MANAGED_COURIER_FIXTURE_VEHICLES)configuration.set(vehicle.id,vehicle.configuration);
 const routes=open.filter(row=>row.availability_geometry==='ROUTE');
 for(const name of ['Courier car','Cargo van','Pickup truck','Mini Open Body Truck','Medium Box Truck','Heavy Rigid Stake Body Truck']){
  const byConfiguration=routes.filter(row=>configuration.get(row.vehicle_id)===name);
  assert.ok(byConfiguration.some(row=>routeDistance(row)>=100),name+' long route');
  assert.ok(byConfiguration.some(row=>routeDistance(row)<100),name+' short route');
 }
});

test('fixture planning preserves authority, location observations, privacy choices and authored scenario inputs',()=>{
 const original=JSON.parse(readFileSync('resources/fixtures/managed-market.json','utf8')).tables;
 const result=diversifyFixturePlanning(original);
 for(const [table,rows] of Object.entries(original))if(!['capacities','profile_routes'].includes(table))assert.equal(result[table],rows,table);
 for(let index=0;index<original.capacities.length;index++){
  const before=original.capacities[index],after=result.capacities[index];
  if(!AUTHORED_DEMO_PLAN_VEHICLES.has(before.vehicle_id)&&!DEMO_CORRIDOR_CATALOG.routes.some(route=>route.evidence.id===before.id)){
    assert.equal(after.availability_geometry,'ROUTE');
    assert.equal(after.capacity_area_boundary_json,'[]');
  }
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

test('diversity refresh preserves every exact corridor input and all twenty authored phases',()=>{
 const fixture=JSON.parse(readFileSync('resources/fixtures/managed-market.json','utf8'));
 const manifest=JSON.parse(readFileSync('resources/fixtures/demo-world-scenarios.json','utf8'));
 const refreshed={...fixture,tables:diversifyFixturePlanning(fixture.tables)};
 assert.equal(validateDemoCorridorCatalog(refreshed),true);
 const planningFields=['availability_geometry','movement_scope','origin','destination','corridor',
  'origin_place_ref','origin_lat','origin_lng','destination_place_ref','destination_lat','destination_lng',
  'current_route_origin','current_route_destination','current_route_points_json',
  'current_origin_place_ref','current_origin_lat','current_origin_lng',
  'current_destination_place_ref','current_destination_lat','current_destination_lng',
  'local_place_ref','local_place_label','local_center_lat','local_center_lng','local_radius_km','work_radius_km',
  'capacity_area_center_place_ref','capacity_area_center_label','capacity_area_center_lat','capacity_area_center_lng',
  'capacity_area_boundary_json'];
 let evidenceOutsideMutableVehicles=0;
 for(const route of DEMO_CORRIDOR_CATALOG.routes){
  const before=fixture.tables.capacities.find(row=>row.id===route.evidence.id);
  const after=refreshed.tables.capacities.find(row=>row.id===route.evidence.id);
  assert.ok(before&&after,route.evidence.id);
  for(const field of planningFields)assert.deepEqual(after[field],before[field],`${route.evidence.id}.${field}`);
  if(!AUTHORED_DEMO_PLAN_VEHICLES.has(before.vehicle_id))evidenceOutsideMutableVehicles++;
 }
 assert.ok(evidenceOutsideMutableVehicles>0,'alternate and other exact evidence must survive independently of mutable target vehicles');
 const activatedAt='2026-11-13T12:00:00.000Z';let phases=0;
 for(const target of manifest.targets.filter(row=>row.mutable))for(let stepIndex=0;stepIndex<4;stepIndex++){
  const previousCompletedAt=stepIndex===0?null:new Date(Date.parse(activatedAt)+(target.start_offset_seconds+(stepIndex-1)*120)*1000+1000).toISOString();
  const options={manifest,activatedAt,epoch:1,targetKey:target.key,cycleIndex:0,stepIndex,previousCompletedAt};
  assert.deepEqual(demoWorldPlanForStep({...options,fixture:refreshed}),demoWorldPlanForStep({...options,fixture}));
  phases++;
 }
 assert.equal(phases,20);
 for(const change of ['coordinate','order']){
  const changed=structuredClone(refreshed);
  const row=changed.tables.capacities.find(capacity=>capacity.id===DEMO_CORRIDOR_CATALOG.routes[0].evidence.id);
  const points=JSON.parse(row.current_route_points_json);
  if(change==='coordinate')points[0].lat+=0.001;else points.reverse();
  row.current_route_points_json=JSON.stringify(points);
  assert.throws(()=>validateDemoCorridorCatalog(changed),/DEMO_WORLD_ROUTE_REFUSED/,change);
 }
});
