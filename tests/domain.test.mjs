import test from 'node:test';
import assert from 'node:assert/strict';
import { mutationOriginAllowed } from '../src/lib/origin.js';
import { validateCapacity, validatePriceMode, canTransition, capacityFreshness, formatEtb } from '../src/lib/domain.js';

test('capacity rules are simple and strict',()=>{
 assert.equal(validateCapacity('EMPTY',''),100);
 assert.equal(validateCapacity('FULL',''),0);
 assert.equal(validateCapacity('PARTIAL','40'),40);
 assert.throws(()=>validateCapacity('PARTIAL','0'),/CAPACITY_PERCENT_REQUIRED/);
 assert.throws(()=>validateCapacity('PARTIAL','100'),/CAPACITY_PERCENT_REQUIRED/);
});

test('ETB price modes support fixed, target, and quote',()=>{
 assert.deepEqual(validatePriceMode({priceMode:'FIXED_PRICE',priceEtb:'35000'}),{priceMinor:3500000,targetMinor:null});
 assert.deepEqual(validatePriceMode({priceMode:'TARGET_PRICE',targetPriceEtb:'32000'}),{priceMinor:null,targetMinor:3200000});
 assert.deepEqual(validatePriceMode({priceMode:'QUOTE_REQUESTED'}),{priceMinor:null,targetMinor:null});
 assert.equal(formatEtb(3500000),'ETB 35,000');
});

test('parcel status transitions preserve simple workflow',()=>{
 assert.equal(canTransition('PARCEL','NEW','CONTACTED'),true);
 assert.equal(canTransition('PARCEL','NEW','COMPLETED'),false);
 assert.equal(canTransition('PARCEL','IN_ROUTE','READY_FOR_PICKUP'),true);
 assert.equal(canTransition('PARCEL','IN_ROUTE','OUT_FOR_DELIVERY'),true);
});

test('freight status transitions preserve agreement before movement',()=>{
 assert.equal(canTransition('FREIGHT','POSTED','CONTACTED'),true);
 assert.equal(canTransition('FREIGHT','POSTED','IN_TRANSIT'),false);
 assert.equal(canTransition('FREIGHT','ASSIGNED','IN_TRANSIT'),true);
});

test('capacity freshness labels expired data honestly',()=>{
 const now=Date.now();
 assert.equal(capacityFreshness(new Date(now-60_000).toISOString(),new Date(now+3_600_000).toISOString(),12),'FRESH');
 assert.equal(capacityFreshness(new Date(now-13*3_600_000).toISOString(),new Date(now+3_600_000).toISOString(),12),'UPDATE_NEEDED');
 assert.equal(capacityFreshness(new Date(now-60_000).toISOString(),new Date(now-1).toISOString(),12),'EXPIRED');
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
