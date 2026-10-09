import {test} from 'node:test';
import assert from 'node:assert/strict';
import {capacityRouteAlignmentMatch as route,capacityRoutePointMatch as point,serviceAreaGeometryMatch as area} from '../src/lib/route-matching.js';
import {capacityGeographicMatch} from '../src/lib/capacity-geographic-match.js';
const options={originRadiusKm:5,destinationRadiusKm:5};
const a={lat:9,lng:38},b={lat:10,lng:39},c={lat:10,lng:38};
const query=(start,end)=>({origin_lat:start.lat,origin_lng:start.lng,destination_lat:end.lat,destination_lng:end.lng});
test('all occurrences on a crossing or returning route can satisfy ordered pickup and delivery',()=>{
 assert.equal(route(query(c,a),[a,b,c,a],options).matched,true);
 assert.equal(route(query(b,a),[a,b],options).matched,false);
 assert.equal(route(query(b,a),[a,b],{...options,directionMode:'EITHER'}).matched,true);
 const crossing=[{lat:9,lng:38},{lat:10,lng:39},{lat:9,lng:39},{lat:10,lng:38}];
 assert.equal(route(query({lat:9,lng:39},{lat:9.5,lng:38.5}),crossing,options).matched,true);
});
test('malformed vertices invalidate a whole route and are never replaced with zero or connecting legs',()=>{
 for(const middle of [{lat:null,lng:38.5},{lng:38.5},{lat:91,lng:38.5},{lat:9.5,lng:NaN}])assert.equal(route(query(a,b),[a,middle,b],options).matched,false);
 assert.equal(point({lat:null,lng:0},[{lat:0,lng:0},{lat:0,lng:1}],{radiusKm:5}).matched,false);
 assert.equal(route(query(a,a),[a,a],options).matched,false);
 const zero=[{lat:0,lng:0},{lat:0,lng:1}];assert.equal(route(query(zero[0],zero[1]),zero,options).matched,true);
});
test('service-area polygons must be complete, nonzero and simple',()=>{
 const valid=[{lat:9,lng:38},{lat:9.2,lng:38},{lat:9.2,lng:38.2},{lat:9,lng:38.2}],center={lat:9.1,lng:38.1};
 assert.equal(area(center,valid,{searchRadiusKm:5}).matched,true);
 assert.equal(area(center,[valid[0],valid[2],valid[1],valid[3]],{searchRadiusKm:5}).matched,false);
 assert.equal(area(a,[a,{lat:9,lng:38.1},{lat:9,lng:38.2}],{searchRadiusKm:5}).matched,false);
 assert.equal(area(center,[...valid,{lat:null,lng:38.3}],{searchRadiusKm:5}).matched,false);
});
test('two different signals cannot be spliced to invent one transport route',()=>{
 const truck={status:'EMPTY',availability_geometry:'ROUTE',current_route_points:[a,{lat:9.1,lng:38.1}],recurring_corridors:[{geometry:'ROUTE',route_points:[c,b]}]};
 const p=value=>({center_lat:value.lat,center_lng:value.lng,place_label:'Selected city'});
 assert.equal(capacityGeographicMatch(truck,options,p(a),p(b)).matched,false);
 assert.equal(capacityGeographicMatch(truck,options,p(c),p(b)).matched,true);
 assert.equal(capacityGeographicMatch({...truck,current_signal_geometry_visible:false,recurring_corridors:[]},options,p(a),p({lat:9.1,lng:38.1})).matched,false);
});
