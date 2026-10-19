// CI-only dump/restore pipeline. Keep raw PostgreSQL stderr in memory and emit
// only fixed error categories: it can contain object names or connection data.
import {spawn} from 'node:child_process';

const STDERR_LIMIT = 8192;

export function checkedLocalGpsPassword(status) {
  let url;
  try {
    url = new URL(status?.DB_URL);
  } catch {
    throw new Error('GPS CI local database URL is missing or invalid');
  }
  if (!['postgresql:', 'postgres:'].includes(url.protocol)
      || url.hostname !== '127.0.0.1' || url.port !== '55322'
      || url.pathname !== '/postgres' || decodeURIComponent(url.username) !== 'postgres'
      || !url.password || url.search || url.hash) {
    throw new Error('GPS CI local database target mismatch');
  }
  return decodeURIComponent(url.password);
}

export function checkedLocalRestoreRole(user) {
  if (user !== 'supabase_admin') throw new Error('GPS CI local restore role mismatch');
  return user;
}

export function checkedMatchingPgMajor(clientMajor, serverMajor) {
  if (![15, 17].includes(clientMajor) || clientMajor !== serverMajor) {
    throw new Error('GPS CI PostgreSQL client/server major mismatch');
  }
  return clientMajor;
}

export function postgresErrorCategory(stderr) {
  if (/server version mismatch|aborting because of server version mismatch/i.test(stderr)) return 'version-mismatch';
  if (/password authentication failed|SASL authentication failed/i.test(stderr)) return 'authentication-failed';
  if (/role .* does not exist/i.test(stderr)) return 'role-missing';
  if (/permission denied|must be owner|not permitted/i.test(stderr)) return 'permission-denied';
  if (/canceling statement due to lock timeout|deadlock detected/i.test(stderr)) return 'lock-contention';
  if (/no space left on device|out of memory|disk full/i.test(stderr)) return 'resource-exhausted';
  if (/connection refused|could not connect to server|connection timed out/i.test(stderr)) return 'connection-failed';
  if (/broken pipe|EPIPE/i.test(stderr)) return 'broken-pipe';
  if (/pg_restore: error:|ERROR:/i.test(stderr)) return 'restore-sql-error';
  if (/pg_dump: error:/i.test(stderr)) return 'dump-error';
  return 'unclassified';
}

function boundedStderr(child) {
  let tail = Buffer.alloc(0);
  child.stderr.on('data', (chunk) => {
    tail = Buffer.concat([tail, chunk]).subarray(-STDERR_LIMIT);
  });
  return () => postgresErrorCategory(tail.toString('utf8'));
}

function outcome(result) {
  if (!result) return 'pending';
  if (result.error) return `spawn-${result.error}`;
  return result.signal ?? String(result.code);
}

export async function runGpsClonePipeline({
  dumpCommand, dumpArgs, restoreCommand, restoreArgs, env,
  timeoutMs = 8 * 60_000, killAfterMs = 10_000,
  spawnProcess = spawn,
}) {
  const startedAt = Date.now();
  const dump = spawnProcess(dumpCommand, dumpArgs, {
    env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const restore = spawnProcess(restoreCommand, restoreArgs, {
    env, stdio: ['pipe', 'ignore', 'pipe'],
  });
  const dumpCategory = boundedStderr(dump);
  const restoreCategory = boundedStderr(restore);
  const results = {dump: null, restore: null};
  let firstFailure = null;
  let timedOut = false;
  let hardKillTimer;
  let timeout;

  function stop(child) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  }
  function stopBoth() {
    dump.stdout.unpipe(restore.stdin);
    stop(dump);
    stop(restore);
    hardKillTimer ??= setTimeout(() => {
      if (dump.exitCode === null && dump.signalCode === null) dump.kill('SIGKILL');
      if (restore.exitCode === null && restore.signalCode === null) restore.kill('SIGKILL');
    }, killAfterMs);
  }

  dump.stdout.pipe(restore.stdin);
  restore.stdin.on('error', () => {}); // Peer may close before the producer.

  const completion = new Promise((resolve) => {
    function record(name, result) {
      if (results[name]) return;
      results[name] = result;
      if (!timedOut && (result.error || result.code !== 0) && !firstFailure) {
        firstFailure = name;
        stopBoth();
      }
      if (results.dump && results.restore) resolve();
    }
    for (const [name, child] of [['dump', dump], ['restore', restore]]) {
      child.once('error', (error) => record(name, {error: error.code ?? 'unknown'}));
      child.once('close', (code, signal) => record(name, {code, signal}));
    }
  });

  timeout = setTimeout(() => {
    timedOut = true;
    stopBoth();
  }, timeoutMs);
  try {
    await completion;
  } finally {
    clearTimeout(timeout);
    clearTimeout(hardKillTimer);
  }

  if (timedOut || firstFailure) {
    const stage = timedOut ? 'timeout' : firstFailure;
    const elapsedMs = Date.now() - startedAt;
    const categories = `dump=${dumpCategory()},restore=${restoreCategory()}`;
    throw new Error(`GPS clone ${stage} after ${elapsedMs}ms; exits dump=${outcome(results.dump)},restore=${outcome(results.restore)}; categories ${categories}`);
  }
}
