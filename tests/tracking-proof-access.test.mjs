import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('proof migration adds only its scoped getter and safe recipient projection',()=>{
  const sql=read('supabase/migrations/083_tracking_proof_access.sql');
  assert.deepEqual([...sql.matchAll(/create or replace function public\.(\w+)/g)].map(match=>match[1]),['provider_tracking_proof_file','provider_guest_tracking_for_recipient']);
  assert.match(sql,/event\.id=target_event_id and event\.shipment_id=target_shipment_id/);
  assert.match(sql,/managed_actor_has_permission\(actor_user_id,'OPERATIONS'\)/);
  assert.match(sql,/provider_tracking_actor_owns_shipment/);
  assert.match(sql,/party\.revoked_at is null/);
  assert.match(sql,/guest_expires_at>now\(\)/);
  assert.match(sql,/revoke all[^;]+from public,anon,authenticated/);
  assert.doesNotMatch(sql,/grant execute[^;]+to (anon|authenticated)/);
});

test('proof UI uses record-scoped links and file route reauthorizes before Storage read',()=>{
  const endpoint=read('src/app/api/provider-shipments/[id]/proofs/[eventId]/route.ts');
  assert.match(endpoint,/getProviderTrackingGrant\(id\)/);
  assert.match(endpoint,/readProviderTrackingProof\(user,id,eventId,grant\?\.recipientDigest\|\|null\)/);
  assert.match(endpoint,/privateDocumentHeaders/);
  const adapter=read('src/lib/provider-tracking/supabase.js');
  const getter=adapter.slice(adapter.indexOf('export async function readSupabaseProviderTrackingProof'),adapter.indexOf('export async function addSupabaseProviderTrackingRecipient'));
  assert.ok(getter.indexOf("rpc('provider_tracking_proof_file'")<getter.indexOf('readPrivateUpload'));
  for(const path of ['src/app/app/provider-shipments/[id]/page.tsx','src/app/track/[id]/page.tsx','src/app/admin/operations/[view]/[id]/page.tsx'])assert.match(read(path),/event.has_proof\?<TrackingProofLink/);
  assert.doesNotMatch(read('src/components/tracking-proof-link.tsx'),/storage_path|supabase:\/\//);
});
