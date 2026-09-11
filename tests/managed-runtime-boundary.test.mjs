import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read=relative=>readFileSync(new URL(`../${relative}`,import.meta.url),'utf8');

test('identity runtime always uses managed Supabase Auth without SQLite or signed-cookie fallback',()=>{
  const auth=read('src/lib/auth.ts');
  const login=read('src/app/api/auth/login/route.ts');
  const logout=read('src/app/api/auth/logout/route.ts');
  const middleware=read('src/middleware.ts');
  const sessionMiddleware=read('src/lib/supabase/session-middleware.ts');
  const config=read('src/lib/supabase/config.ts');

  assert.match(auth,/createSupabaseServerClient/);
  assert.match(login,/auth\.signInWithPassword/);
  assert.match(login,/localFixturePasswordLoginEnabled/);
  assert.match(logout,/auth\.signOut/);
  assert.match(middleware,/refreshSupabaseSession/);
  assert.match(sessionMiddleware,/auth\.getUser\(\)/);
  for(const source of [auth,login,logout,middleware,sessionMiddleware,config]){
    assert.doesNotMatch(source,/repository\.js|AUTH_BACKEND|usesSupabaseAuth|lg_session/);
  }
});

test('retired authenticated Directory redirects safely and exposes no repository search',()=>{
  const collection=read('src/app/app/providers/page.tsx');
  const detail=read('src/app/app/providers/[handle]/page.tsx');
  const companies=read('src/app/companies/page.tsx');
  const company=read('src/app/companies/[handle]/page.tsx');
  const search=read('src/app/api/directory/search/route.ts');
  const nextConfig=read('next.config.mjs');

  assert.match(collection,/redirect\(`\/\$\{suffix\}`\)/);
  assert.match(companies,/redirect\(`\/\$\{suffix\}`\)/);
  assert.match(detail,/redirect\(`\/providers\/\$\{encodeURIComponent\(handle\)\}`\)/);
  assert.match(company,/redirect\(`\/providers\/\$\{encodeURIComponent\(handle\)\}`\)/);
  assert.match(search,/DIRECTORY_RETIRED/);
  assert.match(search,/status:410/);
  assert.match(nextConfig,/source:'\/app\/providers',destination:'\/'/);
  assert.match(nextConfig,/source:'\/app\/providers\/:handle',destination:'\/providers\/:handle'/);
  assert.match(nextConfig,/source:'\/companies',destination:'\/'/);
  assert.match(nextConfig,/source:'\/companies\/:handle',destination:'\/providers\/:handle'/);
  for(const source of [collection,detail,companies,company,search]){
    assert.doesNotMatch(source,/repository\.js|listDirectoryProfiles|searchDirectory|getPublicCompany/);
  }
});

test('browser test server has no selectable data, Auth, or Storage fallback',()=>{
  const server=read('scripts/e2e-server.mjs');
  const example=read('.env.example');
  const health=read('src/app/api/health/route.ts');
  const storage=read('src/lib/private-storage.js');
  const limits=read('src/lib/rate-limit.js');
  assert.doesNotMatch(server,/resetDb|DATABASE_PATH|AUTH_BACKEND|DATA_BACKEND|PRIVATE_STORAGE_BACKEND/);
  assert.doesNotMatch(example,/DATABASE_PATH|AUTH_BACKEND|DATA_BACKEND|PRIVATE_STORAGE_BACKEND/);
  assert.doesNotMatch(health,/db\.js|sqlite|DATA_BACKEND/);
  assert.doesNotMatch(storage,/node:fs|local:\/\/|PRIVATE_STORAGE_BACKEND|PRIVATE_UPLOAD_DIR/);
  assert.doesNotMatch(limits,/globalBuckets|checkMemoryRateLimit|DATA_BACKEND/);
});

test('every active data facade imports only its managed adapter',()=>{
  for(const relative of [
    'src/lib/access-email.js','src/lib/capacity-market.js','src/lib/place-search.js',
    'src/lib/provider-capacity.js','src/lib/provider-profile.js','src/lib/provider-tracking.js',
    'src/lib/public-featured.js','src/lib/public-provider.js'
  ]){
    const source=read(relative);
    assert.doesNotMatch(source,/repository\.js|DATA_BACKEND|usesManagedData|legacy\(/,relative);
    assert.match(source,/supabase\.js/,relative);
  }
});
