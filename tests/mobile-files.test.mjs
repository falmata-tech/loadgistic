import test from 'node:test';
import assert from 'node:assert/strict';
import { readMobileMultipart, mobileUploadBodyLimit, privateFilePayload, projectVerificationCenter } from '../src/lib/mobile/file-contract.js';
const upload = (extra) => { const form = new FormData(); form.append('command', JSON.stringify({ action: 'STATUS' })); form.append('file', new Blob(['test'], { type: 'image/png' }), 'proof.png'); extra?.(form); return new Request('http://localhost/upload', { method: 'POST', body: form }); };
test('multipart allows one bounded command and one file, rejecting ambiguous or injected fields', async () => {
 const valid = await readMobileMultipart(upload()); assert.equal(valid.command.action, 'STATUS'); assert.equal(valid.file.size, 4);
 for (const mutate of [form => form.append('command', '{}'), form => form.append('actorId', 'other'), form => form.append('file', new Blob(['x']), 'other.png'), form => form.set('command', '[]'), form => form.set('command', '{'), form => form.set('file', 'storage/path')]) await assert.rejects(readMobileMultipart(upload(mutate)), /INVALID_UPLOAD/);
 await assert.rejects(readMobileMultipart(new Request('http://localhost', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })), /MULTIPART_REQUIRED/);
 await assert.rejects(readMobileMultipart(new Request('http://localhost', { method: 'POST', body: 'broken', headers: { 'Content-Type': 'multipart/form-data; boundary=foo' } })), /INVALID_UPLOAD/);
});
test('chunked upload cap is enforced independently of Content-Length', async () => {
 let cancelled = false; const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(mobileUploadBodyLimit + 1)); }, cancel() { cancelled = true; } });
 await assert.rejects(readMobileMultipart(new Request('http://localhost', { method: 'POST', body: stream, duplex: 'half', headers: { 'Content-Type': 'multipart/form-data; boundary=foo', 'Content-Length': '1' } })), /FILE_TOO_LARGE/); assert.equal(cancelled, true);
 await assert.rejects(readMobileMultipart(upload(form => form.set('file', new Blob([new Uint8Array(4 * 1024 * 1024 + 1)]), 'large.pdf'))), /FILE_TOO_LARGE/);
});
test('private projections exclude storage references and reject executable or excessive file payloads', () => {
 const secret = 'PRIVATE-STORAGE', center = projectVerificationCenter({ subjects: [{ subject_id: 'one', subject_type: 'VEHICLE', storage_path: secret, vehicles: [{ id: 'truck', label: 'Truck', secret }], badges: [{ type: 'VEHICLE_OWNERSHIP', verified: true, secret }] }], requests: [{ id: 'two', storage_path: secret, original_name: secret, review_note: 'Review note' }] });
 assert.equal(JSON.stringify(center).includes(secret), false); assert.equal(center.subjects[0].badges[0].verified, true); assert.equal(center.requests[0].note, 'Review note');
 assert.deepEqual(privateFilePayload(Buffer.from('test'), 'image/png'), { mimeType: 'image/png', base64: 'dGVzdA==' });
 for (const [bytes, type] of [[null, 'image/png'], [Buffer.from('x'), 'text/html'], [Buffer.alloc(4 * 1024 * 1024 + 1), 'application/pdf']]) assert.throws(() => privateFilePayload(bytes, type), /FILE_UNAVAILABLE/);
});
