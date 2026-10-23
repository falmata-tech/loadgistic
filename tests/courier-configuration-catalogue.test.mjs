import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import ts from 'typescript';
import {CAPACITY_FILTER_CHOICES,canonicalCapacityFilters} from '../src/lib/capacity-filter-values.js';
import {FEATURED_TRUCK_DAYS} from '../src/lib/featured-trucks.js';
const compiled=ts.transpileModule(readFileSync('src/lib/vehicle-configurations.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,catalogue={};
new Function('exports',compiled)(catalogue);
test('restored courier configurations have their own existing map/picker artwork and stay fixed bodies',()=>{
 assert.equal(catalogue.VEHICLE_CONFIGURATIONS.length,17);
 assert.equal(new Set(catalogue.VEHICLE_CONFIGURATIONS.map(item=>item.name)).size,17);
 for(const [name,path]of [['Courier car','courier-car.jpg'],['Courier motorcycle','courier-motorcycle.jpg']]){
  assert.equal(catalogue.vehicleConfigurationImage(name),'/vehicle-configurations/'+path);
  assert.ok(existsSync('public'+catalogue.vehicleConfigurationImage(name)));
  assert.equal(catalogue.isTractorTrailerConfiguration(name),false);assert.equal(catalogue.isTrailerVehicleConfiguration(name),false);
 }
 assert.deepEqual(new Set(CAPACITY_FILTER_CHOICES.vehicleCategory),new Set(catalogue.VEHICLE_CONFIGURATIONS.map(item=>item.name)));
});
test('courier multi-filters compose with source, status and legacy API load choices without accepting aliases',()=>{
 assert.deepEqual(canonicalCapacityFilters({vehicleCategory:['Courier motorcycle','Courier car','Courier car'],status:['EMPTY','PARTIAL'],loadType:'PTL',locationSource:'MOBILE,GPS'}),{vehicleCategory:'Courier car,Courier motorcycle',status:'EMPTY,PARTIAL',loadType:'PTL',stopOption:'',freshness:'',locationSource:'GPS,MOBILE'});
 for(const name of ['Motorcycle','Courier Car','Courier bicycle','Courier car,Unknown'])assert.throws(()=>canonicalCapacityFilters({vehicleCategory:name}),/INVALID_CAPACITY_FILTER/);
});
test('every restored courier label is localized while theme keys and seven-day order stay stable',()=>{
 assert.deepEqual(FEATURED_TRUCK_DAYS.map(theme=>theme.key),['mini-trucks','cargo-vans','pickups','light-duty','medium-duty','heavy-trucks','mixed-trucks']);
 for(const locale of ['am','om']){
  const messages=JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
  for(const key of ['Courier car','Courier motorcycle','Vans and couriers','Vans & couriers'])assert.ok(messages[key]&&messages[key]!==key);
 }
});
