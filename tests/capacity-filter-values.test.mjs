import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CAPACITY_FILTER_CHOICES,capacityFilterValues,capacityFilterValue,capacityFilterParams,parseCapacityFilterValues} from '../src/lib/capacity-filter-values.js';
test('canonical group values retain scalars and deduplicate sorted bounded selections',()=>{
 assert.deepEqual(capacityFilterValues('status',' partial,EMPTY,PARTIAL '),['EMPTY','PARTIAL']);
 assert.equal(capacityFilterValue('vehicleCategory',['Pickup truck','Cargo van','Pickup truck']),'Cargo van,Pickup truck');
 assert.equal(capacityFilterValue('status',[]),'');assert.equal(parseCapacityFilterValues('', 'status'),null);
 assert.equal(parseCapacityFilterValues('EMPTY','status'),'EMPTY');
 assert.deepEqual(capacityFilterValues('locationSource',' manual,GPS,mobile,GPS '),['GPS','MANUAL','MOBILE']);
 for(const [key,value]of [['status','EMPTY,FULL'],['vehicleCategory','Cargo van,Unknown'],['loadType','FTL,'],['freshness',true],['locationSource','GPS,DEVICE_OBSCURED'],['locationSource','GPS,'],['status',['EMPTY',null]],['status','EMPTY,'.repeat(40)],['status','x'.repeat(2049)],['status',' '.repeat(2049)],['unknown','EMPTY']])assert.throws(()=>capacityFilterValues(key,value),/INVALID_CAPACITY_FILTER/);
});
test('HTTP group parsing rejects repeated keys and only the sole incompatible full/partial pair',()=>{
 assert.equal(capacityFilterParams(new URLSearchParams('loadType=PTL,FTL&status=PARTIAL')).loadType,'FTL,PTL');
 assert.equal(capacityFilterParams(new URLSearchParams('loadType=FTL&status=PARTIAL,EMPTY')).status,'EMPTY,PARTIAL');
 assert.equal(capacityFilterParams(new URLSearchParams('locationSource=MOBILE,GPS,MOBILE')).locationSource,'GPS,MOBILE');
 assert.equal(capacityFilterParams(new URLSearchParams('minAvailablePercent=40')).minAvailablePercent,'40');
 assert.equal(capacityFilterParams(new URLSearchParams('minAvailablePercent=')).minAvailablePercent,'');
 for(const value of ['0','101','040','40.5','forty','-1'])assert.throws(
  ()=>capacityFilterParams(new URLSearchParams('minAvailablePercent='+value)),/INVALID_CAPACITY_FILTER/
 );
 assert.throws(()=>capacityFilterParams(new URLSearchParams('minAvailablePercent=40&minAvailablePercent=50')),/INVALID_CAPACITY_FILTER/);
 for(const value of ['status=EMPTY&status=PARTIAL','status=PARTIAL&loadType=FTL','vehicleCategory=Cargo+van&vehicleCategory=Pickup+truck','locationSource=GPS&locationSource=MANUAL'])assert.throws(()=>capacityFilterParams(new URLSearchParams(value)),/INVALID_CAPACITY_FILTER/);
});
test('bounded configuration allowlist exactly matches the established catalog',()=>{
 const catalog=readFileSync(new URL('../src/lib/vehicle-configurations.ts',import.meta.url),'utf8').matchAll(/\{ name: '([^']+)', image:/g);
 assert.deepEqual([...CAPACITY_FILTER_CHOICES.vehicleCategory].sort(),[...catalog].map(match=>match[1]).sort());
 const migration=readFileSync(new URL('../supabase/migrations/168_restore_courier_configurations.sql',import.meta.url),'utf8');
 const sql=migration.match(/when 'vehicle_category' then array\[([\s\S]*?)\]/)[1];
 assert.deepEqual([...CAPACITY_FILTER_CHOICES.vehicleCategory].sort(),[...sql.matchAll(/'([^']+)'/g)].map(match=>match[1]).sort());
});
