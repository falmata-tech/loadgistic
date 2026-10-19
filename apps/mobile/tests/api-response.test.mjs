import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, readApiResponse } from '../src/api/response.ts';
test('empty and HTML success responses become safe service failures', async () => {
 for (const response of [new Response(''), new Response('<html>proxy</html>', { headers: { 'Content-Type': 'text/html' } }), new Response('', { headers: { 'Content-Type': 'application/json' } }), Response.json(null)]) {
  await assert.rejects(readApiResponse(response), error => error instanceof ApiError && error.status === 503 && error.code === 'INVALID_RESPONSE');
 }
});
for (const [name, message] of [['empty', ''], ['whitespace', ' \t\n '], ['overlong', 'x'.repeat(501)], ['missing', undefined], ['non-string', 42]]) {
 test(`${name} API failure messages retain a meaningful recoverable error`, async () => {
  await assert.rejects(readApiResponse(Response.json({ error: { code: 'UNAVAILABLE', message } }, { status: 503 })), error => {
   assert.ok(error instanceof ApiError);
   assert.equal(error.status, 503);
   assert.equal(error.code, 'UNAVAILABLE');
   assert.equal(error.message, 'Please try again.');
   return true;
  });
 });
}
test('valid unauthorized response preserves its code, status and nonempty message', async () => {
 for (const message of ['Please sign in again.', '  Please sign in again. \n']) {
  await assert.rejects(readApiResponse(Response.json({ error: { code: 'SIGN_IN_REQUIRED', message } }, { status: 401 })), error => {
   assert.equal(error.status, 401);
   assert.equal(error.code, 'SIGN_IN_REQUIRED');
   assert.equal(error.message, 'Please sign in again.');
   return true;
  });
 }
});
test('valid object payload is returned', async () => { assert.deepEqual(await readApiResponse(Response.json({ ok: true })), { ok: true }); });
test('only an explicit bounded response policy accepts successful search arrays',async()=>{
 await assert.rejects(readApiResponse(Response.json([])),error=>error.code==='INVALID_RESPONSE');
 assert.deepEqual(await readApiResponse(Response.json([]),{allowArray:true}),[]);
 await assert.rejects(readApiResponse(Response.json([],{status:403}),{allowArray:true}),error=>error.code==='INVALID_RESPONSE');
});
