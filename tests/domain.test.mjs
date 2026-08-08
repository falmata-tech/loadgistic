import test from 'node:test';
import assert from 'node:assert/strict';
import { mutationOriginAllowed } from '../src/lib/origin.js';
import { validateCapacity, validateAcceptedLoads, validateCapacityServiceRadius, validateFreightLoadType, validateMovementScope, validateServiceRadius, distanceBetweenKm, pointInServiceArea, serviceAreasOverlap, validatePriceMode, canTransition, capacityFreshness, capacitySignalFreshness, capacityExpiryState, loadBoardDeadlineState, formatEtb, isPendingDirectRequest, roleCanCreateShipment, validateSupportCategory, validateSupportMessage, validateSupportAgentLimit } from '../src/lib/domain.js';
import { bestGeographicRouteMatch, geographicRouteMatch, normalizePlace, uncertaintyAreasOverlap } from '../src/lib/route-matching.js';
import { buildAlongRouteChains, distanceKm, poolCompatibleLoads } from '../src/lib/pstl.js';
import { placeIdentity, placeLabel, qualifyCorridorList, qualifyPlaceList } from '../src/lib/place-labels.js';
import { accessPeriodEnd, subscriptionAccess } from '../src/lib/subscription-access.js';
import { capacityPrivacyRadii, obscureCoordinate, possibleDistanceRange, validateCapacityPrivacyRadius } from '../src/lib/location-privacy.js';

test('capacity rules are simple and strict',()=>{
 assert.equal(validateCapacity('EMPTY',''),100);
 assert.throws(()=>validateCapacity('BUSY',''),/INVALID_CAPACITY_STATUS/);
 assert.equal(validateCapacity('OFF_DUTY',''),0);
 assert.equal(validateCapacity('PARTIAL','40'),40);
 assert.throws(()=>validateCapacity('FULL',''),/INVALID_CAPACITY_STATUS/);
 assert.throws(()=>validateCapacity('PARTIAL','0'),/CAPACITY_PERCENT_REQUIRED/);
 assert.throws(()=>validateCapacity('PARTIAL','100'),/CAPACITY_PERCENT_REQUIRED/);
});

test('direct requests accept both current and legacy pending operational states',()=>{
 const pending={distributionMode:'DIRECT_TO_PROVIDER',commercialStatus:'SENT'};
 assert.equal(isPendingDirectRequest({...pending,operationalStatus:'POSTED'}),true);
 assert.equal(isPendingDirectRequest({...pending,operationalStatus:'SENT'}),true);
 assert.equal(isPendingDirectRequest({...pending,operationalStatus:'AGREED'}),false);
 assert.equal(isPendingDirectRequest({...pending,commercialStatus:'AGREED',operationalStatus:'POSTED'}),false);
 assert.equal(isPendingDirectRequest({...pending,distributionMode:'OPEN_MARKET',operationalStatus:'POSTED'}),false);
});

test('capacity load acceptance distinguishes FTL, PTL, and both',()=>{
 assert.deepEqual(validateAcceptedLoads('EMPTY','FTL'),{acceptsFullLoad:true,acceptsPartialLoad:false});
 assert.deepEqual(validateAcceptedLoads('EMPTY','PTL'),{acceptsFullLoad:false,acceptsPartialLoad:true});
 assert.deepEqual(validateAcceptedLoads('EMPTY','BOTH'),{acceptsFullLoad:true,acceptsPartialLoad:true});
 assert.deepEqual(validateAcceptedLoads('OFF_DUTY',''),{acceptsFullLoad:false,acceptsPartialLoad:false});
 assert.throws(()=>validateAcceptedLoads('BUSY',''),/ACCEPTED_LOADS_REQUIRED/);
 assert.deepEqual(validateAcceptedLoads('PARTIAL',''),{acceptsFullLoad:false,acceptsPartialLoad:true});
 assert.deepEqual(validateAcceptedLoads('PARTIAL','BOTH'),{acceptsFullLoad:false,acceptsPartialLoad:true});
 assert.equal(validateCapacityServiceRadius('10'),10);
 assert.equal(validateCapacityServiceRadius('50'),50);
 assert.throws(()=>validateCapacityServiceRadius('60'),/INVALID_CAPACITY_RADIUS/);
});

test('PSTL pooling is deterministic and distance bounded',()=>{
 const base={load_type:'PTL',operational_status:'POSTED',movement_scope:'INTERCITY',pickup_date:'2026-08-01',delivery_date:'2026-08-02'};
 const loads=[
  {...base,id:'a',origin:'Addis Ababa',destination:'Adama',origin_coordinate:{lat:9.03,lng:38.74},destination_coordinate:{lat:8.54,lng:39.27}},
  {...base,id:'b',origin:'Akaki',destination:'Mojo',origin_coordinate:{lat:8.88,lng:38.78},destination_coordinate:{lat:8.59,lng:39.12}},
  {...base,id:'c',origin:'Bahir Dar',destination:'Gondar',origin_coordinate:{lat:11.59,lng:37.39},destination_coordinate:{lat:12.6,lng:37.47}}
 ];
 assert.ok(distanceKm(loads[0].origin_coordinate,loads[1].origin_coordinate)<40);
 const pools=poolCompatibleLoads(loads);
 assert.equal(pools.length,1);
 assert.deepEqual(pools[0].members.map(load=>load.id),['a','b']);
 assert.equal(poolCompatibleLoads(loads.reverse())[0].id,pools[0].id);
});

test('PSTL requires complete pair compatibility and close deadlines',()=>{
 const base={load_type:'PTL',operational_status:'POSTED',movement_scope:'INTERCITY',pickup_date:'2026-08-01',delivery_date:'2026-08-02'};
 const loads=[
  {...base,id:'a',origin:'A',destination:'D',origin_coordinate:{lat:9,lng:38},destination_coordinate:{lat:7,lng:38}},
  {...base,id:'b',origin:'B',destination:'E',origin_coordinate:{lat:9.2,lng:38},destination_coordinate:{lat:7.2,lng:38}},
  {...base,id:'c',origin:'C',destination:'F',origin_coordinate:{lat:9.4,lng:38},destination_coordinate:{lat:7.4,lng:38}},
  {...base,id:'late',pickup_date:'2026-08-10',delivery_date:'2026-08-11',origin:'A',destination:'D',origin_coordinate:{lat:9,lng:38},destination_coordinate:{lat:7,lng:38}}
 ];
 const pools=poolCompatibleLoads(loads,{originRadiusKm:30,destinationRadiusKm:30,deadlineWindowDays:3});
 assert.equal(pools.length,1);
 assert.deepEqual(pools[0].members.map(load=>load.id),['a','b']);
 assert.equal(pools[0].members.some(load=>load.id==='c'),false);
 assert.equal(pools[0].members.some(load=>load.id==='late'),false);
});

test('along-route candidates chain nearby forward legs in deadline order',()=>{
 const base={operational_status:'POSTED',movement_scope:'INTERCITY',pickup_date:'2026-08-01',delivery_date:'2026-08-02'};
 const loads=[
  {...base,id:'addis-adama',load_type:'FTL',origin:'Addis Ababa',destination:'Adama',origin_coordinate:{lat:9.03,lng:38.74},destination_coordinate:{lat:8.54,lng:39.27}},
  {...base,id:'adama-batu',load_type:'PTL',pickup_date:'2026-08-02',delivery_date:'2026-08-03',origin:'Adama',destination:'Batu',origin_coordinate:{lat:8.54,lng:39.27},destination_coordinate:{lat:7.93,lng:38.72}},
  {...base,id:'batu-hawassa',load_type:'PTL',pickup_date:'2026-08-03',delivery_date:'2026-08-04',origin:'Batu',destination:'Hawassa',origin_coordinate:{lat:7.93,lng:38.72},destination_coordinate:{lat:7.06,lng:38.48}},
  {...base,id:'reverse',load_type:'PTL',pickup_date:'2026-08-04',delivery_date:'2026-08-05',origin:'Hawassa',destination:'Addis Ababa',origin_coordinate:{lat:7.06,lng:38.48},destination_coordinate:{lat:9.03,lng:38.74}}
 ];
 const chains=buildAlongRouteChains(loads,{handoffRadiusKm:10});
 assert.equal(chains.length,1);
 assert.deepEqual(chains[0].members.map(load=>load.id),['addis-adama','adama-batu','batu-hawassa']);
 assert.equal(chains[0].member_count,3);
 assert.equal(chains[0].connectors.length,2);
 assert.equal(chains[0].members.some(load=>load.id==='reverse'),false);
 assert.equal(buildAlongRouteChains(loads,{handoffRadiusKm:10})[0].id,chains[0].id);
});

test('road freight requires the same FTL or PTL language',()=>{
 assert.equal(validateFreightLoadType('FREIGHT','FTL'),'FTL');
 assert.equal(validateFreightLoadType('FREIGHT','PTL'),'PTL');
 assert.throws(()=>validateFreightLoadType('UNSUPPORTED',''),/INVALID_SERVICE_MODE/);
 assert.throws(()=>validateFreightLoadType('FREIGHT','FULL_LOAD'),/FREIGHT_LOAD_TYPE_REQUIRED/);
});

test('local geography validates scope, radius, distance, and overlap',()=>{
 assert.equal(validateMovementScope('LOCAL'),'LOCAL');
 assert.equal(validateMovementScope('BOTH',{allowBoth:true}),'BOTH');
 assert.throws(()=>validateMovementScope('BOTH'),/INVALID_MOVEMENT_SCOPE/);
 assert.equal(validateServiceRadius('40'),40);
 assert.throws(()=>validateServiceRadius('4'),/INVALID_SERVICE_RADIUS/);
 assert.throws(()=>validateServiceRadius('101'),/INVALID_SERVICE_RADIUS/);
 const addis={lat:9.03,lng:38.74};
 const adama={lat:8.54,lng:39.27};
 assert.ok(distanceBetweenKm(addis,adama)>70);
 assert.equal(pointInServiceArea({lat:9.1,lng:38.8},{center_lat:9.03,center_lng:38.74,radius_km:20}),true);
 assert.equal(serviceAreasOverlap(
  {center_lat:9.03,center_lng:38.74,radius_km:40},
  {center_lat:8.75,center_lng:38.99,radius_km:20}
 ),true);
 assert.equal(serviceAreasOverlap(
  {center_lat:9.03,center_lng:38.74,radius_km:20},
  {center_lat:8.54,center_lng:39.27,radius_km:20}
 ),false);
});

test('device capacity location is displaced into the promised privacy area',()=>{
 const exact={lat:9.03,lng:38.74};
 const obscured=obscureCoordinate(exact.lat,exact.lng,35);
 const distance=distanceBetweenKm(exact,obscured);
 assert.ok(distance>=34.9&&distance<=35.1);
 assert.notDeepEqual(obscured,exact);
 assert.deepEqual(obscureCoordinate(exact.lat,exact.lng,35),obscured);
});

test('Driver controls capacity privacy across every movement scope',()=>{
 assert.deepEqual(capacityPrivacyRadii('LOCAL'),[1,3,5,10,20,40]);
 assert.deepEqual(capacityPrivacyRadii('INTERCITY'),[1,3,5,10,20,40]);
 assert.deepEqual(capacityPrivacyRadii('BOTH'),[1,3,5,10,20,40]);
 assert.equal(validateCapacityPrivacyRadius('INTERCITY',1),1);
 assert.throws(()=>validateCapacityPrivacyRadius('LOCAL',2),/INVALID_LOCATION_PRIVACY/);
 assert.deepEqual(possibleDistanceRange(12.4,5,1),{minKm:6,maxKm:18});
});

test('ETB price modes support fixed, target, and quote',()=>{
 assert.deepEqual(validatePriceMode({priceMode:'FIXED_PRICE',priceEtb:'35000'}),{priceMinor:3500000,targetMinor:null});
 assert.deepEqual(validatePriceMode({priceMode:'TARGET_PRICE',targetPriceEtb:'32000'}),{priceMinor:null,targetMinor:3200000});
 assert.deepEqual(validatePriceMode({priceMode:'QUOTE_REQUESTED'}),{priceMinor:null,targetMinor:null});
 assert.equal(formatEtb(3500000),'ETB 35,000');
});

test('freight status transitions preserve agreement before movement',()=>{
 assert.equal(canTransition('FREIGHT','POSTED','CONTACTED'),true);
 assert.equal(canTransition('FREIGHT','POSTED','IN_TRANSIT'),false);
 assert.equal(canTransition('FREIGHT','ASSIGNED','IN_TRANSIT'),true);
 assert.equal(canTransition('FREIGHT','IN_TRANSIT','DELIVERED'),true);
 assert.equal(canTransition('FREIGHT','IN_TRANSIT','ISSUE'),true);
 assert.equal(canTransition('FREIGHT','DELIVERED','COMPLETED'),true);
 assert.equal(canTransition('FREIGHT','DELIVERED','ISSUE'),false);
});

test('only business workspace roles can originate shipment demand',()=>{
 assert.equal(roleCanCreateShipment('SHIPPER'),true);
 assert.equal(roleCanCreateShipment('RECEIVER'),true);
 assert.equal(roleCanCreateShipment('ADMIN'),false);
 assert.equal(roleCanCreateShipment('TRANSPORTER'),false);
});

test('capacity freshness labels expired data honestly',()=>{
 const now=Date.now();
 assert.equal(capacityFreshness(new Date(now-60_000).toISOString(),new Date(now+3_600_000).toISOString(),12),'FRESH');
 assert.equal(capacityFreshness(new Date(now-13*3_600_000).toISOString(),new Date(now+3_600_000).toISOString(),12),'UPDATE_NEEDED');
 assert.equal(capacityFreshness(new Date(now-60_000).toISOString(),new Date(now-1).toISOString(),12),'EXPIRED');
});

test('cargo-space freshness is based on the current signal update',()=>{
 assert.equal(capacitySignalFreshness('EMPTY','2026-07-28T09:00:00.000Z',null,12,'2026-07-30'),'UPDATE_NEEDED');
 assert.equal(capacitySignalFreshness('PARTIAL',new Date().toISOString(),null,12),'FRESH');
});

test('legacy capacity expiry utility remains deterministic for historical records',()=>{
 const now=new Date('2026-07-30T09:00:00.000Z');
 assert.equal(capacityExpiryState('2026-07-30T12:00:01.000Z',now),'CURRENT');
 assert.equal(capacityExpiryState('2026-07-30T10:59:59.000Z',now),'EXPIRING');
 assert.equal(capacityExpiryState('2026-07-30T09:00:00.000Z',now),'EXPIRED');
});

test('load Board keeps two full grace days after its delivery deadline',()=>{
 assert.equal(loadBoardDeadlineState(null,'2026-07-30'),'CURRENT');
 assert.equal(loadBoardDeadlineState('2026-07-30','2026-07-30'),'CURRENT');
 assert.equal(loadBoardDeadlineState('2026-07-29','2026-07-30'),'PAST_DUE');
 assert.equal(loadBoardDeadlineState('2026-07-28','2026-07-30'),'PAST_DUE');
 assert.equal(loadBoardDeadlineState('2026-07-27','2026-07-30'),'EXPIRED');
});

test('workspace access periods distinguish trial, paid, sponsored, and expired states',()=>{
 const now=new Date('2026-07-29T09:00:00.000Z');
 assert.equal(accessPeriodEnd(now,7),'2026-08-05T09:00:00.000Z');
 assert.equal(accessPeriodEnd(now,30),'2026-08-28T09:00:00.000Z');
 assert.deepEqual(subscriptionAccess(null,now),{
  granted:false,status:'NO_SUBSCRIPTION',ends_at:null,days_remaining:0
 });
 assert.equal(subscriptionAccess({status:'TRIAL',ends_at:'2026-08-05T09:00:00.000Z'},now).days_remaining,7);
 assert.equal(subscriptionAccess({status:'ACTIVE',ends_at:'2026-08-28T09:00:00.000Z'},now).granted,true);
 assert.equal(subscriptionAccess({status:'SPONSORED',ends_at:null},now).granted,true);
 assert.equal(subscriptionAccess({status:'TRIAL',ends_at:'2026-07-29T09:00:00.000Z'},now).status,'EXPIRED_UNPAID');
 assert.equal(subscriptionAccess({status:'PAYMENT_UNDER_REVIEW',ends_at:'2026-07-28T09:00:00.000Z'},now).granted,false);
});

test('place labels normalize display text without driving route matching',()=>{
 assert.equal(normalizePlace('  Addis-Ababa '),'addis ababa');
 assert.equal(placeLabel('Adaba'),'Adaba, Ethiopia');
 assert.equal(placeLabel('Adaba, Kenya'),'Adaba, Kenya');
 assert.equal(placeIdentity('Adaba'),placeIdentity('Adaba, Ethiopia'));
 assert.equal(qualifyPlaceList('Oromia; Somali, Ethiopia'),'Oromia, Ethiopia; Somali, Ethiopia');
 assert.equal(qualifyCorridorList('Addis Ababa ↔ Hawassa'),'Addis Ababa, Ethiopia ↔ Hawassa, Ethiopia');
});

test('coordinate route matching supports radii, direction, and best truck route',()=>{
 const query={origin_lat:9.03,origin_lng:38.74,destination_lat:7.06,destination_lng:38.48};
 const nearby={id:'nearby',origin_lat:8.88,origin_lng:38.78,destination_lat:7.20,destination_lng:38.60};
 const reverse={id:'reverse',origin_lat:7.20,origin_lng:38.60,destination_lat:8.88,destination_lng:38.78};
 const distant={id:'distant',origin_lat:11.59,origin_lng:37.39,destination_lat:12.60,destination_lng:37.47};
 const direct=geographicRouteMatch(query,nearby,{originRadiusKm:30,destinationRadiusKm:30});
 assert.equal(direct.matched,true);
 assert.equal(direct.direction,'DIRECT');
 assert.equal(geographicRouteMatch(query,reverse,{originRadiusKm:30,destinationRadiusKm:30}).matched,false);
 assert.equal(geographicRouteMatch(query,reverse,{originRadiusKm:30,destinationRadiusKm:30,directionMode:'EITHER'}).direction,'REVERSE');
 const best=bestGeographicRouteMatch(query,[distant,nearby],{originRadiusKm:50,destinationRadiusKm:50});
 assert.equal(best.id,'nearby');
 assert.match(best.label,/Route match/);
});

test('obscured current areas compare by circle overlap',()=>{
 assert.equal(uncertaintyAreasOverlap(
  {center_lat:9.03,center_lng:38.74,radius_km:20},
  {center_lat:8.75,center_lng:38.99,radius_km:40}
 ).matched,true);
 assert.equal(uncertaintyAreasOverlap(
  {center_lat:9.03,center_lng:38.74,radius_km:20},
  {center_lat:7.06,center_lng:38.48,radius_km:40}
 ).matched,false);
});

test('mutation origin guard accepts browser-confirmed same-origin proxy requests',()=>{
 const headers=new Headers({
  origin:'https://workspace-3000.app.github.dev',
  host:'localhost:3000',
  'sec-fetch-site':'same-origin'
 });
 assert.equal(mutationOriginAllowed(headers,'http://localhost:3000/api/auth/login'),true);
});

test('mutation origin guard rejects cross-site requests',()=>{
 const headers=new Headers({
  origin:'https://attacker.example',
  host:'localhost:3000',
  'x-forwarded-host':'workspace-3000.app.github.dev',
  'x-forwarded-proto':'https',
  'sec-fetch-site':'cross-site'
 });
  assert.equal(mutationOriginAllowed(headers,'http://localhost:3000/api/auth/login'),false);
});

test('support inputs are bounded and use a small stable category set',()=>{
 assert.equal(validateSupportCategory('payment'),'PAYMENT');
 assert.throws(()=>validateSupportCategory('PASSWORD_RESET'),/INVALID_SUPPORT_CATEGORY/);
 assert.equal(validateSupportMessage('  Please help with payment.  '),'Please help with payment.');
 assert.throws(()=>validateSupportMessage(''),/SUPPORT_MESSAGE_REQUIRED/);
 assert.throws(()=>validateSupportMessage('x'.repeat(2001)),/SUPPORT_MESSAGE_TOO_LONG/);
 assert.equal(validateSupportAgentLimit('4'),4);
 assert.throws(()=>validateSupportAgentLimit('0'),/INVALID_SUPPORT_AGENT_LIMIT/);
 assert.throws(()=>validateSupportAgentLimit('21'),/INVALID_SUPPORT_AGENT_LIMIT/);
});
