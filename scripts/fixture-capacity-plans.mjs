import {demoCurrentRouteForLocation,demoServiceAreaForLocation,demoPlanningSeed} from '../src/lib/demo-capacity-geography.js';
import {demoPilotBindingPlan} from './demo-pilot-binding-policy.mjs';
import {HANDOVER_FIXTURE_VEHICLE_IDS} from './fixture-market-policy.mjs';

// Exact existing workflow/scenario inputs, never a rule about vehicle capability.
export const AUTHORED_DEMO_PLAN_VEHICLES=new Set([
 ...demoPilotBindingPlan().map(target=>target.vehicleKey),...HANDOVER_FIXTURE_VEHICLE_IDS,'veh-trans-2'
]);

const pointFields=(prefix,p)=>({[`${prefix}_place_ref`]:p?.place_ref??null,
 [`${prefix}_lat`]:p?.lat??null,[`${prefix}_lng`]:p?.lng??null});
const routePoints=(points,resolve)=>{
 const chosen=points.length<=5?points:Array.from({length:5},(_,i)=>points[Math.round(i*(points.length-1)/4)]);
 return chosen.map(resolve);
};
const emptyArea={capacity_area_center_place_ref:null,capacity_area_center_label:null,
 capacity_area_center_lat:null,capacity_area_center_lng:null,capacity_area_boundary_json:'[]'};

function capacityPlan(capacity,resolve){
 const record={...capacity,id:capacity.vehicle_id};
 if(demoPlanningSeed(record)%5===0){
  const area=demoServiceAreaForLocation(record),center=resolve(area.center),boundary=area.boundary.map(resolve);
  return {...capacity,availability_geometry:'RADIUS',movement_scope:area.movementScope,
   origin:center.label,destination:center.label,corridor:`${center.label} service area`,
   ...pointFields('origin',center),...pointFields('destination',center),
   current_route_origin:null,current_route_destination:null,current_route_points_json:'[]',
   ...pointFields('current_origin',null),...pointFields('current_destination',null),
   local_place_ref:center.place_ref,local_place_label:center.label,local_center_lat:center.lat,local_center_lng:center.lng,
   local_radius_km:Math.min(50,area.radiusKm),work_radius_km:area.radiusKm,
   capacity_area_center_place_ref:center.place_ref,capacity_area_center_label:center.label,
   capacity_area_center_lat:center.lat,capacity_area_center_lng:center.lng,capacity_area_boundary_json:JSON.stringify(boundary)};
 }
 const chosen=demoCurrentRouteForLocation(record),points=routePoints(chosen.points,resolve),first=points[0],last=points.at(-1);
 return {...capacity,availability_geometry:'ROUTE',movement_scope:chosen.movementScope,
  origin:first.label,destination:last.label,corridor:`${first.label} → ${last.label}`,
  ...pointFields('origin',first),...pointFields('destination',last),
  current_route_origin:first.label,current_route_destination:last.label,current_route_points_json:JSON.stringify(points),
  ...pointFields('current_origin',first),...pointFields('current_destination',last),
  local_place_ref:null,local_place_label:null,local_center_lat:null,local_center_lng:null,local_radius_km:null,work_radius_km:null,...emptyArea};
}

function preferredPlan(route,vehicle,resolve){
 const record={id:`preferred:${route.id}`,location_lat:vehicle?.location_lat,
  location_lng:vehicle?.location_lng,location_place_ref:vehicle?.location_place_ref};
 if(demoPlanningSeed(record)%3===0){
  const area=demoServiceAreaForLocation(record),center=resolve(area.center);
  return {...route,geometry:'RADIUS',origin:center.label,destination:center.label,
   ...pointFields('origin',center),...pointFields('destination',center),route_points_json:'[]',
   area_center_place_ref:center.place_ref,area_center_label:center.label,area_center_lat:center.lat,area_center_lng:center.lng,
   area_boundary_json:JSON.stringify(area.boundary.map(resolve))};
 }
 const chosen=demoCurrentRouteForLocation(record),points=routePoints(chosen.points,resolve),first=points[0],last=points.at(-1);
 return {...route,geometry:'ROUTE',origin:first.label,destination:last.label,
  ...pointFields('origin',first),...pointFields('destination',last),route_points_json:JSON.stringify(points),
  area_center_place_ref:null,area_center_label:null,area_center_lat:null,area_center_lng:null,area_boundary_json:'[]'};
}

/** Author planning facts only. No location observation, privacy or authority changes. */
export function diversifyFixturePlanning(tables,{resolvePlace=point=>({...point})}={}){
 const current=new Map(tables.capacities.map(capacity=>[capacity.vehicle_id,capacity]));
 return {...tables,
  capacities:tables.capacities.map(capacity=>AUTHORED_DEMO_PLAN_VEHICLES.has(capacity.vehicle_id)
   ?capacity:capacityPlan(capacity,resolvePlace)),
  profile_routes:tables.profile_routes.map(route=>!route.assigned_vehicle_id||AUTHORED_DEMO_PLAN_VEHICLES.has(route.assigned_vehicle_id)
   ?route:preferredPlan(route,current.get(route.assigned_vehicle_id),resolvePlace))};
}
