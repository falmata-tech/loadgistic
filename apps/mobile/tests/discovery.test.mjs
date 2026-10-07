import test from 'node:test';
import assert from 'node:assert/strict';
import { discoveryParams,filterCount,changeSpace,changeAvailability,parseDiscovery } from '../src/api/discovery.ts';
import { parseCapacityPage,loadCapacity,loadSharedCapacity } from '../src/api/public-capacity.ts';
import { markerLocation,project,signalPaths,separateMarkers } from '../src/map/capacity-geometry.ts';
const raw={id:'truck1',status:'EMPTY',assigned_driver_first_name:'Driver',location_lat:null,location_lng:null,availability_geometry:'ROUTE',current_route_points:[{lat:9,lng:38,label:'A'},{lat:10,lng:39,label:'B'}],recurring_corridors:[{geometry:'ROUTE',route_points:[{lat:8,lng:39,label:'C'},{lat:10,lng:39,label:'B'},{lat:9,lng:38,label:'A'}]}]};
const parse=row=>parseCapacityPage({items:[row],hasMore:false}).items[0];
test('native truck filters encode identically across public/private map pagination',async()=>{
 const filters={vehicleCategory:'Tractor + Container Trailer',truckCityPlaceRef:'city',truckCityLabel:'Private local display label',truckLocationRadiusKm:'50',ownerDocs:'IDENTITY,BUSINESS_LICENSE'};
 const urls=[];await loadCapacity('https://loadgistic.com','A&B',new AbortController().signal,()=>{},async url=>{urls.push(url);return Response.json({items:[],hasMore:false});},filters);
 await loadSharedCapacity('A&B',new AbortController().signal,()=>{},async path=>{urls.push('https://loadgistic.com'+path);return {items:[],hasMore:false};},filters);
 assert.equal(new URL(urls[0]).search,new URL(urls[1]).search);assert.equal(new URL(urls[0]).searchParams.get('vehicleCategory'),filters.vehicleCategory);assert.equal(new URL(urls[0]).searchParams.has('truckCityLabel'),false);
 assert.equal(filterCount(filters),3);assert.equal(discoveryParams('',{}).toString(),'');
});
test('mutually exclusive load filters cannot accidentally hide all trucks',()=>{
 assert.equal(changeSpace({status:'PARTIAL'},'FTL').status,'');assert.equal(changeAvailability({loadType:'FTL'},'PARTIAL').loadType,'');assert.equal(changeSpace({status:'EMPTY'},'PTL').status,'EMPTY');
});
test('capacity geometry excludes invalid coordinates, regular-only fake locations and hidden current signals',()=>{
 const truck=parse(raw);assert.deepEqual(markerLocation(truck),[38.5,9.5]);
 const hidden=parse({...raw,current_signal_geometry_visible:false});assert.equal(markerLocation(hidden),null);assert.equal(signalPaths(hidden,12).some(p=>p.kind==='current'),false);
 const bad=parse({...raw,current_route_points:[{lat:91,lng:1},{lat:null,lng:0},{lat:9,lng:38}]});assert.equal(markerLocation(bad),null);assert.equal(signalPaths(bad,12).some(p=>p.kind==='current'),false);
 assert.throws(()=>parseCapacityPage({items:[],hasMore:false,filterError:'Invalid city'}));
});
test('partially shared reversed route leg has separated lanes without mutating real coordinates',()=>{
 const truck=parse(raw),before=JSON.stringify(truck),paths=signalPaths(truck,12);
 const current=paths.find(p=>p.kind==='current'),regular=paths.find(p=>p.kind==='regular');
 const a=project(current.points[0],12),b=project(current.points.at(-1),12),c=project(regular.points.at(-1),12);
 const distance=Math.abs((b.y-a.y)*c.x-(b.x-a.x)*c.y+b.x*a.y-b.y*a.x)/Math.hypot(b.y-a.y,b.x-a.x);
 assert.ok(distance>=11.9,`shared leg separation ${distance}`);assert.equal(JSON.stringify(truck),before);
});
test('invalid middle points cannot fabricate a shortcut route or reshaped service boundary',()=>{
 const broken=[{lat:9,lng:38},{lat:NaN,lng:39},{lat:10,lng:40},{lat:11,lng:39}];
 for(const geometry of ['ROUTE','RADIUS']){
  const truck=parse({...raw,availability_geometry:geometry,current_route_points:broken,capacity_area_boundary:broken,recurring_corridors:[{geometry,route_points:broken,area_boundary:broken}]});
  assert.equal(markerLocation(truck),null);assert.deepEqual(signalPaths(truck,12),[]);
 }
});
test('coincident closed areas are separated and remain closed',()=>{
 const ring=[{lat:9,lng:38},{lat:9,lng:39},{lat:10,lng:39},{lat:10,lng:38}],truck=parse({...raw,availability_geometry:'RADIUS',capacity_area_boundary:ring,recurring_corridors:[{geometry:'RADIUS',area_boundary:ring}]});
 const paths=signalPaths(truck,12),a=paths.find(p=>p.kind==='current').points,b=paths.find(p=>p.kind==='regular').points;
 assert.deepEqual(a[0],a.at(-1));assert.deepEqual(b[0],b.at(-1));assert.notDeepEqual(a,b);
});
test('all coincident truck markers receive stable individually reachable display positions',()=>{
 const points=Array.from({length:9},(_,i)=>({id:String(i),coordinate:[38,9]}));const offsets=separateMarkers(points,20);assert.deepEqual(offsets,separateMarkers(points.toReversed(),20));
 const values=Object.values(offsets);assert.equal(values.length,9);for(let i=0;i<values.length;i++)for(let j=i+1;j<values.length;j++)assert.ok(Math.hypot(values[i][0]-values[j][0],values[i][1]-values[j][1])>=54);
});
test('profile parsing excludes extra contacts and rejects unconnected truck result shells',()=>{
 const result=parseDiscovery({items:[{key:'a',kind:'COMPANY',title:'Company',description:'',handle:'public',city:'Adama',capacityId:'',matchingTrucks:2,privateEmail:'hidden'}],total:1,page:1,hasMore:false,configurations:[]});assert.equal('privateEmail' in result.items[0],false);
 assert.throws(()=>parseDiscovery({items:[{kind:'TRUCK'}],total:1,page:1,hasMore:false,configurations:[]}));
});
