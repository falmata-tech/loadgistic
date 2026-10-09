import test from 'node:test';
import assert from 'node:assert/strict';
import { foregroundTrackingDue, trackingAreaGeometry } from '../src/location/tracking-area.ts';
test('automatic tracking requires current assigned driver, all active stages, foreground, idle request and cadence', () => {
 const now = 2000000, ready = { status: 'TO_PICKUP', canLocate: true, mode: 'LOCATION_AND_STATUS', foreground: true, busy: false, lastAttempt: 0, lastUpdate: '' };
 assert.equal(foregroundTrackingDue(ready, now), true);
 for (const change of [{ canLocate: false }, { mode: 'STATUS_ONLY' }, { foreground: false }, { busy: true }, { status: 'COMPLETED' }, { status: 'CANCELLED' }, { lastAttempt: now - 599999 }, { lastUpdate: new Date(now - 599999).toISOString() }]) assert.equal(foregroundTrackingDue({ ...ready, ...change }, now), false);
 for(const status of ['CREATED','LOADING','UNLOADING','ISSUE'])assert.equal(foregroundTrackingDue({...ready,status},now),true);
 assert.equal(foregroundTrackingDue({ ...ready, status: 'IN_TRANSIT', lastAttempt: now - 600000 }, now), true);
});
test('tracking map displays the full privacy radius without an exact-location pin', () => {
 const location = { latitude: 9, longitude: 38, radius: 20, area: 'Around city', updatedAt: 'now' }, feature = trackingAreaGeometry(location);
 assert.equal(feature.geometry.type, 'Polygon'); const ring = feature.geometry.coordinates[0]; assert.equal(ring.length, 65); assert.deepEqual(ring[0], ring.at(-1));
 for (const [lng, lat] of ring) { const rad = Math.PI / 180, a = Math.sin((lat - 9) * rad / 2) ** 2 + Math.cos(9 * rad) * Math.cos(lat * rad) * Math.sin((lng - 38) * rad / 2) ** 2; assert.ok(Math.abs(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) - 20) < 0.00001); }
 for (const change of [{ latitude: NaN }, { longitude: 181 }, { radius: 0 }, { radius: 10000 }]) assert.equal(trackingAreaGeometry({ ...location, ...change }), null);
});
