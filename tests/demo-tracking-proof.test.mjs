import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {
  DEMO_TRACKING_SHIPMENT_ID,
  demoTrackingProofFile,
  demoTrackingProofSvg,
} from '../src/lib/demo-tracking-proof.js';

const recordedAt = '2026-10-22T12:00:00.000Z';

test('each exact synthetic phase yields a distinct visibly marked PNG for the private proof upload', async () => {
  const files = await Promise.all(['LOADING', 'UNLOADING'].map(phase =>
    demoTrackingProofFile(DEMO_TRACKING_SHIPMENT_ID, phase, recordedAt)));
  assert.notEqual(files[0].name, files[1].name);
  const buffers = await Promise.all(files.map(async file => Buffer.from(await file.arrayBuffer())));
  assert.notDeepEqual(buffers[0], buffers[1]);
  for (const [index, file] of files.entries()) {
    assert.equal(file.type, 'image/png');
    assert.equal(file.size, buffers[index].length);
    assert.equal(buffers[index].subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const metadata = await sharp(buffers[index]).metadata();
    assert.equal(metadata.width, 1200);
    assert.equal(metadata.height, 800);
    assert.match(demoTrackingProofSvg(DEMO_TRACKING_SHIPMENT_ID,
      index === 0 ? 'LOADING' : 'UNLOADING', recordedAt), /DEMO — NO REAL CARGO/);
    assert.match(demoTrackingProofSvg(DEMO_TRACKING_SHIPMENT_ID,
      index === 0 ? 'LOADING' : 'UNLOADING', recordedAt), /Not evidence of transport or delivery/);
  }
});

test('proof fixture refuses imported shipment, arbitrary target, phase and timestamp', async () => {
  for (const id of ['a641aca2-f550-4960-94a9-7c1de9e4cd56', crypto.randomUUID()]) {
    await assert.rejects(demoTrackingProofFile(id, 'LOADING', recordedAt), /DEMO_TRACKING_PROOF_SCOPE/);
  }
  await assert.rejects(demoTrackingProofFile(DEMO_TRACKING_SHIPMENT_ID, 'COMPLETE', recordedAt),
    /DEMO_TRACKING_PROOF_SCOPE/);
  await assert.rejects(demoTrackingProofFile(DEMO_TRACKING_SHIPMENT_ID, 'LOADING', 'bad-date'),
    /DEMO_TRACKING_PROOF_DATE/);
});
