import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=file=>fs.readFileSync(file,'utf8');
const migration=read('supabase/migrations/062_tracking_recipient_email_otp.sql');
const adapter=read('src/lib/provider-tracking/supabase.js');
const facade=read('src/lib/provider-tracking.js');
const auth=read('src/lib/auth.ts');
const requestRoute=read('src/app/api/tracking/otp/route.ts');
const verifyRoute=read('src/app/api/tracking/unlock/route.ts');
const publicForm=read('src/components/tracking-unlock-form.tsx');
const publicTrackingPage=read('src/app/track/[id]/page.tsx');
const providerForm=read('src/components/provider-shipment-form.tsx');
const providerRoute=read('src/app/api/provider-shipments/route.ts');
const providerRecipientRoute=read('src/app/api/provider-shipments/[id]/recipients/route.ts');
const emailDelivery=read('src/lib/email-delivery.js');
const emailTemplates=read('src/lib/email-templates.js');

function migrationSection(start,end){
  const from=migration.indexOf(start);
  assert.notEqual(from,-1,`Missing migration section: ${start}`);
  const to=end?migration.indexOf(end,from+start.length):migration.length;
  return migration.slice(from,to<0?migration.length:to);
}

test('Tracking recipient and OTP tables are private and every active RPC is service-role-only',()=>{
  assert.match(migration,/create table if not exists public\.provider_tracking_recipients/i);
  assert.match(migration,/create table if not exists public\.provider_tracking_email_otps/i);
  assert.match(migration,/alter table public\.provider_tracking_recipients enable row level security/i);
  assert.match(migration,/alter table public\.provider_tracking_email_otps enable row level security/i);
  for(const signature of [
    'create_provider_tracking_with_recipients(uuid,jsonb)',
    'list_provider_tracking_recipients(uuid,uuid)',
    'add_provider_tracking_recipient(uuid,uuid,text,text)',
    'revoke_provider_tracking_recipient(uuid,uuid,uuid)',
    'request_provider_tracking_otp(uuid,text,text,text,text,timestamptz)',
    'consume_provider_tracking_otp(uuid,text,text,text)',
    'provider_guest_tracking_for_recipient(uuid,text)',
    'tracking_email_otp_cleanup(integer)'
  ]){
    const escaped=signature.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    assert.match(migration,new RegExp(`revoke all on function public\\.${escaped} from public,anon,authenticated`,'i'));
    assert.match(migration,new RegExp(`grant execute on function public\\.${escaped} to service_role`,'i'));
  }
  assert.match(migration,/revoke execute on function public\.unlock_provider_tracking\(text\) from service_role/i);
  assert.match(migration,/revoke execute on function public\.provider_guest_tracking\(uuid,text\) from service_role/i);
});

test('OTP issuance requires one exact active recipient and shipment-code match before writing a challenge or delivery',()=>{
  const request=migrationSection(
    'create or replace function public.request_provider_tracking_otp',
    'create or replace function public.consume_provider_tracking_otp'
  );
  assert.match(request,/party\.recipient_email_digest=recipient_digest/i);
  assert.match(request,/party\.recipient_email=clean_email/i);
  assert.match(request,/grant_record\.code_hash=trim\(tracking_code_digest\)/i);
  assert.match(request,/party\.revoked_at is null/i);
  assert.match(request,/grant_record\.revoked_at is null/i);
  assert.match(request,/if not found then[\s\S]*return false/i);
  assert.ok(request.indexOf('if not found then')<request.indexOf('insert into public.provider_tracking_email_otps'));
  assert.ok(request.indexOf('if not found then')<request.indexOf('insert into public.access_email_deliveries'));
  assert.match(request,/pg_catalog\.pg_advisory_xact_lock/i);
});

test('OTP consumption is single-use, bounded, and rechecks revocation and the shipment code',()=>{
  const consume=migrationSection(
    'create or replace function public.consume_provider_tracking_otp',
    'create or replace function public.provider_guest_tracking_for_recipient'
  );
  assert.match(consume,/challenge\.used_at is not null/i);
  assert.match(consume,/challenge\.superseded_at is not null/i);
  assert.match(consume,/challenge\.expires_at<=timestamp_value/i);
  assert.match(consume,/challenge\.attempt_count>=5/i);
  assert.match(consume,/set attempt_count=least\(5,attempt_count\+1\)/i);
  assert.match(consume,/party\.revoked_at is null/i);
  assert.match(consume,/grant_record\.code_hash=trim\(tracking_code_digest\)/i);
  assert.match(consume,/set used_at=timestamp_value/i);
  const projection=migrationSection(
    'create or replace function public.provider_guest_tracking_for_recipient',
    'create or replace function public.provider_tracking_guest_cleanup'
  );
  assert.match(projection,/party\.recipient_email_digest=requested_recipient_digest/i);
  assert.match(projection,/party\.revoked_at is null/i);
  assert.match(projection,/grant_record\.revoked_at is null/i);
  assert.doesNotMatch(projection,/recipient_email(?:'|\s*,)|code_digest|last_error|proof_storage_path/i);
});

test('provider creation and management support bounded distinct tracking parties',()=>{
  const create=migrationSection(
    'create or replace function public.create_provider_tracking_with_recipients',
    'create or replace function public.list_provider_tracking_recipients'
  );
  assert.match(create,/public\.create_provider_tracking\(actor_user_id,command\)/i);
  assert.match(create,/jsonb_array_length\(additional\)>20/i);
  assert.match(create,/'OWNER'/);
  assert.match(create,/'TRACKING_PARTY'/);
  assert.match(create,/'TRACKING_ACCESS'/);
  assert.match(providerForm,/name="additionalRecipientEmails"/);
  assert.match(providerRoute,/additionalRecipientEmails:text\(form,'additionalRecipientEmails'\)/);
  assert.match(adapter,/create_provider_tracking_with_recipients/);
  assert.match(adapter,/providerTrackingRecipientDigest/);
  assert.match(providerRecipientRoute,/addProviderTrackingRecipient/);
  assert.match(providerRecipientRoute,/revokeProviderTrackingRecipient/);
});

test('public Tracking uses a staged email OTP and a recipient-bound short session',()=>{
  assert.match(requestRoute,/requestProviderTrackingOtp\(email,trackingCode\)/);
  assert.match(requestRoute,/if\(challenge\.deliveryQueued\)/);
  assert.match(requestRoute,/deliverTargetedAccessEmail\('TRACKING_OTP',challenge\.challengeId\)/);
  assert.match(requestRoute,/tracking-otp-recipient:/);
  assert.match(verifyRoute,/verifyProviderTrackingOtp/);
  assert.match(verifyRoute,/setProviderTrackingGrant\(shipment\.id,shipment\.recipientDigest\)/);
  assert.match(auth,/provider-tracking:\$\{shipmentId\}:\$\{recipientDigest\}/);
  assert.match(auth,/\(\[a-f0-9\]\{64\}\)/);
  assert.match(publicForm,/Approved email/);
  assert.match(publicForm,/One-time code/);
  assert.match(publicForm,/\/api\/tracking\/otp/);
  assert.match(publicForm,/\/api\/tracking\/unlock/);
  assert.match(publicTrackingPage,/isCustomerOwner=shipment\.recipient_role==='OWNER'/);
  assert.match(publicTrackingPage,/needsReviewCode=isCustomerOwner&&/);
  assert.doesNotMatch(facade,/unlockSupabaseProviderTracking|unlockProviderTracking/);
});

test('managed access email treats Tracking OTP as a challenge-fenced short delivery',()=>{
  assert.match(migration,/delivery_kind in \('SHARED_CAPACITY','GUEST_SUPPORT','TRACKING_OTP'\)/i);
  assert.match(migration,/delivery\.delivery_kind='TRACKING_OTP'[\s\S]*provider_tracking_email_otps/i);
  assert.match(migration,/delivery\.delivery_kind in \('SHARED_CAPACITY','TRACKING_OTP'\)/i);
  assert.match(emailDelivery,/template:shared\?'shared-capacity-access':tracking\?'tracking-access-code'/);
  assert.match(emailDelivery,/providerTrackingOtpCode\(delivery\.entity_id\)/);
  assert.match(emailTemplates,/tracking-access-code/);
  assert.match(emailTemplates,/within 10 minutes to open the shipment updates/i);
  assert.match(migration,/create or replace function public\.tracking_email_otp_cleanup/i);
});
