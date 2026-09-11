import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {projectSupabaseOwnCompanyPage} from '../src/lib/provider-profile/supabase.js';

const root=process.cwd();

test('managed provider profile projection exposes an application image URL without storage references',()=>{
  const custom=projectSupabaseOwnCompanyPage({
    id:'page-1',handle:'safe-provider',name:'Safe Provider',profile_image_is_custom:true,
    profile_image_updated_at:'2026-08-27T00:00:00.000Z',profile_image_preset:'ignored.png'
  });
  assert.equal(custom.profile_image_url,'/api/public/providers/safe-provider/image?v=2026-08-27T00%3A00%3A00.000Z');
  assert.equal(custom.profile_image_is_custom,true);
  assert.equal('profile_image_path' in custom,false);
  const preset=projectSupabaseOwnCompanyPage({handle:'preset-provider',profile_image_is_custom:false,profile_image_preset:'preset-provider.png'});
  assert.equal(preset.profile_image_url,'/marketing/transporters/preset-provider.png');
});

test('managed profile routes use the dedicated application port instead of the SQLite repository',()=>{
  for(const file of [
    'src/app/app/company-page/page.tsx','src/app/api/company-page/route.ts','src/app/api/company-page/image/route.ts'
  ]){
    const source=fs.readFileSync(path.join(root,file),'utf8');
    assert.match(source,/lib\/provider-profile\.js/);
    assert.doesNotMatch(source,/lib\/repository\.js/);
  }
});

test('provider profile migration is owner-scoped, audited, bounded, and service-role-only',()=>{
  const migration=fs.readFileSync(path.join(root,'supabase/migrations/049_managed_provider_profile.sql'),'utf8');
  assert.match(migration,/provider_profile_actor_scope/);
  assert.match(migration,/profile\.active/);
  assert.match(migration,/workspace_access/);
  assert.match(migration,/is_company_driver/);
  assert.match(migration,/char_length\(headline_value\)>120/);
  assert.match(migration,/place_catalog/);
  assert.match(migration,/COMPANY_PAGE_UPDATED/);
  assert.match(migration,/previous_reference/);
  assert.match(migration,/revoke all on function public\.update_provider_profile_page\(uuid,jsonb\) from public,anon,authenticated/);
  assert.match(migration,/grant execute on function public\.update_provider_profile_page\(uuid,jsonb\) to service_role/);
  assert.doesNotMatch(migration,/COMPANY_PAGE_UPDATED[^;]*(phone_value|whatsapp_value|email_value|website_value)/is);
});
