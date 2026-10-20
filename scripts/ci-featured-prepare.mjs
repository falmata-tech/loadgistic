import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const cases=Object.freeze({
  'platform-controls':'tests/e2e/platform-controls.spec.ts',
  'featured-operations-review':'tests/e2e/featured-operations-review.spec.ts',
  'featured-team-permission':'tests/e2e/featured-team-permission.spec.ts'
});

export function inspectFeaturedPrepareResult(processResult,report,expectedFile){
  if(processResult.error||processResult.signal||processResult.status!==0)return 'PLAYWRIGHT_FAILED';
  if(!report||!Array.isArray(report.suites)||report.suites.length!==1
    ||path.basename(String(report.suites[0].file||''))!==path.basename(expectedFile)
    ||!report.stats||!Array.isArray(report.errors))return 'REPORT_MISSING_OR_UNEXPECTED';
  const {expected,skipped,unexpected,flaky}=report.stats;
  if(expected!==2||skipped!==0||unexpected!==0||flaky!==0||report.errors.length!==0){
    return 'TWO_PROJECT_PASSES_ZERO_SKIPS_REQUIRED';
  }
  return null;
}

function main(){
  const choice=process.argv[2];
  if(process.argv.length!==3||!Object.hasOwn(cases,choice)){
    process.stderr.write('CI_FEATURED_PREPARE_UNKNOWN_CASE\n');
    process.exitCode=1;
    return;
  }
  const cli=path.join(root,'node_modules','playwright','cli.js');
  // A failed browser report may hold session or contact details. Keep raw JSON
  // and stderr in memory; report only a bounded, non-sensitive failure reason.
  const result=spawnSync(process.execPath,[cli,'test',cases[choice],'--grep','@featured-prepare','--project=desktop-chromium','--project=mobile-chromium','--reporter=json','--retries=0','--workers=1'],{
    cwd:root,
    env:process.env,
    encoding:'utf8',
    stdio:['ignore','pipe','pipe'],
    maxBuffer:32*1024*1024
  });
  let report;
  try{report=JSON.parse(result.stdout||'');}catch{report=null;}
  const failure=inspectFeaturedPrepareResult(result,report,cases[choice]);
  if(failure){
    process.stderr.write(`CI_FEATURED_PREPARE_${failure}\n`);
    process.exitCode=1;
    return;
  }
  process.stdout.write(`CI Featured Prepare ${choice}: desktop and phone passed, zero skipped.\n`);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
