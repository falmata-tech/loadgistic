// FEAT-GST/SUP/ADM/UIX-001: exact one-time retirement, recurring rollback proof.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const root=new URL('../',import.meta.url);
const container='supabase_db_loadgistic-local';
const migrationDigest='694e9288f202fccd05d392afacc921541e13a0e005c557edb25483d2d1d2b3d2';
const fixtureDigests={setup:'a515b283b85673dbbeeee67a9bcafb2488a078fa2b14700e9d4f46817868b2e0',assertions:'ca1b8e6748c4d0d1351bfde9f09166b84aa16f49cbf04167965a37f8274936b3'};
const rollbackMarker='RETIRED_GUEST_WORKLOAD_ROLLBACK_OK';
const controls=/^[ \t]*(?:begin|commit|rollback|start[ \t]+transaction|end|abort)[ \t]*;[ \t]*$/gmi;
const meta=/^[ \t]*\\/m;

/** @param {{migration:string,setup:string,assertions:string}} sources */
export function retirementProbeSql({migration,setup,assertions}){
  if(createHash('sha256').update(migration).digest('hex')!==migrationDigest)throw Error('RETIRED_GUEST_MIGRATION_DIGEST_CHANGED');
  const outer=[...migration.matchAll(controls)].map(match=>match[0].trim().toLowerCase());
  if(outer.length!==2||outer[0]!=='begin;'||outer[1]!=='commit;'||meta.test(migration))throw Error('RETIRED_GUEST_MIGRATION_BOUNDARY_INVALID');
  for(const fixture of[setup,assertions])if(meta.test(fixture)||[...fixture.matchAll(controls)].length)throw Error('RETIRED_GUEST_FIXTURE_BOUNDARY_INVALID');
  for(const[key,source]of Object.entries({setup,assertions}))if(createHash('sha256').update(source).digest('hex')!==fixtureDigests[key])throw Error('RETIRED_GUEST_FIXTURE_DIGEST_CHANGED');
  const body=migration.replace(controls,'');
  return `\\set ON_ERROR_STOP on\n\\set VERBOSITY verbose\nbegin;\nset local statement_timeout='15s';\nset local lock_timeout='3s';\nset local idle_in_transaction_session_timeout='5s';\n${setup}\n${body}\n${body}\n${assertions}\nrollback;\nselect '${rollbackMarker}';\n`;
}

/** @param {unknown} stderr @returns {string} */
export function retirementFailureCode(stderr){
  // Never emit raw SQL diagnostics: they can include private row/function data.
  const match=String(stderr||'').match(/ERROR:[ \t]+([0-9A-Z]{5}):[ \t]+([A-Z][A-Z0-9_]{2,80})(?:\r?\n|$)/m);
  if(match)return `${match[1]}:${match[2]}`;
  const state=String(stderr||'').match(/ERROR:[ \t]+([0-9A-Z]{5}):/m);
  return state?`SQLSTATE_${state[1]}`:'RETIRED_GUEST_PROBE_FAILED';
}

/** @param {typeof spawnSync} [runCommand] */
export function verifyRetiredGuestWorkload(runCommand=spawnSync){
  const config=readFileSync(new URL('supabase/config.toml',root),'utf8');
  if(!/^project_id[ \t]*=[ \t]*"loadgistic-local"[ \t]*$/m.test(config))throw Error('RETIRED_GUEST_LOCAL_PROJECT_REQUIRED');
  const inspected=runCommand('docker',['inspect','--format','{{ index .Config.Labels "com.supabase.cli.project" }}',container],{encoding:'utf8',timeout:10000,maxBuffer:64*1024});
  if(inspected.status!==0||inspected.signal||inspected.error||inspected.stdout.trim()!=='loadgistic-local')throw Error('RETIRED_GUEST_LOCAL_CONTAINER_REQUIRED');
  const sources={
    migration:readFileSync(new URL('supabase/migrations/152_retire_guest_support_workload.sql',root),'utf8'),
    setup:readFileSync(new URL('tests/sql/retire-guest-support-workload-setup.sql',root),'utf8'),
    assertions:readFileSync(new URL('tests/sql/retire-guest-support-workload-assert.sql',root),'utf8')
  };
  const result=runCommand('docker',['exec','-i',container,'psql','-XAtq','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{
    input:retirementProbeSql(sources),encoding:'utf8',timeout:60000,maxBuffer:1024*1024
  });
  if(result.error||result.signal)throw Error('RETIRED_GUEST_PROBE_PROCESS_FAILED');
  if(result.status!==0)throw Error(retirementFailureCode(result.stderr));
  if(!String(result.stdout||'').split(/\r?\n/).includes(rollbackMarker))throw Error('RETIRED_GUEST_ROLLBACK_NOT_CONFIRMED');
  return {ok:true,migration:152,passes:2,rollback:true};
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  try{
    if(process.argv.length!==2)throw Error('RETIRED_GUEST_LOCAL_ARGUMENTS_REFUSED');
    console.log(JSON.stringify(verifyRetiredGuestWorkload()));
  }catch(error){
    const message=error instanceof Error?error.message:'';
    console.error(/^(?:RETIRED_GUEST_[A-Z0-9_]+|[0-9A-Z]{5}:[A-Z][A-Z0-9_]{2,80}|SQLSTATE_[0-9A-Z]{5})$/.test(message)?message:'RETIRED_GUEST_VERIFICATION_FAILED');
    process.exitCode=1;
  }
}
