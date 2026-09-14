import test from 'node:test';
import assert from 'node:assert/strict';
import {capacityGeographicMatch as match} from '../src/lib/capacity-geographic-match.js';

const place=(lat,lng)=>({center_lat:lat,center_lng:lng,place_label:'Selected place'});
const a=place(9,38),b=place(9.1,38.1),far=place(14,43);
const route=[{lat:9,lng:38},{lat:9.1,lng:38.1}];
const area=[{lat:8.95,lng:37.95},{lat:9.15,lng:37.95},{lat:9.15,lng:38.15},{lat:8.95,lng:38.15}];
const truck={status:'PARTIAL',availability_geometry:'ROUTE',current_route_points:route,recurring_corridors:[]};
const filters={originRadiusKm:5,destinationRadiusKm:5,currentAreaRadiusKm:5,nearLat:'',nearLng:''};

test('private query cannot degrade a failed pair to one matching endpoint or blank proximity',()=>{
  for(const endpoints of [[a,far],[far,b],[far,far]])assert.deepEqual(match(truck,filters,...endpoints),{matched:false,label:null});
  assert.equal(match(truck,filters,a,b).matched,true);
  assert.equal(match(truck,filters,a).matched,true);
  assert.equal(match(truck,filters,null,b).matched,true);
  assert.deepEqual(match(truck,filters),{matched:true,label:null});
});

test('shipment endpoints and independent area filter are conjunctive',()=>{
  const empty={...truck,status:'EMPTY',recurring_corridors:[{geometry:'RADIUS',area_boundary:area}]};
  assert.equal(match(empty,filters,a,b,a).matched,true);
  assert.equal(match(empty,filters,a,b,far).matched,false);
  assert.equal(match(empty,filters,far,b,a).matched,false);
  assert.equal(match(truck,filters,a,b,a).matched,false);
  assert.equal(match(empty,{...filters,geometry:'ROUTE'},a,b,a).matched,false);
});

test('direction, every route segment, and Empty-only area evidence are retained',()=>{
  assert.equal(match(truck,filters,b,a).matched,false);
  assert.equal(match(truck,{...filters,directionMode:'EITHER'},b,a).matched,true);
  const regular={...truck,current_route_points:[],recurring_corridors:[{geometry:'ROUTE',route_points:route}]};
  assert.equal(match(regular,filters,b,a).matched,true);
  const multi={...truck,current_route_points:[{lat:8,lng:37},...route,{lat:10,lng:39}]};
  assert.equal(match(multi,filters,a,b).matched,true);
  const areaTruck={status:'EMPTY',availability_geometry:'RADIUS',capacity_area_boundary:area};
  assert.equal(match(areaTruck,filters,a,b).matched,true);
  assert.equal(match({...areaTruck,status:'PARTIAL'},filters,a,b).matched,false);
});
