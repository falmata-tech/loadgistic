import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const fixtureFile='tests/e2e/fixture-contract-preflight.spec.ts';

export function inspectFixturePreflightResult(processResult,report){
  if(processResult.error||processResult.signal||processResult.status!==0)return 'PLAYWRIGHT_FAILED';
  if(!report||!Array.isArray(report.suites)||report.suites.length!==1
    ||path.basename(String(report.suites[0].file||''))!==path.basename(fixtureFile)
    ||!report.stats||!Array.isArray(report.errors))return 'REPORT_MISSING_OR_UNEXPECTED';
  const {expected,skipped,unexpected,flaky}=report.stats;
  if(expected!==1||skipped!==0||unexpected!==0||flaky!==0||report.errors.length!==0){
    return 'ONE_PASS_ZERO_SKIPS_REQUIRED';
  }
  return null;
}

function main(){
  const cli=path.join(root,'node_modules','playwright','cli.js');
  // JSON stays in memory. Playwright may include request details in a failure
  // report, so never print or persist the raw stdout/stderr from this command.
  const result=spawnSync(process.execPath,[cli,'test',fixtureFile,'--project=desktop-chromium','--reporter=json','--retries=0'],{
    cwd:root,
    env:process.env,
    encoding:'utf8',
    stdio:['ignore','pipe','pipe'],
    maxBuffer:16*1024*1024
  });
  let report;
  try{report=JSON.parse(result.stdout||'');}catch{report=null;}
  const failure=inspectFixturePreflightResult(result,report);
  if(failure){
    process.stderr.write(`CI_FIXTURE_PREFLIGHT_${failure}\n`);
    process.exitCode=1;
    return;
  }
  process.stdout.write('CI fixture preflight: one passed, zero skipped.\n');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
