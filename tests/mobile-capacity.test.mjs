import {phoneInstallationProof} from '../src/lib/phone-location-contract.js';
import {locationSourceKind} from '../src/lib/location-source.js';
import {capacityLocationSource,selectedCapacityLocation} from '../src/lib/capacity-location-selection.js';
import {capacityLoadPreference} from '../src/lib/capacity-load-preferences.js';
import {isValidCoordinate} from '../src/lib/location-privacy.js';
import { mobileCatalogPlace } from '../src/lib/mobile/place-projection.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { z } from 'zod';
const regularSource=readFileSync('src/lib/mobile/regular-contract.ts','utf8').replace("import { z } from 'zod';",'').replace("import { mobileCatalogPlace } from './place-projection.js';",'').replaceAll('export ','');
const {regularService}=new Function('z','mobileCatalogPlace',ts.transpile(regularSource)+';return {regularService};')(z,mobileCatalogPlace);
const source = readFileSync(new URL('../src/lib/mobile/capacity-contract.ts', import.meta.url), 'utf8').replace("import { z } from 'zod';", '').replace("import { mobileCatalogPlace } from './place-projection.js';", '').replace("import { capacityLoadPreference } from '../capacity-load-preferences.js';", '').replace("import {isValidCoordinate} from '../location-privacy.js';", '').replace("import {regularService} from './regular-contract';",'').replace("import {capacityLocationSource,selectedCapacityLocation} from '../capacity-location-selection.js';",'').replace("import {phoneInstallationProof} from '../phone-location-contract.js';",'').replace("import {locationSourceKind} from '../location-source.js';",'').replaceAll('export ', '');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const { capacityCommand, projectMobileCapacity } = new Function('phoneInstallationProof','locationSourceKind','capacityLocationSource','selectedCapacityLocation','z', 'mobileCatalogPlace', 'capacityLoadPreference', 'isValidCoordinate','regularService', compiled + '; return { capacityCommand, projectMobileCapacity };')(phoneInstallationProof,locationSourceKind,capacityLocationSource,selectedCapacityLocation,z,mobileCatalogPlace,capacityLoadPreference,isValidCoordinate,regularService);
const id = '00000000-0000-4000-8000-000000000001';
test('new capacity fixes cap at20 while an actual historical40-km point remains40',()=>{
 const command={action:'LOCATION',vehicleId:id,approximateLat:9,approximateLng:38,locationPrecisionKm:20};
 assert.equal(capacityCommand.safeParse(command).success,true);assert.equal(capacityCommand.safeParse({...command,locationPrecisionKm:40}).success,false);
 const result=projectMobileCapacity({vehicles:[{id,driver_location:{lat:9,lng:38,radius:40,updatedAt:'2026-10-10T12:00:00Z'}}],capacities:[]},'driver','DRIVER');
 assert.equal(result.vehicles[0].location.radius,40);assert.deepEqual(result.vehicles[0].location.coordinate,[38,9]);
});
test('published source and demo label follow the chosen fix rather than a pending source',()=>{
 const at='2026-10-18T10:00:00Z',later='2026-10-18T11:00:00Z';
 const vehicle={id,cargo_configuration:'Mini Box Truck',location_selection:{source:'MOBILE',selectedAt:at},driver_location:{lat:9,lng:38,radius:10,updatedAt:later,location_is_demo:false,installationId:'PRIVATE_INSTALLATION',secret:'PRIVATE_SECRET'}};
 const old={vehicle_id:id,location_lat:8,location_lng:39,location_precision_km:20,location_updated_at:at,location_source:'MANUAL_ADMIN',location_is_demo:true};
 let item=projectMobileCapacity({vehicles:[vehicle],capacities:[old]},'driver','DRIVER').vehicles[0];
 assert.equal(item.publishedLocationSource,'MOBILE');assert.equal(item.locationIsDemo,false);assert.equal(item.configuration,'Mini Box Truck');assert.deepEqual(item.location.coordinate,[38,9]);
 item=projectMobileCapacity({vehicles:[{...vehicle,location_selection:{source:'GPS'}}],capacities:[old]},'driver','DRIVER').vehicles[0];
 assert.equal(item.publishedLocationSource,'MANUAL');assert.equal(item.locationIsDemo,true);
 item=projectMobileCapacity({vehicles:[vehicle],capacities:[]},'driver','DRIVER').vehicles[0];assert.equal(item.publishedLocationSource,'MOBILE');
 assert.equal(JSON.stringify(item).includes('PRIVATE_'),false);
});
test('native location commands reject spoofed actors, invalid locations and precise radii', () => {
 const value = { action: 'LOCATION', vehicleId: id, approximateLat: 9, approximateLng: 38, locationPrecisionKm: 20 };
 assert.equal(capacityCommand.safeParse(value).success, true);
 for (const extra of [{ actor_user_id: id }, { approximateLat: 91 }, { approximateLng: null }, { locationPrecisionKm: 0 }, { locationPrecisionKm: 2 }, { approximateLat: Infinity }]) assert.equal(capacityCommand.safeParse({ ...value, ...extra }).success, false);
});
test('native workspace never exposes proof paths or grants owner device-location authority', () => {
 const data = { access: { can_manage_capacity: true }, vehicles: [{ id, assigned_driver: { id: 'driver', name: 'Driver' }, driver_location: { lat: 9, lng: 38, radius: 20, area: 'Around city', updatedAt: '2026-10-15T12:00:00Z' } }], capacities: [{ vehicle_id: id, status: 'EMPTY', photo_storage_path: 'secret-path', location_lat: 9, location_lng: 38 }] };
 const owner = projectMobileCapacity(data, 'owner', 'TRANSPORTER');
 assert.equal(owner.canPublish, true); assert.equal(owner.vehicles[0].canLocate, false);
 const ownDriver = projectMobileCapacity(data, 'driver', 'DRIVER'); assert.equal(ownDriver.vehicles[0].canLocate, true);
 assert.deepEqual(ownDriver.vehicles[0].location.coordinate,[38,9]);
 const json = JSON.stringify(ownDriver); for (const key of ['secret-path', 'location_lat', 'location_lng', '"lat"', '"lng"']) assert.equal(json.includes(key), false);
 assert.equal(projectMobileCapacity({ ...data, access: { can_manage_capacity: false } }, 'driver', 'DRIVER').canPublish, false);
});
test('assigned driver retains location editor access after saving manual and can return to phone',()=>{
 const base={id,assigned_driver:{id:'driver',name:'Driver'},location_selection:{source:'MANUAL',selectedAt:'2026-10-18T12:00:00Z'},driver_location:{lat:9,lng:38,radius:10,updatedAt:'2026-10-18T11:00:00Z'}};
 const capacity={vehicle_id:id,location_lat:9.1,location_lng:38.1,location_precision_km:10,location_updated_at:'2026-10-18T12:00:00Z',location_source:'MANUAL_ADMIN'};
 const manual=projectMobileCapacity({vehicles:[base],capacities:[capacity]},'driver','DRIVER').vehicles[0];
 assert.equal(manual.selectedLocationSource,'MANUAL');assert.equal(manual.canLocate,false);
 assert.equal(manual.canSetManualLocation,true);assert.equal(manual.canSetPhoneLocation,true);
 assert.equal(manual.canLocate||manual.canSetManualLocation,true,'Driver Home must keep the location button visible after manual save');
 const phone=projectMobileCapacity({vehicles:[{...base,location_selection:{source:'MOBILE',selectedAt:'2026-10-18T13:00:00Z'}}],capacities:[capacity]},'driver','DRIVER').vehicles[0];
 assert.equal(phone.selectedLocationSource,'MOBILE');assert.equal(phone.canLocate,true);
 assert.equal(phone.canSetManualLocation,true);assert.equal(phone.canSetPhoneLocation,true);
 const provider=projectMobileCapacity({vehicles:[base],capacities:[capacity]},'owner','TRANSPORTER').vehicles[0];
 const formerDriver=projectMobileCapacity({vehicles:[base],capacities:[capacity]},'other','DRIVER').vehicles[0];
 for(const viewer of [provider,formerDriver]){assert.equal(viewer.canLocate,false);assert.equal(viewer.canSetManualLocation,false);assert.equal(viewer.canSetPhoneLocation,false);}
 const selfDrivingOwner=projectMobileCapacity({vehicles:[{...base,assigned_driver:{id:'owner',name:'Owner'}}],capacities:[capacity]},'owner','TRANSPORTER').vehicles[0];
 assert.equal(selfDrivingOwner.canSetManualLocation,true);assert.equal(selfDrivingOwner.canSetPhoneLocation,true);
});
test('saved approximate map coordinates validate presence, bounds and privacy radius',()=>{
 const project=driver_location=>projectMobileCapacity({vehicles:[{id,driver_location}]},'driver','DRIVER').vehicles[0].location;
 const saved={lat:9,lng:38,radius:20,updatedAt:'2026-10-15T12:00:00Z',area:'Around city'};
 assert.deepEqual(project(saved).coordinate,[38,9]);
 for(const change of [{lat:null},{lng:null},{lat:NaN},{lng:Infinity},{lat:91},{lng:-181},{radius:0},{radius:2}]) assert.equal(project({...saved,...change}).coordinate,null);
 assert.deepEqual(projectMobileCapacity({vehicles:[{id}],capacities:[{vehicle_id:id,location_lat:9,location_lng:38,location_precision_km:20,location_updated_at:'saved'}]},'driver','DRIVER').vehicles[0].location.coordinate,[38,9]);
});
test('capacity publication defaults private and never accepts direct device coordinates or actor fields', () => {
 const value = { action: 'PUBLISH', vehicleId: id, status: 'EMPTY', acceptedLoads: 'FTL', availabilityGeometry: 'ROUTE', currentRoutePlaces: [{ placeRef: 'place-a' }, { placeRef: 'place-b' }], capacityAreaCenterPlaceRef: '', capacityAreaBoundaryPlaces: [], acceptsMultiPick: false, acceptsMultiDrop: false };
 assert.equal(capacityCommand.parse(value).visibility, 'PRIVATE');
 assert.equal(capacityCommand.parse({...value,status:'PARTIAL',availablePercent:40}).availablePercent,40);
 assert.equal(capacityCommand.parse({...value,status:'PARTIAL',availablePercent:null}).availablePercent,null);
 assert.equal(capacityCommand.parse({...value,status:'PARTIAL'}).availablePercent,undefined);
 for(const availablePercent of [0,100,40.5,'40']) assert.equal(
  capacityCommand.safeParse({...value,status:'PARTIAL',availablePercent}).success,false
 );
 assert.equal(capacityCommand.safeParse({...value,status:'PARTIAL',availablePercent:0}).error.issues[0].path[0],
  'availablePercent');
 assert.equal(capacityCommand.safeParse({...value,availablePercent:40}).success,false);
 for (const extra of [{ locationSource: 'DEVICE_OBSCURED' }, { approximateLat: 9 }, { actorId: id }, { visibility: 'UNKNOWN' }]) assert.equal(capacityCommand.safeParse({ ...value, ...extra }).success, false);
});
test('native current capacity never presents historical Partial50 as a report',()=>{
 const vehicle={id},partial={vehicle_id:id,status:'PARTIAL',available_percent:50};
 const current=capacity=>projectMobileCapacity({vehicles:[vehicle],capacities:[capacity]},'driver','DRIVER').vehicles[0].current;
 assert.equal(current(partial).availablePercent,null);
 assert.equal(current(partial).availablePercentReportedAt,'');
 assert.equal(current({...partial,available_percent_reported_at:'2026-10-26T12:00:00Z'}).availablePercent,50);
 assert.equal(current({...partial,status:'EMPTY',available_percent_reported_at:null}).availablePercent,100);
});
test('truck regular editor data stays with the selected current-driver pair',()=>{
 const drivers=['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003'];
 const second='00000000-0000-4000-8000-000000000004';
 const signal=(name,vehicle_id,driver_user_id)=>({id:name,vehicle_id,driver_user_id,geometry:'ROUTE',route_points:[]});
 const projected=projectMobileCapacity({vehicles:[{id,assigned_driver:{id:drivers[0],name:'First'}},{id:second,assigned_driver:{id:drivers[1],name:'Second'}}],corridors:[signal('legacy'),signal('first',id,drivers[0]),signal('stale',id,drivers[1]),signal('second',second,drivers[1])]},'owner','TRANSPORTER');
 assert.equal(projected.vehicles[0].driverId,drivers[0]);assert.deepEqual(projected.vehicles[0].regularServices.map(item=>item.id),['first']);
 assert.deepEqual(projected.vehicles[1].regularServices.map(item=>item.id),['second']);
});
