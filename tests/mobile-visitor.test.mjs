import test from 'node:test';
import assert from 'node:assert/strict';
import { visitorSubject, parseVisitorSession, visitorBearer, visitorSessionSeconds } from '../src/lib/mobile/visitor-policy.js';
const now = 1800000000000, digest = 'a'.repeat(64);
test('native visitor subjects reject browser, provider and other visitor scope credentials', () => {
 const payload = { sub: visitorSubject('tracking', digest, now), exp: (now + 300000) / 1000 };
 assert.equal(parseVisitorSession(payload, 'tracking', now).digest, digest);
 for (const sub of [`tracking-email:${digest}:${now}`, `shared-capacity:${digest}`, `mobile-login:test@loadgistic.local`, visitorSubject('capacity', digest, now)]) assert.equal(parseVisitorSession({ ...payload, sub }, 'tracking', now), null);
 assert.equal(visitorBearer('Bearer a.b'), 'a.b'); for (const value of ['a.b', 'Bearer a.b.c', 'Bearer a.b.extra', 'Bearer a.b ']) assert.equal(visitorBearer(value), null);
});
test('idle expiry and tracking absolute deadline fail closed', () => {
 const sub = visitorSubject('tracking', digest, now);
 assert.equal(parseVisitorSession({ sub, exp: now / 1000 }, 'tracking', now), null);
 assert.equal(parseVisitorSession({ sub, exp: (now + 1802000) / 1000 }, 'tracking', now), null);
 assert.equal(visitorSessionSeconds('tracking', now - 300000, now), 0);
 assert.equal(visitorSessionSeconds('tracking', now - 300000 + 30000, now), 30);
 assert.equal(visitorSessionSeconds('tracking',now,now),300);
 assert.equal(parseVisitorSession({sub,exp:(now+1800000)/1000},'tracking',now),null);
 assert.equal(visitorSessionSeconds('capacity', now - 8 * 3600000, now), 1800);
});
