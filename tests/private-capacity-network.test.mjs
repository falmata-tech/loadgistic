import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {localAccessCodeForDevelopment,sharedCapacityOtpRequestResponse} from '../src/lib/email-delivery.js';
import {sharedCapacityOtpCode} from '../src/lib/security.js';
import {
  SHARED_CAPACITY_IDLE_MS,
  SHARED_CAPACITY_RENEW_AFTER_MS,
  sharedCapacityDeadline,
  sharedCapacitySessionExpired,
  sharedCapacitySessionNeedsRenewal
} from '../src/lib/shared-capacity-session.js';

test('Shared capacity uses a 30-minute deliberate-activity idle boundary',()=>{
  const startedAt=1_000_000;
  const expiresAt=startedAt+SHARED_CAPACITY_IDLE_MS;
  assert.equal(SHARED_CAPACITY_IDLE_MS,30*60*1000);
  assert.equal(SHARED_CAPACITY_RENEW_AFTER_MS,60*1000);
  assert.equal(sharedCapacityDeadline(startedAt,expiresAt),expiresAt);
  assert.equal(sharedCapacitySessionExpired(expiresAt-1,startedAt,expiresAt),false);
  assert.equal(sharedCapacitySessionExpired(expiresAt,startedAt,expiresAt),true);
  assert.equal(sharedCapacitySessionNeedsRenewal(startedAt+SHARED_CAPACITY_RENEW_AFTER_MS-1,startedAt),false);
  assert.equal(sharedCapacitySessionNeedsRenewal(startedAt+SHARED_CAPACITY_RENEW_AFTER_MS,startedAt),true);
  assert.equal(sharedCapacityDeadline(startedAt,expiresAt-10_000),expiresAt-10_000);
});

test('local access codes appear only for eligible unconfigured non-production delivery',()=>{
  const challenge={deliveryQueued:true,accessCode:'123456'};
  assert.equal(localAccessCodeForDevelopment(challenge,{configured:false},'development'),'123456');
  assert.equal(localAccessCodeForDevelopment(challenge,{configured:false},'production'),null);
  assert.equal(localAccessCodeForDevelopment(challenge,{configured:true},'development'),null);
  assert.equal(localAccessCodeForDevelopment({deliveryQueued:false},{configured:false},'development'),null);
});

test('Shared capacity request responses expose the code step only for a queued challenge',()=>{
  const challenge={deliveryQueued:true,accessCode:'123456'};
  const expected={
    ok:true,
    verificationRequired:true,
    message:'Check your email for a one-time code.'
  };
  assert.deepEqual(sharedCapacityOtpRequestResponse(challenge,{configured:true,environment:'production'}),expected);
  assert.deepEqual(sharedCapacityOtpRequestResponse({deliveryQueued:false,challengeId:'opaque-target'}, {
    configured:false,environment:'development'
  }),{
    ok:true,
    verificationRequired:false,
    message:'No transporter has shared capacity with this email yet. Ask a transporter to share capacity with this email address.'
  });
  assert.deepEqual(sharedCapacityOtpRequestResponse(challenge,{configured:false,environment:'development'}),{
    ok:true,
    verificationRequired:true,
    message:'Email delivery is not configured in this local environment. Use the local test code below.',
    localTestCode:'123456'
  });
});

test('Shared capacity issues a stable six-digit application OTP without creating an Auth identity',()=>{
  const first=sharedCapacityOtpCode('challenge-one');
  assert.match(first,/^\d{6}$/);
  assert.equal(sharedCapacityOtpCode('challenge-one'),first);
  assert.notEqual(sharedCapacityOtpCode('challenge-two'),first);
});

test('private-capacity recovery email delivery stays on the managed queue boundary',()=>{
  const root=process.cwd();
  const accessFacade=fs.readFileSync(path.join(root,'src/lib/access-email.js'),'utf8');
  const deliveryWorker=fs.readFileSync(path.join(root,'src/lib/email-delivery.js'),'utf8');
  const verifier=fs.readFileSync(path.join(root,'scripts/verify-supabase-shared-capacity.mjs'),'utf8');
  const requestRoute=fs.readFileSync(path.join(root,'src/app/api/shared-capacity/otp/route.ts'),'utf8');
  const responseStart=deliveryWorker.indexOf('export function sharedCapacityOtpRequestResponse');
  const responseEnd=deliveryWorker.indexOf('function publicUrl',responseStart);
  assert.match(accessFacade,/listSupabasePendingAccessEmailDeliveries/);
  assert.match(accessFacade,/recordSupabaseAccessEmailDeliveryAttempt/);
  assert.doesNotMatch(accessFacade,/repository\.js|DATA_BACKEND/);
  assert.match(deliveryWorker,/from '\.\/access-email\.js'/);
  assert.doesNotMatch(deliveryWorker.slice(responseStart,responseEnd),/deliverPendingAccessEmails|sendManagedEmail|await /);
  assert.match(requestRoute,/after\(async\(\)=>/);
  assert.match(requestRoute,/if\(challenge\.deliveryQueued\)/);
  assert.match(requestRoute,/deliverTargetedAccessEmail\('SHARED_CAPACITY',challenge\.challengeId\)/);
  assert.doesNotMatch(requestRoute,/deliverPendingAccessEmails/);
  assert.match(verifier,/claimAccessEmailDelivery\('SHARED_CAPACITY',challenge\.challengeId\)/);
  assert.match(verifier,/recordAccessEmailDeliveryAttempt\(delivery\.id,\{leaseToken:delivery\.lease_token,sent:true\}\)/);
  assert.match(verifier,/SUPABASE_SHARED_VERIFY_DELIVERY_QUEUE_FAILED/);
  assert.match(verifier,/SUPABASE_SHARED_VERIFY_DELIVERY_RECORD_FAILED/);
});
