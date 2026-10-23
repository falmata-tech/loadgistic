import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

// CI/local negative check only. The exact artifact must reject before changing
// definitions, ACLs, publication gates or the installed runtime contract.
const root=new URL('../',import.meta.url);
const container='supabase_db_loadgistic-local';
const database=process.env.LOADGISTIC_AUTHORITY_TEST_DATABASE||'postgres';
assert.ok(['postgres','loadgistic_provider_final_20261014','loadgistic_provider_final_v2_20261014','loadgistic_provider_final_v3_20261014'].includes(database),'Unknown local test database');
assert.match(readFileSync(new URL('supabase/config.toml',root),'utf8'),/^project_id\s*=\s*"loadgistic-local"/m);
let stage='local target';
try{
 const inspected=spawnSync('docker',['inspect','--format','{{ index .Config.Labels "com.supabase.cli.project" }}',container],{encoding:'utf8'});
 assert.equal(inspected.status,0);assert.equal(inspected.stdout.trim(),'loadgistic-local');
 stage='exact rollback denial';
 const source=readFileSync(new URL('supabase/rollbacks/146_provider_vehicle_authority.sql',root),'utf8');
 const regression=readFileSync(new URL('tests/sql/provider-authority-rollback-denial.sql',root),'utf8');
 const result=spawnSync('docker',['exec','-i',container,'psql','-XAtq','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-v',`provider_authority_rollback_source=${source}`],{input:regression,encoding:'utf8',maxBuffer:1024*1024});
 assert.equal(result.status,0,'Exact rollback artifact or retained safety boundary failed');
 console.log('PASS: exact unsafe rollback rejects; definitions, permissions, publication trigger and runtime marker are unchanged. Transaction rolled back.');
}catch(error){
 // PostgreSQL diagnostics can contain private function/row context. Do not emit it.
 console.error(`FAIL: ${stage} (${error instanceof Error?error.name:'unknown'})`);
 process.exitCode=1;
}
