import assert from 'node:assert/strict';
import test from 'node:test';
import { requestMobileOtp } from '../src/lib/mobile/otp-delivery.ts';

test('a native code handoff requires an explicit Auth acceptance', async () => {
  assert.equal(await requestMobileOtp(async () => ({ data: { user: null }, error: null })), 'SENT');
  assert.equal(await requestMobileOtp(async () => ({ error: undefined })), 'UNAVAILABLE');
  assert.equal(await requestMobileOtp(async () => null), 'UNAVAILABLE');
});

test('Auth rate limits and outages remain bounded without disclosing provider errors', async () => {
  const secret = new Error('internal provider details and recipient');
  assert.equal(await requestMobileOtp(async () => ({ error: Object.assign(secret, { status: 429 }) })), 'WAIT');
  assert.equal(await requestMobileOtp(async () => ({ error: secret })), 'WAIT');
  assert.equal(await requestMobileOtp(async () => { throw Object.assign(new Error('provider unavailable'), { status: 503 }); }), 'UNAVAILABLE');
  assert.equal(await requestMobileOtp(async () => { throw new Error('network failed'); }), 'UNAVAILABLE');
});
