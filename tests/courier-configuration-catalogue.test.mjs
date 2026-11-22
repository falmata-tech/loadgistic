import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import ts from 'typescript';
import {CAPACITY_FILTER_CHOICES,canonicalCapacityFilters} from '../src/lib/capacity-filter-values.js';
import {FEATURED_TRUCK_DAYS} from '../src/lib/featured-trucks.js';
const compiled=ts.transpileModule(readFileSync('src/lib/vehicle-configurations.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,catalogue={};
new Function('exports',compiled)(catalogue);
test('Courier car retains its artwork and fixed-body vehicle configuration',()=>{
 assert.equal(catalogue.VEHICLE_CONFIGURATIONS.length,16);
 assert.equal(new Set(catalogue.VEHICLE_CONFIGURATIONS.map(item=>item.name)).size,16);
 assert.equal(catalogue.vehicleConfigurationImage('Courier car'),'/vehicle-configurations/courier-car.jpg');
 assert.ok(existsSync('public'+catalogue.vehicleConfigurationImage('Courier car')));
 assert.equal(catalogue.isTractorTrailerConfiguration('Courier car'),false);
 assert.equal(catalogue.isTrailerVehicleConfiguration('Courier car'),false);
 assert.ok(!catalogue.VEHICLE_CONFIGURATIONS.some(item=>item.name==='Courier motorcycle'));
 assert.deepEqual(new Set(CAPACITY_FILTER_CHOICES.vehicleCategory),new Set(catalogue.VEHICLE_CONFIGURATIONS.map(item=>item.name)));
});
test('courier multi-filters compose with source, status and legacy API load choices without accepting aliases',()=>{
 assert.deepEqual(canonicalCapacityFilters({vehicleCategory:['Courier car','Cargo van','Courier car'],status:['EMPTY','PARTIAL'],loadType:'PTL',locationSource:'MOBILE,GPS'}),{vehicleCategory:'Cargo van,Courier car',status:'EMPTY,PARTIAL',loadType:'PTL',stopOption:'',freshness:'',locationSource:'GPS,MOBILE',minAvailablePercent:''});
 for(const name of ['Courier motorcycle','Cargo van,Courier motorcycle','Motorcycle','Courier Car','Courier bicycle','Courier car,Unknown'])assert.throws(()=>canonicalCapacityFilters({vehicleCategory:name}),/INVALID_CAPACITY_FILTER/);
});
test('every restored courier label is localized while theme keys and seven-day order stay stable',()=>{
 assert.deepEqual(FEATURED_TRUCK_DAYS.map(theme=>theme.key),['mini-trucks','cargo-vans','pickups','light-duty','medium-duty','heavy-trucks','mixed-trucks']);
 for(const locale of ['am','om']){
  const messages=JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
  for(const key of ['Courier car','Vans and couriers','Vans & couriers'])assert.ok(messages[key]&&messages[key]!==key);
 }
});
