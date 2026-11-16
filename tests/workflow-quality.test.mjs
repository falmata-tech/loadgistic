import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {actionlintArchive,actionlintVersion,checkScriptSyntax,operationalScripts,verifyArchive} from '../scripts/check-workflow.mjs';

test('workflow tools pin supported release archives and refuse mismatched bytes',()=>{
  for(const [platform,arch] of [['darwin','x64'],['darwin','arm64'],['linux','x64'],['linux','arm64']]){
    const archive=actionlintArchive(platform,arch);
    assert.ok(archive.name.startsWith(`actionlint_${actionlintVersion}_`));assert.match(archive.sha256,/^[a-f0-9]{64}$/);
    assert.throws(()=>verifyArchive(Buffer.from('wrong archive'),archive.sha256),/CHECKSUM_MISMATCH/);
  }
  const bytes=Buffer.from('fixture');verifyArchive(bytes,createHash('sha256').update(bytes).digest('hex'));
  assert.throws(()=>actionlintArchive('unreviewed','arch'),/UNSUPPORTED_PLATFORM/);
});

test('operational script discovery includes nested root and mobile tools only',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'loadgistic-workflow-'));
  try{
    for(const dir of ['scripts/nested','apps/mobile/scripts'])mkdirSync(path.join(directory,dir),{recursive:true});
    for(const file of ['scripts/a.mjs','scripts/nested/b.cjs','apps/mobile/scripts/c.js','scripts/query.sql','scripts/note.md'])writeFileSync(path.join(directory,file),'');
    assert.deepEqual(operationalScripts(directory),['apps/mobile/scripts/c.js','scripts/a.mjs','scripts/nested/b.cjs']);
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test('syntax checks reject broken scripts without executing valid operational code',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'loadgistic-workflow-'));
  try{
    const marker=path.join(directory,'must-not-exist');
    const valid=path.join(directory,'valid.mjs'),invalid=path.join(directory,'invalid.mjs');
    writeFileSync(valid,`import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(marker)},'EXECUTED');throw Error('MUST_NOT_EXECUTE');`);
    writeFileSync(invalid,'const broken = ;');
    checkScriptSyntax(valid);assert.equal(existsSync(marker),false);
    assert.throws(()=>checkScriptSyntax(invalid),/SYNTAX_FAILED/);assert.equal(existsSync(marker),false);
    assert.throws(()=>checkScriptSyntax(path.join(directory,'missing.mjs')),/SYNTAX_FAILED/);
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test('workflow static gate stays in local quality and before expensive CI setup',()=>{
  const pkg=JSON.parse(readFileSync('package.json','utf8'));
  assert.equal(pkg.scripts['check:workflow'],'node scripts/check-workflow.mjs');
  assert.ok(pkg.scripts.check.includes('npm run check:workflow'));assert.ok(pkg.scripts.quality.includes('npm run check'));
  const workflow=readFileSync('.github/workflows/ci.yml','utf8');
  const validation=workflow.slice(workflow.indexOf('  validate:'),workflow.indexOf('  e2e-shards:'));
  const setup=validation.indexOf('run: npm run tools:workflow:setup');
  const check=validation.indexOf('run: npm run check');
  assert.ok(setup>=0&&check>setup&&check<validation.indexOf('run: node scripts/ci-start-local-supabase.mjs'));
  assert.equal(validation.match(/run: npm run check\n/g)?.length,1);
});

test('both simulator CI paths run current-owner races only on the disposable clone and retain cleanup',()=>{
 for(const file of ['.github/workflows/ci.yml','.github/workflows/operations-proof.yml']){
  const workflow=readFileSync(file,'utf8');
  const fixture=workflow.indexOf('      - name: Verify exact existing pilot bindings');
  const races=workflow.indexOf('      - name: Verify pilot provisioning and motion serialize current co-owner changes');
  const cleanup=workflow.indexOf('      - name: Remove disposable GPS test database',races);
  assert.ok(fixture>=0&&races>fixture&&cleanup>races,file);
  const step=workflow.slice(races,workflow.indexOf('      - name:',races+16));
  assert.match(step,/LOADGISTIC_TEST_DATABASE: loadgistic_telematics_ci/);
  assert.match(step,/LOADGISTIC_PILOT_OWNER_RACE_CONFIRM: loadgistic_telematics_ci/);
  assert.match(step,/timeout --signal=TERM --kill-after=10s 3m node scripts\/verify-demo-pilot-owner-concurrency-local\.mjs/);
  assert.match(workflow.slice(cleanup,workflow.indexOf('      - name:',cleanup+16)),/always\(\).*steps\.simulator_clone\.outcome/);
 }
});

test('the pinned linter accepts a valid workflow and rejects broken job dependencies',()=>{
  const executable=path.resolve('.local','tools','actionlint',actionlintVersion,`${process.platform}-${process.arch}`,'actionlint');
  const workflow=needs=>`name: fixture\non: push\njobs:\n  check:\n    runs-on: ubuntu-latest\n${needs}    steps:\n      - run: echo fixture\n`;
  const run=input=>spawnSync(executable,['-oneline','-'],{input,encoding:'utf8',timeout:10000});
  const valid=run(workflow(''));assert.equal(valid.error,undefined);assert.equal(valid.status,0);
  const invalid=run(workflow('    needs: missing-job\n'));assert.equal(invalid.error,undefined);
  assert.notEqual(invalid.status,0);assert.match(invalid.stdout,/missing-job/);
});
