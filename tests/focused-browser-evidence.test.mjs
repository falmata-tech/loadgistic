import test from 'node:test';import assert from 'node:assert/strict';
import {focusedBrowserEvidence,parseFocusedBrowserEvidence} from '../scripts/lib/focused-browser-evidence.mjs';
import {failedBrowserCaseDiagnostics} from '../scripts/ci-browser-shard.mjs';
const title='driving Transport Provider OWNED signs up, explicitly assigns a truck and publishes after location permission';
const file='fleet-onboarding.spec.ts';
const evidence=()=>focusedBrowserEvidence({title,project:'desktop-chromium',stage:'CLEANUP_DELETE_AUTH',elapsedMs:42000,
 error:{name:'AuthApiError',code:'unexpected_failure',status:500,message:'PRIVATE person@example.test',stack:'Error: PRIVATE\n    at /repo/tests/e2e/fleet-onboarding.spec.ts:527:5'}});
test('focused CI evidence retains the exact cleanup stage and known failure codes without private values',()=>{
 const value=evidence();assert.deepEqual(value,{file,scenario:'DRIVING_OWNED',project:'desktop-chromium',stage:'CLEANUP_DELETE_AUTH',
  errorClass:'AuthApiError',errorCode:'unexpected_failure',errorStatus:500,elapsedMs:42000,line:527});
 assert.doesNotMatch(JSON.stringify(value),/PRIVATE|@|\/repo|message|stack/);
 assert.deepEqual(parseFocusedBrowserEvidence({...value,token:'PRIVATE',route:'/app/private'}),value);
 for(const input of [{...value,file:'constructor'},{...value,file:'PRIVATE'},{...value,project:'PRIVATE'},{...value,stage:'PRIVATE'},{...value,scenario:'TRACKING_PROOF'},'PRIVATE',' '.repeat(5000)])assert.equal(parseFocusedBrowserEvidence(input),null);
 const sanitized=parseFocusedBrowserEvidence({...value,errorCode:'TOKEN',errorClass:'PRIVATE',errorStatus:0,elapsedMs:-1,line:0});
 assert.equal(sanitized.errorCode,null);assert.equal(sanitized.errorClass,'OTHER');assert.equal(sanitized.errorStatus,null);assert.equal(sanitized.elapsedMs,null);assert.equal(sanitized.line,null);
});
test('browser artifacts retain bounded primary and cleanup evidence bound to the exact source case',()=>{
 const result={status:'failed',stdout:[{text:'CI_BROWSER_FOCUSED_EVIDENCE '+JSON.stringify(evidence())+'\n'}]};
 const report={suites:[{specs:[{file,title,line:423,tests:[{projectName:'desktop-chromium',status:'unexpected',results:[result]}]}]}]};
 const diagnostic=failedBrowserCaseDiagnostics(report)[0];assert.equal(diagnostic.line,527);assert.equal(diagnostic.focused[0].errorCode,'unexpected_failure');
 result.stdout[0].text='CI_BROWSER_FOCUSED_EVIDENCE '+JSON.stringify({...evidence(),project:'mobile-chromium'});assert.equal(failedBrowserCaseDiagnostics(report)[0].focused,undefined);
 result.stdout[0].text='CI_BROWSER_FOCUSED_EVIDENCE '+JSON.stringify({...evidence(),scenario:'TRACKING_PROOF'});assert.equal(failedBrowserCaseDiagnostics(report)[0].focused,undefined);
 assert.doesNotMatch(JSON.stringify(diagnostic),/PRIVATE|@|stdout|message|stack/);
});
