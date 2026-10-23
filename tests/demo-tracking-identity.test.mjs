import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEMO_TRACKING_SHIPMENT_ID,
  DEMO_TRACKING_LIVE_SHIPMENT_ID,
  demoTrackingLabel,
  isDemoTrackingShipment,
} from '../src/lib/demo-tracking-identity.js';

test('only the two reserved synthetic shipments carry a Demo marker', () => {
  assert.equal(isDemoTrackingShipment(DEMO_TRACKING_SHIPMENT_ID), true);
  assert.equal(isDemoTrackingShipment(DEMO_TRACKING_LIVE_SHIPMENT_ID), true);
  assert.equal(isDemoTrackingShipment('a641aca2-f550-4960-94a9-7c1de9e4cd56'), false);
  assert.equal(isDemoTrackingShipment(DEMO_TRACKING_SHIPMENT_ID.toUpperCase()), false);
  assert.equal(isDemoTrackingShipment(undefined), false);
});

test('shipment, event, proof and approval markers remain explicit', () => {
  assert.equal(demoTrackingLabel('shipment'), 'Demo · no real cargo');
  assert.equal(demoTrackingLabel('event'), 'Demo update');
  assert.equal(demoTrackingLabel('proof'), 'Demo proof');
  assert.equal(demoTrackingLabel('approval'), 'Demo approval');
  assert.throws(() => demoTrackingLabel('truck'), /DEMO_TRACKING_LABEL_INVALID/);
});
