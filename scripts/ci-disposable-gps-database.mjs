// CI-only lifecycle for the GPS race-test clone. Supabase's local DB URL is
// used by host PostgreSQL clients so Docker exec is not on the clone path.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkedLocalGpsPassword,checkedLocalRestoreRole,checkedMatchingPgMajor,postgresErrorCategory,runGpsClonePipeline,splitPgGraphqlAclToc} from './ci-disposable-gps-clone.mjs';

const container = 'supabase_db_loadgistic-local';
const database = 'loadgistic_telematics_ci';
const mode = process.argv[2];
assert.equal(process.env.CI, 'true', 'This clone lifecycle is CI-only');
assert.ok(mode === 'create' || mode === 'remove', 'Use create or remove');
assert.equal(process.env.LOADGISTIC_TEST_DATABASE, database, 'Wrong disposable database');

const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8');
assert.match(config, /^project_id\s*=\s*"loadgistic-local"\s*$/m);
assert.match(config, /^\[db\]\s*\nport\s*=\s*55322\s*$/m);

function localCommand(program, args, options = {}) {
  try {
    return execFileSync(program, args, {
      encoding: 'utf8',
      stdio: [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      input: options.input,
      timeout: options.timeout ?? 20_000,
      env: options.env ?? process.env,
    }).trim();
  } catch (error) {
    // The CLI status includes keys. Never include its stdout/stderr in CI logs.
    const category = /^(?:pg_dump|pg_restore|psql)$/.test(program)
      ? postgresErrorCategory(String(error.stderr ?? '')) : 'command-failed';
    throw new Error(`${program} failed during ${mode}: ${error.code ?? error.status ?? 'unknown'}; category=${category}`);
  }
}

let label;
try {
  label = localCommand('docker', [
    'inspect', '--format', '{{ index .Config.Labels "com.supabase.cli.project" }}', container,
  ], {timeout: 10_000});
} catch (error) {
  if (mode === 'remove') {
    console.log('Disposable GPS database container is absent; no cleanup needed');
    process.exit(0);
  }
  throw error;
}
assert.equal(label, 'loadgistic-local', 'Wrong local Supabase project');

let status;
try {
  status = JSON.parse(localCommand('supabase', ['status', '-o', 'json']));
} catch {
  throw new Error('Could not read structured local Supabase status');
}
const localPassword = checkedLocalGpsPassword(status);

const clientVersion = localCommand('pg_dump', ['--version']);
const major = Number(clientVersion.match(/PostgreSQL\)\s+(\d+)/)?.[1]);
const pgEnv = {
  ...process.env,
  PGHOST: '127.0.0.1',
  PGHOSTADDR: '127.0.0.1',
  PGPORT: '55322',
  PGUSER: 'postgres',
  PGDATABASE: 'postgres',
  PGPASSWORD: localPassword,
  PGSSLMODE: 'disable',
  PGCONNECT_TIMEOUT: '5',
};
delete pgEnv.PGSERVICE;
delete pgEnv.PGSERVICEFILE;
delete pgEnv.PGOPTIONS;

assert.equal(localCommand('psql', ['-X', '-A', '-t', '-q', '-c', 'select current_database()'],
  {env: pgEnv}), 'postgres', 'Not connected to the isolated local primary');
const serverMajor = Math.floor(Number(localCommand('psql', [
  '-X', '-A', '-t', '-q', '-c', 'show server_version_num',
], {env: pgEnv})) / 10000);
checkedMatchingPgMajor(major, serverMajor);
// Local Supabase makes this role available on the same checked loopback server.
// The full catalog needs its privileges; postgres cannot SET ROLE to it.
const restoreEnv = {...pgEnv, PGUSER: 'supabase_admin'};
checkedLocalRestoreRole(localCommand('psql', [
  '-X', '-A', '-t', '-q', '-c', 'select current_user',
], {env: restoreEnv}));

async function clone() {
  if (major === 15) {
    clonePg15WithGraphqlAclOrder();
    return;
  }
  // Use the verified local admin role for the full Supabase catalog. The
  // checked postgres login creates the disposable database, but cannot SET
  // ROLE to supabase_admin during pg_restore.
  await runGpsClonePipeline({
    dumpCommand: 'pg_dump', dumpArgs: ['-Fc', '-d', 'postgres'],
    restoreCommand: 'pg_restore',
    restoreArgs: ['-d', database, '--exit-on-error'],
    env: restoreEnv,
  });
}

function clonePg15WithGraphqlAclOrder() {
  const directory = mkdtempSync(join(tmpdir(), 'loadgistic-gps-ci-'));
  const archive = join(directory, 'catalog.dump');
  const mainList = join(directory, 'catalog-main.list');
  const deferredList = join(directory, 'graphql-acl.list');
  const wrapper = 'graphql_public.graphql(text,text,jsonb,jsonb)';
  const identitySql = `select md5(pg_get_functiondef(p.oid)) || '|' || md5(coalesce(p.proacl::text,''))
    from pg_proc p where p.oid=to_regprocedure('${wrapper}')`;
  const extensionSql = `select e.extname from pg_depend d join pg_extension e on e.oid=d.refobjid
    where d.classid='pg_proc'::regclass and d.objid=to_regprocedure('${wrapper}')
    and d.deptype='e'`;
  const query = (db, sql) => localCommand('psql', ['-X', '-A', '-t', '-q', '-d', db, '-c', sql],
    {env: restoreEnv, timeout: 30_000});
  try {
    // An archive is needed to defer exactly one broken Supabase PG15 ACL. It
    // stays in a private temporary directory and is removed even on failure.
    localCommand('pg_dump', ['-Fc', '-d', 'postgres', '-f', archive],
      {env: restoreEnv, timeout: 120_000});
    const lists = splitPgGraphqlAclToc(localCommand('pg_restore', ['-l', archive],
      {env: restoreEnv, timeout: 30_000}));
    writeFileSync(mainList, lists.main, {mode: 0o600});
    writeFileSync(deferredList, lists.deferred, {mode: 0o600});
    assert.equal(query('postgres', extensionSql), 'pg_graphql',
      'Source GraphQL wrapper must belong to Supabase pg_graphql');
    const sourceIdentity = query('postgres', identitySql);
    assert.match(sourceIdentity, /^[a-f0-9]{32}\|[a-f0-9]{32}$/);
    localCommand('pg_restore', ['-d', database, '--exit-on-error', '-L', mainList, archive],
      {env: restoreEnv, timeout: 120_000});
    assert.equal(query(database, `select to_regprocedure('${wrapper}') is null`), 't',
      'Expected Supabase PostgreSQL 15 GraphQL wrapper restore gap changed');
    const definition = query('postgres', `select pg_get_functiondef('${wrapper}'::regprocedure)`);
    assert.ok(definition.startsWith('CREATE OR REPLACE FUNCTION graphql_public.graphql('),
      'Unexpected Supabase GraphQL wrapper definition');
    localCommand('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', database, '-f', '-'],
      {env: restoreEnv, input: `${definition}\n`, timeout: 30_000});
    localCommand('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', database,
      '-c', `alter extension pg_graphql add function ${wrapper}`],
    {env: restoreEnv, timeout: 30_000});
    localCommand('pg_restore', ['-d', database, '--exit-on-error', '-L', deferredList, archive],
      {env: restoreEnv, timeout: 30_000});
    assert.equal(query(database, extensionSql), 'pg_graphql',
      'Restored GraphQL wrapper lost Supabase extension ownership');
    assert.equal(query(database, identitySql), sourceIdentity,
      'Restored GraphQL wrapper definition or grants differ from source');
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
}

if (mode === 'create') {
  localCommand('createdb', ['--owner=postgres', database], {env: pgEnv, timeout: 60_000});
  await clone();
  assert.equal(localCommand('psql', [
    '-X', '-A', '-t', '-q', '-d', database, '-c', 'select current_database()',
  ], {env: pgEnv}), database, 'GPS clone identity mismatch');
  console.log('Disposable Loadgistic GPS database cloned through local PostgreSQL port');
} else {
  localCommand('dropdb', ['--force', '--if-exists', database], {env: pgEnv, timeout: 60_000});
  console.log('Disposable Loadgistic GPS database removed');
}
