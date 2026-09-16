import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
// Fixed Docker target: this helper cannot select a hosted URL or arbitrary SQL.
const sql = readFileSync(new URL('../docs/operations/spatial-reference-owner-repair.sql', import.meta.url), 'utf8');
const result = spawnSync('docker', ['exec','-i','supabase_db_loadgistic-local','psql','-X','-q','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'], {input:sql, encoding:'utf8'});
if (result.status !== 0) { console.error('LOCAL_OWNER_SECURITY_SETUP_FAILED'); process.exitCode=1; }
else console.log('Local PostGIS owner security setup verified. No hosted connection used.');
