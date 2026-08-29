import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATABASE_PATH='./data/test-provider-profile-image.db';
process.env.PRIVATE_UPLOAD_DIR='./data/test-provider-profile-image-uploads';
const databaseFile=path.resolve(process.cwd(),process.env.DATABASE_PATH);
const uploadDirectory=path.resolve(process.cwd(),process.env.PRIVATE_UPLOAD_DIR);
for(const suffix of ['', '-wal','-shm'])if(fs.existsSync(databaseFile+suffix))fs.rmSync(databaseFile+suffix);
if(fs.existsSync(uploadDirectory))fs.rmSync(uploadDirectory,{recursive:true});
const repo=await import('../src/lib/repository.js');
const {getDb}=await import('../src/lib/db.js');

test('active provider profile images use only the managed storage lifecycle',()=>{
  const facade=fs.readFileSync(path.resolve(process.cwd(),'src/lib/provider-profile.js'),'utf8');
  const verifier=fs.readFileSync(path.resolve(process.cwd(),'scripts/verify-supabase-provider-profile.mjs'),'utf8');
  assert.match(facade,/from '\.\/provider-profile\/supabase\.js'/);
  assert.doesNotMatch(facade,/repository\.js|DATA_BACKEND|local:\/\//);
  assert.match(verifier,/updateSupabaseProviderProfileImage\(actor,upload\)/);
  assert.match(verifier,/removeSupabaseProviderProfileImage\(actor\)/);
  assert.match(verifier,/SUPABASE_PROVIDER_PROFILE_DRIVER_ALLOWED/);
  assert.match(verifier,/SUPABASE_PROVIDER_PROFILE_ANONYMOUS_RPC_ALLOWED/);
  assert.match(verifier,/SUPABASE_PROVIDER_PROFILE_IMAGE_OBJECT_RETAINED/);
});

test('every seeded transporter portrait resolves to a distinct repository asset',()=>{
  const portraits=getDb().prepare(`
    SELECT profile_image_preset
    FROM company_pages
    WHERE (id IN ('page-transporter','page-driver')
        OR id LIKE 'page-public-fleet-%'
        OR id LIKE 'page-public-owner-%')
      AND profile_image_preset IS NOT NULL
    ORDER BY profile_image_preset
  `).all();

  assert.equal(portraits.length,30);
  assert.equal(new Set(portraits.map(({profile_image_preset})=>profile_image_preset)).size,30);
  for(const {profile_image_preset} of portraits){
    assert.match(profile_image_preset,/^[a-z0-9-]+\.png$/);
    assert.equal(
      fs.existsSync(path.resolve(process.cwd(),'public/marketing/transporters',profile_image_preset)),
      true,
      `Missing generated transporter portrait: ${profile_image_preset}`,
    );
  }
});
