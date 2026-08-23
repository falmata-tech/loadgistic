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

const png=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc0000004010100f689891d0000000049454e44ae426082','hex');

test('provider owner controls one validated public profile image without exposing storage',async()=>{
  const owner=repo.findUserByEmail('transporter@loadgistic.local');
  const companyDriver=repo.findUserByEmail('company-driver@loadgistic.local');
  const upload=new File([png],'provider.png',{type:'image/png'});
  await assert.rejects(()=>repo.updateProviderProfileImage(companyDriver,upload),/FORBIDDEN/);
  await assert.rejects(()=>repo.updateProviderProfileImage(owner,new File([Buffer.from('%PDF-1.4')],'profile.pdf',{type:'application/pdf'})),/PROFILE_IMAGE_TYPE_INVALID/);
  await repo.updateProviderProfileImage(owner,upload);
  const own=repo.getOwnCompanyPage(owner);
  assert.match(own.profile_image_url,/^\/api\/public\/providers\/blueline-transport\/image\?v=/);
  const publicProvider=repo.getPublicProvider('blueline-transport');
  assert.equal(publicProvider.profile_image_url,own.profile_image_url);
  assert.equal(JSON.stringify(publicProvider).includes('profile_image_path'),false);
  const image=repo.getPublicProviderProfileImage('blueline-transport');
  assert.equal(image.mime_type,'image/png');
  assert.ok(image.file_path.startsWith('local://provider-profile/'));
  await repo.removeProviderProfileImage(owner);
  assert.equal(repo.getPublicProvider('blueline-transport').profile_image_url,'/marketing/transporters/blueline-transport.png');
  assert.equal(repo.getPublicProviderProfileImage('blueline-transport'),undefined);
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
