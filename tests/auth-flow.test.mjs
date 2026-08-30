import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  isNumericEmailOtp,
  localFixturePasswordLoginEnabled,
  managedAuthCallbackUrl,
  managedWorkspaceDestination,
  normalizeManagedAuthEmail
} from '../src/lib/auth-flow.js';

test('managed callback is fixed to the deployment-owned HTTPS origin',()=>{
  assert.equal(managedAuthCallbackUrl({
    environment:{NODE_ENV:'production',APP_URL:'https://loadgistic.netlify.app/ignored/path'},
    requestUrl:'https://attacker.example/callback'
  }),'https://loadgistic.netlify.app/api/auth/callback');
  assert.equal(managedAuthCallbackUrl({environment:{NODE_ENV:'production'},requestUrl:'https://loadgistic.netlify.app'}),null);
  assert.equal(managedAuthCallbackUrl({environment:{NODE_ENV:'production',APP_URL:'http://loadgistic.example'}}),null);
  assert.equal(managedAuthCallbackUrl({environment:{NODE_ENV:'production',APP_URL:'https://user:secret@loadgistic.example'}}),null);
  assert.equal(managedAuthCallbackUrl({environment:{NODE_ENV:'development'},requestUrl:'http://127.0.0.1:3000/login'}),'http://127.0.0.1:3000/api/auth/callback');
});

test('fixture passwords are explicitly non-production only',()=>{
  assert.equal(localFixturePasswordLoginEnabled({NODE_ENV:'development',ENABLE_LOCAL_FIXTURE_PASSWORD_LOGIN:'true'}),true);
  assert.equal(localFixturePasswordLoginEnabled({NODE_ENV:'development'}),false);
  assert.equal(localFixturePasswordLoginEnabled({NODE_ENV:'production',ENABLE_LOCAL_FIXTURE_PASSWORD_LOGIN:'true'}),false);
});

test('email-code inputs are bounded and normalized without account disclosure',()=>{
  assert.equal(normalizeManagedAuthEmail(' Provider@Example.COM '),'provider@example.com');
  assert.equal(normalizeManagedAuthEmail('not-an-email'),null);
  assert.equal(isNumericEmailOtp('123456'),true);
  assert.equal(isNumericEmailOtp('12345678'),false);
  assert.equal(isNumericEmailOtp('12345'),false);
  assert.equal(isNumericEmailOtp('123 456'),false);
  assert.equal(managedWorkspaceDestination('SUPPORT'),'/support');
  assert.equal(managedWorkspaceDestination('DRIVER'),'/app/home');
});

test('managed adapters request minimum Google scopes and never create an OTP user',()=>{
  const google=readFileSync(new URL('../src/app/api/auth/google/route.ts',import.meta.url),'utf8');
  const otp=readFileSync(new URL('../src/app/api/auth/email-otp/request/route.ts',import.meta.url),'utf8');
  const callback=readFileSync(new URL('../src/app/api/auth/callback/route.ts',import.meta.url),'utf8');
  assert.match(google,/provider:'google'/);
  assert.match(google,/scopes:'openid email profile'/);
  assert.match(google,/redirectTo:callbackUrl/);
  assert.match(otp,/shouldCreateUser:false/);
  assert.match(callback,/exchangeCodeForSession\(code,flowId\?\{flowId\}:undefined\)/);
  assert.doesNotMatch(callback,/searchParams\.get\(['"]next['"]\)/);
});

test('local Google OAuth uses an ignored environment boundary and a dedicated callback',()=>{
  const config=readFileSync(new URL('../supabase/config.toml',import.meta.url),'utf8');
  const starter=readFileSync(new URL('../scripts/start-local-supabase.mjs',import.meta.url),'utf8');
  const workflow=readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
  assert.match(config,/\[auth\.external\.google\][\s\S]*enabled = true/);
  assert.match(config,/client_id = "env\(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID\)"/);
  assert.match(config,/secret = "env\(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET\)"/);
  assert.match(config,/site_url = "http:\/\/127\.0\.0\.1:3100"/);
  assert.match(starter,/\.local','google-oauth\.env'/);
  assert.match(starter,/INSECURE_LOCAL_GOOGLE_OAUTH_FILE_PERMISSIONS/);
  assert.match(starter,/stdio:\['ignore','ignore','inherit'\]/);
  assert.match(starter,/local-google-not-configured\.apps\.googleusercontent\.com/);
  assert.doesNotMatch(starter,/console\.log\([^)]*clientSecret/);
  assert.equal((workflow.match(/npm run supabase:start/g)||[]).length,2);
});

test('signup uses the same managed identity choices but may create only an inactive Auth identity',()=>{
  const google=readFileSync(new URL('../src/app/api/applications/google/route.ts',import.meta.url),'utf8');
  const otp=readFileSync(new URL('../src/app/api/applications/email-otp/request/route.ts',import.meta.url),'utf8');
  const verify=readFileSync(new URL('../src/app/api/applications/email-otp/verify/route.ts',import.meta.url),'utf8');
  const config=readFileSync(new URL('../supabase/config.toml',import.meta.url),'utf8');
  const template=readFileSync(new URL('../supabase/templates/signup-code.html',import.meta.url),'utf8');
  assert.match(google,/provider:'google'/);
  assert.match(google,/scopes:'openid email profile'/);
  assert.match(otp,/shouldCreateUser:true/);
  assert.match(verify,/readProviderSignupHandoff/);
  assert.match(verify,/projection\.active/);
  assert.match(verify,/type:'signup'/);
  assert.match(config,/\[auth\.email\.template\.confirmation\][\s\S]*signup-code\.html/);
  assert.match(template,/\{\{ \.Token \}\}/);
});
