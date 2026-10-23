import sharp from 'sharp';
import {DEMO_TRACKING_SHIPMENT_ID} from './demo-tracking-identity.js';
export {DEMO_TRACKING_SHIPMENT_ID} from './demo-tracking-identity.js';

const PROOF_PHASES = Object.freeze({
  LOADING: {label: 'Loading', detail: 'Demonstration loading record'},
  UNLOADING: {label: 'Unloading', detail: 'Demonstration unloading record'},
});

function checkedInputs(shipmentId, phase, occurredAt) {
  if (shipmentId !== DEMO_TRACKING_SHIPMENT_ID || !Object.hasOwn(PROOF_PHASES, phase)) {
    throw new Error('DEMO_TRACKING_PROOF_SCOPE');
  }
  const date = new Date(occurredAt);
  if (!Number.isFinite(date.getTime())) throw new Error('DEMO_TRACKING_PROOF_DATE');
  return {phase: PROOF_PHASES[phase], date: date.toISOString()};
}

export function demoTrackingProofSvg(shipmentId, phase, occurredAt) {
  const checked = checkedInputs(shipmentId, phase, occurredAt);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <rect width="1200" height="800" fill="#eaf0ff"/>
    <rect x="40" y="40" width="1120" height="720" rx="32" fill="#ffffff" stroke="#17386c" stroke-width="8"/>
    <rect x="40" y="40" width="1120" height="125" rx="32" fill="#132e5b"/>
    <rect x="40" y="125" width="1120" height="40" fill="#132e5b"/>
    <text x="95" y="120" fill="#ffffff" font-family="Arial,sans-serif" font-size="52" font-weight="700">LOADGISTIC · DEMO</text>
    <text x="100" y="260" fill="#132e5b" font-family="Arial,sans-serif" font-size="64" font-weight="700">${checked.phase.label} proof</text>
    <text x="100" y="330" fill="#355a99" font-family="Arial,sans-serif" font-size="33">${checked.phase.detail}</text>
    <rect x="95" y="388" width="1010" height="135" rx="20" fill="#dce7ff"/>
    <text x="130" y="472" fill="#0f3475" font-family="Arial,sans-serif" font-size="54" font-weight="700">DEMO — NO REAL CARGO</text>
    <text x="100" y="610" fill="#273c5f" font-family="Arial,sans-serif" font-size="30">Synthetic shipment · ${DEMO_TRACKING_SHIPMENT_ID}</text>
    <text x="100" y="665" fill="#52627c" font-family="Arial,sans-serif" font-size="28">Recorded ${checked.date}</text>
    <text x="100" y="716" fill="#52627c" font-family="Arial,sans-serif" font-size="25">Illustrative record. Not evidence of transport or delivery.</text>
  </svg>`;
}

// This only prepares bytes for the existing quarantine/scanning upload path.
// Calling it never writes a proof object or changes a shipment.
export async function demoTrackingProofFile(shipmentId, phase, occurredAt) {
  const svg = demoTrackingProofSvg(shipmentId, phase, occurredAt);
  const bytes = await sharp(Buffer.from(svg)).png().toBuffer();
  return {
    name: `demo-${phase.toLowerCase()}-proof.png`,
    type: 'image/png',
    size: bytes.length,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}
