import test from 'node:test';
import assert from 'node:assert/strict';
import { capacityLocation, privacyRadii } from '../src/location/privacy.ts';
import { obscureCoordinate } from '../../../src/lib/location-privacy.js';
test('native location uses the shared web privacy function and exposes only an obscured command', () => {
 for (const radius of privacyRadii) {
  const exact = { lat: 9.03, lng: 38.74 }, expected = obscureCoordinate(exact.lat, exact.lng, radius);
  const result = capacityLocation(exact.lat, exact.lng, 10, radius);
  assert.deepEqual(result, { approximateLat: expected.lat, approximateLng: expected.lng, locationPrecisionKm: radius });
  assert.notEqual(result.approximateLat, exact.lat); assert.notEqual(result.approximateLng, exact.lng);
 }
});
test('unsupported, unavailable or too-inaccurate fixes never become capacity commands', () => {
 for (const input of [[0, 0, 10, 20], [9, 38, null, 20], [NaN, 38, 10, 20], [9, 38, 50000, 20], [9, 38, 10, 2]]) assert.throws(() => capacityLocation(...input));
});
