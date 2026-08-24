import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('supabase/migrations/045_managed_provider_signup.sql','utf8');
const route=fs.readFileSync('src/app/api/applications/route.ts','utf8');
const callback=fs.readFileSync('src/app/api/auth/callback/route.ts','utf8');
const page=fs.readFileSync('src/app/apply/page.tsx','utf8');

test('managed signup accepts only the three provider operating models without a password',async()=>{
  const {normalizeProviderSignupInput}=await import('../src/lib/provider-signup.js');
  for(const applicationType of ['TRANSPORT_COMPANY','OWNER_OPERATOR','SELF_MANAGED_DRIVER']){
    const result=normalizeProviderSignupInput({
      name:'Aster Bekele',businessName:'Aster Transport',phone:'+251 911 000 000',applicationType
    });
    assert.equal(result.ok,true);
    assert.equal(result.input.applicationType,applicationType);
  }
  assert.equal(normalizeProviderSignupInput({name:'Aster',businessName:'Aster Transport',phone:'+251911000000',applicationType:'COMPANY_DRIVER'}).ok,false);
  assert.doesNotMatch(page,/name="password"|type="password"/i);
  assert.match(page,/Continue with Google/i);
});

test('signup intent and provisioning commands are server-only and authority activates last',()=>{
  assert.match(migration,/provider_signup_intents[\s\S]*token_digest text not null unique/i);
  assert.match(migration,/expires_at>now\(\)[\s\S]*for update/i);
  assert.match(migration,/after insert on auth\.users/i);
  assert.match(migration,/values\(new\.id[\s\S]*'DRIVER',false/i);
  assert.match(migration,/interval '7 days'/i);
  assert.match(migration,/insert into public\.company_pages/i);
  assert.match(migration,/insert into public\.subscriptions/i);
  assert.match(migration,/insert into public\.applications/i);
  const activation=migration.indexOf('update public.profiles set');
  assert.ok(activation>migration.indexOf('insert into public.applications'));
  assert.match(migration,/role=target_role,active=true/i);
  for(const signature of [
    'prepare_provider_signup_intent(text,text,text,text,text,text,timestamptz)',
    'complete_provider_signup(uuid,text)'
  ]){
    assert.ok(migration.toLowerCase().includes(`revoke all on function public.${signature} from public,anon,authenticated`));
    assert.ok(migration.toLowerCase().includes(`grant execute on function public.${signature} to service_role`));
  }
  assert.doesNotMatch(migration,/grant execute on function public\.complete_provider_signup\(uuid,text\) to (?:anon|authenticated)/i);
});

test('public signup hands a short-lived intent to fixed Google callback and never calls SQLite signup',()=>{
  assert.match(route,/prepareManagedProviderSignup/);
  assert.match(route,/MANAGED_SIGNUP_MAX_AGE_SECONDS/);
  assert.match(route,/scopes:'openid email profile'/);
  assert.doesNotMatch(route,/createBusinessApplication|@\/lib\/repository/);
  assert.match(callback,/completeManagedProviderSignup/);
  assert.match(callback,/projection\?\.active/);
  assert.match(callback,/maxAge:0/);
});
