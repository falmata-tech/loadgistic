import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {inspectFixturePreflightResult} from '../scripts/ci-fixture-preflight.mjs';
import {inspectFeaturedPrepareResult} from '../scripts/ci-featured-prepare.mjs';
import {inspectBrowserShard} from '../scripts/ci-browser-shard.mjs';
const reviewedSkips=JSON.parse(readFileSync('tests/e2e/ci-allowed-skips.json','utf8')).allowed;
const workflow=readFileSync('.github/workflows/ci.yml','utf8');
const preflightRunner=readFileSync('scripts/ci-fixture-preflight.mjs','utf8');
const featuredRunner=readFileSync('scripts/ci-featured-prepare.mjs','utf8');
test('all eight isolated browser shards remain required by the e2e release gate',()=>{
 assert.match(workflow,/fail-fast: false/);
 assert.match(workflow,/shard: \[1, 2, 3, 4, 5, 6, 7, 8\]/);
 assert.match(workflow,/run: node scripts\/ci-browser-shard\.mjs '\$\{\{ matrix.shard \}\}'/);
 const gate=workflow.slice(workflow.indexOf('  e2e:\n'),workflow.indexOf('  container:\n'));
 assert.match(gate,/needs: \[e2e-shards, featured-prepare\]/);
 assert.match(gate,/if: always\(\)/);
 assert.match(gate,/test '\$\{\{ needs.e2e-shards.result \}\}' = 'success'/);
 assert.match(gate,/test '\$\{\{ needs.featured-prepare.result \}\}' = 'success'/);
});

test('each persistent Featured Prepare workflow runs in its own required database job on desktop and phone',()=>{
 const isolated=workflow.slice(workflow.indexOf('  featured-prepare:\n'),workflow.indexOf('  e2e:\n'));
 assert.match(isolated,/needs: validate/);
 assert.match(isolated,/fail-fast: false/);
 assert.match(isolated,/featured_case: \[platform-controls, featured-operations-review, featured-team-permission\]/);
 assert.match(isolated,/run: node scripts\/ci-start-local-supabase\.mjs/);
 assert.match(isolated,/run: npm run supabase:local:configure/);
 assert.match(isolated,/run: node scripts\/ci-fixture-preflight\.mjs/);
 assert.match(isolated,/run: node scripts\/ci-featured-prepare\.mjs '\$\{\{ matrix.featured_case \}\}'/);
 assert.match(isolated,/if: always\(\)\n\s+run: supabase stop --no-backup/);
 assert.doesNotMatch(isolated,/continue-on-error:/);
 const taggedCases={
  'platform-controls':'Featured automatic selection',
  'featured-operations-review':'Featured explains automatic operation',
  'featured-team-permission':'admin grants Featured alone'
 };
 for(const [filename,title] of Object.entries(taggedCases)){
  const source=readFileSync(`tests/e2e/${filename}.spec.ts`,'utf8');
  assert.equal(source.match(/@featured-prepare/g)?.length,1);
  assert.match(source,new RegExp(`test\\('${title}[^']* @featured-prepare'`));
  assert.ok(featuredRunner.includes(`'${filename}':'tests/e2e/${filename}.spec.ts'`));
 }
 const taggedFiles=readdirSync('tests/e2e').filter(name=>name.endsWith('.spec.ts')
  &&readFileSync(`tests/e2e/${name}`,'utf8').includes('@featured-prepare')).sort();
 assert.deepEqual(taggedFiles,['featured-operations-review.spec.ts','featured-team-permission.spec.ts','platform-controls.spec.ts']);
});

test('Featured Prepare runner rejects skipped, absent, flaky and failed desktop or phone evidence',()=>{
 assert.match(featuredRunner,/--grep','@featured-prepare','--project=desktop-chromium','--project=mobile-chromium','--reporter=json','--retries=0','--workers=1'/);
 const file='tests/e2e/platform-controls.spec.ts';
 const report=()=>({suites:[{file}],errors:[],stats:{expected:2,skipped:0,unexpected:0,flaky:0}});
 assert.equal(inspectFeaturedPrepareResult({status:0,signal:null},report(),file),null);
 const skipped=report();skipped.stats.expected=1;skipped.stats.skipped=1;
 assert.equal(inspectFeaturedPrepareResult({status:0,signal:null},skipped,file),'TWO_PROJECT_PASSES_ZERO_SKIPS_REQUIRED');
 const absent=report();absent.stats.expected=0;
 assert.equal(inspectFeaturedPrepareResult({status:0,signal:null},absent,file),'TWO_PROJECT_PASSES_ZERO_SKIPS_REQUIRED');
 const flaky=report();flaky.stats.expected=1;flaky.stats.flaky=1;
 assert.equal(inspectFeaturedPrepareResult({status:0,signal:null},flaky,file),'TWO_PROJECT_PASSES_ZERO_SKIPS_REQUIRED');
 const wrongFile=report();wrongFile.suites[0].file='tests/e2e/other.spec.ts';
 assert.equal(inspectFeaturedPrepareResult({status:0,signal:null},wrongFile,file),'REPORT_MISSING_OR_UNEXPECTED');
 assert.equal(inspectFeaturedPrepareResult({status:0,signal:null},null,file),'REPORT_MISSING_OR_UNEXPECTED');
 assert.equal(inspectFeaturedPrepareResult({status:1,signal:null},report(),file),'PLAYWRIGHT_FAILED');
});

test('each isolated browser shard checks current synthetic fixture behavior before long workflows',()=>{
 const shard=workflow.slice(workflow.indexOf('  e2e-shards:\n'),workflow.indexOf('  e2e:\n'));
 const fixtureImport=shard.indexOf('Import and verify managed fixtures');
 const preflight=shard.indexOf('run: node scripts/ci-fixture-preflight.mjs');
 const fullSuite=shard.indexOf('run: node scripts/ci-browser-shard.mjs');
 assert.ok(fixtureImport>=0&&preflight>fixtureImport&&fullSuite>preflight);
});

test('ordinary browser shard rejects missing tests, unreviewed skips, retries and failures',()=>{
 const testCase=(file,title,project,status='expected')=>({file,title,project,status});
 const selected=[testCase('ordinary.spec.ts','saved workflow','desktop-chromium'),testCase('one-project.spec.ts','phone-sized workflow','mobile-chromium')];
 const report=(rows,stats={expected:1,skipped:1,unexpected:0,flaky:0})=>({
  suites:rows.map(row=>({file:row.file,specs:[{file:row.file,title:row.title,tests:[{projectName:row.project,status:row.status}]}]})),
  errors:[],stats
 });
 const list=report(selected,{expected:0,skipped:2,unexpected:0,flaky:0});
 const run=report([selected[0],{...selected[1],status:'skipped'}]);
 const ok={status:0,signal:null};
 const allowed=[{file:'one-project.spec.ts',title:'phone-sized workflow',project:'mobile-chromium'}];
 assert.equal(inspectBrowserShard(ok,list,ok,run,allowed),null);
 assert.equal(inspectBrowserShard(ok,list,ok,run,[]),'UNREVIEWED_OR_MISSING_SKIP');
 assert.equal(inspectBrowserShard(ok,list,ok,report([selected[0]],{expected:1,skipped:0,unexpected:0,flaky:0}),allowed),'TEST_SELECTION_CHANGED');
 assert.equal(inspectBrowserShard(ok,list,ok,report([{...selected[0],status:'skipped'},selected[1]],{expected:0,skipped:2,unexpected:0,flaky:0}),allowed),'FAILED_OR_FLAKY_TESTS');
 assert.equal(inspectBrowserShard(ok,list,ok,report([selected[0],{...selected[1],status:'skipped'}],{expected:1,skipped:1,unexpected:0,flaky:1}),allowed),'FAILED_OR_FLAKY_TESTS');
 assert.equal(inspectBrowserShard(ok,list,{status:1,signal:null},run,allowed),'PLAYWRIGHT_FAILED');
 assert.equal(inspectBrowserShard(ok,list,ok,null,allowed),'REPORT_UNAVAILABLE');
 assert.ok(reviewedSkips.length>0);
});

test('fixture preflight rejects skipped, absent, flaky and failed browser evidence',()=>{
 assert.match(preflightRunner,/node_modules','playwright','cli\.js'/);
 assert.match(preflightRunner,/--project=desktop-chromium','--reporter=json','--retries=0'/);
 const report=()=>({
  suites:[{file:'tests/e2e/fixture-contract-preflight.spec.ts'}],
  errors:[],
  stats:{expected:1,skipped:0,unexpected:0,flaky:0}
 });
 assert.equal(inspectFixturePreflightResult({status:0,signal:null},report()),null);
 const playwrightReport=report();playwrightReport.suites[0].file='fixture-contract-preflight.spec.ts';
 assert.equal(inspectFixturePreflightResult({status:0,signal:null},playwrightReport),null);
 const skipped=report();skipped.stats.expected=0;skipped.stats.skipped=1;
 assert.equal(inspectFixturePreflightResult({status:0,signal:null},skipped),'ONE_PASS_ZERO_SKIPS_REQUIRED');
 const absent=report();absent.stats.expected=0;
 assert.equal(inspectFixturePreflightResult({status:0,signal:null},absent),'ONE_PASS_ZERO_SKIPS_REQUIRED');
 const flaky=report();flaky.stats.expected=0;flaky.stats.flaky=1;
 assert.equal(inspectFixturePreflightResult({status:0,signal:null},flaky),'ONE_PASS_ZERO_SKIPS_REQUIRED');
 const wrongFile=report();wrongFile.suites[0].file='tests/e2e/other.spec.ts';
 assert.equal(inspectFixturePreflightResult({status:0,signal:null},wrongFile),'REPORT_MISSING_OR_UNEXPECTED');
 assert.equal(inspectFixturePreflightResult({status:0,signal:null},null),'REPORT_MISSING_OR_UNEXPECTED');
 assert.equal(inspectFixturePreflightResult({status:1,signal:null},report()),'PLAYWRIGHT_FAILED');
});

test('release branches start CI automatically and other branches keep PR or dispatch',()=>{
 assert.match(workflow,/on:\n\s+pull_request:\n\s+push:\n\s+branches: \[main, feat\/mobile-app, 'release\/\*\*'\]\n\s+workflow_dispatch:/);
});

test('one release-ready job requires every same-commit boundary',()=>{
 const gate=workflow.slice(workflow.indexOf('  release-ready:\n'));
 assert.match(gate,/needs: \[validate, e2e, featured-prepare, mobile-internal, container\]/);
 assert.match(gate,/if: always\(\)/);
 for(const job of ['validate','e2e','featured-prepare','mobile-internal','container']){
  assert.match(gate,new RegExp(`test '\\\$\\{\\{ needs\\.${job}\\.result \\}\\}' = 'success'`));
 }
 const proposal=JSON.parse(readFileSync('docs/operations/repository-protection-plan.json','utf8'));
 assert.equal(proposal.status,'PROPOSED_NOT_APPLIED');
 assert.deepEqual(proposal.branchProtection.required_status_checks.contexts,['release-ready']);
});
