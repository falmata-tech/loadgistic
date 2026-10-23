// Exact, fixture-only presentation marker. It does not grant access or
// authorize a simulated shipment to be created or advanced.
export const DEMO_TRACKING_SHIPMENT_ID = '2cb3ecbd-e627-485d-99cc-7c9ae5d641bc';
export const DEMO_TRACKING_LIVE_SHIPMENT_ID = 'ab8e45be-d878-4aad-a9d9-32e0e64c991a';

export function isDemoTrackingShipment(id) {
  return id === DEMO_TRACKING_SHIPMENT_ID || id === DEMO_TRACKING_LIVE_SHIPMENT_ID;
}

const LABELS = Object.freeze({
  shipment: 'Demo · no real cargo',
  event: 'Demo update',
  proof: 'Demo proof',
  approval: 'Demo approval',
});

export function demoTrackingLabel(kind) {
  if (!Object.hasOwn(LABELS, kind)) throw new Error('DEMO_TRACKING_LABEL_INVALID');
  return LABELS[kind];
}
