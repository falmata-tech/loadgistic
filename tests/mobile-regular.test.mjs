import { mobileCatalogPlace } from '../src/lib/mobile/place-projection.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { z } from 'zod';
const source = readFileSync('src/lib/mobile/regular-contract.ts', 'utf8').replace("import { z } from 'zod';", '').replace("import { mobileCatalogPlace } from './place-projection.js';", '').replaceAll('export ', '');
const { regularCommand, regularService } = new Function('z', 'mobileCatalogPlace', ts.transpile(source) + ';return {regularCommand,regularService};')(z,mobileCatalogPlace);
test('regular service rejects client ownership, coordinates and unconfirmed removal', () => {
 const input = { action: 'SAVE', replaceId: null, geometry: 'ROUTE', routePlaces: [{ placeRef: 'city1' }, { placeRef: 'city2' }], areaCenterPlaceRef: '', areaBoundaryPlaces: [] };
 assert.equal(regularCommand.safeParse(input).success, true);
 for (const extra of [{ actorId: 'other' }, { geometry: 'ANYWHERE' }, { routePlaces: [{ placeRef: 'city', lat: 9, lng: 38 }] }, { replaceId: 'invalid' }]) assert.equal(regularCommand.safeParse({ ...input, ...extra }).success, false);
 const remove = { action: 'REMOVE', id: '00000000-0000-4000-8000-000000000001', confirm: true };
 assert.equal(regularCommand.safeParse(remove).success, true); assert.equal(regularCommand.safeParse({ ...remove, confirm: false }).success, false);
});
test('regular service editor projection includes catalog references but no account internals', () => {
 const projected = regularService({ corridors: [{ id: 'one', geometry: 'ROUTE', organization_id: 'secret', route_points: [{ place_ref: 'city', label: 'City', lat: 9, lng: 38, secret: 'secret' }] }] });
 assert.deepEqual(projected[0].route, [{ placeRef: 'city', label: 'City',coordinate:[38,9] }]); assert.equal(JSON.stringify(projected).includes('secret'), false);
});
