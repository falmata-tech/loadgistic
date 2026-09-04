import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root=process.cwd();
const activeFiles=[
  'src/app/api/capacity-network/route.ts',
  'src/app/app/network/page.tsx',
  'src/app/shared-capacity/page.tsx',
  'src/app/admin/capacity-network/page.tsx',
  'src/app/api/shared-capacity/route.ts',
  'src/app/api/shared-capacity/otp/route.ts',
  'src/app/api/shared-capacity/access/route.ts',
  'src/app/api/admin/capacity-network/route.ts'
];

test('active private-capacity routes use the dedicated managed port',()=>{
  for(const relativePath of activeFiles){
    const source=fs.readFileSync(path.join(root,relativePath),'utf8');
    assert.doesNotMatch(source,/lib\/repository\.js/);
    assert.match(source,/lib\/private-capacity\.js/);
  }
  const port=fs.readFileSync(path.join(root,'src/lib/private-capacity.js'),'utf8');
  assert.match(port,/repository\/supabase\.js/);
  assert.doesNotMatch(port,/DATA_BACKEND|repository\.js/);
});

test('Shared capacity delivery leasing and retention fail closed around terminal OTPs',()=>{
  const issuanceMigration=fs.readFileSync(path.join(root,'supabase/migrations/058_guest_access_retention.sql'),'utf8');
  const deliveryMigration=fs.readFileSync(path.join(root,'supabase/migrations/059_targeted_access_email_delivery.sql'),'utf8');
  const issuanceStart=issuanceMigration.indexOf('create or replace function public.request_shared_capacity_otp');
  const issuanceEnd=issuanceMigration.indexOf('create or replace function public.pending_access_email_deliveries');
  const issuance=issuanceMigration.slice(issuanceStart,issuanceEnd);
  assert.ok(issuanceStart>=0&&issuanceEnd>issuanceStart);
  assert.match(issuance,/security definer\s+set search_path=public,pg_temp/i);
  assert.match(issuance,/pg_catalog\.pg_advisory_xact_lock\(\s*pg_catalog\.hashtextextended\(recipient_digest,0\)\s*\)/i);
  assert.ok(issuance.indexOf('pg_catalog.pg_advisory_xact_lock')<issuance.indexOf('update public.shared_capacity_email_otps'));
  assert.ok(issuance.indexOf('update public.shared_capacity_email_otps')<issuance.indexOf('insert into public.shared_capacity_email_otps'));
  assert.match(issuance,/attempt_count,expires_at,created_at[\s\S]*challenge_expires_at,clock_timestamp\(\)/i);
  assert.match(deliveryMigration,/add column if not exists lease_token uuid/i);
  assert.match(deliveryMigration,/add column if not exists leased_until timestamptz/i);
  assert.match(deliveryMigration,/access_email_deliveries_pending_due_idx[\s\S]*where status in \('QUEUED','FAILED'\) and attempts<6/i);
  assert.match(deliveryMigration,/order by case when delivery\.delivery_kind='SHARED_CAPACITY' then 0 else 1 end/i);
  assert.match(deliveryMigration,/while a serial worker performs provider I\/O\.\s*limit 1/i);
  assert.match(deliveryMigration,/order by case when claimed\.delivery_kind='SHARED_CAPACITY' then 0 else 1 end,[\s\S]*coalesce\(claimed\.next_attempt_at,claimed\.created_at\)/i);
  assert.match(deliveryMigration,/create or replace function public\.claim_access_email_delivery\(\s*requested_kind text,\s*requested_entity_id uuid/i);
  assert.match(deliveryMigration,/delivery\.delivery_kind=requested_kind[\s\S]*delivery\.entity_id=requested_entity_id/i);
  assert.match(deliveryMigration,/for update of delivery skip locked/i);
  assert.match(deliveryMigration,/lease_token=gen_random_uuid\(\)/i);
  assert.match(deliveryMigration,/leased_until=clock_timestamp\(\)\+interval '90 seconds'/i);
  assert.match(deliveryMigration,/create or replace function public\.access_email_delivery_is_deliverable\([\s\S]*delivery\.lease_token=claimed_lease_token/i);
  assert.match(deliveryMigration,/delivery\.leased_until>clock_timestamp\(\)/i);
  assert.match(deliveryMigration,/delivery\.delivery_kind='GUEST_SUPPORT'[\s\S]*delivery\.delivery_kind='SHARED_CAPACITY'/i);
  assert.match(deliveryMigration,/challenge\.expires_at>clock_timestamp\(\)\+interval '30 seconds'/i);
  assert.match(deliveryMigration,/make_interval\([\s\S]*secs=>least\(120,/i);
  assert.match(deliveryMigration,/retry_at>=challenge_expires_at-interval '30 seconds'/i);
  assert.match(deliveryMigration,/guest_cutoff_at timestamptz:=clock_timestamp\(\)-interval '30 days'/i);
  assert.match(deliveryMigration,/delivery\.delivery_kind='GUEST_SUPPORT'[\s\S]*delivery\.status='SENT'[\s\S]*delivery\.status='FAILED' and delivery\.attempts>=6/i);
  assert.match(deliveryMigration,/jsonb_build_object\(\s*'otpCount',challenge_count,\s*'deliveryCount',linked_delivery_count\+stale_delivery_count\+guest_delivery_count,\s*'guestDeliveryCount',guest_delivery_count\s*\)/i);
  assert.doesNotMatch(deliveryMigration,/return jsonb_build_object\([^;]*(?:recipient_email|code_digest|shipmentIds|challenge_ids)/is);
  for(const signature of [
    'public.claim_access_email_delivery(text,uuid)',
    'public.access_email_delivery_is_deliverable(uuid,uuid)',
    'public.shared_capacity_delivery_is_deliverable(uuid,uuid)',
    'public.record_access_email_delivery_attempt(uuid,uuid,boolean,text)',
    'public.shared_capacity_access_cleanup(integer)'
  ]){
    assert.match(deliveryMigration,new RegExp(`revoke all on function ${signature.replace(/[().]/g,'\\$&')} from public,anon,authenticated`,'i'));
    assert.match(deliveryMigration,new RegExp(`grant execute on function ${signature.replace(/[().]/g,'\\$&')} to service_role`,'i'));
  }
  assert.match(deliveryMigration,/revoke all on function public\.record_access_email_delivery_attempt\(uuid,boolean,text\) from public,anon,authenticated,service_role/i);
});
