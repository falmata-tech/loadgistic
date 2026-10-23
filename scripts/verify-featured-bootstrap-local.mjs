// FEAT-FTR-001 / NR-34. Fixed local target, exact migration seed, rollback-only probes.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const approvedDigest='9d5980b5d84e7b7aa1ee7079d399b6f2ae107a39363b142bd00bd31cceb1aed9';
const marker='-- ACTUAL_MIGRATION_137_SEED_BLOCK';
export function selectedDatabase(args){
  if(args.length===0)return 'postgres';
  if(args.length===2&&args[0]==='--database'&&args[1]==='loadgistic_featured137_20261013')return args[1];
  throw new Error('FEATURED_BOOTSTRAP_LOCAL_TARGET_REQUIRED');
}
export function localDatabaseUser(database){
  if(database==='postgres')return 'postgres';
  // The sole restored clone retains the approved restore owner's private helpers.
  if(database==='loadgistic_featured137_20261013')return 'supabase_admin';
  throw new Error('FEATURED_BOOTSTRAP_LOCAL_TARGET_REQUIRED');
}
export function actualSeedStatement(source){
  if(createHash('sha256').update(source).digest('hex')!==approvedDigest)throw new Error('FEATURED_MIGRATION_DIGEST_CHANGED');
  const matches=String(source).match(/^with known as \([\s\S]*?^order by primary_theme_key,vehicle_id,driver_user_id,first_feature_date,featured_day_id;\n/gm);
  if(matches?.length!==1)throw new Error('FEATURED_SEED_STATEMENT_NOT_UNIQUE');
  return matches[0];
}
export function bootstrapProbeSql(fixture,seed){
  const statements=fixture.replace(/^\s*--[^\n]*$/gm,'').trim();
  if(fixture.split(marker).length!==2||!/^begin;/.test(statements)||!/(?:^|\n)rollback;$/.test(statements)||/^\s*commit;/im.test(statements))throw new Error('FEATURED_BOOTSTRAP_ROLLBACK_TEMPLATE_REQUIRED');
  return fixture.replace(marker,seed);
}
function run(){
  const database=selectedDatabase(process.argv.slice(2));
  const user=localDatabaseUser(database);
  if(!/^project_id\s*=\s*"loadgistic-local"/m.test(readFileSync(new URL('../supabase/config.toml',import.meta.url),'utf8')))throw new Error('FEATURED_BOOTSTRAP_LOCAL_PROJECT_REQUIRED');
  const label=spawnSync('docker',['inspect','--format','{{ index .Config.Labels "com.supabase.cli.project" }}','supabase_db_loadgistic-local'],{encoding:'utf8',timeout:10000});
  if(label.status!==0||label.stdout.trim()!=='loadgistic-local')throw new Error('FEATURED_BOOTSTRAP_LOCAL_CONTAINER_REQUIRED');
  const seed=actualSeedStatement(readFileSync(new URL('../supabase/migrations/137_featured_continuous_rotation.sql',import.meta.url)));
  const fixture=readFileSync(new URL('../tests/sql/featured-rotation-bootstrap.sql',import.meta.url),'utf8');
  const sql=input=>spawnSync('docker',['exec','-i','supabase_db_loadgistic-local','psql','-X','-U',user,'-d',database,'-v','ON_ERROR_STOP=1','-Atq'],{
    input,encoding:'utf8',timeout:45000,maxBuffer:1024*1024
  });
  const fingerprint=`select jsonb_build_object(
    'legacy',md5(coalesce((select jsonb_agg(to_jsonb(h) order by round_number,vehicle_id,driver_user_id)::text from public.featured_rotation_selections h),'[]')),
    'theme',md5(coalesce((select jsonb_agg(to_jsonb(h) order by primary_theme_key,round_number,vehicle_id,driver_user_id)::text from public.featured_theme_rotation_selections h),'[]')),
    'days',md5(coalesce((select jsonb_agg(to_jsonb(d) order by id)::text from public.featured_provider_days d),'[]')),
    'slots',md5(coalesce((select jsonb_agg(to_jsonb(s) order by id)::text from public.featured_provider_slots s),'[]')),
    'ledgerOid','public.featured_theme_rotation_selections'::regclass::oid,
    'authCount',(select count(*) from auth.users),'profileCount',(select count(*) from public.profiles),
    'organizationCount',(select count(*) from public.organizations),'vehicleCount',(select count(*) from public.vehicles));`;
  const before=sql(fingerprint);
  if(before.status!==0)throw new Error('FEATURED_BOOTSTRAP_BASELINE_FAILED');
  const missingLegacy=seed.replace(/^  where history\.round_number=.*$/m,'  where false');
  const missingReservations=seed.replace(/^  where day\.feature_date>=.*$/m,'  where false');
  if(missingLegacy===seed||missingReservations===seed)throw new Error('FEATURED_BOOTSTRAP_NEGATIVE_SOURCE_MISSING');
  for(const [name,input,expected]of [
    ['actual migration137 seed',seed,null],
    ['missing latest legacy source',missingLegacy,'LEGACY_TURNS_NOT_BOOTSTRAPPED'],
    ['missing protected reservations',missingReservations,'FUTURE_RESERVATIONS_NOT_BOOTSTRAPPED']
  ]){
    const result=sql(bootstrapProbeSql(fixture,input));
    if(result.error||result.signal||result.status===null)throw new Error('FEATURED_BOOTSTRAP_PROBE_RUN_FAILED');
    if(expected?result.status===0||!result.stderr.includes(expected):result.status!==0)throw new Error(`FEATURED_BOOTSTRAP_PROBE_FAILED:${name}`);
    console.log(`PASS: ${name}${expected?' rejected':''}.`);
  }
  const after=sql(fingerprint);
  if(after.status!==0||after.stdout!==before.stdout)throw new Error('FEATURED_BOOTSTRAP_ROLLBACK_CHANGED_SAVED_STATE');
  console.log('PASS: all bootstrap probes rolled back; saved ledger identity/history and rosters are unchanged.');
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  try{run();}catch(error){console.error(error instanceof Error?error.message:'FEATURED_BOOTSTRAP_RUN_FAILED');process.exitCode=1;}
}
