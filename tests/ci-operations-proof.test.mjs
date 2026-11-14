import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectOperationsProofResult,runOperationsProofRepetitions} from '../scripts/ci-operations-proof.mjs';

const processResult={status:0,signal:null};
function report(){
 return {suites:[{file:'tests/e2e/operations-connected-actions.spec.ts',specs:[{
  title:'Operations single-proof boundary preserves acknowledged bytes',tests:['desktop-chromium','mobile-chromium'].map(projectName=>({projectName,status:'expected',results:[{status:'passed',retry:0}]}))
 }]}],errors:[],stats:{expected:2,skipped:0,unexpected:0,flaky:0}};
}
test('focused Operations proof requires each desktop and phone repetition exactly once',()=>{
 assert.equal(inspectOperationsProofResult(processResult,report()),null);
 const nested=report();nested.suites=[{suites:nested.suites}];assert.equal(inspectOperationsProofResult(processResult,nested),null);
 for(const count of [0,1,3,'2']){const value=report();value.stats.expected=count;assert.equal(inspectOperationsProofResult(processResult,value),'TWO_CLEAN_PROJECT_PASSES_REQUIRED');}
 for(const field of ['skipped','unexpected','flaky']){const value=report();value.stats[field]=1;assert.equal(inspectOperationsProofResult(processResult,value),'TWO_CLEAN_PROJECT_PASSES_REQUIRED');}
});
test('focused Operations proof rejects missing, duplicate, retried and different cases',()=>{
 for(const change of ['duplicate','missing','project','title','file','retry','skipped','results','error']){
  const value=report(),spec=value.suites[0].specs[0],first=spec.tests[0];
  if(change==='duplicate')spec.tests[1]=first;
  if(change==='missing')spec.tests.pop();
  if(change==='project')first.projectName='PRIVATE';
  if(change==='title')spec.title='PRIVATE';
  if(change==='file')value.suites[0].file='tests/e2e/smoke.spec.ts';
  if(change==='retry')first.results[0].retry=1;
  if(change==='skipped')first.status='skipped';
  if(change==='results')first.results.push({status:'passed',retry:1});
  if(change==='error')value.errors.push({message:'PRIVATE'});
  assert.notEqual(inspectOperationsProofResult(processResult,value),null,change);
 }
 for(const value of [null,{}, {suites:[],errors:[],stats:{}}, {...report(),suites:[null]}])assert.notEqual(inspectOperationsProofResult(processResult,value),null);
 for(const processValue of [{status:1},{status:0,signal:'SIGTERM'},{status:0,error:new Error('PRIVATE')}])assert.equal(inspectOperationsProofResult(processValue,report()),'PLAYWRIGHT_FAILED');
});
test('focused Operations proof runner keeps fixed selection, zero retries and bounded private output',()=>{
 const source=readFileSync('scripts/ci-operations-proof.mjs','utf8');
 assert.match(source,/'--project=desktop-chromium','--project=mobile-chromium','--repeat-each=1','--retries=0','--workers=1','--reporter=json'/);
 assert.match(source,/timeout:480_000/);assert.match(source,/stdio:\['ignore','pipe','pipe'\]/);
 assert.doesNotMatch(source,/console\.log|write\(result\.(stdout|stderr)/);
});

test('three independent proof runs stop at their first failure instead of retrying until green',()=>{
 let calls=0;const output=[];
 const ok=()=>{calls++;return {result:processResult,report:report()};};
 assert.equal(runOperationsProofRepetitions(ok,value=>output.push(value)),true);assert.equal(calls,3);
 for(const failureAt of [1,2,3]){
  calls=0;output.length=0;
  assert.equal(runOperationsProofRepetitions(()=>{const result=ok();if(calls===failureAt)result.result={status:1};return result;},value=>output.push(value)),false);
  assert.equal(calls,failureAt);assert.match(output.join(''),new RegExp('repetition='+failureAt));
 }
});

test('admin queue diagnostics accept only the chosen case and both clean projects',()=>{
 const value=report();value.suites[0].file='tests/e2e/admin-connected-queues.spec.ts';
 value.suites[0].specs[0].title='Content and deletion overflow pages recover saved synthetic cases with unchanged controls';
 assert.equal(inspectOperationsProofResult(processResult,value,'admin-queues'),null);
 assert.notEqual(inspectOperationsProofResult(processResult,value),null);
 assert.notEqual(inspectOperationsProofResult(processResult,report(),'admin-queues'),null);
 assert.notEqual(inspectOperationsProofResult(processResult,value,'PRIVATE'),null);
 value.suites[0].specs[0].tests[0].results[0].retry=1;
 assert.notEqual(inspectOperationsProofResult(processResult,value,'admin-queues'),null);
});

test('queue diagnosis branches start only the fixed isolated replay before a PR exists',()=>{
 const source=readFileSync('.github/workflows/operations-proof.yml','utf8');
 assert.match(source,/branches: \['diagnose\/admin-queues\/\*\*', 'diagnose\/simulator-db\/\*\*'\]/);
 assert.match(source,/github.event_name == 'push' && 'admin-queues'/);
 assert.match(source,/permissions:\n  contents: read/);
 assert.match(source,/path: \.local\/ci-browser-diagnostics\/\*\.json/);
 assert.doesNotMatch(source,/secrets\.|continue-on-error/);
});

test('simulator database diagnosis is explicit, isolated and cannot replace the existing browser proof',()=>{
 const source=readFileSync('.github/workflows/operations-proof.yml','utf8');
 const browser=source.slice(source.indexOf('  proof:'),source.indexOf('  simulator-db:'));
 const database=source.slice(source.indexOf('  simulator-db:'));
 assert.match(source,/default: operations-proof/);
 assert.match(source,/options: \[operations-proof, admin-queues, simulator-db\]/);
 assert.match(browser,/if: \$\{\{ inputs\.case != 'simulator-db' && !\(github\.event_name == 'push' && startsWith\(github\.ref, 'refs\/heads\/diagnose\/simulator-db\/'\)\) \}\}/);
 assert.match(browser,/run: node scripts\/ci-operations-proof\.mjs --case "\$FOCUS_CASE"/);
 assert.match(database,/if: \$\{\{ \(github\.event_name == 'workflow_dispatch' && inputs\.case == 'simulator-db'\) \|\| \(github\.event_name == 'push' && startsWith\(github\.ref, 'refs\/heads\/diagnose\/simulator-db\/'\)\) \}\}/);
 assert.match(database,/runs-on: ubuntu-latest\n    timeout-minutes: 45/);
 assert.match(database,/version: 2\.111\.0/);
 for(const required of ['ci-reserve-local-ports.mjs','prepare-local-security.mjs','check-database-security.sql',
  'verify-database-security-gate.mjs','npm run supabase:local:configure','verify-data-api-guard.mjs',
  'npx playwright install --with-deps chromium','ci-fixture-preflight.mjs'])assert.ok(database.includes(required),required);
 assert.ok(database.indexOf('run: npm run check')<database.indexOf('ci-start-local-supabase.mjs'));
 assert.match(database,/array\['221','222','223','224','225'\]::text\[\]/);
 assert.match(database,/catalog_version=2/);assert.match(database,/SIMULATOR_DIAGNOSTIC_INERT_BASELINE_REQUIRED/);
 assert.match(database,/Remove disposable GPS test database\n        if: always\(\)/);
 assert.match(database,/Stop isolated Supabase\n        if: always\(\)/);
 assert.doesNotMatch(database,/secrets\.|continue-on-error|--linked|--project-ref|SUPABASE_ACCESS_TOKEN|DATABASE_URL|supabase (?:link|db push|config push)/);
});

test('simulator database regression plan preserves rollback and GPS fixture ordering',()=>{
 const source=readFileSync('.github/workflows/operations-proof.yml','utf8');
 const database=source.slice(source.indexOf('  simulator-db:'));
 const manual=['driver-manual-capacity-location','location-radius-choices','telematics',
  'telematics-account-privacy','tracking-owner-delegation','tracking-selected-sources'];
 const simulator=['demo-world-durable-capacity','demo-world-fast-catalog','demo-world-tracking-notification-sink',
  'demo-world-duty-cycle','demo-world-atomic-handover','demo-world-handover-worker','demo-world-provider-profile',
  'demo-world-tracking-lifecycle-readiness','demo-world-tracking-lifecycle-reservation',
  'demo-tracking-exact-incomplete-resume','demo-world-tracking-live-reservation'];
 for(const suites of [manual,simulator]){
  assert.ok(database.includes(`for suite in ${suites.join(' ')}; do`));
  for(const suite of suites){
   const sql=readFileSync(`tests/sql/${suite}.sql`,'utf8');
   assert.match(sql,/^begin;/m,suite);assert.match(sql,/^rollback;/mi,suite);
   assert.doesNotMatch(sql,/^commit;/mi,suite);
  }
 }
 assert.ok(database.indexOf('ci-fixture-preflight.mjs')<database.indexOf('for suite in driver-manual'));
 assert.ok(database.indexOf('demo-world-fast-catalog')<database.indexOf('demo-ci-isolated-setup.sql'));
 assert.ok(database.indexOf('demo-ci-isolated-setup.sql')<database.indexOf('demo-account-isolation.sql'));
 assert.match(database,/docker exec -e PGOPTIONS='-c loadgistic\.demo_isolated_test=true'[^\n]+demo-account-isolation\.sql/);
 assert.match(database,/test "\$LOADGISTIC_TEST_DATABASE" = loadgistic_telematics_ci/);
 assert.match(database,/--force|ci-disposable-gps-database\.mjs remove/);
 assert.doesNotMatch(database,/demo-world-provider-profile-v2-history|infra\/telematics|supabase\/migrations\/18[5-9]/);
});
