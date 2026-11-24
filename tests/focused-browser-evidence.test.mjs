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
 const navigation=focusedBrowserEvidence({title:'fleet assigns an unverified driver, then email-code login unlocks the same assignment',
  project:'desktop-chromium',stage:'FIRST_CAPACITY',error:{name:'TimeoutError',message:'PRIVATE'},elapsedMs:45000});
 assert.equal(navigation.scenario,'FLEET_ASSIGNMENT');
 assert.equal(navigation.stage,'FIRST_CAPACITY');
 assert.doesNotMatch(JSON.stringify(navigation),/PRIVATE/);
});
test('browser artifacts retain bounded primary and cleanup evidence bound to the exact source case',()=>{
 const result={status:'failed',stdout:[{text:'CI_BROWSER_FOCUSED_EVIDENCE '+JSON.stringify(evidence())+'\n'}]};
 const report={suites:[{specs:[{file,title,line:423,tests:[{projectName:'desktop-chromium',status:'unexpected',results:[result]}]}]}]};
 const diagnostic=failedBrowserCaseDiagnostics(report)[0];assert.equal(diagnostic.line,527);assert.equal(diagnostic.focused[0].errorCode,'unexpected_failure');
 result.stdout[0].text='CI_BROWSER_FOCUSED_EVIDENCE '+JSON.stringify({...evidence(),project:'mobile-chromium'});assert.equal(failedBrowserCaseDiagnostics(report)[0].focused,undefined);
 result.stdout[0].text='CI_BROWSER_FOCUSED_EVIDENCE '+JSON.stringify({...evidence(),scenario:'TRACKING_PROOF'});assert.equal(failedBrowserCaseDiagnostics(report)[0].focused,undefined);
 assert.doesNotMatch(JSON.stringify(diagnostic),/PRIVATE|@|stdout|message|stack/);
});

const capacityTitle='invalid multi-option deep links stay denied until an explicit filter correction';
const capacityFile='capacity-multiple-options.spec.ts';
const observations={alert:true,loading:false,textEqual:false,errorPresent:true,reviewVisible:true,initialLabelPresent:true,currentLabelPresent:false,fontZero:true,invalidRequests:0};
const capacityEvidence=(overrides={})=>focusedBrowserEvidence({title:capacityTitle,project:'mobile-chromium',stage:'VIEWPORT_TICK',elapsedMs:16000,
 error:{name:'AssertionError',message:'PRIVATE contact@example.test',stack:`Error: PRIVATE\n    at /repo/tests/e2e/${capacityFile}:90:5`},observations,...overrides});

test('invalid Capacity evidence retains only exact typed observations without changing failure identity',()=>{
 const value=capacityEvidence();
 assert.deepEqual(value,{file:capacityFile,scenario:'INVALID_CAPACITY_FILTER',project:'mobile-chromium',stage:'VIEWPORT_TICK',
  errorClass:'AssertionError',errorCode:null,errorStatus:null,elapsedMs:16000,line:90,...observations});
 const input={...observations,file:'PRIVATE',scenario:'TRACKING_PROOF',project:'desktop-chromium',stage:'PRIVATE',line:999,token:'PRIVATE',url:'/private',headers:{authorization:'PRIVATE'}};
 Object.defineProperty(input,'rawText',{get(){throw Error('RAW_FIELD_MUST_NOT_BE_READ');}});
 assert.deepEqual(capacityEvidence({observations:input}),value);
 assert.deepEqual(parseFocusedBrowserEvidence({...value,body:'PRIVATE',message:'PRIVATE',stack:'PRIVATE',rawText:'PRIVATE',url:'https://private.test',token:'PRIVATE'}),value);
 assert.doesNotMatch(JSON.stringify(value),/PRIVATE|@|\/repo|message|stack|token|url|headers|rawText/);
});

test('Capacity observation types and request count bounds are never coerced',()=>{
 for(const key of Object.keys(observations).filter(key=>key!=='invalidRequests')){
  for(const invalid of [undefined,null,'true','false',0,1,{},[]]){
   assert.equal(Object.hasOwn(capacityEvidence({observations:{[key]:invalid}}),key),false);
   assert.equal(Object.hasOwn(parseFocusedBrowserEvidence({...capacityEvidence(),[key]:invalid}),key),false);
  }
 }
 for(const count of [0,1000])assert.equal(capacityEvidence({observations:{invalidRequests:count}}).invalidRequests,count);
 for(const invalid of [undefined,null,-1,1001,.5,NaN,Infinity,'0',{},[]]){
  assert.equal(Object.hasOwn(capacityEvidence({observations:{invalidRequests:invalid}}),'invalidRequests'),false);
  assert.equal(Object.hasOwn(parseFocusedBrowserEvidence({...capacityEvidence(),invalidRequests:invalid}),'invalidRequests'),false);
 }
 for(const invalid of [null,'PRIVATE',[],1])assert.deepEqual(capacityEvidence({observations:invalid}),capacityEvidence({observations:{}}));
 const inherited=Object.create(observations);assert.deepEqual(capacityEvidence({observations:inherited}),capacityEvidence({observations:{}}));
});

test('Capacity observations stay scoped to the fixed case, file, stages and browser projects',()=>{
 const value=capacityEvidence();
 for(const changes of [{file:'constructor'},{file}, {scenario:'TRACKING_PROOF'},{stage:'PRIVATE'},{stage:'COMPLETE'},{project:'PRIVATE'}]){
  assert.equal(parseFocusedBrowserEvidence({...value,...changes}),null);
 }
 assert.equal(capacityEvidence({title:'PRIVATE'}),null);
 for(const stage of ['VIEWPORT_TICK','INVALID_REAPPLY'])for(const project of ['desktop-chromium','mobile-chromium']){
  const current=capacityEvidence({stage,project});assert.equal(current.stage,stage);assert.equal(current.project,project);assert.equal(current.line,90);
 }
 assert.deepEqual(parseFocusedBrowserEvidence({...evidence(),...observations}),evidence());
 assert.deepEqual(focusedBrowserEvidence({title,project:'desktop-chromium',stage:'CLEANUP_DELETE_AUTH',elapsedMs:42000,
  error:{name:'AuthApiError',code:'unexpected_failure',status:500,stack:'Error\n    at /repo/tests/e2e/fleet-onboarding.spec.ts:527:5'},observations}),evidence());
 for(const invalid of ['PRIVATE',' '.repeat(5000)])assert.equal(parseFocusedBrowserEvidence(invalid),null);
});

test('failed Capacity artifacts retain sanitized observations only for the matching case and project',()=>{
 const value=capacityEvidence();
 const result={status:'failed',stdout:[{text:'CI_BROWSER_FOCUSED_EVIDENCE '+JSON.stringify({...value,rawText:'PRIVATE',token:'PRIVATE',headers:{cookie:'PRIVATE'}})+'\n'}]};
 const report={suites:[{specs:[{file:capacityFile,title:capacityTitle,line:72,tests:[{projectName:'mobile-chromium',status:'unexpected',results:[result]}]}]}]};
 const diagnostic=failedBrowserCaseDiagnostics(report)[0];
 assert.equal(diagnostic.line,90);assert.deepEqual(diagnostic.focused,[value]);
 assert.doesNotMatch(JSON.stringify(diagnostic),/PRIVATE|@|stdout|message|stack|rawText|token|cookie|headers/);
 result.stdout[0].text='CI_BROWSER_FOCUSED_EVIDENCE '+JSON.stringify({...value,project:'desktop-chromium'});
 assert.equal(failedBrowserCaseDiagnostics(report)[0].focused,undefined);
 result.stdout[0].text='CI_BROWSER_FOCUSED_EVIDENCE '+JSON.stringify({...value,scenario:'TRACKING_PROOF'});
 assert.equal(failedBrowserCaseDiagnostics(report)[0].focused,undefined);
 result.stdout[0].text='CI_BROWSER_FOCUSED_EVIDENCE '+JSON.stringify(value);
 report.suites[0].specs[0].title='PRIVATE';assert.equal(failedBrowserCaseDiagnostics(report)[0].focused,undefined);
});
