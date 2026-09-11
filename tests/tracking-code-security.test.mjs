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

test('Tracking owner and review codes contain 80 deterministic bits in readable distinct formats',()=>{
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

test('Tracking codes and digests do not change when SESSION_SECRET rotates',()=>{
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

test('Tracking email OTPs are numeric, deterministic per challenge, and isolated from Shared capacity codes',async()=>{
  const {sharedCapacityOtpCode}=await import('../src/lib/security.js');
  const challenge='11111111-1111-4111-8111-111111111111';
  assert.match(providerTrackingOtpCode(challenge),/^\d{6}$/);
  assert.equal(providerTrackingOtpCode(challenge),providerTrackingOtpCode(challenge));
  assert.notEqual(providerTrackingOtpCode(challenge),sharedCapacityOtpCode(challenge));
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

test('Tracking and review entry fields communicate the complete code formats',()=>{
  const root=process.cwd();
  const trackingForm=fs.readFileSync(path.join(root,'src/components/tracking-unlock-form.tsx'),'utf8');
  const reviewPage=fs.readFileSync(path.join(root,'src/app/track/[id]/page.tsx'),'utf8');
  assert.match(trackingForm,/placeholder="LG-XXXX-XXXX-XXXX-XXXX"/);
  assert.match(trackingForm,/maxLength=\{22\}/);
  assert.match(reviewPage,/placeholder="LG-RV-XXXX-XXXX-XXXX-XXXX"/);
  assert.match(reviewPage,/maxLength=\{25\}/);
});
