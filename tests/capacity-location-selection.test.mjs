import test from 'node:test';
import assert from 'node:assert/strict';
import {capacityLocationSource,selectedCapacityLocation} from '../src/lib/capacity-location-selection.js';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {z} from 'zod';
import {mobileCatalogPlace} from '../src/lib/mobile/place-projection.js';
import {capacityLoadPreference} from '../src/lib/capacity-load-preferences.js';
import {isValidCoordinate} from '../src/lib/location-privacy.js';
import {phoneInstallationProof} from '../src/lib/phone-location-contract.js';
import {locationSourceKind} from '../src/lib/location-source.js';
const source=readFileSync('src/lib/mobile/capacity-contract.ts','utf8').replace(/^import .*;$/gm,'').replaceAll('export ','');
const {projectMobileCapacity}=new Function('capacityLocationSource','selectedCapacityLocation','z','mobileCatalogPlace','capacityLoadPreference','isValidCoordinate','phoneInstallationProof','locationSourceKind','regularService',ts.transpile(source)+';return {projectMobileCapacity};')(capacityLocationSource,selectedCapacityLocation,z,mobileCatalogPlace,capacityLoadPreference,isValidCoordinate,phoneInstallationProof,locationSourceKind,()=>[]);
const point=(hour,area)=>({lat:9,lng:38,radius:20,updatedAt:`2026-10-15T${hour}:00:00Z`,area});
test('GPS/manual publication is not replaced by newer unselected phone or captured positions',()=>{
 const published=point('10','Published'),phone=point('12','Phone'),captured=point('13','Captured');
 for(const source of ['GPS','MANUAL'])assert.equal(selectedCapacityLocation({selection:{source},published,phone,captured}),published);
 assert.equal(selectedCapacityLocation({selection:{source:'GPS'},phone,captured}),null);
});
test('switching back to phone waits for a report after selection and preserves published history',()=>{
 const published=point('10','Published'),phone=point('11','Old phone'),fresh=point('13','Fresh phone');
 const selection={source:'MOBILE',selectedAt:'2026-10-15T12:00:00Z'};
 assert.equal(selectedCapacityLocation({selection,published,phone}),published);
 assert.equal(selectedCapacityLocation({selection,published,phone,captured:fresh}),fresh);
 assert.equal(capacityLocationSource(null),'MOBILE');
 assert.equal(selectedCapacityLocation({published,phone}),phone);
});
test('authorized mobile workspace gates phone capture and projects the selected published location',()=>{
 const workspace={access:{can_manage_capacity:true},vehicles:[{id:'truck',assigned_driver:{id:'driver'},driver_location:point('12','Phone'),location_selection:{source:'GPS'}}],capacities:[{vehicle_id:'truck',location_lat:8,location_lng:37,location_precision_km:20,location_updated_at:point('10').updatedAt,location_area:'GPS area'}]};
 let truck=projectMobileCapacity(workspace,'driver','DRIVER').vehicles[0];
 assert.equal(truck.canLocate,false);assert.equal(truck.location.area,'GPS area');assert.deepEqual(truck.location.coordinate,[37,8]);
 workspace.vehicles[0].location_selection={source:'MOBILE',selectedAt:point('13').updatedAt};
 truck=projectMobileCapacity(workspace,'driver','DRIVER').vehicles[0];assert.equal(truck.canLocate,true);assert.equal(truck.location.area,'GPS area');
 workspace.vehicles[0].driver_location=point('14','Fresh phone');
 assert.equal(projectMobileCapacity(workspace,'driver','DRIVER').vehicles[0].location.area,'Fresh phone');
});
