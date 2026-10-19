import test from 'node:test';
import assert from 'node:assert/strict';
import {statusLocationOrNull} from '../src/lib/provider-tracking/status-location.js';

const blank={locationArea:'',approximateLat:'',approximateLng:'',locationPrecisionKm:'',locationSource:''};

test('status-only Loading and Unloading omit absent location data',()=>{
  assert.equal(statusLocationOrNull(blank),null);
  assert.equal(statusLocationOrNull(null),null);
  assert.equal(statusLocationOrNull({...blank,locationArea:'  '}),null);
});

test('complete and partial location input still reaches strict database validation',()=>{
  const complete={...blank,locationArea:'Around Addis Ababa',approximateLat:'9',approximateLng:'38.7',locationPrecisionKm:'3',locationSource:'DEVICE_OBSCURED'};
  assert.equal(statusLocationOrNull(complete),complete);
  const partial={...blank,approximateLat:'9'};
  assert.equal(statusLocationOrNull(partial),partial);
  const zero={...blank,approximateLat:'0'};
  assert.equal(statusLocationOrNull(zero),zero);
});
