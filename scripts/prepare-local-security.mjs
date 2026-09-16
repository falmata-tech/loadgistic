import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
// Fixed Docker target: this helper cannot select a hosted URL or arbitrary SQL.
const sql = readFileSync(new URL('../docs/operations/spatial-reference-owner-repair.sql', import.meta.url), 'utf8');
const result = spawnSync('docker', ['exec','-i','supabase_db_loadgistic-local','psql','-X','-q','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'], {input:sql, encoding:'utf8', timeout:30000});
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
