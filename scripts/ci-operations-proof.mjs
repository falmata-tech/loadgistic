import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {reportBrowserShardFailure} from './ci-browser-shard.mjs';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const file='operations-connected-actions.spec.ts';
const title='Operations single-proof boundary preserves acknowledged bytes';

export function inspectOperationsProofResult(processResult,report){
 if(processResult.error||processResult.signal||processResult.status!==0)return 'PLAYWRIGHT_FAILED';
 if(!report||!Array.isArray(report.suites)||!Array.isArray(report.errors)||!report.stats)return 'REPORT_UNAVAILABLE';
 const {expected,skipped,unexpected,flaky}=report.stats;
 if(expected!==2||skipped!==0||unexpected!==0||flaky!==0||report.errors.length)return 'TWO_CLEAN_PROJECT_PASSES_REQUIRED';
 const seen=new Set(),pending=[...report.suites];let suites=0,tests=0;
 while(pending.length){
  if(++suites>64)return 'UNEXPECTED_SELECTION';
  const suite=pending.shift();
  if(!suite||typeof suite!=='object')return 'UNEXPECTED_SELECTION';
  if(suite.suites!==undefined&&!Array.isArray(suite.suites))return 'UNEXPECTED_SELECTION';
  pending.push(...(suite.suites||[]));
  if(suite.specs!==undefined&&!Array.isArray(suite.specs))return 'UNEXPECTED_SELECTION';
  for(const spec of suite.specs||[]){
   if(!spec||typeof spec!=='object'||Array.isArray(spec))return 'UNEXPECTED_SELECTION';
   const source=spec.file||suite.file;
   if(typeof source!=='string'||path.basename(source)!==file||spec.title!==title||!Array.isArray(spec.tests))return 'UNEXPECTED_SELECTION';
   for(const test of spec.tests){
    if(!test||typeof test!=='object'||Array.isArray(test))return 'UNEXPECTED_SELECTION';
    if(++tests>2||!['desktop-chromium','mobile-chromium'].includes(test.projectName)
     ||test.status!=='expected'||!Array.isArray(test.results)||test.results.length!==1
     ||test.results[0]?.status!=='passed'||test.results[0]?.retry!==0)return 'TWO_CLEAN_PROJECT_PASSES_REQUIRED';
    const key=test.projectName;
    if(seen.has(key))return 'UNEXPECTED_SELECTION';
    seen.add(key);
   }
  }
 }
 return seen.size===2?null:'TWO_CLEAN_PROJECT_PASSES_REQUIRED';
}

export function runOperationsProofRepetitions(run,write=message=>process.stdout.write(message)){
 for(let repetition=1;repetition<=3;repetition++){
  const {result,report}=run();
  const failure=inspectOperationsProofResult(result,report);
  if(failure){
   write(`CI_OPERATIONS_PROOF_${failure} repetition=${repetition}\n`);
   reportBrowserShardFailure(result.status===0?'FAILED_OR_FLAKY_TESTS':'PLAYWRIGHT_FAILED',4,report,write);
   return false;
  }
  write(`CI Operations proof repetition ${repetition}: desktop and phone passed; zero skips or retries.\n`);
 }
 return true;
}
function main(){
 if(process.argv.length!==2){process.stderr.write('CI_OPERATIONS_PROOF_ARGUMENTS_REJECTED\n');process.exitCode=1;return;}
 // Fixed synthetic workflow only. Raw reports can contain request/session data.
 const run=()=>{
  const result=spawnSync(process.execPath,[path.join(root,'node_modules/playwright/cli.js'),'test',`tests/e2e/${file}`,
   '--grep',`${title}$`,'--project=desktop-chromium','--project=mobile-chromium','--repeat-each=1','--retries=0','--workers=1','--reporter=json'],{
   cwd:root,env:process.env,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:64*1024*1024,timeout:480_000
  });
  let report=null;try{report=JSON.parse(result.stdout||'');}catch{/* Bounded failure only. */}
  return {result,report};
 };
 process.exitCode=runOperationsProofRepetitions(run)?0:1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
