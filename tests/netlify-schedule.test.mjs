import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync} from 'node:fs';
import {dueNativeOperations,executeNativePushSchedule,config} from '../netlify/functions/native-push.mjs';
import {verifyManagedOperationsSignature,
  MANAGED_OPERATIONS_TIMESTAMP_HEADER,MANAGED_OPERATIONS_SIGNATURE_HEADER
} from '../src/lib/managed-operations-auth.js';

const origin='https://loadgistic.example';
const url=`${origin}/.netlify/functions/native-push`;
const minute=value=>Date.UTC(2026,10,11,0,value);

test('one published cron keeps existing push, email and operations cadences',()=>{
  assert.equal(config.schedule,'* * * * *');
  assert.deepEqual(dueNativeOperations(minute(0)),{accessEmail:true,managedOperations:true});
  assert.deepEqual(dueNativeOperations(minute(1)),{accessEmail:false,managedOperations:false});
  assert.deepEqual(dueNativeOperations(minute(2)),{accessEmail:true,managedOperations:false});
  assert.deepEqual(dueNativeOperations(minute(15)),{accessEmail:false,managedOperations:true});
  assert.deepEqual(dueNativeOperations(minute(30)),{accessEmail:true,managedOperations:true});
  assert.deepEqual(dueNativeOperations(minute(59)),{accessEmail:false,managedOperations:false});
  for(const retired of ['access-email-retry.mjs','managed-operations.mjs']){
    assert.equal(existsSync(new URL(`../netlify/functions/${retired}`,import.meta.url)),false);
  }
});

test('late cron invokes each due job at its scheduled UTC minute on the same origin',async()=>{
  const now=minute(1)+25_000;
  const request=new Request(url,{method:'POST',body:JSON.stringify({next_run:new Date(minute(1)).toISOString()})});
  const calls=[];
  const environment={SESSION_SECRET:'test-secret-with-enough-length-to-sign'};
  const response=await executeNativePushSchedule(request,{now,environment,
    push:async()=>{calls.push('push');},
    accessEmail:async input=>{calls.push(['email',input]);},
    managedOperations:async input=>{calls.push(['operations',input]);}
  });
  assert.equal(response.status,204);
  assert.equal(calls[0],'push');
  assert.deepEqual(calls.slice(1).map(([name])=>name),['email','operations']);
  for(const [,input] of calls.slice(1)){
    assert.equal(input.invocationUrl,url);
    assert.equal(input.environment,environment);
    assert.equal(input.now,now);
  }
});

test('combined tick signs both existing background endpoints with the invocation origin',async()=>{
  const now=minute(30);
  const environment={SESSION_SECRET:'a-secret-long-enough-for-signed-test-dispatch',NODE_ENV:'production'};
  const requests=[];
  const response=await executeNativePushSchedule(new Request(url),{now,environment,
    push:async()=>({enabled:true,claimed:0}),
    fetchImpl:async(target,options)=>{
      requests.push({target,options});
      return {ok:true,status:202};
    }
  });
  assert.equal(response.status,204);
  assert.deepEqual(requests.map(item=>item.target.pathname).sort(),[
    '/.netlify/functions/access-email-retry-background',
    '/.netlify/functions/managed-operations-background'
  ]);
  for(const {target,options} of requests){
    assert.equal(target.origin,origin);
    assert.equal(options.method,'POST');
    assert.equal(verifyManagedOperationsSignature({
      timestamp:options.headers[MANAGED_OPERATIONS_TIMESTAMP_HEADER],
      signature:options.headers[MANAGED_OPERATIONS_SIGNATURE_HEADER],
      audience:target.href
    },environment,now),true);
  }
});

test('non-due minute runs push only; one failed job cannot cancel another',async()=>{
  const calls=[];
  const logs=[];
  const originalError=console.error;
  console.error=value=>logs.push(String(value));
  try{
    await executeNativePushSchedule(new Request(url),{now:minute(1),
      push:async()=>{calls.push('push');},
      accessEmail:async()=>{calls.push('email');},
      managedOperations:async()=>{calls.push('operations');}
    });
    assert.deepEqual(calls,['push']);
    await executeNativePushSchedule(new Request(url),{now:minute(30),
      push:()=>{calls.push('push');throw Error('recipient@example.test');},
      accessEmail:async()=>{calls.push('email');},
      managedOperations:async()=>{calls.push('operations');}
    });
  }finally{console.error=originalError;}
  assert.deepEqual(calls,['push','push','email','operations']);
  assert.equal(logs.length,1);
  assert.match(logs[0],/"job":"native-push"/);
  assert.doesNotMatch(logs[0],/recipient@example/);
});
