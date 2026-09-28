import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTrackingSession,trackingSessionSubject,trackingSessionSeconds,trackingSessionExpired,trackingSessionNeedsRenewal,TRACKING_IDLE_MS,TRACKING_ABSOLUTE_MS} from '../src/lib/tracking-session.js';
const now=1800000000000,digest='a'.repeat(64);
test('email verification lasts thirty minutes, with a fixed eight-hour maximum',()=>{
 const payload={sub:trackingSessionSubject(digest,now),exp:(now+TRACKING_IDLE_MS)/1000};
 assert.equal(trackingSessionSeconds(now,now),1800);
 assert.equal(parseTrackingSession(payload,now).recipientDigest,digest);
 assert.equal(parseTrackingSession(payload,now+TRACKING_IDLE_MS),null);
 assert.equal(trackingSessionSeconds(now,now+TRACKING_ABSOLUTE_MS-60000),60);
 assert.equal(trackingSessionSeconds(now,now+TRACKING_ABSOLUTE_MS),0);
 assert.equal(parseTrackingSession({...payload,exp:(now+2*TRACKING_ABSOLUTE_MS)/1000},now+TRACKING_ABSOLUTE_MS),null);
});
test('legacy shipment and unrelated sessions never become email-wide sessions',()=>{
 for(const sub of [`provider-tracking:shipment:${digest}`,`shared-capacity:${digest}`,`tracking-email:${digest}:NaN`,`tracking-email:${digest}:${now+1}`])assert.equal(parseTrackingSession({sub,exp:(now+TRACKING_IDLE_MS)/1000},now),null);
 assert.throws(()=>trackingSessionSubject('bad',now));
});
test('idle and server deadlines cannot be extended by background polling',()=>{
 assert.equal(trackingSessionExpired(now+TRACKING_IDLE_MS,now,now+2*TRACKING_IDLE_MS),true);
 assert.equal(trackingSessionExpired(now,now,now),true);
 assert.equal(trackingSessionExpired(now+60000,now,now+TRACKING_IDLE_MS),false);
 assert.equal(trackingSessionNeedsRenewal(now+59999,now),false);
 assert.equal(trackingSessionNeedsRenewal(now+60000,now),true);
});
