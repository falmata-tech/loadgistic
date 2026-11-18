import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function fixture(){
 const calls=[],exports={};
 const dependencies={
  './browser-test':{},'./audit-helpers':{},'./mailpit-helper':{},
  './tracking-session-fixtures':{cleanupTrackingOwnerFixtures:async()=>{calls.push('owners');}},
 };
 const source=ts.transpileModule(readFileSync(new URL('./e2e/native-tracking-fixtures.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:name=>{assert.ok(Object.hasOwn(dependencies,name));return dependencies[name];},AggregateError});
 const page={isClosed:()=>false,goto:async(url,options)=>{assert.equal(url,'about:blank');assert.equal(options.timeout,5000);calls.push('stop-requests');}};
 return{...exports,calls,page};
}

test('native afterEach stops requests, cleans exact resources, then removes registered owners once',async()=>{
 const x=fixture();
 x.registerNativeTrackingCleanup(async()=>{x.calls.push('shipment');});
 x.registerNativeTrackingCleanup(async()=>{x.calls.push('proof');});
 await x.cleanupNativeTrackingFixtures(x.page);
 assert.deepEqual(x.calls,['stop-requests','proof','shipment','owners']);
 x.calls.length=0;await x.cleanupNativeTrackingFixtures(x.page);
 assert.deepEqual(x.calls,['stop-requests','owners']);
});

test('a failed resource cleanup is reported and does not race or skip later guarded teardown',async()=>{
 const x=fixture(),failure=new Error('EXACT_RESOURCE_CLEANUP_REFUSED');
 x.registerNativeTrackingCleanup(async()=>{x.calls.push('shipment');});
 x.registerNativeTrackingCleanup(async()=>{x.calls.push('proof');throw failure;});
 await assert.rejects(x.cleanupNativeTrackingFixtures(x.page),error=>error instanceof AggregateError&&error.errors.length===1&&error.errors[0]===failure);
 assert.deepEqual(x.calls,['stop-requests','proof','shipment','owners']);
});

test('closed pages and failed navigation still reach exact resource and owner cleanup',async()=>{
 for(const closed of[false,true]){
  const x=fixture();x.page.isClosed=()=>closed;
  x.page.goto=async()=>{x.calls.push('stop-refused');throw Error('PAGE_UNAVAILABLE');};
  x.registerNativeTrackingCleanup(async()=>{x.calls.push('shipment');});
  if(closed)await x.cleanupNativeTrackingFixtures(x.page);
  else await assert.rejects(x.cleanupNativeTrackingFixtures(x.page),{message:'NATIVE_TRACKING_FIXTURE_CLEANUP_FAILED'});
  assert.deepEqual(x.calls,closed?['shipment','owners']:['stop-refused','shipment','owners']);
 }
});
