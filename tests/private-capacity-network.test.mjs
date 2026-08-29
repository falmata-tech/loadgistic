import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {localAccessCodeForDevelopment} from '../src/lib/email-delivery.js';
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
  const challenge={deliveryQueued:true,accessCode:'12345678'};
  assert.equal(localAccessCodeForDevelopment(challenge,{configured:false},'development'),'12345678');
  assert.equal(localAccessCodeForDevelopment(challenge,{configured:false},'production'),null);
  assert.equal(localAccessCodeForDevelopment(challenge,{configured:true},'development'),null);
  assert.equal(localAccessCodeForDevelopment({deliveryQueued:false},{configured:false},'development'),null);
});

test('private-capacity recovery email delivery stays on the managed queue boundary',()=>{
  const root=process.cwd();
  const accessFacade=fs.readFileSync(path.join(root,'src/lib/access-email.js'),'utf8');
  const deliveryWorker=fs.readFileSync(path.join(root,'src/lib/email-delivery.js'),'utf8');
  const verifier=fs.readFileSync(path.join(root,'scripts/verify-supabase-shared-capacity.mjs'),'utf8');
  assert.match(accessFacade,/listSupabasePendingAccessEmailDeliveries/);
  assert.match(accessFacade,/recordSupabaseAccessEmailDeliveryAttempt/);
  assert.doesNotMatch(accessFacade,/repository\.js|DATA_BACKEND/);
  assert.match(deliveryWorker,/from '\.\/access-email\.js'/);
  assert.match(verifier,/listPendingAccessEmailDeliveries\(100\)/);
  assert.match(verifier,/recordAccessEmailDeliveryAttempt\(delivery\.id,\{sent:true\}\)/);
  assert.match(verifier,/SUPABASE_SHARED_VERIFY_DELIVERY_QUEUE_FAILED/);
  assert.match(verifier,/SUPABASE_SHARED_VERIFY_DELIVERY_RECORD_FAILED/);
});
