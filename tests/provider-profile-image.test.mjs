import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();

test('active provider profile images use only the managed storage lifecycle',()=>{
  const facade=fs.readFileSync(path.join(root,'src/lib/provider-profile.js'),'utf8');
  const verifier=fs.readFileSync(path.join(root,'scripts/verify-supabase-provider-profile.mjs'),'utf8');
  assert.match(facade,/from '\.\/provider-profile\/supabase\.js'/);
  assert.doesNotMatch(facade,/repository\.js|DATA_BACKEND|local:\/\//);
  assert.match(verifier,/updateSupabaseProviderProfileImage\(actor,upload\)/);
  assert.match(verifier,/removeSupabaseProviderProfileImage\(actor\)/);
  assert.match(verifier,/SUPABASE_PROVIDER_PROFILE_DRIVER_ALLOWED/);
  assert.match(verifier,/SUPABASE_PROVIDER_PROFILE_ANONYMOUS_RPC_ALLOWED/);
  assert.match(verifier,/SUPABASE_PROVIDER_PROFILE_IMAGE_OBJECT_RETAINED/);
});

test('every fixture transporter portrait resolves to a distinct repository asset',()=>{
  const fixture=JSON.parse(fs.readFileSync(path.join(root,'resources/fixtures/managed-market.json'),'utf8'));
  const portraits=fixture.tables.company_pages
    .map(page=>page.profile_image_preset)
    .filter(Boolean)
    .sort();

  assert.equal(portraits.length,30);
  assert.equal(new Set(portraits).size,30);
  for(const portrait of portraits){
    assert.match(portrait,/^[a-z0-9-]+\.png$/);
    assert.equal(
      fs.existsSync(path.join(root,'public/marketing/transporters',portrait)),
      true,
      `Missing generated transporter portrait: ${portrait}`,
    );
  }
});
