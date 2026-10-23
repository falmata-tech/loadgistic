import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSession } from '../src/session/contract.ts';
const session = { accessToken: 'test-access', refreshToken: 'test-refresh', expiresAt: 2000000000, state: 'ACTIVE', user: { id: 'driver-id', name: 'Test Driver', email: 'test@loadgistic.local', role: 'DRIVER', organizationName: null, businessName: 'Test transport', operatingModel: 'OWNER_OPERATOR' }, access: { granted: true, status: 'TRIAL' } };
test('native session requires a complete valid identity and authorization projection', () => {
 for (const change of [{ expiresAt: NaN }, { accessToken: '' }, { access: {} }, { state: 'UNKNOWN' }, { user: { ...session.user, email: undefined } }, { user: { ...session.user, role: 'ADMIN' } }, { user: { ...session.user, role: 'SUPPORT' } }]) assert.throws(() => parseSession({ ...session, ...change }));
});
test('session projection discards unexpected fields and does not promote onboarding access', () => {
 const parsed = parseSession({ ...session, privateStorageKey: 'never-copy', user: { ...session.user, staffPermissions: ['ALL'] } });
 assert.deepEqual(parsed, session);
 assert.equal(parseSession({ ...session, state: 'ONBOARDING' }).access, null);
});
