import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  hashProviderTrackingCode,
  providerTrackingOtpCode,
  providerTrackingRecipientDigest,
  reviewAccessCode,
  trackingAccessCode,
  verifyReviewAccessCode
} from '../src/lib/security.js';

const trackingSecret='tracking-code-secret-for-tests-with-more-than-32-characters';
const production={NODE_ENV:'production',SESSION_SECRET:'session-secret-a-with-more-than-32-characters',TRACKING_CODE_SECRET:trackingSecret};

test('retained legacy Tracking owner and review derivations preserve their distinct80-bit formats',()=>{
  const owner=trackingAccessCode('shipment-one',production);
  const review=reviewAccessCode('shipment-one',production);
  assert.match(owner,/^LG-[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
  assert.match(review,/^LG-RV-[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
  assert.equal(owner,trackingAccessCode('shipment-one',production));
  assert.equal(review,reviewAccessCode('shipment-one',production));
  assert.notEqual(owner,trackingAccessCode('shipment-two',production));
  assert.notEqual(owner.replace(/^LG-/,''),review.replace(/^LG-RV-/,''));
  assert.equal(verifyReviewAccessCode('shipment-one',review.toLowerCase(),production),true);
  assert.equal(verifyReviewAccessCode('shipment-two',review,production),false);
});

test('retained legacy Tracking codes and digests survive SESSION_SECRET rotation',()=>{
  const rotated={...production,SESSION_SECRET:'session-secret-b-with-more-than-32-characters'};
  const owner=trackingAccessCode('shipment-one',production);
  assert.equal(trackingAccessCode('shipment-one',rotated),owner);
  assert.equal(hashProviderTrackingCode(owner,rotated),hashProviderTrackingCode(owner,production));
  assert.equal(providerTrackingRecipientDigest('Owner@Example.test',rotated),providerTrackingRecipientDigest('owner@example.test',production));
  assert.notEqual(
    trackingAccessCode('shipment-one',{...production,TRACKING_CODE_SECRET:'another-tracking-code-secret-with-more-than-32-characters'}),
    owner
  );
});

test('historical Tracking email OTP helper remains numeric and challenge-bound',()=>{
  const challenge='11111111-1111-4111-8111-111111111111';
  assert.match(providerTrackingOtpCode(challenge),/^\d{6}$/);
  assert.equal(providerTrackingOtpCode(challenge),providerTrackingOtpCode(challenge));
  assert.notEqual(providerTrackingOtpCode(challenge),providerTrackingOtpCode('22222222-2222-4222-8222-222222222222'));
});

test('Tracking code derivation fails closed without a dedicated strong Production secret',()=>{
  for(const environment of [
    {NODE_ENV:'production'},
    {NODE_ENV:'production',TRACKING_CODE_SECRET:'short'},
    {NODE_ENV:'production',TRACKING_CODE_SECRET:'local-development-secret-change-before-production-1234'},
    {NODE_ENV:'production',SESSION_SECRET:trackingSecret,TRACKING_CODE_SECRET:trackingSecret}
  ]){
    assert.throws(()=>trackingAccessCode('shipment-one',environment),error=>error?.message==='TRACKING_CODE_SECRET_REQUIRED');
    assert.throws(()=>hashProviderTrackingCode('LG-TEST',environment),error=>error?.message==='TRACKING_CODE_SECRET_REQUIRED');
  }
  assert.match(trackingAccessCode('shipment-one',{NODE_ENV:'development'}),/^LG-/);
});

test('public Tracking requires a per-load link and separate code without email or owner-review authority',()=>{
  const root=process.cwd();
  const trackingForm=fs.readFileSync(path.join(root,'src/components/tracking-unlock-form.tsx'),'utf8');
  const reviewPage=fs.readFileSync(path.join(root,'src/app/track/[id]/page.tsx'),'utf8');
  assert.match(trackingForm,/trackingLinkToken\(linkToken\|\|id,/);
  assert.match(trackingForm,/name="trackingId"/);
  assert.doesNotMatch(trackingForm,/name="trackingLink"/);
  assert.match(trackingForm,/trackingAccessCode\(code\)/);
  assert.match(trackingForm,/JSON\.stringify\(\{linkToken:token,code:secret\}\)/);
  assert.match(trackingForm,/maxLength=\{9\} placeholder="XXXX-XXXX"/);
  assert.match(trackingForm,/autoComplete="off"/);
  assert.doesNotMatch(trackingForm,/one-time-code|type="email"|6-digit email code|\/api\/tracking\/(?:otp|unlock)/);
  assert.match(reviewPage,/trackingLinkToken\.safeParse\(id\)/);
  assert.match(reviewPage,/parseTrackingLinkGrant/);
  assert.doesNotMatch(reviewPage,/recipient_role|TrackingReviewForm|TrackingProofLink|Review access code|LG-RV-/);
});
