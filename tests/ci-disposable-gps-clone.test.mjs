import test from 'node:test';
import assert from 'node:assert/strict';
import {postgresErrorCategory, runGpsClonePipeline} from '../scripts/ci-disposable-gps-clone.mjs';

const child = (source) => [process.execPath, ['-e', source]];

function run(dumpSource, restoreSource, options = {}) {
  const [dumpCommand, dumpArgs] = child(dumpSource);
  const [restoreCommand, restoreArgs] = child(restoreSource);
  return runGpsClonePipeline({
    dumpCommand, dumpArgs, restoreCommand, restoreArgs,
    env: process.env, timeoutMs: 10_000, killAfterMs: 500, ...options,
  });
}

test('GPS CI clone accepts a complete streamed dump and restore', async () => {
  await run(
    'process.stdout.write("fixture");',
    'let text="";process.stdin.on("data",chunk=>text+=chunk);process.stdin.on("end",()=>process.exit(text==="fixture"?0:1));',
  );
});

test('GPS CI clone stops dump promptly when restore fails and never prints raw stderr', async () => {
  const started = Date.now();
  await assert.rejects(
    run(
      'setInterval(()=>process.stdout.write("fixture"),10);',
      'process.stderr.write("pg_restore: error: role private-credential does not exist\\n");process.exit(1);',
    ),
    (error) => {
      assert.match(error.message, /GPS clone restore/);
      assert.match(error.message, /restore=1/);
      assert.match(error.message, /restore=role-missing/);
      assert.doesNotMatch(error.message, /private-credential/);
      return true;
    },
  );
  assert.ok(Date.now() - started < 5000, 'peer failure must not wait for the full clone timeout');
});

test('GPS CI clone stops restore promptly when dump fails', async () => {
  await assert.rejects(
    run(
      'process.stderr.write("pg_dump: error: server version mismatch\\n");process.exit(1);',
      'process.stdin.resume();setInterval(()=>{},1000);',
    ),
    (error) => {
      assert.match(error.message, /GPS clone dump/);
      assert.match(error.message, /dump=1/);
      assert.match(error.message, /dump=version-mismatch/);
      return true;
    },
  );
});

test('GPS CI clone timeout reports bounded stage and child outcomes', async () => {
  await assert.rejects(
    run('setInterval(()=>{},1000);', 'process.stdin.resume();setInterval(()=>{},1000);', {
      timeoutMs: 250, killAfterMs: 200,
    }),
    (error) => {
      assert.match(error.message, /GPS clone timeout/);
      assert.match(error.message, /exits dump=SIGTERM,restore=SIGTERM/);
      return true;
    },
  );
});

test('GPS CI clone reports a missing client without waiting for its peer', async () => {
  const [restoreCommand, restoreArgs] = child('process.stdin.resume();setInterval(()=>{},1000);');
  await assert.rejects(
    runGpsClonePipeline({
      dumpCommand: '/missing-loadgistic-pg-dump', dumpArgs: [],
      restoreCommand, restoreArgs, env: process.env,
      timeoutMs: 5000, killAfterMs: 200,
    }),
    (error) => {
      assert.match(error.message, /GPS clone dump/);
      assert.match(error.message, /dump=spawn-ENOENT/);
      return true;
    },
  );
});

test('PostgreSQL category classifier emits a fixed label for unknown sensitive output', () => {
  assert.equal(postgresErrorCategory('secret=reviewer-password'), 'unclassified');
  assert.equal(postgresErrorCategory('pg_restore: error: could not execute query: ERROR: duplicate'), 'restore-sql-error');
});
