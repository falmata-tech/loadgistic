import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  isNumericEmailOtp,
  localFixturePasswordLoginEnabled,
  localAuthInboxUrl,
  managedAuthCallbackUrl,
  managedWorkspaceDestination,
  normalizeManagedAuthEmail
} from '../src/lib/auth-flow.js';
import {
  createManagedOAuthHandoff,
  managedOAuthCallbackIntent,
  readManagedOAuthHandoff
} from '../src/lib/managed-oauth-flow.js';

test('managed callback is fixed to the deployment-owned HTTPS origin',()=>{
  assert.equal(managedAuthCallbackUrl({
    environment:{NODE_ENV:'production',APP_URL:'https://loadgistic.netlify.app/ignored/path'},
    requestUrl:'https://attacker.example/callback'
  }),'https://loadgistic.netlify.app/api/auth/callback');
  assert.equal(managedAuthCallbackUrl({environment:{NODE_ENV:'production'},requestUrl:'https://loadgistic.netlify.app'}),null);
  assert.equal(managedAuthCallbackUrl({environment:{NODE_ENV:'production',APP_URL:'http://loadgistic.example'}}),null);
  assert.equal(managedAuthCallbackUrl({environment:{NODE_ENV:'production',APP_URL:'https://user:secret@loadgistic.example'}}),null);
  assert.equal(managedAuthCallbackUrl({environment:{NODE_ENV:'development',APP_URL:'http://127.0.0.1:3100'},requestUrl:'http://127.0.0.1:3001/login'}),'http://127.0.0.1:3001/api/auth/callback');
});

test('local Auth code testing points only isolated Supabase at its local inbox',()=>{
  assert.equal(localAuthInboxUrl({NODE_ENV:'development',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55321'}),'http://127.0.0.1:55324');
  assert.equal(localAuthInboxUrl({NODE_ENV:'development',NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co'}),null);
  assert.equal(localAuthInboxUrl({NODE_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55321'}),null);
});

test('managed OAuth callbacks require a signed intent bound to the exact PKCE flow',()=>{
  const previous=process.env.SESSION_SECRET;
  process.env.SESSION_SECRET='managed-oauth-flow-test-secret-longer-than-32-characters';
  try{
    const loginFlow='0123456789abcdef0123456789abcdef';
    const accessFlow='fedcba9876543210fedcba9876543210';
    const login=createManagedOAuthHandoff('LOGIN',loginFlow);
    const access=createManagedOAuthHandoff('ACCESS',accessFlow);
    assert.deepEqual(
      {...readManagedOAuthHandoff(login),expiresAt:'future'},
      {intent:'LOGIN',flowId:loginFlow,expiresAt:'future'}
    );
    assert.ok(readManagedOAuthHandoff(login).expiresAt>Date.now());
    assert.equal(managedOAuthCallbackIntent(login),'LOGIN');
    assert.equal(managedOAuthCallbackIntent(login,loginFlow),'LOGIN');
    assert.equal(managedOAuthCallbackIntent(login,accessFlow),null);
    assert.equal(managedOAuthCallbackIntent(access,accessFlow),'ACCESS');
    assert.equal(managedOAuthCallbackIntent(`${access}altered`,accessFlow),null);
    assert.throws(()=>createManagedOAuthHandoff('LOGIN','short'),/INVALID_MANAGED_OAUTH_FLOW/);
  }finally{
    if(previous===undefined)delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET=previous;
  }
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

test('unified account access requests minimum Google scopes and creates only an inactive OTP identity',()=>{
  const google=readFileSync(new URL('../src/app/api/applications/google/route.ts',import.meta.url),'utf8');
  const otp=readFileSync(new URL('../src/app/api/applications/email-otp/request/route.ts',import.meta.url),'utf8');
  const legacyGoogle=readFileSync(new URL('../src/app/api/auth/google/route.ts',import.meta.url),'utf8');
  const legacyOtp=readFileSync(new URL('../src/app/api/auth/email-otp/request/route.ts',import.meta.url),'utf8');
  const callback=readFileSync(new URL('../src/app/api/auth/callback/route.ts',import.meta.url),'utf8');
  const supabaseClients=['route.ts','server.ts','browser.ts','session-middleware.ts']
    .map(file=>readFileSync(new URL(`../src/lib/supabase/${file}`,import.meta.url),'utf8')).join('\n');
  assert.match(google,/provider:'google'/);
  assert.match(google,/scopes:'openid email profile'/);
  assert.match(google,/redirectTo:callbackUrl/);
  assert.match(google,/createManagedOAuthHandoff\('ACCESS',data\.flowId\)/);
  assert.match(google,/\[MANAGED_OAUTH_COOKIE,MANAGED_SIGNUP_COOKIE\]/);
  assert.match(google,/maxAge:0/);
  assert.match(callback,/managedOAuthCallbackHandoff\(oauthToken,flowId\)/);
  assert.match(callback,/accountAccess&&!signupHandoff/);
  assert.match(callback,/clearOAuthCookie\(response\)/);
  assert.match(callback,/exchangeCodeForSession\(code,\{flowId:oauthHandoff\.flowId\}\)/);
  assert.doesNotMatch(supabaseClients,/appendPkceFlowIdToRedirects/);
  assert.match(google,/managedAuthCallbackUrl\(\{requestUrl:redirectUrl\(request,'\/'\)\.toString\(\)\}\)/);
  assert.match(otp,/managedAuthCallbackUrl\(\{requestUrl:redirectUrl\(request,'\/'\)\.toString\(\)\}\)/);
  assert.match(otp,/shouldCreateUser:true/);
  assert.match(otp,/createProviderSignupHandoff\(email\)/);
  assert.match(otp,/managed-account-email-request'\),10,10\*60_000/);
  assert.match(otp,/managed-account-email-request:\$\{email\}`,5,10\*60_000/);
  assert.match(otp,/Too many code requests\. Try again in about/);
  assert.doesNotMatch(otp,/if\(error\).*MANAGED_AUTH_UNAVAILABLE/s);
  assert.match(legacyGoogle,/applications\/google\/route/);
  assert.match(legacyOtp,/applications\/email-otp\/request\/route/);
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

test('local unified account access explains the isolated inbox before and after an OTP request',()=>{
  const login=readFileSync(new URL('../src/app/login/page.tsx',import.meta.url),'utf8');
  const setup=readFileSync(new URL('../src/app/apply/page.tsx',import.meta.url),'utf8');
  assert.match(login,/title=\{codeStep\?'Enter your code':'Log in'\}/);
  assert.doesNotMatch(login,/Continue to Loadgistic/);
  assert.match(login,/Local testing: open the email inbox/);
  assert.match(login,/Open the local email inbox in a new tab/);
  assert.doesNotMatch(setup,/Continue with Google|Email me a code/);
});

test('signup uses the same managed identity choices but may create only an inactive Auth identity',()=>{
  const google=readFileSync(new URL('../src/app/api/applications/google/route.ts',import.meta.url),'utf8');
  const otp=readFileSync(new URL('../src/app/api/applications/email-otp/request/route.ts',import.meta.url),'utf8');
  const verify=readFileSync(new URL('../src/app/api/applications/email-otp/verify/route.ts',import.meta.url),'utf8');
  const setup=readFileSync(new URL('../src/app/apply/page.tsx',import.meta.url),'utf8');
  const config=readFileSync(new URL('../supabase/config.toml',import.meta.url),'utf8');
  const template=readFileSync(new URL('../supabase/templates/signup-code.html',import.meta.url),'utf8');
  assert.match(google,/provider:'google'/);
  assert.match(google,/scopes:'openid email profile'/);
  assert.match(google,/managedAuthCallbackUrl\(\{requestUrl:redirectUrl\(request,'\/'\)\.toString\(\)\}\)/);
  assert.match(google,/createManagedOAuthHandoff\('ACCESS',data\.flowId\)/);
  assert.match(otp,/managedAuthCallbackUrl\(\{requestUrl:redirectUrl\(request,'\/'\)\.toString\(\)\}\)/);
  assert.match(otp,/shouldCreateUser:true/);
  assert.match(otp,/MANAGED_OAUTH_COOKIE/);
  assert.match(otp,/maxAge:0/);
  assert.match(verify,/readProviderSignupHandoff/);
  assert.match(verify,/projection\.active/);
  assert.match(verify,/type:'signup'/);
  assert.match(verify,/MANAGED_AUTH_ERROR/);
  assert.match(verify,/clearOAuthCookie\(response\)/);
  assert.match(setup,/authenticatedEmail===handoff\.email/);
  assert.match(config,/\[auth\.email\.template\.confirmation\][\s\S]*signup-code\.html/);
  assert.match(template,/\{\{ \.Token \}\}/);
});
