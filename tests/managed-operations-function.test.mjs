import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createManagedOperationsSignature,
  MANAGED_OPERATIONS_SIGNATURE_HEADER,
  MANAGED_OPERATIONS_TIMESTAMP_HEADER,
  verifyManagedOperationsSignature
} from '../src/lib/managed-operations-auth.js';
import {
  config as scheduleConfig,
  dispatchManagedOperations,
  executeManagedOperationsDispatch
} from '../netlify/functions/managed-operations.mjs';
import {config as backgroundConfig,executeManagedOperations} from '../netlify/functions/managed-operations-background.mjs';

const environment={SESSION_SECRET:'a-production-length-session-secret-for-tests',NODE_ENV:'production',URL:'https://loadgistic.example'};

function request(timestamp,signature,method='POST'){
  return new Request('https://loadgistic.example/.netlify/functions/managed-operations-background',{
    method,headers:{
      [MANAGED_OPERATIONS_TIMESTAMP_HEADER]:String(timestamp),
      [MANAGED_OPERATIONS_SIGNATURE_HEADER]:String(signature)
    }
  });
}

test('managed Operations dispatch authorization is short-lived and secret-derived',()=>{
  assert.equal(scheduleConfig.schedule,'*/15 * * * *');
  assert.equal(backgroundConfig.background,true);
  const now=1_788_200_000_000;
  const authorization={timestamp:String(now),audience:'https://loadgistic.example'};
  const signature=createManagedOperationsSignature(authorization,environment);
  assert.match(signature,/^[a-f0-9]{64}$/);
  assert.equal(verifyManagedOperationsSignature({...authorization,signature},environment,now),true);
  assert.equal(verifyManagedOperationsSignature({timestamp:String(now-5*60_000-1),audience:authorization.audience,signature},environment,now),false);
  assert.equal(verifyManagedOperationsSignature({...authorization,signature:'0'.repeat(64)},environment,now),false);
  assert.equal(verifyManagedOperationsSignature({...authorization,audience:'https://preview--loadgistic.example',signature},environment,now),false);
  assert.doesNotMatch(signature,/production-length-session-secret/);
});

test('managed Operations rejects documented placeholder secrets',()=>{
  const timestamp='1788200000000';
  for(const SESSION_SECRET of [
    '',
    'short',
    'local-development-secret-change-before-production-1234',
    'ci-only-session-secret-not-for-production-123456'
  ]){
    const unsafe={...environment,SESSION_SECRET};
    assert.throws(
      ()=>createManagedOperationsSignature({timestamp,audience:'https://loadgistic.example'},unsafe),
      error=>error?.message==='MANAGED_OPERATIONS_SECRET_UNAVAILABLE'
    );
    assert.equal(verifyManagedOperationsSignature({timestamp,audience:'https://loadgistic.example',signature:'0'.repeat(64)},unsafe,Number(timestamp)),false);
  }
});

test('scheduled function dispatches one signed background request without returning private work',async()=>{
  const now=1_788_200_000_000;
  let captured;
  const result=await dispatchManagedOperations({
    invocationUrl:'https://deploy-preview-17--loadgistic.example/.netlify/functions/managed-operations',
    environment,now,fetchImpl:async(url,options)=>{
    captured={url,options};
    return {ok:true,status:202};
  }});
  assert.deepEqual(result,{ok:true,status:202});
  assert.equal(captured.url.href,'https://deploy-preview-17--loadgistic.example/.netlify/functions/managed-operations-background');
  assert.equal(captured.options.method,'POST');
  assert.equal(captured.options.headers[MANAGED_OPERATIONS_TIMESTAMP_HEADER],String(now));
  assert.equal(verifyManagedOperationsSignature({
    timestamp:captured.options.headers[MANAGED_OPERATIONS_TIMESTAMP_HEADER],
    signature:captured.options.headers[MANAGED_OPERATIONS_SIGNATURE_HEADER],
    audience:captured.url.href
  },environment,now),true);
  assert.doesNotMatch(JSON.stringify(captured),/production-length-session-secret/);
});

test('scheduled handler preserves its exact invocation origin',async()=>{
  let target;
  const response=await executeManagedOperationsDispatch(
    new Request('https://branch--loadgistic.example/.netlify/functions/managed-operations'),
    {environment,now:1_788_200_000_000,fetchImpl:async url=>{
      target=url.href;
      return {ok:true,status:202};
    }}
  );
  assert.equal(response.status,202);
  assert.equal(await response.text(),'');
  assert.equal(target,'https://branch--loadgistic.example/.netlify/functions/managed-operations-background');
});

test('background Operations rejects unsigned or stale requests before database work',async()=>{
  let calls=0;
  const runOperations=async()=>{calls+=1;return {ok:true,operations:[]};};
  const unsigned=await executeManagedOperations(new Request('https://loadgistic.example',{method:'POST'}),{environment,runOperations,now:1_788_200_000_000});
  assert.equal(unsigned.status,401);
  const old=1_788_199_000_000;
  const stale=await executeManagedOperations(request(old,createManagedOperationsSignature({timestamp:String(old),audience:'https://loadgistic.example'},environment)),{environment,runOperations,now:1_788_200_000_000});
  assert.equal(stale.status,401);
  assert.equal(calls,0);
});

test('authorized background Operations run once and return no private result body',async()=>{
  const now=1_788_200_000_000;
  const signature=createManagedOperationsSignature({timestamp:String(now),audience:'https://loadgistic.example'},environment);
  let calls=0;
  const logs=[];
  const originalInfo=console.info;
  console.info=value=>logs.push(String(value));
  let response;
  try{
    response=await executeManagedOperations(request(now,signature),{
      environment,now,runOperations:async()=>{
        calls+=1;
        return {ok:true,operations:[{name:'access-email',ok:true,result:{configured:true,provider:'smtp',attempted:1,sent:1,failed:0,privateRows:['never returned']}}]};
      }
    });
  }finally{console.info=originalInfo;}
  assert.equal(calls,1);
  assert.equal(response.status,204);
  assert.equal(await response.text(),'');
  assert.doesNotMatch(logs.join('\n'),/never returned|privateRows/);
  assert.match(logs.join('\n'),/"sent":1/);
  assert.match(logs.join('\n'),/"skipped":0/);
});

test('operation-level failure is logged without requesting a signed-request retry',async()=>{
  const now=1_788_200_000_000;
  const signature=createManagedOperationsSignature({timestamp:String(now),audience:'https://loadgistic.example'},environment);
  const logs=[];
  const originalInfo=console.info;
  console.info=value=>logs.push(String(value));
  let response;
  try{
    response=await executeManagedOperations(request(now,signature),{
      environment,now,runOperations:async()=>({
        ok:false,
        operations:[{name:'access-email',ok:false,error:'OPERATION_FAILED',privateRows:['never returned']}]
      })
    });
  }finally{console.info=originalInfo;}
  assert.equal(response.status,204);
  assert.equal(await response.text(),'');
  assert.match(logs.join('\n'),/"ok":false/);
  assert.doesNotMatch(logs.join('\n'),/never returned/);
});

test('unexpected worker failure is logged safely and left for the next schedule',async()=>{
  const now=1_788_200_000_000;
  const signature=createManagedOperationsSignature({timestamp:String(now),audience:'https://loadgistic.example'},environment);
  const logs=[];
  const originalError=console.error;
  console.error=value=>logs.push(String(value));
  let response;
  try{
    response=await executeManagedOperations(request(now,signature),{
      environment,now,runOperations:async()=>{throw new Error('recipient@example.test');}
    });
  }finally{console.error=originalError;}
  assert.equal(response.status,204);
  assert.equal(await response.text(),'');
  assert.deepEqual(logs,['{"event":"managed-operations-background","ok":false,"error":"OPERATION_FAILED"}']);
});
