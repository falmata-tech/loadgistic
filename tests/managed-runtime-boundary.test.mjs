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

test('browser test server selects managed data, Auth, and Storage boundaries',()=>{
  const server=read('scripts/e2e-server.mjs');
  const example=read('.env.example');
  assert.match(server,/DATA_BACKEND = 'supabase'/);
  assert.match(server,/PRIVATE_STORAGE_BACKEND = 'supabase'/);
  assert.doesNotMatch(server,/resetDb|DATABASE_PATH|AUTH_BACKEND = 'local'|DATA_BACKEND = 'sqlite'/);
  assert.match(example,/DATA_BACKEND=supabase/);
  assert.match(example,/PRIVATE_STORAGE_BACKEND=supabase/);
  assert.doesNotMatch(example,/DATABASE_PATH|AUTH_BACKEND=local|PRIVATE_STORAGE_BACKEND=local/);
});
