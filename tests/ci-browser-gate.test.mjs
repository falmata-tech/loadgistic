import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import ts from 'typescript';
import {inspectFixturePreflightResult} from '../scripts/ci-fixture-preflight.mjs';
import {inspectFeaturedPrepareResult} from '../scripts/ci-featured-prepare.mjs';
import {inspectBrowserShard,failedBrowserFiles,browserShardFailureSummary,failedBrowserCaseDiagnostics,reportBrowserShardFailure} from '../scripts/ci-browser-shard.mjs';
const reviewedSkips=JSON.parse(readFileSync('tests/e2e/ci-allowed-skips.json','utf8')).allowed;
const workflow=readFileSync('.github/workflows/ci.yml','utf8');
const preflightRunner=readFileSync('scripts/ci-fixture-preflight.mjs','utf8');
const featuredRunner=readFileSync('scripts/ci-featured-prepare.mjs','utf8');
test('every intentional browser skip is reviewed before CI starts',()=>{
 const expected=[];
 for(const file of readdirSync('tests/e2e').filter(name=>name.endsWith('.spec.ts'))){
  const source=ts.createSourceFile(file,readFileSync(`tests/e2e/${file}`,'utf8'),ts.ScriptTarget.Latest,true);
  function visit(node){
   if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='test'
     &&ts.isStringLiteral(node.arguments[0])&&node.arguments[1]){
    const title=node.arguments[0].text;
    const skips=[];
    function findSkip(child){
     if(ts.isCallExpression(child)&&ts.isPropertyAccessExpression(child.expression)
       &&ts.isIdentifier(child.expression.expression)&&child.expression.expression.text==='test'
       &&child.expression.name.text==='skip')skips.push(child.arguments[0]?.getText(source)||'');
     ts.forEachChild(child,findSkip);
    }
    findSkip(node.arguments[1]);
    if(skips.length){
     const conditions=skips.join(' ');
     const projects=conditions.includes('process.env')?['desktop-chromium','mobile-chromium']
      :conditions.includes('desktop-chromium')?['mobile-chromium']
      :conditions.includes('mobile-chromium')?['desktop-chromium']:null;
     assert.ok(projects,`Review skip condition in ${file}: ${title}`);
     for(const project of projects)expected.push({file,title,project});
    }
   }
   ts.forEachChild(node,visit);
  }
  visit(source);
 }
 const key=row=>`${row.file}\0${row.title}\0${row.project}`;
 assert.deepEqual(reviewedSkips.map(key).sort(),expected.map(key).sort());
});
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

test('each CI fixture import provides only a synthetic recipient for demo-world sharing',()=>{
 const imports=[...workflow.matchAll(/- name: Import and verify managed fixtures\n\s+env:\n\s+LOADGISTIC_DEMO_SHARED_EMAILS: ([^\n]+)\n\s+run: npm run supabase:local:configure/g)];
 assert.equal(imports.length,3,'validate, browser shards and Featured prepare must use the same fixture');
 assert.deepEqual([...new Set(imports.map(match=>match[1]))],['ci-capacity@example.test']);
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

test('failed browser report names only bounded source test files for diagnosis',()=>{
 const report={suites:[
  {file:'tests/e2e/featured-operations-review.spec.ts',specs:[{tests:[{projectName:'desktop-chromium',status:'unexpected'},{projectName:'mobile-chromium',status:'unexpected'}]}]},
  {file:'tests/e2e/ordinary.spec.ts',specs:[{tests:[{projectName:'desktop-chromium',status:'expected'}]}]},
  {file:'tests/e2e/unsafe name.spec.ts',specs:[{tests:[{projectName:'desktop-chromium',status:'unexpected'}]}]}
 ]};
 assert.deepEqual(failedBrowserFiles(report),['featured-operations-review.spec.ts']);
 assert.deepEqual(failedBrowserFiles(null),[]);
 const many={suites:Array.from({length:12},(_,index)=>({file:`tests/e2e/case-${String(index).padStart(2,'0')}.spec.ts`,specs:[{tests:[{status:'unexpected'}]}]}))};
 many.suites.push({file:`${'x'.repeat(121)}.spec.ts`,specs:[{tests:[{status:'unexpected'}]}]});
 assert.deepEqual(failedBrowserFiles(many),Array.from({length:10},(_,index)=>`case-${String(index).padStart(2,'0')}.spec.ts`));
 assert.deepEqual(failedBrowserFiles({suites:[many.suites.at(-1)]}),[]);
});

test('browser shard failure summary exposes only safe counts and source filenames',()=>{
 const report={suites:[{file:'tests/e2e/ordinary.spec.ts',specs:[{
  title:'PRIVATE_TITLE private@example.test',tests:[{status:'unexpected',error:{message:'PRIVATE_ASSERTION',headers:{Authorization:'PRIVATE_HEADER'}}}]
 }]}],errors:[{message:'PRIVATE_REPORT'}],stats:{expected:12,skipped:2,unexpected:1,flaky:0}};
 assert.equal(browserShardFailureSummary('PLAYWRIGHT_FAILED',3,report),
  'CI_BROWSER_SHARD_PLAYWRIGHT_FAILED shard=3 passed=12 skipped=2 failed=1 flaky=0 failed_files=ordinary.spec.ts');
 assert.equal(browserShardFailureSummary('TEST_LIST_UNAVAILABLE',8,null),
  'CI_BROWSER_SHARD_TEST_LIST_UNAVAILABLE shard=8 passed=? skipped=? failed=? flaky=? failed_files=unknown');
});

test('browser shard diagnosis never stringifies malformed counts or untrusted reason and shard fields',()=>{
 const unsafe=[undefined,null,'12','PRIVATE_COUNT\n::error::PRIVATE_ANNOTATION',{},['PRIVATE_ARRAY'],false,-1,.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,
  {toString(){throw Error('COUNTS_MUST_NOT_BE_STRINGIFIED');}}];
 for(const value of unsafe){
  assert.equal(browserShardFailureSummary('PLAYWRIGHT_FAILED',1,{stats:{expected:value,skipped:value,unexpected:value,flaky:value}}),
   'CI_BROWSER_SHARD_PLAYWRIGHT_FAILED shard=1 passed=? skipped=? failed=? flaky=? failed_files=unknown');
 }
 assert.equal(browserShardFailureSummary('PRIVATE_REASON\n::error::PRIVATE_ANNOTATION','PRIVATE_SHARD',null),
  'CI_BROWSER_SHARD_REPORT_UNAVAILABLE shard=? passed=? skipped=? failed=? flaky=? failed_files=unknown');
});

test('browser shard failures emit one GitHub error annotation matching the sanitized log summary',()=>{
 for(const [reason,report] of [['TEST_LIST_UNAVAILABLE',null],['PLAYWRIGHT_FAILED',{stats:{expected:'PRIVATE\n::error::INJECTED',skipped:0,unexpected:1,flaky:0}}]]){
  const chunks=[];reportBrowserShardFailure(reason,4,report,message=>chunks.push(message));
  const summary=browserShardFailureSummary(reason,4,report);
  assert.deepEqual(chunks,[`${summary}\n::error::${summary}\n`]);
  assert.equal(chunks.join('').split('\n').filter(line=>line.startsWith('::error::')).length,1);
  assert.doesNotMatch(chunks.join(''),/PRIVATE|INJECTED/);
 }
});

const diagnosticFile='driver-manual-mobile-preview.spec.ts';
function diagnosticReport({file=diagnosticFile,line=12,project='mobile-chromium',status='unexpected',results=[]}={}){
 return {suites:[{file:`tests/e2e/${file}`,specs:[{file,line,title:'PRIVATE_TITLE contact@example.test',
  tests:[{projectName:project,status,results}]}]}],errors:[],stats:{expected:0,skipped:0,unexpected:1,flaky:0}};
}

test('known layout failures retain only typed geometry differences without assertion text',()=>{
 const report=diagnosticReport({file:'truck-profile-layout.spec.ts',results:[{status:'failed',error:{message:
  'PRIVATE_ASSERTION contact@example.test\n\u001b[32m-   "verticalOverflow": 0,\u001b[39m\n\u001b[31m+   "verticalOverflow": 8.5,\u001b[39m\n    "peopleStacked": true,\n    "contact": "PRIVATE_PHONE",\n    "horizontalOverflow": "PRIVATE_TOKEN",'
 }}]});
 const expected=[{field:'verticalOverflow',side:'expected',value:0},{field:'verticalOverflow',side:'received',value:8.5},{field:'peopleStacked',side:'context',value:true}];
 assert.deepEqual(failedBrowserCaseDiagnostics(report)[0].layout,expected);
 const output=[];reportBrowserShardFailure('PLAYWRIGHT_FAILED',7,report,value=>output.push(value));
 assert.match(output[2],/^::error file=tests\/e2e\/truck-profile-layout.spec.ts::CI_BROWSER_LAYOUT /);
 assert.doesNotMatch(output.join(''),/PRIVATE|contact@example|contact|Authorization/);
});

test('layout measurements reject wrong files, keys, types and malformed numeric values',()=>{
 const message=['"verticalOverflow": -1,','"verticalOverflow": 1000001,','"verticalOverflow": Infinity,','"verticalOverflow": 1e3,','"verticalOverflow": "42",','"verticalOverflow": true,','"peopleStacked": 1,','"unknown": 12,','prefix "verticalOverflow": 5,','"verticalOverflow": 5, PRIVATE'].join('\n');
 for(const file of ['truck-profile-layout.spec.ts','public-map-shell-layout.spec.ts',diagnosticFile]){
  assert.equal(failedBrowserCaseDiagnostics(diagnosticReport({file,results:[{status:'failed',error:{message}}]}))[0].layout,undefined);
 }
 for(const message of [null,{},Array(1),'x'.repeat(100001),{toString(){throw Error('DO_NOT_STRINGIFY');}}]){
  assert.equal(failedBrowserCaseDiagnostics(diagnosticReport({file:'truck-profile-layout.spec.ts',results:[{status:'failed',error:{message}}]}))[0].layout,undefined);
 }
});

test('map-shell layout booleans are allowlisted and repeated measurements remain bounded',()=>{
 const report=diagnosticReport({file:'public-map-shell-layout.spec.ts',results:[{status:'failed',errors:[{message:'- "navigationClear": true,\n+ "navigationClear": false,\n"verticalOverflow": 9,\n"navigationClear": "PRIVATE"'},{message:'- "navigationClear": true,'}]}]});
 assert.deepEqual(failedBrowserCaseDiagnostics(report)[0].layout,[{field:'navigationClear',side:'expected',value:true},{field:'navigationClear',side:'received',value:false}]);
 const message=Array.from({length:100},(_,n)=>`+ "verticalOverflow": ${n},`).join('\n');
 assert.equal(failedBrowserCaseDiagnostics(diagnosticReport({file:'truck-profile-layout.spec.ts',results:[{status:'failed',error:{message}}]}))[0].layout.length,24);
});

test('case annotation prefers the failing spec stack frame and keeps the shard summary unchanged',()=>{
 const report=diagnosticReport({results:[{status:'failed',errorLocation:{file:diagnosticFile,line:30},error:{
  message:'PRIVATE_ASSERTION Authorization: Bearer PRIVATE_TOKEN',
  stack:`Error: PRIVATE_STACK\n    at helper (/repo/tests/e2e/fixture-helper.ts:900:1)\n    at unrelated (/repo/tests/e2e/play-policy-workflows.spec.ts:88:4)\n    at source (/repo/tests/e2e/${diagnosticFile}:123:7)`,
  location:{file:diagnosticFile,line:31}
 }}]});
 assert.deepEqual(failedBrowserCaseDiagnostics(report),[{
  file:diagnosticFile,project:'mobile-chromium',category:'FAILED',line:123,declarationLine:12
 }]);
 const chunks=[];reportBrowserShardFailure('PLAYWRIGHT_FAILED',4,report,chunk=>chunks.push(chunk));
 const summary=browserShardFailureSummary('PLAYWRIGHT_FAILED',4,report);
 assert.deepEqual(chunks,[`${summary}\n::error::${summary}\n`,
  `::error file=tests/e2e/${diagnosticFile},line=123::CI_BROWSER_CASE file=${diagnosticFile} line=123 project=mobile-chromium category=FAILED declaration_line=12\n`]);
 assert.doesNotMatch(chunks.join(''),/PRIVATE|contact@example|fixture-helper|unrelated|Authorization/);
});

test('case source extraction accepts standard stack frame paths without printing their directories or function names',()=>{
 const frames=[
  `    at source (/repo/tests/e2e/${diagnosticFile}:45:7)`,
  `    at file:///repo/tests/e2e/${diagnosticFile}:45:7`,
  `    at ${diagnosticFile}:45:7`,
  `    at PRIVATE_FUNCTION (C:\\repo\\tests\\e2e\\${diagnosticFile}:45:7)`
 ];
 for(const frame of frames){
  const report=diagnosticReport({results:[{status:'failed',error:{stack:`Error: PRIVATE_MESSAGE\n${frame}`}}]});
  assert.equal(failedBrowserCaseDiagnostics(report)[0].line,45);
 }
});

test('case source extraction falls back only to matching structured error locations',()=>{
 const location={file:`/repo/tests/e2e/${diagnosticFile}`,line:62};
 for(const fields of [{errorLocation:location},{error:{location}},{errors:[{location}]}]){
  assert.equal(failedBrowserCaseDiagnostics(diagnosticReport({results:[{status:'timedOut',...fields}]}))[0].line,62);
 }
 const result={status:'timedOut',errorLocation:{file:'/repo/tests/e2e/helper.ts',line:99},error:{
  message:`PRIVATE_MESSAGE\n    at /repo/tests/e2e/${diagnosticFile}:777:1`,
  snippet:`PRIVATE_SNIPPET ${diagnosticFile}:888`,
  stack:`Error: PRIVATE_STACK\n    at /repo/helpers/${diagnosticFile}:456:2\n    at /repo/tests/e2e/helper.ts:457:2`
 }};
 const report=diagnosticReport({results:[result]});
 assert.deepEqual(failedBrowserCaseDiagnostics(report),[{
  file:diagnosticFile,project:'mobile-chromium',category:'TIMED_OUT',line:null,declarationLine:12
 }]);
 const chunks=[];reportBrowserShardFailure('PLAYWRIGHT_FAILED',4,report,chunk=>chunks.push(chunk));
 assert.match(chunks[1],/ line=unknown project=mobile-chromium category=TIMED_OUT declaration_line=12\n$/);
 assert.doesNotMatch(chunks[1],/,line=|PRIVATE|456|457|777|888/);
});

test('case annotations retain failed attempts for flaky tests and explicitly handle absent or unknown results',()=>{
 const failed={status:'failed',error:{stack:`Error\n    at /repo/tests/e2e/${diagnosticFile}:72:3`}};
 assert.deepEqual(failedBrowserCaseDiagnostics(diagnosticReport({status:'flaky',results:[failed,{status:'passed'}]})),[{
  file:diagnosticFile,project:'mobile-chromium',category:'FLAKY',line:72,declarationLine:12
 }]);
 for(const results of [undefined,null,[],[null],{},'PRIVATE_RESULT']){
  assert.deepEqual(failedBrowserCaseDiagnostics(diagnosticReport({results})),[{
   file:diagnosticFile,project:'mobile-chromium',category:'RESULT_UNAVAILABLE',line:null,declarationLine:12
  }]);
 }
 for(const [status,category] of [['interrupted','INTERRUPTED'],['passed','UNEXPECTED_PASS'],['PRIVATE_RESULT','UNKNOWN_RESULT']]){
  assert.equal(failedBrowserCaseDiagnostics(diagnosticReport({results:[{status}]}))[0].category,category);
 }
 for(const status of ['expected','skipped','PRIVATE_STATUS'])assert.deepEqual(failedBrowserCaseDiagnostics(diagnosticReport({status,results:[failed]})),[]);
 assert.deepEqual(failedBrowserCaseDiagnostics(null),[]);
});

test('case annotations validate filenames, project names and numeric lines without stringifying runtime fields',()=>{
 const notStringifiable={toString(){throw Error('RUNTIME_FIELDS_MUST_NOT_BE_STRINGIFIED');}};
 const unsafeLines=[undefined,null,0,-1,.5,'42','PRIVATE_LINE\n::error::INJECTED',NaN,Infinity,1_000_001,Number.MAX_SAFE_INTEGER+1,notStringifiable];
 for(const line of unsafeLines){
  const report=diagnosticReport({line,project:'PRIVATE_PROJECT\n::error::INJECTED',results:[{
   status:'PRIVATE_RESULT\n::error::INJECTED',errorLocation:{file:diagnosticFile,line},error:{stack:notStringifiable}
  }]});
  report.suites[0].specs[0].line=line;
  const chunks=[];reportBrowserShardFailure('PLAYWRIGHT_FAILED',4,report,chunk=>chunks.push(chunk));
  assert.equal(chunks[1],`::error file=tests/e2e/${diagnosticFile}::CI_BROWSER_CASE file=${diagnosticFile} line=unknown project=unknown category=UNKNOWN_RESULT declaration_line=unknown\n`);
  assert.doesNotMatch(chunks.join(''),/PRIVATE|INJECTED/);
 }
 for(const project of ['desktop-chromium','mobile-chromium',notStringifiable]){
  assert.equal(failedBrowserCaseDiagnostics(diagnosticReport({project}))[0].project,
   typeof project==='string'?project:'unknown');
 }
 for(const file of ['not-a-repository-test.spec.ts','unsafe name.spec.ts','bad,prop.spec.ts','bad%0A.spec.ts',`unsafe\n${diagnosticFile}`,`/helpers/${diagnosticFile}`,notStringifiable]){
  const report=diagnosticReport();report.suites[0].specs[0].file=file;
  assert.deepEqual(failedBrowserCaseDiagnostics(report),[]);
 }
 for(const line of [1,1_000_000]){
  assert.equal(failedBrowserCaseDiagnostics(diagnosticReport({line,results:[{status:'failed',errorLocation:{file:diagnosticFile,line}}]}))[0].line,line);
 }
});

test('case annotations discard sentinel contact, credential and request context from every error surface',()=>{
 const sentinels=['SENTINEL_COOKIE','SENTINEL_TOKEN','SENTINEL_PASSWORD','sentinel@example.test','+251911234567'];
 const privateContext=sentinels.join(' ');
 const report=diagnosticReport({project:'desktop-chromium',results:[{status:'failed',error:{
  message:privateContext,stack:`Error: ${privateContext}\n    at ${privateContext} (/private/${privateContext}/tests/e2e/${diagnosticFile}:84:5)`,
  snippet:privateContext,cause:{message:privateContext},headers:{Cookie:sentinels[0],Authorization:sentinels[1]},
  request:{body:privateContext},response:{body:privateContext}
 },errors:[{message:privateContext}],stdout:[{text:privateContext}],stderr:[{text:privateContext}],attachments:[{body:privateContext}]}]});
 report.suites[0].specs[0].title=privateContext;
 report.errors=[{message:privateContext}];
 const chunks=[];reportBrowserShardFailure('PLAYWRIGHT_FAILED',4,report,chunk=>chunks.push(chunk));
 assert.match(chunks[1],/line=84 project=desktop-chromium category=FAILED declaration_line=12/);
 for(const sentinel of sentinels)assert.equal(chunks.join('').includes(sentinel),false);
 assert.equal(chunks.join('').split('\n').filter(line=>line.startsWith('::error')).length,2);
});

test('case diagnostics are bounded per failed case without changing completed-report gate decisions',()=>{
 const report=diagnosticReport();
 const spec=report.suites[0].specs[0];
 report.suites[0].specs=Array.from({length:24},(_,index)=>({...spec,line:index+1}));
 const diagnostics=failedBrowserCaseDiagnostics(report);
 assert.equal(diagnostics.length,20);
 assert.deepEqual(diagnostics.map(row=>row.declarationLine),Array.from({length:20},(_,index)=>index+1));
 const selected=structuredClone(report);
 const ok={status:0,signal:null};
 assert.equal(inspectBrowserShard(ok,selected,{status:1,signal:null},report,[]),'PLAYWRIGHT_FAILED');
 report.suites[0].specs=report.suites[0].specs.slice(0,1);
 assert.equal(inspectBrowserShard(ok,selected,ok,report,[]),'TEST_SELECTION_CHANGED');
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
