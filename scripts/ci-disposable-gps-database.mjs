// CI-only lifecycle for the GPS race-test clone. Supabase's local DB URL is
// used by host PostgreSQL clients so Docker exec is not on the clone path.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {checkedLocalGpsPassword,checkedLocalRestoreRole,runGpsClonePipeline} from './ci-disposable-gps-clone.mjs';

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
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: options.timeout ?? 20_000,
      env: options.env ?? process.env,
    }).trim();
  } catch (error) {
    // The CLI status includes keys. Never include its stdout/stderr in CI logs.
    throw new Error(`${program} failed during ${mode}: ${error.code ?? error.status ?? 'unknown'}`);
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
assert.equal(major, 17, 'PostgreSQL 17 host client is required for the local server');
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
assert.equal(serverMajor, major, 'PostgreSQL host client/server major version mismatch');
// Local Supabase makes this role available on the same checked loopback server.
// The full catalog needs its privileges; postgres cannot SET ROLE to it.
const restoreEnv = {...pgEnv, PGUSER: 'supabase_admin'};
checkedLocalRestoreRole(localCommand('psql', [
  '-X', '-A', '-t', '-q', '-c', 'select current_user',
], {env: restoreEnv}));

async function clone() {
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
