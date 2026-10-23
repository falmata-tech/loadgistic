import test from 'node:test';
import assert from 'node:assert/strict';
import {trackingRoute,trackingMapLocation,trackingPublicTruck} from '../src/lib/tracking-map.js';

const shipment={origin:'Pickup',origin_place_ref:'a',origin_lat:9,origin_lng:38,
 passing:'Passing city',passing_place_ref:'b',passing_lat:10,passing_lng:39,
 destination:'Delivery',destination_place_ref:'c',destination_lat:11,destination_lng:40};
test('shipment map preserves the ordered three-city route and honest legacy endpoints',()=>{
 assert.deepEqual(trackingRoute(shipment).map(point=>point.placeRef),['a','b','c']);
 assert.deepEqual(trackingRoute({...shipment,passing_place_ref:null,passing:null,passing_lat:null,passing_lng:null}).map(point=>point.placeRef),['a','c']);
 assert.deepEqual(trackingRoute({...shipment,passing_lat:null}),[]);
 assert.deepEqual(trackingRoute({...shipment,passing_place_ref:'a'}),[]);
 assert.deepEqual(trackingRoute({...shipment,origin_lat:0,origin_lng:0})[0].coordinate,[0,0]);
});
test('only saved bounded approximate location survives active map projection',()=>{
 const location={location_area:'Reported area',location_lat:41,location_lng:-87,location_precision_km:20,created_at:'2026-10-13T10:00:00Z'};
 const input={tracking_mode:'LOCATION_AND_STATUS',operational_status:'UNLOADING',latest_location:location};
 assert.deepEqual(trackingMapLocation(input),{latitude:41,longitude:-87,area:'Reported area',radius:20,updatedAt:location.created_at});
 for(const status of ['COMPLETED','CANCELLED'])assert.equal(trackingMapLocation({...input,operational_status:status}),null);
 assert.equal(trackingMapLocation({...input,tracking_mode:'STATUS_ONLY'}),null);
 assert.equal(trackingMapLocation({...input,current_location:null}),null);
 for(const changed of [{location_lat:null},{location_lng:Infinity},{location_precision_km:40}])assert.equal(trackingMapLocation({...input,latest_location:{...location,...changed}}),null);
});
test('truck map summary allowlists public identity and published contacts only',()=>{
 const summary={platformNumber:'LG-1',make:'Isuzu',model:'Truck',configuration:'Mini Box Truck',providerName:'Transporter',providerHandle:'transporter',driverName:'Public first name',driverPhone:'+251900000000',contactPhone:null};
 const projected=trackingPublicTruck({public_truck_summary:{...summary,plate:'PRIVATE-PLATE',recipientEmail:'PRIVATE-EMAIL',driverId:'PRIVATE-ID',proofPath:'PRIVATE-PATH'}});
 assert.deepEqual(projected,{...summary,contactPhone:'',driverPortrait:''});
 assert.equal(trackingPublicTruck({public_truck_summary:{...summary,driverPortrait:'/private/portrait.jpg'}}).driverPortrait,'');
 assert.equal(trackingPublicTruck({public_truck_summary:{...summary,driverPortrait:'/api/public/driver-portraits/10000000-0000-4000-8000-000000000001'}}).driverPortrait,'/api/public/driver-portraits/10000000-0000-4000-8000-000000000001');
 assert.equal(JSON.stringify(projected).includes('PRIVATE-'),false);
 assert.equal(trackingPublicTruck({driver_name:'Private full name'}),null);
});

test('Tracking source reflects its saved fix and never a pending capacity selection or identifier',()=>{
 const location={location_lat:9,location_lng:38,location_precision_km:10,updated_at:'2026-10-18T12:00:00Z',imei:'PRIVATE-IMEI',device_id:'PRIVATE-DEVICE'};
 const shipment={tracking_mode:'LOCATION_AND_STATUS',operational_status:'IN_TRANSIT',current_location:location,selectedLocationSource:'GPS'};
 for(const [saved,canonical] of [['TELEMATICS','GPS'],['DEVICE_OBSCURED','MOBILE'],['MANUAL_ADMIN','MANUAL']]){
  const result=trackingMapLocation({...shipment,current_location:{...location,location_source:saved}});
  assert.equal(result.source,canonical);assert.equal(JSON.stringify(result).includes('PRIVATE-'),false);
 }
 assert.equal(Object.hasOwn(trackingMapLocation(shipment),'source'),false);
 assert.equal(Object.hasOwn(trackingMapLocation({...shipment,current_location:{...location,location_source:'UNKNOWN'}}),'source'),false);
 assert.equal(trackingMapLocation({...shipment,can_view_location:false}),null);
});
