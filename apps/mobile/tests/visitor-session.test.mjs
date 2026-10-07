import test from 'node:test';
import assert from 'node:assert/strict';
import { createVisitorController, parseVisitorGrant } from '../src/session/visitor-controller.ts';
const initial = 1800000000000;
function setup() {
 let now = initial; const stored = new Map(), calls = [];
 const grant = scope => ({ scope, token: 'payload.signature', startedAt: initial, issuedAt: now, expiresAt: now + 1800000 });
 const port = { now: () => now, read: async scope => stored.get(scope) || null, write: async (scope, value) => { stored.set(scope, value); }, remove: async scope => { stored.delete(scope); }, request: async (path, options) => { calls.push({ path, options }); return grant(path.includes('/tracking/') ? 'tracking' : 'capacity'); }, changed: () => {} };
 return { port, stored, calls, grant, advance: ms => { now += ms; }, controller: createVisitorController(port) };
}
test('visitor credentials reject another scope, expired grants and a tracking lifetime beyond eight hours', () => {
 const valid = { token: 'payload.signature', scope: 'tracking', startedAt: initial, expiresAt: initial + 1800000 };
 assert.equal(parseVisitorGrant(valid, 'tracking', initial).scope, 'tracking');
 for (const value of [{ ...valid, scope: 'capacity' }, { ...valid, expiresAt: initial }, { ...valid, startedAt: initial - 8 * 3600000 }, { ...valid, token: 'a.b.c' }, { ...valid, renewedAt: initial + 1 }, { ...valid, renewedAt: -1 }, { ...valid, lastActivityAt: 'invalid' }, { ...valid, lastActivityAt: -1 }]) assert.throws(() => parseVisitorGrant(value, 'tracking', initial));
});
test('logout separates scopes and late private reads cannot restore content', async () => {
 const x = setup(); await x.controller.verify('tracking', 'handoff', '123456'); await x.controller.verify('capacity', 'handoff', '123456');
 let resolve; x.port.request = () => new Promise(done => { resolve = done; });
 const reading = x.controller.request('tracking', '/api/mobile/visitor/tracking/shipments');
 await x.controller.clear('tracking'); resolve({ items: ['private'] });
 await assert.rejects(reading); assert.equal(x.controller.snapshot().tracking, null); assert.ok(x.controller.snapshot().capacity); assert.equal(x.stored.has('tracking'), false);
});
test('idle expiry clears secure storage; background never renews and hides in-flight results', async () => {
 const x = setup(); await x.controller.verify('tracking', 'handoff', '123456'); const count = x.calls.length;
 x.controller.setForeground(false); x.advance(61000); await x.controller.touch('tracking'); assert.equal(x.calls.length, count);
 await assert.rejects(x.controller.request('tracking', '/api/mobile/visitor/tracking/shipments'));
 x.advance(1800000); await x.controller.expire(); assert.equal(x.controller.snapshot().tracking, null); assert.equal(x.stored.has('tracking'), false);
});
test('late verification cannot undo logout; storage failure does not activate private UI', async () => {
 const x = setup(); let resolve;
 x.port.request = () => new Promise(done => { resolve = done; });
 const pending = x.controller.verify('tracking', 'handoff', '123456');
 while (!resolve) await new Promise(done => setImmediate(done));
 await x.controller.clear('tracking'); resolve(x.grant('tracking')); await pending;
 assert.equal(x.controller.snapshot().tracking, null); assert.equal(x.stored.has('tracking'), false);
 const y = setup(); y.port.write = async () => { throw new Error('Locked storage'); };
 await assert.rejects(y.controller.verify('tracking', 'handoff', '123456')); assert.equal(y.controller.snapshot().tracking, null);
});
test('renewal is single-flight and a late renewed credential cannot undo logout', async () => {
 const x = setup(); await x.controller.verify('tracking', 'handoff', '123456'); x.advance(61000);
 let resolve, calls = 0; x.port.request = () => { calls++; return new Promise(done => { resolve = done; }); };
 const a = x.controller.touch('tracking'), b = x.controller.touch('tracking'); assert.equal(calls, 1);
 await x.controller.clear('tracking'); resolve(x.grant('tracking')); await Promise.all([a, b]); assert.equal(x.controller.snapshot().tracking, null); assert.equal(x.stored.has('tracking'), false);
});

test('failed credential removal still hides data and exposes retry; retry clears retained storage', async () => {
 const x = setup(), warnings = [];
 x.port.storageError = (scope, message) => warnings.push({ scope, message });
 await x.controller.verify('capacity', 'handoff', '123456');
 x.port.remove = async () => { throw new Error('Storage unavailable'); };
 await assert.rejects(x.controller.clear('capacity'));
 assert.equal(x.controller.snapshot().capacity, null); assert.equal(x.stored.has('capacity'), true);
 assert.equal(warnings.at(-1).scope, 'capacity'); assert.ok(warnings.at(-1).message.includes('Retry'));
 await assert.rejects(x.controller.request('capacity', '/api/mobile/visitor/capacity/signals'));
 x.port.remove = async scope => { x.stored.delete(scope); };
 await x.controller.clear('capacity'); assert.equal(x.stored.has('capacity'), false); assert.equal(warnings.at(-1).message, '');
});

test('phone clock skew and response delay preserve bounded visitor expiry across restore', async () => {
 for (const skew of [-120000, 120000]) {
  const x = setup();
  x.port.request = async () => { const serverNow = x.port.now() + skew; x.advance(2000); return { scope: 'capacity', token: 'payload.signature', startedAt: serverNow, issuedAt: serverNow, expiresAt: serverNow + 1800000 }; };
  await x.controller.verify('capacity', 'handoff', '123456');
  assert.ok(x.controller.snapshot().capacity);
  const restored = createVisitorController(x.port); await restored.restore('capacity'); assert.ok(restored.snapshot().capacity);
  x.advance(1798000); await restored.expire(); assert.equal(restored.snapshot().capacity, null);
 }
});
test('skew-adjusted renewal preserves the Tracking identity and rejects excessive server lifetime', async () => {
 const x = setup(), serverStart = initial + 120000;
 x.port.request = async () => ({ scope: 'tracking', token: 'payload.signature', startedAt: serverStart, issuedAt: x.port.now() + 120000, expiresAt: x.port.now() + 120000 + 1800000 });
 await x.controller.verify('tracking', 'handoff', '123456'); x.advance(61000); await x.controller.touch('tracking');
 assert.equal(x.controller.snapshot().tracking.startedAt, serverStart);
 x.port.request = async () => ({ scope: 'tracking', token: 'payload.signature', startedAt: serverStart - 8 * 3600000, issuedAt: x.port.now() + 120000, expiresAt: x.port.now() + 120000 + 1800000 });
 await assert.rejects(x.controller.verify('tracking', 'handoff', '123456')); assert.equal(x.controller.snapshot().tracking, null);
});
