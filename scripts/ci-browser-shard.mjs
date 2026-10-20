import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const manifest=JSON.parse(readFileSync(path.join(root,'tests/e2e/ci-allowed-skips.json'),'utf8'));
const identity=({file,title,project})=>`${file}\u0000${title}\u0000${project}`;

function cases(report){
 const rows=[];
 function visit(suite){
  for(const spec of suite.specs||[]){
   for(const test of spec.tests||[])rows.push({file:path.basename(String(spec.file||suite.file||'')),title:spec.title,project:test.projectName,status:test.status});
  }
  for(const child of suite.suites||[])visit(child);
 }
 for(const suite of report?.suites||[])visit(suite);
 return rows;
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
 // memory and print only bounded status/count evidence.
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
 if(listed.result.status!==0||!listed.report){process.stderr.write('CI_BROWSER_SHARD_TEST_LIST_UNAVAILABLE\n');process.exitCode=1;return;}
 const executed=runJson(args);
 const failure=inspectBrowserShard(listed.result,listed.report,executed.result,executed.report);
 if(failure){
  const stats=executed.report?.stats||{};
  process.stderr.write(`CI_BROWSER_SHARD_${failure} shard=${shard} passed=${stats.expected??'?'} skipped=${stats.skipped??'?'} failed=${stats.unexpected??'?'} flaky=${stats.flaky??'?'}\n`);
  process.exitCode=1;
  return;
 }
 process.stdout.write(`CI browser shard ${shard}: ${executed.report.stats.expected} passed, ${executed.report.stats.skipped} reviewed skips, zero failures or retries.\n`);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
