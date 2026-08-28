import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root=process.cwd();
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('active Verification and Billing routes use managed application ports',()=>{
  for(const relative of [
    'src/app/app/verification/page.tsx','src/app/api/verifications/route.ts',
    'src/app/api/files/verification/[id]/route.ts','src/app/api/admin/verifications/[id]/route.ts',
    'src/app/api/billing/payment-proof/route.ts','src/app/api/files/payment-proof/[id]/route.ts',
    'src/app/api/admin/payment-proofs/[id]/route.ts','src/app/admin/reviews/page.tsx'
  ])assert.doesNotMatch(read(relative),/lib\/repository\.js/);
  assert.match(read('src/lib/verification.js'),/verification\/supabase\.js/);
  assert.match(read('src/lib/billing.js'),/billing\/supabase\.js/);
});

test('managed private-file commands clean failed uploads and hide storage paths from queues',()=>{
  const verification=read('src/lib/verification/supabase.js');
  const billing=read('src/lib/billing/supabase.js');
  assert.match(verification,/removePrivateUpload\(stored\.path\)/);
  assert.match(billing,/removePrivateUpload\(stored\.path\)/);
  const migration=read('supabase/migrations/051_managed_verification_billing.sql');
  assert.match(migration,/revoke all on function public\.managed_verification_file/);
  assert.match(migration,/revoke all on function public\.managed_payment_proof_file/);
  assert.match(migration,/grant execute on function public\.managed_verification_file\(uuid,uuid\) to service_role/);
  assert.match(migration,/grant execute on function public\.managed_payment_proof_file\(uuid,uuid\) to service_role/);
  assert.doesNotMatch(migration,/jsonb_build_object\([^;]*'file_path',/s);
});

test('Verification and Billing reviews are terminal, scoped, and audited in PostgreSQL',()=>{
  const migration=read('supabase/migrations/051_managed_verification_billing.sql');
  assert.match(migration,/managed_actor_has_permission\(actor_user_id,'TRUST'\)/);
  assert.match(migration,/managed_actor_has_permission\(actor_user_id,'BILLING'\)/);
  assert.match(migration,/VERIFICATION_ALREADY_REVIEWED/);
  assert.match(migration,/PAYMENT_PROOF_ALREADY_REVIEWED/);
  assert.match(migration,/VERIFICATION_REVIEWED/);
  assert.match(migration,/PAYMENT_PROOF_REVIEWED/);
});
