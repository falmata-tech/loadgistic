import {spawnSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import axe from 'axe-core';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const manifest=JSON.parse(readFileSync(path.join(root,'tests/e2e/ci-allowed-skips.json'),'utf8'));
const identity=({file,title,project})=>`${file}\u0000${title}\u0000${project}`;
const failureReasons=new Set(['TEST_LIST_UNAVAILABLE','PLAYWRIGHT_FAILED','REPORT_UNAVAILABLE','NO_SELECTED_TESTS',
 'TEST_SELECTION_CHANGED','FAILED_OR_FLAKY_TESTS','SKIP_COUNT_MISMATCH','UNREVIEWED_OR_MISSING_SKIP','RESULT_COUNT_MISMATCH']);
const sourceFiles=new Set(readdirSync(path.join(root,'tests/e2e'))
 .filter(file=>file.length<=128&&/^[A-Za-z0-9._-]+\.spec\.ts$/.test(file)));
const projects=new Set(['desktop-chromium','mobile-chromium']);
const resultCategories=new Map([['failed','FAILED'],['timedOut','TIMED_OUT'],['interrupted','INTERRUPTED'],['passed','UNEXPECTED_PASS']]);
const knownAxeRules=new Set(axe.getRules().map(rule=>rule.ruleId));
const publicA11yRoutes=new Set(['/','/shared-capacity','/featured','/about','/privacy','/terms','/track','/login','/apply','/@blueline-transport']);
const authenticatedA11yCases=new Map([
 ...['/app/home','/app/fleet','/app/provider-shipments','/app/company-page','/app/verification','/app/support','/app/more','/app/menu']
  .map(route=>[`fleet transporter ${route} has no serious accessibility violations`,{role:'FLEET_TRANSPORTER',route}]),
 ...['/app/home','/app/provider-shipments','/app/verification','/app/support','/app/more','/app/menu']
  .map(route=>[`self-managed Driver ${route} has no serious accessibility violations`,{role:'SELF_MANAGED_DRIVER',route}])
]);
const accessibilityStages=new Map([
 ['accessibility: primary axe','PRIMARY_AXE'],
 ['accessibility: target size axe','TARGET_SIZE_AXE'],
 ['accessibility: assert results','ASSERT_RESULTS']
]);
const portraitCases=new Map([
 ["independent Driver controls their public portrait while Featured keeps the provider's separate identity",'SELF_MANAGED'],
 ["company Driver controls their public portrait while Featured keeps the provider's separate identity",'COMPANY']
]);
const sourceLine=value=>Number.isSafeInteger(value)&&value>0&&value<=1_000_000?value:null;
const trackingSmokeTitle='provider starts Tracking for one owner, who shares status with a viewer after verifying email';
const trackingStages=new Map([
 ['tracking: prepare synthetic provider and vehicle','FIXTURE'],
 ['tracking: provider email sign-in','PROVIDER_SIGN_IN'],
 ['tracking: create shipment and open provider detail','CREATE_SHIPMENT'],
 ['tracking: provider status and proof','STATUS_AND_PROOF'],
 ['tracking: owner email access and viewer invitation','OWNER_SHARING'],
 ['tracking: viewer email access and restricted detail','VIEWER_RESTRICTIONS'],
 ['tracking: clean up synthetic records','CLEANUP'],
]);

function failedWorkflowStage(result,file,title){
 if(file!=='smoke.spec.ts'||title!==trackingSmokeTitle||!Array.isArray(result?.steps))return null;
 for(const step of result.steps.slice(0,32)){
  if(!step||typeof step!=='object'||!trackingStages.has(step.title)
   ||!step.error||typeof step.error!=='object'||Array.isArray(step.error))continue;
  const duration=step.duration;
  return {stage:trackingStages.get(step.title),durationMs:Number.isSafeInteger(duration)&&duration>=0&&duration<=3_600_000?duration:null};
 }
 return null;
}

function cases(report){
 const rows=[];
 function visit(suite){
  for(const spec of suite.specs||[]){
   const file=spec.file||suite.file;
   for(const test of spec.tests||[])rows.push({file:typeof file==='string'?path.basename(file):'',title:spec.title,project:test.projectName,status:test.status,
    sourceFile:file,declarationLine:spec.line,results:test.results});
  }
  for(const child of suite.suites||[])visit(child);
 }
 for(const suite of report?.suites||[])visit(suite);
 return rows;
}

export function failedBrowserFiles(report){
 return [...new Set(cases(report).filter(test=>test.status==='unexpected'||test.status==='flaky')
  .map(test=>test.file).filter(file=>file.length<=128&&/^[A-Za-z0-9._-]+\.spec\.ts$/.test(file)))].sort().slice(0,10);
}

export function browserShardFailureSummary(failure,shard,report){
 const reason=failureReasons.has(failure)?failure:'REPORT_UNAVAILABLE';
 const shardNumber=Number.isInteger(shard)&&shard>=1&&shard<=8?shard:'?';
 const count=value=>Number.isSafeInteger(value)&&value>=0?value:'?';
 const stats=report?.stats||{};
 const files=failedBrowserFiles(report).join(',')||'unknown';
 return `CI_BROWSER_SHARD_${reason} shard=${shardNumber} passed=${count(stats.expected)} skipped=${count(stats.skipped)} failed=${count(stats.unexpected)} flaky=${count(stats.flaky)} failed_files=${files}`;
}

function sourceFile(value){
 if(typeof value!=='string'||value.length>4096||/[\r\n\0]/.test(value))return null;
 const normalized=value.replaceAll('\\','/');
 const file=path.posix.basename(normalized);
 return sourceFiles.has(file)&&(normalized===file||normalized===`tests/e2e/${file}`||normalized.endsWith(`/tests/e2e/${file}`))?file:null;
}

function failureLine(result,file){
 const errors=[result?.error,...(Array.isArray(result?.errors)?result.errors:[])];
 // Read only real stack-frame lines, never formatted messages or snippets. A
 // helper's location cannot identify the failing assertion in the source spec.
 for(const error of errors){
  if(typeof error?.stack!=='string')continue;
  for(const frame of error.stack.split(/\r?\n/)){
   const match=/^\s+at (?:.* \()?([^()\r\n]+):([1-9][0-9]{0,6}):[0-9]+\)?$/.exec(frame);
   if(match&&sourceFile(match[1])===file){
    const line=sourceLine(Number(match[2]));
    if(line!==null)return line;
   }
  }
 }
 for(const location of [result?.errorLocation,...errors.map(error=>error?.location)]){
  if(sourceFile(location?.file)===file&&sourceLine(location?.line)!==null)return location.line;
 }
 return null;
}

const layoutKeys={
 'truck-profile-layout.spec.ts':{booleans:['peopleSideBySide','peopleStacked','docsSideBySide'],pixels:['horizontalOverflow','verticalOverflow']},
 'public-map-shell-layout.spec.ts':{booleans:['navigationClear','headerClear','withinViewport','toolsContained','sessionClear','sessionMapContained','usableMap','noDocumentOverflow'],pixels:[]}
};
function layoutMeasurements(result,file){
 const keys=layoutKeys[file];if(!keys)return [];
 const rows=[],seen=new Set();
 for(const error of [result?.error,...(Array.isArray(result?.errors)?result.errors:[])]){
  if(typeof error?.message!=='string'||error.message.length>100_000)continue;
  for(const line of error.message.replace(/\x1b\[[0-9;]*m/g,'').split(/\r?\n/)){
   const match=/^\s*([+-]?)\s*"([A-Za-z]+)":\s*(true|false|(?:0|[1-9][0-9]*)(?:\.[0-9]+)?),?\s*$/.exec(line);
   if(!match)continue;
   const [,sign,field,literal]=match,isBoolean=literal==='true'||literal==='false';
   if(!(isBoolean?keys.booleans:keys.pixels).includes(field))continue;
   const value=isBoolean?literal==='true':Number(literal);if(typeof value==='number'&&(!Number.isFinite(value)||value>1_000_000))continue;
   const side=sign==='-'?'expected':sign==='+'?'received':'context',key=`${side}:${field}:${value}`;
   if(!seen.has(key)){seen.add(key);rows.push({field,side,value});}
   if(rows.length===24)return rows;
  }
 }
 return rows;
}

function accessibilityFailure(result,file,title){
 if(file!=='accessibility.spec.ts'||typeof title!=='string')return null;
 const match=/^public route (\/[^\s]*) has no serious accessibility violations$/.exec(title);
 if(!match||!publicA11yRoutes.has(match[1]))return null;
 const errors=[result?.error,...(Array.isArray(result?.errors)?result.errors:[])];
 const rules=new Set();
 for(const error of errors){
  const message=error?.message;
  if(typeof message!=='string'||message.length>100_000||!message.includes('serious/critical accessibility violations:'))continue;
  for(const line of message.replace(/\x1b\[[0-9;]*m/g,'').split(/\r?\n/)){
   const rule=/^\s*([a-z][a-z0-9-]{1,80}):\s/.exec(line)?.[1];
   if(knownAxeRules.has(rule))rules.add(rule);
  }
 }
 return {route:match[1],rules:[...rules].sort().slice(0,12)};
}

function authenticatedAccessibilityFailure(result,file,title){
 if(file!=='accessibility.spec.ts'||typeof title!=='string')return null;
 const identity=authenticatedA11yCases.get(title);
 if(!identity)return null;
 const failedStep=Array.isArray(result?.steps)?result.steps.slice(0,16).find(step=>
  step&&typeof step==='object'&&accessibilityStages.has(step.title)
  &&step.error&&typeof step.error==='object'&&!Array.isArray(step.error)):null;
 const stage=failedStep?accessibilityStages.get(failedStep.title):'BEFORE_OR_OUTSIDE_AXE';
 const errors=[failedStep?.error,result?.error,...(Array.isArray(result?.errors)?result.errors:[])];
 const messages=errors.map(error=>error?.message).filter(message=>typeof message==='string'&&message.length<=100_000);
 const has=pattern=>messages.some(message=>pattern.test(message));
 let errorType='OTHER';
 if(stage==='ASSERT_RESULTS'&&has(/serious\/critical accessibility violations:/))errorType='AXE_RULE_FAILURE';
 else if(has(/\bScript Timeout\b/))errorType='AXE_SCRIPT_TIMEOUT';
 else if(has(/Execution context was destroyed/))errorType='CONTEXT_DESTROYED';
 else if(has(/Target page, context or browser has been closed/))errorType='PAGE_CLOSED';
 else if(has(/Frame was detached/))errorType='FRAME_DETACHED';
 else if(has(/Timeout\s+\d+ms exceeded|page\.evaluate:\s*Timeout/))errorType='PLAYWRIGHT_TIMEOUT';
 else if(errors.some(error=>error?.name==='AxeError'))errorType='AXE_RUNTIME_ERROR';
 const rules=new Set();
 if(errorType==='AXE_RULE_FAILURE')for(const message of messages){
  if(!message.includes('serious/critical accessibility violations:'))continue;
  for(const line of message.replace(/\x1b\[[0-9;]*m/g,'').split(/\r?\n/)){
   const rule=/^\s*([a-z][a-z0-9-]{1,80}):\s/.exec(line)?.[1];
   if(knownAxeRules.has(rule))rules.add(rule);
  }
 }
 const duration=value=>Number.isSafeInteger(value)&&value>=0&&value<=3_600_000?value:null;
 return {...identity,stage,errorType,rules:[...rules].sort().slice(0,12),
  durationMs:duration(result?.duration),stepDurationMs:duration(failedStep?.duration)};
}

function portraitReplacementFailure(result,file,title){
 if(file!=='driver-portraits.spec.ts'||!portraitCases.has(title)||!Array.isArray(result?.steps))return null;
 for(const step of result.steps.slice(0,32)){
  if(!step||typeof step!=='object'||!step.error||typeof step.error!=='object'||Array.isArray(step.error))continue;
  const match=typeof step.title==='string'
   ?/^portrait: replacement HTTP old=([1-5][0-9]{2}) new=([1-5][0-9]{2})$/.exec(step.title):null;
  if(match)return {kind:portraitCases.get(title),oldStatus:Number(match[1]),newStatus:Number(match[2])};
 }
 return null;
}

export function failedBrowserCaseDiagnostics(report){
 const diagnostics=[];
 for(const test of cases(report)){
  if(test.status!=='unexpected'&&test.status!=='flaky')continue;
  const file=sourceFile(test.sourceFile);
  if(!file)continue;
  const results=Array.isArray(test.results)?test.results.filter(result=>result&&typeof result==='object'):[];
  const result=results.find(result=>result.status==='failed'||result.status==='timedOut'||result.status==='interrupted')||results.at(-1);
  const layout=layoutMeasurements(result,file);
  const a11y=accessibilityFailure(result,file,test.title);
  const authenticatedA11y=authenticatedAccessibilityFailure(result,file,test.title);
  const workflow=failedWorkflowStage(result,file,test.title);
  const portrait=portraitReplacementFailure(result,file,test.title);
  diagnostics.push({file,project:projects.has(test.project)?test.project:'unknown',
   category:test.status==='flaky'?'FLAKY':result?resultCategories.get(result.status)||'UNKNOWN_RESULT':'RESULT_UNAVAILABLE',
   line:failureLine(result,file),declarationLine:sourceLine(test.declarationLine),...(layout.length?{layout}:{}),...(a11y?{a11y}:{}),
   ...(authenticatedA11y?{authenticatedA11y}:{}),...(workflow?{workflow}:{}),...(portrait?{portrait}:{})});
  if(diagnostics.length===20)break;
 }
 return diagnostics;
}

export function reportBrowserShardFailure(failure,shard,report,write=message=>process.stderr.write(message)){
 const summary=browserShardFailureSummary(failure,shard,report);
 write(`${summary}\n::error::${summary}\n`);
 for(const {file,project,category,line,declarationLine,layout,a11y,authenticatedA11y,workflow,portrait} of failedBrowserCaseDiagnostics(report)){
  const location=`file=tests/e2e/${file}${line===null?'':`,line=${line}`}`;
  write(`::error ${location}::CI_BROWSER_CASE file=${file} line=${line??'unknown'} project=${project} category=${category} declaration_line=${declarationLine??'unknown'}\n`);
  if(layout)write(`::error ${location}::CI_BROWSER_LAYOUT file=${file} project=${project} measurements=${JSON.stringify(layout)}\n`);
  if(a11y)write(`::error ${location}::CI_BROWSER_A11Y route=${a11y.route} rules=${a11y.rules.join(',')||'unknown'}\n`);
  if(authenticatedA11y)write(`::error ${location}::CI_BROWSER_AUTH_A11Y role=${authenticatedA11y.role} route=${authenticatedA11y.route} stage=${authenticatedA11y.stage} error=${authenticatedA11y.errorType} duration_ms=${authenticatedA11y.durationMs??'unknown'} step_ms=${authenticatedA11y.stepDurationMs??'unknown'} rules=${authenticatedA11y.rules.join(',')||'unknown'}\n`);
  if(workflow)write(`::error ${location}::CI_BROWSER_STAGE file=${file} project=${project} stage=${workflow.stage} duration_ms=${workflow.durationMs??'unknown'}\n`);
  if(portrait)write(`::error ${location}::CI_BROWSER_PORTRAIT kind=${portrait.kind} old_status=${portrait.oldStatus} new_status=${portrait.newStatus}\n`);
 }
}

export function inspectBrowserShard(listResult,listReport,runResult,runReport,allowed=manifest.allowed){
 if(listResult.error||listResult.signal||listResult.status!==0||!listReport||!Array.isArray(listReport.suites))return 'TEST_LIST_UNAVAILABLE';
 if(runResult.error||runResult.signal||runResult.status!==0)return 'PLAYWRIGHT_FAILED';
 if(!runReport||!Array.isArray(runReport.suites)||!Array.isArray(runReport.errors)||!runReport.stats)return 'REPORT_UNAVAILABLE';
 const selected=cases(listReport),actual=cases(runReport);
 if(!selected.length||!actual.length)return 'NO_SELECTED_TESTS';
 const selectedIds=selected.map(identity),actualIds=actual.map(identity);
 if(new Set(selectedIds).size!==selectedIds.length||new Set(actualIds).size!==actualIds.length
  ||selectedIds.sort().join('\n')!==actualIds.sort().join('\n'))return 'TEST_SELECTION_CHANGED';
 const stats=runReport.stats;
 if(stats.expected<=0||stats.unexpected!==0||stats.flaky!==0||runReport.errors.length)return 'FAILED_OR_FLAKY_TESTS';
 const skipped=actual.filter(test=>test.status==='skipped').map(identity).sort();
 if(stats.skipped!==skipped.length)return 'SKIP_COUNT_MISMATCH';
 const expectedSkips=allowed.map(identity).filter(id=>selectedIds.includes(id)).sort();
 if(skipped.join('\n')!==expectedSkips.join('\n'))return 'UNREVIEWED_OR_MISSING_SKIP';
 if(stats.expected+stats.skipped!==actual.length)return 'RESULT_COUNT_MISMATCH';
 return null;
}

function runJson(args){
 const cli=path.join(root,'node_modules/playwright/cli.js');
 // Reports may contain request and assertion context. Keep both streams in
 // memory and print only bounded status/count and validated source locations.
 const result=spawnSync(process.execPath,[cli,'test',...args,'--reporter=json'],{
  cwd:root,env:process.env,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:64*1024*1024
 });
 let report=null;
 try{report=JSON.parse(result.stdout||'');}catch{/* sanitized failure below */}
 return {result,report};
}

function main(){
 const shard=Number(process.argv[2]);
 if(!Number.isInteger(shard)||shard<1||shard>8)throw Error('CI_BROWSER_SHARD_NUMBER_REQUIRED');
 const args=[`--shard=${shard}/8`,'--grep-invert=@featured-prepare','--retries=0','--workers=1'];
 const listed=runJson([...args,'--list']);
 if(listed.result.status!==0||!listed.report){reportBrowserShardFailure('TEST_LIST_UNAVAILABLE',shard,null);process.exitCode=1;return;}
 const executed=runJson(args);
 const failure=inspectBrowserShard(listed.result,listed.report,executed.result,executed.report);
 if(failure){
  reportBrowserShardFailure(failure,shard,executed.report);
  process.exitCode=1;
  return;
 }
 process.stdout.write(`CI browser shard ${shard}: ${executed.report.stats.expected} passed, ${executed.report.stats.skipped} reviewed skips, zero failures or retries.\n`);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
