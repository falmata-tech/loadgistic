import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, readApiResponse } from '../src/api/response.ts';
test('empty and HTML success responses become safe service failures', async () => {
 for (const response of [new Response(''), new Response('<html>proxy</html>', { headers: { 'Content-Type': 'text/html' } }), new Response('', { headers: { 'Content-Type': 'application/json' } }), Response.json(null)]) {
  await assert.rejects(readApiResponse(response), error => error instanceof ApiError && error.status === 503 && error.code === 'INVALID_RESPONSE');
 }
});
test('valid unauthorized response preserves the authorization failure', async () => {
 await assert.rejects(readApiResponse(Response.json({ error: { code: 'SIGN_IN_REQUIRED', message: 'Please sign in again.' } }, { status: 401 })), error => error.status === 401 && error.code === 'SIGN_IN_REQUIRED');
});
test('valid object payload is returned', async () => { assert.deepEqual(await readApiResponse(Response.json({ ok: true })), { ok: true }); });
