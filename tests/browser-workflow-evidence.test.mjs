import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {adminQueueEvidence,parseWorkflowEvidence} from '../scripts/lib/browser-workflow-evidence.mjs';
import {failedBrowserCaseDiagnostics,createBrowserFailureArtifact,persistBrowserFailureArtifact} from '../scripts/ci-browser-shard.mjs';

const title='Content and deletion overflow pages recover saved synthetic cases with unchanged controls';
const sourceFile='admin-connected-queues.spec.ts';
function evidence(){
 return adminQueueEvidence({title,project:'desktop-chromium',stage:'CONTENT_DENIED',pageUrl:'http://127.0.0.1:3100/admin/operations?private=PRIVATE',
  error:{name:'Error',stack:'Error: PRIVATE\n    at /repo/tests/e2e/admin-connected-queues.spec.ts:104:5',matcherResult:{name:'toEqual',actual:'PRIVATE'}},
  recordCards:0,notFound:0,pageErrors:['TypeError','PRIVATE']});
}
function report(record){return {suites:[{file:`tests/e2e/${sourceFile}`,specs:[{file:sourceFile,line:85,title,tests:[{projectName:'desktop-chromium',status:'unexpected',results:[{status:'failed',stdout:[{text:`CI_BROWSER_WORKFLOW_EVIDENCE ${JSON.stringify(record)}\n`}],error:{stack:`Error: PRIVATE\n    at /repo/tests/e2e/${sourceFile}:105:5`}}]}]}]}],stats:{expected:76,skipped:27,unexpected:1,flaky:0},errors:[]};}

test('workflow evidence retains original assertion facts without private values or raw routes',()=>{
 const value=evidence();assert.equal(value.line,104);assert.equal(value.matcher,'toEqual');assert.equal(value.route,'/admin/operations');
 assert.equal(value.pageErrorCount,2);assert.deepEqual(value.pageErrorKinds,['OTHER','TypeError']);
 assert.doesNotMatch(JSON.stringify(value),/PRIVATE|actual|private=|\/repo\//);
 assert.deepEqual(parseWorkflowEvidence(JSON.stringify({...value,token:'PRIVATE',contact:'person@example.test'})),value);
 for(const unsafe of [{...value,stage:'PRIVATE'},{...value,scenario:'PRIVATE'},{...value,file:'PRIVATE.spec.ts'},{...value,project:'PRIVATE'}])assert.equal(parseWorkflowEvidence(JSON.stringify(unsafe)),null);
 const invalid=parseWorkflowEvidence({...value,route:'/admin/users/person@example.test',line:-1,recordCards:'PRIVATE',matcher:'PRIVATE'});
 assert.equal(invalid.route,'UNKNOWN');assert.equal(invalid.line,null);assert.equal(invalid.recordCards,null);assert.equal(invalid.matcher,'OTHER');
 assert.equal(parseWorkflowEvidence('PRIVATE'),null);assert.equal(parseWorkflowEvidence(' '.repeat(9000)),null);
});

test('the browser reporter preserves the primary source line and typed workflow evidence',()=>{
 const value=report(evidence()),diagnostic=failedBrowserCaseDiagnostics(value)[0];
 assert.equal(diagnostic.line,104);assert.equal(diagnostic.workflowEvidence.stage,'CONTENT_DENIED');
 const wrong=report({...evidence(),project:'mobile-chromium'});assert.equal(failedBrowserCaseDiagnostics(wrong)[0].workflowEvidence,undefined);
 const artifact=createBrowserFailureArtifact('PLAYWRIGHT_FAILED',4,value);
 assert.equal(artifact.cases[0].workflowEvidence.line,104);assert.doesNotMatch(JSON.stringify(artifact),/PRIVATE|person@|\/repo\//);
});

test('failure artifacts are bounded, contain no raw report and preserve the first saved evidence',()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'loadgistic-failure-artifact-'));
 try{
  assert.equal(persistBrowserFailureArtifact('PLAYWRIGHT_FAILED',4,report(evidence()),directory),true);
  const file=path.join(directory,'shard-4.json'),first=readFileSync(file,'utf8');
  assert.ok(first.length<20000);assert.equal(JSON.parse(first).cases[0].line,104);
  assert.equal(persistBrowserFailureArtifact('PRIVATE',4,null,directory),false);
  assert.equal(readFileSync(file,'utf8'),first);assert.doesNotMatch(first,/PRIVATE|contact|actual|stdout/);
  assert.equal(persistBrowserFailureArtifact('PLAYWRIGHT_FAILED','PRIVATE',null,directory),false);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
