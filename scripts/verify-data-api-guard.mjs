// FEAT-SEC-001: fixed local target; never accepts a hosted URL or credential.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function sql(source, expectedFailure) {
  const result = spawnSync('docker', ['exec', '-i', 'supabase_db_loadgistic-local',
    'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
  { input: source, encoding: 'utf8', timeout: 45000, maxBuffer: 1024 * 1024 });
  if (expectedFailure) {
    if (result.status === 0 || !result.stderr?.includes(expectedFailure)) throw Error('EXPECTED_SQL_DENIAL_MISSING');
  } else if (result.status !== 0) throw Error('LOCAL_GUARD_SQL_FAILED');
  return result.stdout.trim();
}
function check(condition, label) {
  if (!condition) throw Error(label);
  console.log(`Passed: ${label}`);
}
const gate = readFileSync(new URL('./check-data-api-guard.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/097_data_api_request_guard.sql', import.meta.url), 'utf8');
const body = migration.split('$guard$')[1];
check(sql('select md5(prosrc) from pg_proc where oid=\'loadgistic_api_guard.check_request()\'::regprocedure;') ===
  createHash('md5').update(body).digest('hex'), 'installed function matches reviewed migration');
sql(`begin; ${gate} rollback;`);
sql(readFileSync(new URL('../tests/sql/data-api-guard.sql', import.meta.url), 'utf8'));
for (const [change, error] of [
  ['alter role authenticator reset pgrst.db_pre_request;', 'DATA_API_GUARD_SETTING_REQUIRED'],
  ["alter role authenticator in database postgres set pgrst.db_pre_request='other.guard';", 'DATA_API_GUARD_SETTING_REQUIRED'],
  ['alter function loadgistic_api_guard.check_request() security definer;', 'DATA_API_GUARD_FUNCTION_REQUIRED'],
  ['grant create on schema loadgistic_api_guard to authenticated;', 'DATA_API_GUARD_PRIVILEGES_INVALID'],
  ['grant execute on function loadgistic_api_guard.check_request() to public;', 'DATA_API_GUARD_PUBLIC_EXECUTE_FORBIDDEN'],
]) sql(`begin; ${change} ${gate} rollback;`, error);
sql(`begin; alter role authenticator set pgrst.db_pre_request='other.guard'; ${migration} rollback;`,
  'EXISTING_DATA_API_HOOK_REQUIRES_REVIEW');
sql(`begin; ${migration} ${gate} rollback;`);
console.log('Passed: catalog regressions, existing-hook refusal and repeatability (rolled back)');

const status = spawnSync('supabase', ['status', '--output', 'json'], { encoding: 'utf8', timeout: 30000 });
if (status.status !== 0) throw Error('LOCAL_RUNTIME_UNAVAILABLE');
const runtime = JSON.parse(status.stdout);
const url = new URL(runtime.API_URL);
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.protocol !== 'http:') throw Error('REMOTE_API_REFUSED');
const { ANON_KEY: anonKey, SERVICE_ROLE_KEY: serviceKey } = runtime;
if (!anonKey || !serviceKey) throw Error('LOCAL_KEYS_UNAVAILABLE');
const client = createClient(url.href, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
async function request(token, path, method = 'GET', body, extra = {}) {
  const response = await fetch(new URL(path, url), {
    method, headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000),
  });
  let json; try { json = await response.json(); } catch { /* HEAD has no body. */ }
  return { status: response.status, json };
}
const denied = result => [401, 403].includes(result.status) && result.json?.message === 'BROWSER_DATA_API_ACCESS_DENIED';
async function eventually(fn, label) {
  const deadline = Date.now() + 60000;
  do {
    if (await fn()) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
  } while (Date.now() < deadline);
  throw Error(label);
}
let created = false, graphqlCreated = false;
try {
  await eventually(async () => denied(await request(anonKey, '/rest/v1/capacities?select=id&limit=0')), 'GUARD_ACTIVATION_NOT_CONFIRMED');
  if (sql("select exists(select 1 from pg_extension where extname='pg_graphql')::text;") === 'false') {
    sql('create extension pg_graphql;');
    graphqlCreated = true;
  }
  // Deliberately accessible synthetic data proves the hook, independently of ACLs/RLS.
  // Refuse a collision rather than replacing any existing object.
  sql(`begin; create table public.data_api_guard_probe(id integer primary key,label text);
    alter table public.data_api_guard_probe enable row level security;
    create policy probe_only on public.data_api_guard_probe for all to anon,authenticated using(true) with check(true);
    grant select,insert,update,delete on public.data_api_guard_probe to anon,authenticated,service_role;
    insert into public.data_api_guard_probe values(1,'synthetic');
    create function public.data_api_guard_probe_rpc() returns integer language sql security invoker as 'select 1';
    grant execute on function public.data_api_guard_probe_rpc() to anon,authenticated,service_role;
    set local role anon; select id from public.data_api_guard_probe;
    reset role; notify pgrst,'reload schema'; commit;`);
  created = true;
  const probe = '/rest/v1/data_api_guard_probe';
  await eventually(async () => (await request(serviceKey, `${probe}?select=id`)).status === 200, 'PROBE_SCHEMA_NOT_READY');
  const login = await client.auth.signInWithPassword({ email: 'transporter@loadgistic.local', password: 'Loadgistic123!' });
  if (login.error || !login.data.session) throw Error('LOCAL_FIXTURE_LOGIN_FAILED');
  for (const [name, token] of [['anon', anonKey], ['authenticated', login.data.session.access_token]]) {
    for (let i = 0; i < 3; i++) check(denied(await request(token, `${probe}?select=id`)), `${name} read denial ${i + 1}`);
    for (const [method, query, body] of [
      ['POST', '', { id: 99, label: 'forbidden' }],
      ['PATCH', '?id=eq.1', { label: 'forbidden' }], ['DELETE', '?id=eq.1', undefined],
    ]) check(denied(await request(token, probe + query, method, body)), `${name} ${method} denied`);
    check(denied(await request(token, probe, 'GET', undefined,
      { 'X-Role': 'service_role', role: 'service_role', 'X-Client-Info': 'loadgistic-server' })), `${name} forged headers denied`);
    check(denied(await request(token, '/graphql/v1', 'POST', { query: '{__typename}' })), `${name} GraphQL denied`);
    check(denied(await request(token, '/rest/v1/rpc/data_api_guard_probe_rpc', 'POST', {})), `${name} other RPC denied`);
  }
  const graph = await request(serviceKey, '/graphql/v1', 'POST', { query: '{__typename}' });
  check(graph.status === 200 && !graph.json?.errors, 'GraphQL engine available to service');
  for (const method of ['GET', 'HEAD', 'POST']) {
    const identity = await request(login.data.session.access_token, '/rest/v1/rpc/current_user_projection', method, method === 'POST' ? {} : undefined);
    check(identity.status === 200 && (method === 'HEAD' || identity.json?.id === login.data.user.id), `authenticated own identity ${method}`);
  }
  check(denied(await request(anonKey, '/rest/v1/rpc/current_user_projection', 'POST', {})), 'anonymous identity denied');
  check((await request(serviceKey, '/rest/v1/capacities?select=id&limit=1')).status === 200, 'service application read');
  check(sql("begin; set local role service_role; set local search_path=public,extensions,pg_temp; select exists(select 1 from spatial_ref_sys where srid=4326); rollback;") === 't', 'service geography reference lookup');
  const spatial = await request(serviceKey, '/rest/v1/rpc/public_capacity_page', 'POST',
    { query: { near_lat: 9, near_lng: 38, near_radius_km: 500 } });
  check(spatial.status === 200 && Array.isArray(spatial.json), 'service geography application query');
  check((await request(serviceKey, probe, 'POST', { id: 2, label: 'service' })).status === 201, 'service write');
  const rows = await request(serviceKey, `${probe}?select=id,label&order=id`);
  check(rows.json?.length === 2 && rows.json[0].label === 'synthetic', 'denied writes left original row unchanged');
} finally {
  if (created) sql("begin; drop function public.data_api_guard_probe_rpc(); drop table public.data_api_guard_probe; notify pgrst,'reload schema'; commit;");
  if (graphqlCreated) sql('drop extension pg_graphql;');
  await client.auth.signOut();
}
sql(`begin; ${gate} rollback;`);
check(sql("select (to_regclass('public.data_api_guard_probe') is null)::text;") === 'true', 'synthetic table removed and guard retained');
