import {dateOnly} from '../src/lib/date-calendar.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { z } from 'zod';
import { trackingNextStatuses, trackingProgress } from '../src/lib/tracking-progress.js';
const source = readFileSync(new URL('../src/lib/mobile/tracking-contract.ts', import.meta.url), 'utf8').replace("import { z } from 'zod';", '').replace("import {dateOnly} from '../date-calendar.js';",'').replaceAll('export ', '');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const { createTracking, trackingCommand, trackingDetail, trackingRecovery } = new Function('z','dateOnly', compiled + '; return { createTracking, trackingCommand, trackingDetail, trackingRecovery };')(z,dateOnly);
const id = '00000000-0000-4000-8000-000000000001';
test('tracking inputs reject spoofed authority, secrets, exact location and unsupported commands', () => {
 const input = { vehicleId: id, originPlaceRef: 'origin', destinationPlaceRef: 'destination', cargoSummary: 'Cargo', customerEmail: 'test@loadgistic.local', trackingMode: 'STATUS_ONLY',expectedDeliveryDate:'2026-10-12' };
 assert.equal(createTracking.safeParse(input).success, true);
 for (const extra of [{ actor_user_id: id }, { trackingCode: 'secret' }, { trackingMode: 'INVALID' }]) assert.equal(createTracking.safeParse({ ...input, ...extra }).success, false);
 const command = { action: 'STATUS', nextStatus: 'LOADING' };
 assert.equal(trackingCommand.safeParse(command).success, true);
 for (const extra of [{ actorId: id }, { proof: { path: 'secret' } }, { nextStatus: 'CANCELLED' }, { location: { approximateLat: 9, approximateLng: 38, locationPrecisionKm: 0 } }]) assert.equal(trackingCommand.safeParse({ ...command, ...extra }).success, false);
});
test('tracking projection excludes reusable credentials, proof paths, precise coordinates and email failure details', () => {
 const raw = { id, assigned_driver_user_id: 'driver', tracking_access_code: 'secret-a', tracking_code_hash: 'secret-b', review_code_hash: 'secret-c', operational_status: 'LOADING', guest_access_active: true, events: [{ status: 'LOADING', has_proof: true, proof_storage_path: 'secret-d' }], tracking_recipients: [{ id, recipient_email: 'customer@loadgistic.local', recipient_role: 'OWNER', recipient_email_digest: 'secret-e' }], latest_location: { location_area: 'Around city', location_lat: 9, location_lng: 38, location_precision_km: 20, created_at: 'now' }, email_deliveries: [{ status: 'FAILED', last_error: 'secret-f' }] };
 const owner = trackingDetail(raw, { id: 'owner', role: 'TRANSPORTER' }, trackingNextStatuses('LOADING'));
 assert.equal(owner.canLocate, false); assert.equal(owner.recipients[0].owner, true); assert.equal(owner.events[0].hasProof, true);
 assert.equal(JSON.stringify(owner).includes('secret-'), false); assert.equal(JSON.stringify(owner).includes('location_lat'), false);
 assert.equal(trackingDetail(raw, { id: 'driver', role: 'DRIVER' }, []).canLocate, true);
 assert.equal(trackingDetail({ ...raw, operational_status: 'COMPLETED' }, { id: 'driver', role: 'DRIVER' }, []).canManageRecipients, false);
});
test('shared journey choices distinguish skipped steps and stop at terminal states', () => {
 assert.deepEqual(trackingNextStatuses('CREATED'), ['TO_PICKUP', 'LOADING', 'ISSUE']);
 assert.equal(trackingProgress('TO_PICKUP', 'LOADING', ['CREATED', 'LOADING'], trackingNextStatuses('LOADING')), 'Not recorded');
 assert.equal(trackingProgress('IN_TRANSIT', 'LOADING', ['LOADING'], trackingNextStatuses('LOADING')), 'Next');
 assert.deepEqual(trackingNextStatuses('__proto__'), []); assert.deepEqual(trackingNextStatuses('constructor'), []); assert.deepEqual(trackingNextStatuses('COMPLETED'), []); assert.deepEqual(trackingNextStatuses('CANCELLED'), []);
 const next = trackingNextStatuses('LOADING'); next.push('COMPLETED'); assert.equal(trackingNextStatuses('LOADING').includes('COMPLETED'), false);
});

test('recovery exposes a bounded editor projection without credentials or ownership fields', () => {
 const data = trackingRecovery({ id, revision: '2026-10-05T00:00:00Z', status: 'CREATED', actions: ['CORRECT', 'REASSIGN', 'CANCEL', 'GRANT_ADMIN'], tracking_access_code: 'secret', provider_organization_id: 'private', vehicles: [{ id, make: 'Isuzu', model: 'GIGA', platform_number: 'LG-1', private_data: 'secret' }] });
 assert.deepEqual(data.actions, ['CORRECT', 'REASSIGN', 'CANCEL']); assert.equal(data.vehicles[0].label, 'Isuzu · GIGA · LG-1');
 assert.equal(JSON.stringify(data).includes('secret'), false); assert.equal(JSON.stringify(data).includes('provider_organization_id'), false);
});
