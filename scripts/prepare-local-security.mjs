import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
// Fixed Docker target: this helper cannot select a hosted URL or arbitrary SQL.
const sql = readFileSync(new URL('../docs/operations/spatial-reference-owner-repair.sql', import.meta.url), 'utf8');
// PostgreSQL 15 authenticates this local owner with the CLI-provisioned container
// password. Read it only inside that fixed container; never read a hosted secret.
// Explicit loopback/port prevents a PGHOST environment override from redirecting it.
const localCommand = 'test -n "$POSTGRES_PASSWORD" || exit 78; PGPASSWORD="$POSTGRES_PASSWORD" PGCONNECT_TIMEOUT=5 exec psql -X -w -q -h 127.0.0.1 -p 5432 -U supabase_admin -d postgres -v ON_ERROR_STOP=1';
const result = spawnSync('docker', ['exec','-i','supabase_db_loadgistic-local','sh','-c',localCommand], {input:sql, encoding:'utf8', timeout:30000});
if (result.status !== 0) {
  // This fixed local metadata repair never handles customer values or secrets.
  // Retain the first PostgreSQL/Docker error so clean-CI failures are actionable.
  const diagnostic = String(result.stderr || '').split('\n').find(line => /ERROR:|FATAL:|^psql:|^Error response from daemon:/.test(line));
  console.error('LOCAL_OWNER_SECURITY_SETUP_FAILED');
  if (diagnostic) console.error(diagnostic.slice(0,500));
  if (result.error?.code) console.error(`LOCAL_PROCESS_${result.error.code}`);
  process.exitCode=1;
}
else console.log('Local PostGIS owner security setup verified. No hosted connection used.');
