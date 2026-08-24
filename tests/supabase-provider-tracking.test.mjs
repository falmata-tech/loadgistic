import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const migration=fs.readFileSync(path.join(root,'supabase','migrations','044_provider_tracking_runtime.sql'),'utf8');
const facade=fs.readFileSync(path.join(root,'src','lib','provider-tracking.js'),'utf8');
const managed=fs.readFileSync(path.join(root,'src','lib','provider-tracking','supabase.js'),'utf8');

function section(start,end){
  const from=migration.indexOf(start);
  const to=end?migration.indexOf(end,from+start.length):migration.length;
  assert.notEqual(from,-1,`Missing migration section: ${start}`);
  return migration.slice(from,to<0?migration.length:to);
}

test('managed Tracking RPCs remain server-only behind default-deny private tables',()=>{
  for(const signature of [
    'create_provider_tracking(uuid,jsonb)',
    'provider_tracking_detail(uuid,text)',
    'update_provider_tracking_status(uuid,uuid,jsonb)',
    'unlock_provider_tracking(text)',
    'provider_guest_tracking(uuid,text)',
    'submit_provider_tracking_review(uuid,text,integer,text)'
  ]){
    const escaped=signature.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    assert.match(migration,new RegExp(`revoke all on function public\\.${escaped} from public,anon,authenticated`,'i'));
    assert.match(migration,new RegExp(`grant execute on function public\\.${escaped} to service_role`,'i'));
  }
  assert.doesNotMatch(migration,/grant execute on function public\.(?:create_provider_tracking|provider_guest_tracking).*\b(?:anon|authenticated)\b/i);
});

test('managed commands repeat owner, Driver permission, assignment, and transition checks',()=>{
  const actor=section('create or replace function public.provider_tracking_actor_scope','create or replace function public.provider_tracking_actor_owns_shipment');
  assert.match(actor,/can_manage_tracking/i);
  assert.match(actor,/workspace_access/i);
  const ownership=section('create or replace function public.provider_tracking_actor_owns_shipment','create or replace function public.provider_tracking_workspace');
  assert.match(ownership,/shipment\.assigned_driver_user_id=actor_user_id/i);
  assert.match(ownership,/driver_vehicle_assignments/i);
  assert.match(ownership,/assignment\.active/i);
  const transition=section('create or replace function public.update_provider_tracking_status','create or replace function public.update_provider_tracking_location');
  assert.match(transition,/INVALID_STATUS_TRANSITION/);
  assert.match(transition,/next_status not in \('LOADING','UNLOADING','ISSUE'\)/i);
  assert.match(transition,/ASSIGNED_DRIVER_LOCATION_REQUIRED/);
  assert.match(transition,/location_source<>'DEVICE_OBSCURED'/i);
  assert.match(transition,/interval '30 days'/i);
  assert.match(transition,/on conflict\(idempotency_key\) do nothing/i);
});

test('guest projection excludes customer contacts, digests, proofs, and delivery internals',()=>{
  const guest=section('create or replace function public.provider_guest_tracking','create or replace function public.unlock_provider_review');
  assert.match(guest,/shipment_party_grants/i);
  assert.match(guest,/grant_record\.revoked_at is null/i);
  assert.match(guest,/grant_record\.expires_at is null or grant_record\.expires_at>now\(\)/i);
  assert.doesNotMatch(guest,/shipper_email|receiver_email|code_hash|review_code_hash|proof_storage_path|last_error|recipient_email/i);
  assert.match(guest,/operational_status in \('TO_PICKUP','IN_TRANSIT'\)/i);
});

test('cleanup removes only temporary guest data and redacts contacts',()=>{
  const cleanup=section('create or replace function public.provider_tracking_guest_cleanup','create or replace function public.unlock_provider_tracking');
  assert.match(cleanup,/delete from public\.shipment_party_grants/i);
  assert.match(cleanup,/delete from public\.email_deliveries/i);
  assert.match(cleanup,/@redacted\.invalid/i);
  assert.match(cleanup,/review_code_hash=null/i);
  assert.doesNotMatch(cleanup,/delete from public\.provider_shipments|delete from public\.provider_shipment_events|delete from public\.provider_reviews/i);
});

test('email workers lease rows and cannot downgrade a completed delivery',()=>{
  const queue=section('create or replace function public.pending_provider_tracking_email_deliveries','create or replace function public.record_provider_tracking_email_attempt');
  assert.match(queue,/for update skip locked/i);
  assert.match(queue,/next_attempt_at=now\(\)\+interval '10 minutes'/i);
  const record=section('create or replace function public.record_provider_tracking_email_attempt','revoke all on function public.provider_tracking_actor_scope');
  assert.match(record,/if delivery\.status='SENT' then return true/i);
});

test('active Tracking routes use the dedicated managed-data facade without demand writes',()=>{
  const tracked=[
    'src/app/api/provider-shipments/route.ts',
    'src/app/api/provider-shipments/[id]/status/route.ts',
    'src/app/api/provider-shipments/[id]/location/route.ts',
    'src/app/api/tracking/unlock/route.ts',
    'src/app/api/tracking/review-unlock/route.ts',
    'src/app/api/tracking/[id]/review/route.ts',
    'src/app/track/[id]/page.tsx',
    'src/app/app/provider-shipments/page.tsx',
    'src/app/app/provider-shipments/[id]/page.tsx',
    'src/app/app/provider-shipments/new/page.tsx'
  ];
  for(const file of tracked){
    const source=fs.readFileSync(path.join(root,file),'utf8');
    assert.match(source,/@\/lib\/provider-tracking\.js/);
    assert.doesNotMatch(source,/@\/lib\/repository\.js/);
  }
  assert.match(facade,/process\.env\.DATA_BACKEND==='supabase'/);
  assert.match(managed,/createSupabaseAdminClient/);
  assert.doesNotMatch(migration,/insert into public\.(?:shipments|shipment_interests|business_reviews)\b/i);
});
