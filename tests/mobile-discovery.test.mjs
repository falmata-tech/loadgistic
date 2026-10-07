import test from 'node:test';
import assert from 'node:assert/strict';
import { discoveryFilters,discoveryProfiles } from '../src/lib/mobile/discovery-contract.js';
test('native discovery rejects caller-selected authority and ambiguous filters',()=>{
 for(const query of ['view=loadgistic','digest=secret','q=a&q=b','status=FULL','loadType=FTL&status=PARTIAL','nearLat=9','nearLat=9&nearLng=38&truckCityPlaceRef=city','page=1.5','ownerDocs=VEHICLE_OWNERSHIP','truckDocs=VEHICLE_OWNERSHIP,VEHICLE_OWNERSHIP','nearRadiusKm=Infinity']) assert.throws(()=>discoveryFilters(new URLSearchParams(query)));
 assert.throws(()=>discoveryFilters(new URLSearchParams({q:'x'.repeat(121)})));
 const filters=discoveryFilters(new URLSearchParams('q=Adama&status=EMPTY&loadType=FTL&ownerDocs=IDENTITY,BUSINESS_LICENSE&truckCityPlaceRef=city&truckLocationRadiusKm=50'));
 assert.equal(filters.q,'Adama');assert.equal(filters.ownerDocs,'IDENTITY,BUSINESS_LICENSE');assert.equal(filters.truckLocationRadiusKm,'50');
});
test('profile projection cannot leak private source fields or return standalone trucks',()=>{
 const result=discoveryProfiles({items:[{key:'a',kind:'COMPANY',title:'A',matching_trucks:2,capacity_id:'not-company-marker',email:'private',staff_notes:'secret'}, {kind:'TRUCK',matching_trucks:1},{kind:'COMPANY',matching_trucks:0}],total:1,page:1,pageSize:15,hasMore:false});
 assert.equal(result.items.length,1);assert.equal(result.items[0].capacityId,'');assert.equal(result.items[0].matchingTrucks,2);assert.equal(JSON.stringify(result).includes('secret'),false);assert.equal('email' in result.items[0],false);
 assert.throws(()=>discoveryProfiles({filterError:'bad place'}));
});
