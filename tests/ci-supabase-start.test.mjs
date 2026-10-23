import test from 'node:test';
import assert from 'node:assert/strict';
import {knownStartupFailure,startWithBoundedRetry} from '../scripts/ci-start-local-supabase.mjs';

test('CI startup recovery recognizes only the observed Docker quota and fixed local mail-port conflict',()=>{
  assert.equal(knownStartupFailure('Error response from daemon: toomanyrequests: Data limit exceeded'),'DOCKER_REGISTRY_LIMIT');
  assert.equal(knownStartupFailure('Bind for 0.0.0.0:55324 failed: address already in use'),'LOCAL_MAIL_PORT_CONFLICT');
  assert.equal(knownStartupFailure('Bind for 0.0.0.0:55325 failed: address already in use'),null);
  assert.equal(knownStartupFailure('migration failed: relation already exists'),null);
  assert.equal(knownStartupFailure(`toomanyrequests\n${Array(25).fill('pull resumed').join('\n')}\nmigration failed`),null);
  assert.equal(knownStartupFailure('toomanyrequests: Data limit exceeded\nBind for 0.0.0.0:55324 failed: address already in use'),'LOCAL_MAIL_PORT_CONFLICT');
  assert.equal(knownStartupFailure('Error response: toomanyrequests\nError: migration 178 failed'),null);
  assert.equal(knownStartupFailure('Bind for 0.0.0.0:55324 failed: address already in use\nError: migration 178 failed'),null);
  assert.equal(knownStartupFailure('Error response: toomanyrequests\nfailed to start container'),'DOCKER_REGISTRY_LIMIT');
  assert.equal(knownStartupFailure('Error response: failed to start container: Bind for 0.0.0.0:55324 failed: address already in use\nfailed to start container\nTry rerunning with --debug'),'LOCAL_MAIL_PORT_CONFLICT');
  assert.equal(knownStartupFailure('Error response: toomanyrequests\nError: migration 178 failed\nfailed to start container'),null);
});

test('known startup failure stops only the local stack and retries once',async()=>{
  const calls=[];
  const attempts=[{status:1,stderr:'toomanyrequests: Data limit exceeded'},{status:0,stderr:''}];
  const result=await startWithBoundedRetry({
    start:()=>{calls.push('start');return attempts.shift();},
    stop:()=>{calls.push('stop');return {status:0};},
    wait:async()=>{calls.push('wait');}
  });
  assert.deepEqual(result,{ok:true,reason:'DOCKER_REGISTRY_LIMIT',retried:true});
  assert.deepEqual(calls,['start','stop','wait','start']);
});

test('unrelated failure, failed cleanup and failed retry do not continue',async()=>{
  for(const scenario of [
    {first:'migration failed',cleanup:0,expected:'UNRECOGNIZED_START_FAILURE',calls:['start']},
    {first:'Bind for 0.0.0.0:55324 failed: address already in use',cleanup:1,expected:'LOCAL_CLEANUP_FAILED',calls:['start','stop']},
    {first:'toomanyrequests',cleanup:0,expected:'RETRY_FAILED',calls:['start','stop','wait','start']}
  ]){
    const calls=[];
    let attempt=0;
    const result=await startWithBoundedRetry({
      start:()=>{calls.push('start');return {status:1,stderr:attempt++===0?scenario.first:'still unavailable'};},
      stop:()=>{calls.push('stop');return {status:scenario.cleanup};},
      wait:async()=>{calls.push('wait');}
    });
    assert.equal(result.ok,false);
    assert.equal(result.reason,scenario.expected);
    assert.deepEqual(calls,scenario.calls);
  }
});
