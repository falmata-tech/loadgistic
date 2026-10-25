import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalRouteGeometry,coverageBounds,coverageGeometry} from '../src/map/coverage-preview.ts';
import {mobileCatalogPlace} from '../../../src/lib/mobile/place-projection.js';
const places=[{placeRef:'a',coordinate:[38,9]},{placeRef:'b',coordinate:[39,9]},{placeRef:'c',coordinate:[39,10]}];
test('catalog projection exposes only city reference, label and valid coordinates',()=>{
 assert.deepEqual(mobileCatalogPlace({place_ref:'a',label:'City',lat:9,lng:38,phone:'private',secret:'private'}),{placeRef:'a',label:'City',coordinate:[38,9]});
 for(const extra of [{lat:null},{lat:'9'},{lng:Infinity},{lng:181}])assert.equal(mobileCatalogPlace({lat:9,lng:38,...extra}).coordinate,null);
});
test('coverage preview preserves route order and closes a complete area without mutating city choices',()=>{
 const before=structuredClone(places);
 assert.deepEqual(coverageGeometry('ROUTE',places).geometry.coordinates,[[38,9],[39,9],[39,10]]);
 const area=coverageGeometry('RADIUS',places);assert.deepEqual(area.geometry.coordinates[0],[[38,9],[39,9],[39,10],[38,9]]);
 assert.deepEqual(places,before);assert.deepEqual(coverageBounds(area),[37.99,8.99,39.01,10.01]);
});
test('opposite-direction corridor routes use one display direction without changing saved stops',()=>{
 const forward=coverageGeometry('ROUTE',places);
 const reversed=coverageGeometry('ROUTE',[...places].reverse());
 const before=structuredClone(reversed);
 assert.deepEqual(canonicalRouteGeometry(reversed).geometry.coordinates,canonicalRouteGeometry(forward).geometry.coordinates);
 assert.deepEqual(reversed,before,'the map-only lane must not alter source coordinates');
 const area=coverageGeometry('RADIUS',places);
 assert.equal(canonicalRouteGeometry(area),area);
});
test('coverage preview never draws across a missing or invalid middle city',()=>{
 for(const kind of ['ROUTE','RADIUS'])for(const middle of [{placeRef:'missing'},{placeRef:'b',coordinate:[NaN,9]},{placeRef:'b',coordinate:[0,91]},{placeRef:'',coordinate:[39,9]}])assert.equal(coverageGeometry(kind,[places[0],middle,places[2]]),null);
 assert.equal(coverageGeometry('RADIUS',places.slice(0,2)),null);
 assert.equal(coverageGeometry('RADIUS',[places[0],places[1],{placeRef:'c',coordinate:[40,9]}]),null);
 assert.equal(coverageGeometry('ROUTE',[places[0],places[0]]),null);
 assert.equal(coverageGeometry('OTHER',places),null);
});
