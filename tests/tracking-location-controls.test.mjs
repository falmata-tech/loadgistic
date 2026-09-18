import test from 'node:test';
import assert from 'node:assert/strict';
import {createForegroundLocationRunner,trackingLocationResult,trackingPrivacyRadius} from '../src/lib/tracking-location-controls.js';
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve:value=>resolve(value)};};

test('Tracking radius and recorded-result feedback fail closed',()=>{
  for(const radius of [1,3,5,10,20,40])assert.equal(trackingPrivacyRadius(radius),radius);
  for(const radius of [0,2,NaN,Infinity,null,undefined,'bad'])assert.equal(trackingPrivacyRadius(radius),20);
  assert.equal(trackingLocationResult({recorded:true}),'saved');
  assert.equal(trackingLocationResult({recorded:false,reason:'THROTTLED'}),'waiting');
  for(const result of [null,{}, {recorded:false},{recorded:'true'}])assert.throws(()=>trackingLocationResult(result));
});
test('hidden or cancelled GPS callbacks cannot start a location save',async()=>{
  let visible=true,saves=0,results=0;const gps=deferred();const runner=createForegroundLocationRunner(()=>visible);
  const job={read:()=>gps.promise,save:async()=>{saves++;},onState(){},onResult(){results++;},onError(){assert.fail('Cancellation is not an error');}};
  const pending=runner.run(job);visible=false;runner.cancel();gps.resolve({lat:9,lng:38});
  assert.equal(await pending,false);assert.equal(saves,0);assert.equal(results,0);
  assert.equal(await runner.run(job),false);assert.equal(runner.busy,false);
});
test('visibility is rechecked even before the browser visibility event cancels a job',async()=>{
  let visible=true;const gps=deferred();const runner=createForegroundLocationRunner(()=>visible);
  const pending=runner.run({read:()=>gps.promise,save(){assert.fail('Hidden callback sent data');},onState(){},onResult(){assert.fail();},onError(){assert.fail();}});
  visible=false;gps.resolve({});assert.equal(await pending,false);
});
test('only one acquisition runs, and stale completion cannot release a newer request',async()=>{
  const old=deferred(),current=deferred();const states=[];let saves=0;
  const runner=createForegroundLocationRunner(()=>true);
  const job=gps=>({read:()=>gps.promise,save:async()=>{saves++;return {recorded:true};},onState:state=>states.push(state),onResult(){},onError(){assert.fail();}});
  const first=runner.run(job(old));assert.equal(await runner.run(job(old)),false);
  runner.cancel();const second=runner.run(job(current));old.resolve({});await first;
  assert.equal(runner.busy,true);current.resolve({});assert.equal(await second,true);
  assert.equal(saves,1);assert.equal(runner.busy,false);assert.deepEqual(states,['requesting','requesting','saving']);
});
test('cancelling an in-flight fetch aborts it and ignores its eventual success',async()=>{
  const response=deferred();let signal;let result=0;const runner=createForegroundLocationRunner(()=>true);
  const pending=runner.run({read:async()=>({}),save:(_,value)=>{signal=value;return response.promise;},onState(){},onResult(){result++;},onError(){assert.fail();}});
  await Promise.resolve();runner.cancel();assert.equal(signal.aborted,true);response.resolve({recorded:true});await pending;assert.equal(result,0);
});
test('a failed acquisition is reported once and can be retried',async()=>{
  const runner=createForegroundLocationRunner(()=>true);let failures=0;
  assert.equal(await runner.run({read:async()=>{throw new Error('Permission denied');},save(){assert.fail();},onState(){},onResult(){assert.fail();},onError:error=>{failures++;assert.equal(error.message,'Permission denied');}}),false);
  assert.equal(failures,1);assert.equal(runner.busy,false);
  assert.equal(await runner.run({read:async()=>({}),save:async()=>({recorded:true}),onState(){},onResult(){},onError(){assert.fail();}}),true);
});
test('save failure reports an error without a success callback and releases the request',async()=>{
  const runner=createForegroundLocationRunner(()=>true);let failures=0;
  assert.equal(await runner.run({read:async()=>({}),save:async()=>{throw new Error('Network unavailable');},onState(){},onResult(){assert.fail('Failed save reported success');},onError:error=>{assert.equal(error.message,'Network unavailable');failures++;}}),false);
  assert.equal(failures,1);assert.equal(runner.busy,false);
});
