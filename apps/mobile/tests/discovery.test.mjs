import test from 'node:test';
import assert from 'node:assert/strict';
import {discoveryParams,filterCount,changeSpace,changeAvailability,parseDiscovery,peopleSearchFilters,profileTruckFilters,initialCapacityIdentity} from '../src/api/discovery.ts';
import { parseCapacityPage,loadCapacity,loadSharedCapacity } from '../src/api/public-capacity.ts';
import {loadAccountCapacity,loadBusinessCapacity} from '../src/api/business-workspaces.ts';
import { markerLocation,project,signalPaths,separateMarkers } from '../src/map/capacity-geometry.ts';
const raw={id:'truck1',status:'EMPTY',assigned_driver_first_name:'Driver',location_lat:null,location_lng:null,availability_geometry:'ROUTE',current_route_points:[{lat:9,lng:38,label:'A'},{lat:10,lng:39,label:'B'}],recurring_corridors:[{geometry:'ROUTE',route_points:[{lat:8,lng:39,label:'C'},{lat:10,lng:39,label:'B'},{lat:9,lng:38,label:'A'}]}]};
const parse=row=>parseCapacityPage({items:[row],hasMore:false}).items[0];
test('location source is one canonical multi-filter group on public and private maps',async()=>{
 const filters={locationSource:'MOBILE,GPS,MOBILE',vehicleCategory:'Courier motorcycle,Courier car'};
 const urls=[];const response=async url=>{urls.push(String(url));return Response.json({items:[],hasMore:false,nextCursor:null});};
 await loadCapacity('https://loadgistic.com','',new AbortController().signal,()=>{},response,filters);
 await loadSharedCapacity('',new AbortController().signal,()=>{},async path=>{urls.push('https://loadgistic.com'+path);return {items:[],hasMore:false,nextCursor:null};},filters);
 assert.equal(urls.length,2);for(const url of urls){const params=new URL(url).searchParams;assert.equal(params.get('locationSource'),'GPS,MOBILE');assert.equal(params.get('vehicleCategory'),'Courier car,Courier motorcycle');assert.equal(params.getAll('locationSource').length,1);}
 assert.equal(filterCount({locationSource:'GPS,MANUAL,MOBILE'}),1);
 assert.equal(discoveryParams('',{locationSource:''}).has('locationSource'),false);
 assert.equal(peopleSearchFilters({...filters,provider:'selected',truck:'selected-truck'}).locationSource,filters.locationSource);
 for(const invalid of ['GPS_DEVICE','GPS,OTHER','GPS,',Array(34).fill('MOBILE').join(',')])assert.throws(()=>discoveryParams('',{locationSource:invalid}),/INVALID_CAPACITY_FILTER/);
 assert.equal(filters.locationSource,'MOBILE,GPS,MOBILE','Encoding never mutates the draft');
});
test('native truck filters encode identically across public/private map pagination',async()=>{
 const filters={vehicleCategory:'Tractor + Container Trailer',truckCityPlaceRef:'city',truckCityLabel:'Private local display label',truckLocationRadiusKm:'50',ownerDocs:'IDENTITY,BUSINESS_LICENSE'};
 const urls=[];await loadCapacity('https://loadgistic.com','A&B',new AbortController().signal,()=>{},async url=>{urls.push(url);return Response.json({items:[],hasMore:false});},filters);
 await loadSharedCapacity('A&B',new AbortController().signal,()=>{},async path=>{urls.push('https://loadgistic.com'+path);return {items:[],hasMore:false};},filters);
 assert.equal(new URL(urls[0]).search,new URL(urls[1]).search);assert.equal(new URL(urls[0]).searchParams.get('vehicleCategory'),filters.vehicleCategory);assert.equal(new URL(urls[0]).searchParams.has('truckCityLabel'),false);
 assert.equal(filterCount(filters),3);assert.equal(discoveryParams('',{}).toString(),'');
});
test('area place and radius reach public, shared, account and business maps without serializing display text',async()=>{
 const filters={currentAreaPlaceRef:'ethiopia-adama',currentAreaLabel:'Private display text',currentAreaRadiusKm:'50',status:'PARTIAL'};
 const paths=[],signal=new AbortController().signal,page={items:[],hasMore:false,nextCursor:null};
 await loadCapacity('https://loadgistic.com','',signal,()=>{},async url=>{paths.push(String(url));return Response.json(page);},filters);
 await loadSharedCapacity('',signal,()=>{},async path=>{paths.push(path);return page;},filters);
 await loadAccountCapacity(signal,()=>{},async path=>{paths.push(path);return page;},filters);
 await loadBusinessCapacity('synthetic-workspace',signal,()=>{},async path=>{paths.push(path);return page;},filters);
 assert.equal(paths.length,4);
 for(const path of paths){const query=new URL(path,'https://loadgistic.com').searchParams;
  assert.equal(query.get('currentAreaPlaceRef'),'ethiopia-adama');assert.equal(query.get('currentAreaRadiusKm'),'50');
  assert.equal(query.getAll('currentAreaPlaceRef').length,1);assert.equal(query.has('currentAreaLabel'),false);
  assert.equal(query.get('status'),'PARTIAL');
 }
 assert.equal(filterCount(filters),2);
 assert.equal(discoveryParams('',{}).has('currentAreaPlaceRef'),false);
});
test('mutually exclusive load filters cannot accidentally hide all trucks',()=>{
 assert.equal(changeSpace({status:'PARTIAL'},'FTL').status,'');assert.equal(changeAvailability({loadType:'FTL'},'PARTIAL').loadType,'');assert.equal(changeSpace({status:'EMPTY'},'PTL').status,'EMPTY');
});
test('multi-options are canonical and identical for public/private map and people queries',async()=>{
 const filters={vehicleCategory:'Pickup truck,Cargo van,Pickup truck',status:'PARTIAL,EMPTY',loadType:'PTL,FTL',stopOption:'MULTI_PICK,MULTI_DROP',freshness:'UPDATE_NEEDED,FRESH',truckDocs:'VEHICLE_OWNERSHIP,VEHICLE_AUTHORIZATION',originPlaceRef:'city'};
 const urls=[];
 await loadCapacity('https://loadgistic.com','',new AbortController().signal,()=>{},async url=>{urls.push(url);return Response.json({items:[],hasMore:false});},filters);
 await loadSharedCapacity('',new AbortController().signal,()=>{},async path=>{urls.push('https://loadgistic.com'+path);return{items:[],hasMore:false};},filters);
 const publicParams=new URL(urls[0]).searchParams,privateParams=new URL(urls[1]).searchParams;
 assert.equal(publicParams.toString(),privateParams.toString());
 assert.equal(publicParams.get('vehicleCategory'),'Cargo van,Pickup truck');assert.equal(publicParams.get('status'),'EMPTY,PARTIAL');
 assert.equal(publicParams.get('loadType'),'FTL,PTL');assert.equal(publicParams.get('stopOption'),'MULTI_DROP,MULTI_PICK');
 assert.equal(publicParams.get('truckDocs'),filters.truckDocs,'document requirements retain every selected type');
 assert.equal(publicParams.getAll('vehicleCategory').length,1);
 assert.equal(discoveryParams('public profile',peopleSearchFilters(filters)).get('vehicleCategory'),publicParams.get('vehicleCategory'));
 assert.equal(filterCount(filters),7);assert.equal(filters.vehicleCategory,'Pickup truck,Cargo van,Pickup truck');
});
test('valid alternative load/occupancy combinations survive changes while invalid values fail closed',()=>{
 assert.equal(changeSpace({status:'EMPTY,PARTIAL'},'FTL').status,'EMPTY,PARTIAL');
 assert.equal(changeAvailability({loadType:'FTL,PTL'},'PARTIAL').loadType,'FTL,PTL');
 assert.equal(changeSpace({status:'PARTIAL'},'FTL,PTL').status,'PARTIAL');
 for(const [key,value]of [['status','EMPTY,OFF_DUTY'],['loadType','FTL,INVALID'],['vehicleCategory','Cargo van,Unknown truck'],['stopOption','MULTI_PICK,'],['freshness','FRESH,'.repeat(33)]])assert.throws(()=>discoveryParams('',{[key]:value}),/INVALID_CAPACITY_FILTER/);
 assert.equal(discoveryParams('',{}).toString(),'');
});
test('people search drops map identity without changing detailed truck filters',()=>{
 const filters={provider:'selected-company',truck:'selected-truck',status:'EMPTY',ownerDocs:'IDENTITY',originPlaceRef:'city'};
 const before=JSON.stringify(filters),people=peopleSearchFilters(filters);
 assert.deepEqual(people,{status:'EMPTY',ownerDocs:'IDENTITY',originPlaceRef:'city'});
 assert.equal(discoveryParams('office city',people).get('q'),'office city');
 assert.equal(discoveryParams('office city',people).has('provider'),false);
 assert.equal(JSON.stringify(filters),before);
});
test('explicit profile-to-map selection combines identity with existing truck filters',()=>{
 const filters={status:'PARTIAL',loadType:'PTL',truckDocs:'VEHICLE_OWNERSHIP',provider:'old',truck:'old-truck'};
 const provider=profileTruckFilters(filters,{kind:'COMPANY',handle:'new-company',capacityId:''});
 assert.deepEqual(provider,{...filters,provider:'new-company',truck:''});
 const another=profileTruckFilters(filters,{handle:'another-provider'});
 assert.deepEqual(another,{...filters,provider:'another-provider',truck:''});
 assert.equal(filters.provider,'old');
});
test('capacity deep links apply only bounded explicit identity and keep text as a draft',()=>{
 const truck='00000000-0000-4000-8000-000000000123';
 assert.deepEqual(initialCapacityIdentity({provider:'published-company',truck,q:'Unsubmitted text',digest:'private'}),{provider:'published-company',truck});
 for(const input of [{provider:'has spaces',truck:'private plate'},{provider:['a','b'],truck:['one']},{provider:'x'.repeat(65),truck:'not-uuid'}])assert.deepEqual(initialCapacityIdentity(input),{provider:'',truck:''});
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
test('world zoom cannot move route lanes into another country or alter reported geometry',()=>{
 const distanceToPath=(point,path)=>Math.min(...path.slice(1).map((b,i)=>{
  const a=path[i],dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
  const t=len?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/len)):0;
  return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);
 }));
 for(const latitude of [-80,0,9,80])for(const geometry of ['ROUTE','RADIUS']){
  const points=[{lat:latitude,lng:38},{lat:latitude+.1,lng:39},{lat:latitude+.4,lng:38.4}],truck=parse({...raw,
   availability_geometry:geometry,current_route_points:points,capacity_area_boundary:points,
   recurring_corridors:[{geometry,route_points:points.toReversed(),area_boundary:points.toReversed()}]});
  const before=JSON.stringify(truck);
  for(const zoom of [0,1,3,5,8,12])for(const path of signalPaths(truck,zoom).filter(p=>p.kind!=='location')){
   const real=(path.kind==='current'?truck.currentPoints:truck.regular[0].points).map(p=>project([p.longitude,p.latitude],12));
   if(geometry==='RADIUS')real.push(real[0]);
   for(const point of path.points){const meters=distanceToPath(project(point,12),real)*40075016.6856/(512*2**12);
    assert.ok(meters<=1000,`${path.kind} ${geometry} zoom ${zoom}: ${Math.round(meters)} metres from source`);}
   if(geometry==='RADIUS')assert.deepEqual(path.points[0],path.points.at(-1));
  }
  assert.equal(JSON.stringify(truck),before);
 }
});
test('all coincident truck markers receive stable individually reachable display positions',()=>{
 const points=Array.from({length:9},(_,i)=>({id:String(i),coordinate:[38,9]}));const offsets=separateMarkers(points,20);assert.deepEqual(offsets,separateMarkers(points.toReversed(),20));
 const values=Object.values(offsets);assert.equal(values.length,9);for(let i=0;i<values.length;i++)for(let j=i+1;j<values.length;j++)assert.ok(Math.hypot(values[i][0]-values[j][0],values[i][1]-values[j][1])>=54);
});
test('profile parsing excludes extra contacts and rejects unconnected truck result shells',()=>{
 const result=parseDiscovery({items:[{key:'a',kind:'COMPANY',title:'Company',description:'',handle:'public',city:'Adama',capacityId:'',matchingTrucks:2,privateEmail:'hidden'}],total:1,page:1,hasMore:false,configurations:[]});assert.equal('privateEmail' in result.items[0],false);
 assert.throws(()=>parseDiscovery({items:[{kind:'TRUCK'}],total:1,page:1,hasMore:false,configurations:[]}));
 assert.throws(()=>parseDiscovery({items:[{key:'employee',kind:'COMPANY_DRIVER',title:'Employee',description:'',handle:'provider',city:'',capacityId:'private-pair',matchingTrucks:1}],total:1,page:1,hasMore:false,configurations:[]}));
});
