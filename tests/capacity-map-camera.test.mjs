import assert from 'node:assert/strict';
import test from 'node:test';
import {DEFAULT_CAPACITY_CAMERA,initialCapacityCamera} from '../src/lib/map-initial-camera.js';

test('an isolated distant signal cannot pull the initial market view away from its dense cluster',()=>{
 const result=initialCapacityCamera([
  {latitude:9,longitude:38.7},{latitude:9.1,longitude:38.8},{latitude:8.9,longitude:39},
  {latitude:9.2,longitude:39.1},{latitude:41.88,longitude:-87.63}
 ]);
 assert.ok(result.latitude>8&&result.latitude<10);
 assert.ok(result.longitude>38&&result.longitude<40);
 assert.equal(result.zoom,DEFAULT_CAPACITY_CAMERA.zoom);
});

test('one market signal is centered instead of falling back to Ethiopia',()=>{
 assert.deepEqual(initialCapacityCamera([{latitude:41.88,longitude:-87.63}]),{latitude:41.88,longitude:-87.63,zoom:6});
});

test('map adapters can preserve the same cluster while matching their tile scale',()=>{
 const fallback={...DEFAULT_CAPACITY_CAMERA,zoom:5};
 assert.deepEqual(initialCapacityCamera([{latitude:41.88,longitude:-87.63}],{zoom:5,fallback}),{latitude:41.88,longitude:-87.63,zoom:5});
 assert.deepEqual(initialCapacityCamera([],{zoom:5,fallback}),fallback);
});

test('zero coordinates are valid and malformed/out-of-world points are ignored',()=>{
 assert.deepEqual(initialCapacityCamera([
  {latitude:0,longitude:0},{latitude:91,longitude:0},{latitude:0,longitude:181},null
 ]),{latitude:0,longitude:0,zoom:6});
});

test('neighborhood distance wraps across the antimeridian',()=>{
 const result=initialCapacityCamera([
  {latitude:10,longitude:179},{latitude:10.1,longitude:-179.5},{latitude:10.2,longitude:178.8},
  {latitude:-20,longitude:30}
 ]);
 assert.ok(result.latitude>9&&result.latitude<11);
 assert.ok(Math.abs(result.longitude)>178);
});

test('empty results retain the stable market fallback and tie resolution is order independent',()=>{
 assert.deepEqual(initialCapacityCamera([]),DEFAULT_CAPACITY_CAMERA);
 const points=[{latitude:9,longitude:39},{latitude:41,longitude:-74}];
 assert.deepEqual(initialCapacityCamera(points),initialCapacityCamera([...points].reverse()));
});
