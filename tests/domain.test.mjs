import test from 'node:test';
import assert from 'node:assert/strict';
import { mutationOriginAllowed } from '../src/lib/origin.js';
import { validateCapacity, validateAcceptedLoads, validateFreightLoadType, validatePriceMode, canTransition, capacityFreshness, formatEtb, roleCanCreateShipment } from '../src/lib/domain.js';
import { normalizePlace, routeMatch, splitPlaces } from '../src/lib/route-matching.js';

test('capacity rules are simple and strict',()=>{
 assert.equal(validateCapacity('EMPTY',''),100);
 assert.equal(validateCapacity('OFF_DUTY',''),0);
 assert.equal(validateCapacity('PARTIAL','40'),40);
 assert.throws(()=>validateCapacity('FULL',''),/INVALID_CAPACITY_STATUS/);
 assert.throws(()=>validateCapacity('PARTIAL','0'),/CAPACITY_PERCENT_REQUIRED/);
 assert.throws(()=>validateCapacity('PARTIAL','100'),/CAPACITY_PERCENT_REQUIRED/);
});

test('capacity load acceptance distinguishes FTL, PTL, and both',()=>{
 assert.deepEqual(validateAcceptedLoads('EMPTY','FTL'),{acceptsFullLoad:true,acceptsPartialLoad:false});
 assert.deepEqual(validateAcceptedLoads('EMPTY','PTL'),{acceptsFullLoad:false,acceptsPartialLoad:true});
 assert.deepEqual(validateAcceptedLoads('EMPTY','BOTH'),{acceptsFullLoad:true,acceptsPartialLoad:true});
 assert.deepEqual(validateAcceptedLoads('OFF_DUTY',''),{acceptsFullLoad:false,acceptsPartialLoad:false});
 assert.throws(()=>validateAcceptedLoads('PARTIAL',''),/ACCEPTED_LOADS_REQUIRED/);
});

test('road freight requires the same FTL or PTL language',()=>{
 assert.equal(validateFreightLoadType('FREIGHT','FTL'),'FTL');
 assert.equal(validateFreightLoadType('FREIGHT','PTL'),'PTL');
 assert.throws(()=>validateFreightLoadType('UNSUPPORTED',''),/INVALID_SERVICE_MODE/);
 assert.throws(()=>validateFreightLoadType('FREIGHT','FULL_LOAD'),/FREIGHT_LOAD_TYPE_REQUIRED/);
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

test('route matching is simple, order independent, and explainable',()=>{
 assert.deepEqual(routeMatch('Addis Ababa','Hawassa','Hawassa','Addis Ababa'),{score:2,label:'Full route match'});
 assert.deepEqual(routeMatch('Addis Ababa','Hawassa','Addis Ababa','Dire Dawa'),{score:1,label:'One city aligns'});
 assert.deepEqual(routeMatch('Jimma','Nekemte','Addis Ababa','Dire Dawa'),{score:0,label:'No route match'});
 assert.equal(normalizePlace('  Addis-Ababa '),'addis ababa');
 assert.deepEqual(splitPlaces('Addis Ababa ↔ Hawassa; Dire Dawa'),['addis ababa','hawassa','dire dawa']);
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
