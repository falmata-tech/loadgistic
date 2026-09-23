import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {subscriptionAccess} from '../src/lib/subscription-access.js';
import {FEATURED_TRUCK_DAYS} from '../src/lib/featured-trucks.js';
import {getPlatformControls,savePlatformControls} from '../src/lib/platform-controls.js';

const now=new Date('2026-09-13T09:00:00Z');
const expired={status:'TRIAL',ends_at:'2026-08-10T09:00:00Z'};
const policy={mode:'TRIAL_PAYMENT',activated_at:now.toISOString()};
test('free access hides expiry but never supplies a missing workspace',()=>{
  assert.deepEqual(subscriptionAccess(expired,now,{mode:'FREE'}),{granted:true,status:'FREE_ACCESS',ends_at:null,days_remaining:null});
  assert.equal(subscriptionAccess(null,now,{mode:'FREE'}).granted,false);
  assert.equal(subscriptionAccess(expired,now).granted,false);
});
test('commercial activation gives seven days without shortening active plans or new trials',()=>{
  const fresh=subscriptionAccess(expired,now,policy);
  assert.equal(fresh.status,'TRIAL');assert.equal(fresh.days_remaining,7);
  assert.equal(subscriptionAccess(expired,new Date('2026-09-20T09:00:00Z'),policy).granted,false);
  assert.equal(subscriptionAccess({...expired,ends_at:'2026-09-14T09:00:00Z'},now,policy).ends_at,fresh.ends_at);
  assert.equal(subscriptionAccess({status:'ACTIVE',ends_at:'2026-10-01T09:00:00Z'},now,policy).status,'ACTIVE');
  assert.equal(subscriptionAccess({status:'TRIAL',ends_at:'2026-10-01T09:00:00Z'},now,policy).ends_at,'2026-10-01T09:00:00.000Z');
  assert.equal(subscriptionAccess({status:'SPONSORED'},now,policy).status,'SPONSORED');
  assert.equal(subscriptionAccess({status:'PAYMENT_UNDER_REVIEW'},new Date('2026-09-21T09:00:00Z'),policy).granted,false);
});
test('platform settings reject non-admin application callers before database access',async()=>{
  await assert.rejects(getPlatformControls({id:'driver',role:'DRIVER'}),/FORBIDDEN/);
  await assert.rejects(savePlatformControls({id:'support',role:'SUPPORT'},{section:'ACCESS',mode:'FREE'}),/FORBIDDEN/);
});
test('automatic programme uses the same seven themes and protects retries and manual work',()=>{
  const sql=fs.readFileSync(new URL('../supabase/migrations/080_automatic_featured_rosters.sql',import.meta.url),'utf8');
  for(const theme of FEATURED_TRUCK_DAYS){assert.ok(sql.includes(theme.key));for(const configuration of theme.configurations)assert.ok(sql.includes(configuration));}
  assert.match(sql,/pg_try_advisory_xact_lock/);assert.match(sql,/on conflict\(feature_date\) do nothing/);
  assert.match(sql,/partition by link\.driver_user_id/);assert.match(sql,/last_featured nulls first/);
  assert.match(sql,/configuration_position/);assert.match(sql,/selection_source=''MANUAL''/);
  assert.match(sql,/created_count.*skipped_count/s);
  assert.doesNotMatch(sql,/delete from public\.featured_provider_days/);
});
test('shared loading is accessible, reduced-motion-aware, and preserves native submit commands',()=>{
  const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
  const skeleton=read('src/components/loading-state.tsx');
  assert.match(skeleton,/aria-busy="true"/);assert.match(skeleton,/aria-hidden="true"/);assert.match(skeleton,/role="status"/);
  const native=read('src/components/native-form-feedback.tsx');
  assert.match(native,/if\(event\.defaultPrevented\)return/);
  assert.match(native,/form\.hasAttribute\('data-native-submitting'\)/);
  assert.doesNotMatch(native,/\.disabled\s*=|setAttribute\('disabled'/);
  assert.match(read('src/app/globals.css'),/@media\(prefers-reduced-motion:reduce\)\{\.surface-skeleton/);
});
