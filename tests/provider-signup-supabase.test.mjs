import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('supabase/migrations/045_managed_provider_signup.sql','utf8');
const route=fs.readFileSync('src/app/api/applications/route.ts','utf8');
const google=fs.readFileSync('src/app/api/applications/google/route.ts','utf8');
const otpRequest=fs.readFileSync('src/app/api/applications/email-otp/request/route.ts','utf8');
const otpVerify=fs.readFileSync('src/app/api/applications/email-otp/verify/route.ts','utf8');
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
  assert.match(page,/Email me a code/i);
  assert.match(page,/provider-details-form/i);
});

test('signup handoff is signed, short lived, and keeps the account email private',async()=>{
  const previous=process.env.SESSION_SECRET;
  process.env.SESSION_SECRET='provider-signup-test-secret-longer-than-32-characters';
  try{
    const {createProviderSignupHandoff,maskedProviderSignupEmail,readProviderSignupHandoff}=await import('../src/lib/provider-signup.js');
    const token=createProviderSignupHandoff(' New.Provider@Example.com ');
    const handoff=readProviderSignupHandoff(token);
    assert.equal(handoff.email,'new.provider@example.com');
    assert.ok(handoff.expiresAt>Date.now());
    assert.equal(maskedProviderSignupEmail(handoff.email),'ne••••••@example.com');
    assert.equal(readProviderSignupHandoff(`${token}altered`),null);
    assert.equal(readProviderSignupHandoff(createProviderSignupHandoff()).email,null);
  }finally{
    if(previous===undefined)delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET=previous;
  }
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

test('public signup proves identity first and provisions only after an authenticated details submission',()=>{
  assert.match(google,/MANAGED_SIGNUP_MAX_AGE_SECONDS/);
  assert.match(google,/scopes:'openid email profile'/);
  assert.match(google,/createProviderSignupHandoff\(\)/);
  assert.match(otpRequest,/shouldCreateUser:true/);
  assert.match(otpRequest,/emailRedirectTo:callbackUrl/);
  assert.match(otpRequest,/createProviderSignupHandoff\(email\)/);
  assert.match(otpVerify,/verifyOtp\(\{email:handoff\.email,token:code,type:'signup'\}\)/);
  assert.match(otpVerify,/verifyOtp\(\{email:handoff\.email,token:code,type:'email'\}\)/);
  assert.match(otpVerify,/authenticatedEmail!==handoff\.email/);
  assert.match(otpVerify,/redirectUrl\(request,'\/apply\?step=details'\)/);
  assert.match(callback,/readProviderSignupHandoff/);
  assert.match(callback,/authenticatedEmail!==signupHandoff\.email/);
  assert.match(callback,/\/apply\?step=details/);
  assert.doesNotMatch(callback,/completeManagedProviderSignup/);
  assert.match(route,/prepareManagedProviderSignup/);
  assert.match(route,/client\.auth\.getUser\(\)/);
  assert.match(route,/handoff\.email&&authenticatedEmail!==handoff\.email/);
  assert.match(route,/completeManagedProviderSignup/);
  assert.doesNotMatch(route,/createBusinessApplication|@\/lib\/repository/);
  assert.match(route,/clearSignupCookie/);
});
