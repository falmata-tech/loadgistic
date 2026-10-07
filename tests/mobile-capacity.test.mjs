import { mobileCatalogPlace } from '../src/lib/mobile/place-projection.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { z } from 'zod';
const source = readFileSync(new URL('../src/lib/mobile/capacity-contract.ts', import.meta.url), 'utf8').replace("import { z } from 'zod';", '').replace("import { mobileCatalogPlace } from './place-projection.js';", '').replaceAll('export ', '');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const { capacityCommand, projectMobileCapacity } = new Function('z', 'mobileCatalogPlace', compiled + '; return { capacityCommand, projectMobileCapacity };')(z,mobileCatalogPlace);
const id = '00000000-0000-4000-8000-000000000001';
test('native location commands reject spoofed actors, unsupported locations and precise radii', () => {
 const value = { action: 'LOCATION', vehicleId: id, approximateLat: 9, approximateLng: 38, locationPrecisionKm: 20 };
 assert.equal(capacityCommand.safeParse(value).success, true);
 for (const extra of [{ actor_user_id: id }, { approximateLat: 0 }, { approximateLng: null }, { locationPrecisionKm: 0 }, { locationPrecisionKm: 2 }, { approximateLat: Infinity }]) assert.equal(capacityCommand.safeParse({ ...value, ...extra }).success, false);
});
test('native workspace never exposes proof paths or grants owner device-location authority', () => {
 const data = { access: { can_manage_capacity: true }, vehicles: [{ id, assigned_driver: { id: 'driver', name: 'Driver' }, driver_location: { lat: 9, lng: 38, radius: 20, area: 'Around city', updatedAt: 'now' } }], capacities: [{ vehicle_id: id, status: 'EMPTY', photo_storage_path: 'secret-path', location_lat: 9, location_lng: 38 }] };
 const owner = projectMobileCapacity(data, 'owner', 'TRANSPORTER');
 assert.equal(owner.canPublish, true); assert.equal(owner.vehicles[0].canLocate, false);
 const ownDriver = projectMobileCapacity(data, 'driver', 'DRIVER'); assert.equal(ownDriver.vehicles[0].canLocate, true);
 assert.deepEqual(ownDriver.vehicles[0].location.coordinate,[38,9]);
 const json = JSON.stringify(ownDriver); for (const key of ['secret-path', 'location_lat', 'location_lng', '"lat"', '"lng"']) assert.equal(json.includes(key), false);
 assert.equal(projectMobileCapacity({ ...data, access: { can_manage_capacity: false } }, 'driver', 'DRIVER').canPublish, false);
});
test('saved approximate map coordinates validate presence, bounds and privacy radius',()=>{
 const project=driver_location=>projectMobileCapacity({vehicles:[{id,driver_location}]},'driver','DRIVER').vehicles[0].location;
 const saved={lat:9,lng:38,radius:20,updatedAt:'saved',area:'Around city'};
 assert.deepEqual(project(saved).coordinate,[38,9]);
 for(const change of [{lat:null},{lng:null},{lat:NaN},{lng:Infinity},{lat:0},{lng:0},{radius:0},{radius:2}]) assert.equal(project({...saved,...change}).coordinate,null);
 assert.deepEqual(projectMobileCapacity({vehicles:[{id}],capacities:[{vehicle_id:id,location_lat:9,location_lng:38,location_precision_km:20,location_updated_at:'saved'}]},'driver','DRIVER').vehicles[0].location.coordinate,[38,9]);
});
test('capacity publication defaults private and never accepts direct device coordinates or actor fields', () => {
 const value = { action: 'PUBLISH', vehicleId: id, status: 'EMPTY', acceptedLoads: 'FTL', availabilityGeometry: 'ROUTE', currentRoutePlaces: [{ placeRef: 'place-a' }, { placeRef: 'place-b' }], capacityAreaCenterPlaceRef: '', capacityAreaBoundaryPlaces: [], acceptsMultiPick: false, acceptsMultiDrop: false };
 assert.equal(capacityCommand.parse(value).visibility, 'PRIVATE');
 for (const extra of [{ locationSource: 'DEVICE_OBSCURED' }, { approximateLat: 9 }, { actorId: id }, { visibility: 'UNKNOWN' }]) assert.equal(capacityCommand.safeParse({ ...value, ...extra }).success, false);
});
