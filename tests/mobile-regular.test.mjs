import { mobileCatalogPlace } from '../src/lib/mobile/place-projection.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { z } from 'zod';
const source = readFileSync('src/lib/mobile/regular-contract.ts', 'utf8').replace("import { z } from 'zod';", '').replace("import { mobileCatalogPlace } from './place-projection.js';", '').replaceAll('export ', '');
const { regularCommand, regularService } = new Function('z', 'mobileCatalogPlace', ts.transpile(source) + ';return {regularCommand,regularService};')(z,mobileCatalogPlace);
const vehicleId='00000000-0000-4000-8000-000000000001',expectedDriverId='00000000-0000-4000-8000-000000000002';
test('regular service requires explicit truck and current-driver expectations without accepting actor or coordinates', () => {
 const input = { action: 'SAVE', vehicleId,expectedDriverId,replaceId: null, geometry: 'ROUTE', routePlaces: [{ placeRef: 'city1' }, { placeRef: 'city2' }], areaCenterPlaceRef: '', areaBoundaryPlaces: [] };
 assert.equal(regularCommand.safeParse(input).success, true);
 for (const extra of [{ actorId: 'other' }, { geometry: 'ANYWHERE' }, { routePlaces: [{ placeRef: 'city', lat: 9, lng: 38 }] }, { replaceId: 'invalid' }]) assert.equal(regularCommand.safeParse({ ...input, ...extra }).success, false);
 for(const key of ['vehicleId','expectedDriverId']){const incomplete={...input};delete incomplete[key];assert.equal(regularCommand.safeParse(incomplete).success,false);assert.equal(regularCommand.safeParse({...input,[key]:'invalid'}).success,false);}
 const remove = { action: 'REMOVE', vehicleId,expectedDriverId,id: '00000000-0000-4000-8000-000000000003', confirm: true };
 assert.equal(regularCommand.safeParse(remove).success, true); assert.equal(regularCommand.safeParse({ ...remove, confirm: false }).success, false);
 assert.equal(regularCommand.safeParse({action:'REMOVE',id:remove.id,confirm:true}).success,false);
});
test('regular service editor projection includes catalog references but no account internals', () => {
 const projected = regularService({ corridors: [{ id: 'one',vehicle_id:vehicleId,driver_user_id:expectedDriverId, geometry: 'ROUTE', organization_id: 'secret', route_points: [{ place_ref: 'city', label: 'City', lat: 9, lng: 38, secret: 'secret' }] }] });
 assert.deepEqual(projected[0].route, [{ placeRef: 'city', label: 'City',coordinate:[38,9] }]); assert.equal(JSON.stringify(projected).includes('secret'), false);
 assert.equal(projected[0].vehicleId,vehicleId);assert.equal(projected[0].driverId,expectedDriverId);
 assert.deepEqual(regularService({corridors:[{id:'legacy',geometry:'ROUTE',route_points:[] }]}),[]);
});
