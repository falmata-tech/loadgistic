import assert from 'node:assert/strict';
import test from 'node:test';
import {config,executeDemoCapacity,executeScheduledDemoCapacity,runDemoCapacity} from '../netlify/functions/demo-capacity.mjs';
import {handleDemoCapacityAdvance} from '../src/lib/demo-world-advance.js';
import {
  DEMO_CAPACITY_ADVANCE_PATH,DEMO_WORLD_ADVANCE_PATH,DEMO_WORLD_SIGNATURE_HEADER,
  DEMO_WORLD_TIMESTAMP_HEADER,verifyDemoWorldSignature
} from '../src/lib/demo-world-worker-auth.js';

const origin='https://loadgistic.example',now=Date.parse('2026-11-15T06:00:00Z');
const site='1d01c0c0-4554-4747-93b8-34ce3448ab95';
const environment={
  CONTEXT:'production',NODE_ENV:'production',URL:origin,SITE_ID:site,
  LOADGISTIC_DEMO_WORLD_SITE_ID:site,LOADGISTIC_DEMO_WORLD_SITE_ORIGIN:origin,
  LOADGISTIC_DEMO_WORLD_ENABLED:'true',LOADGISTIC_DEMO_WORLD_KILL_SWITCH:'false',
  LOADGISTIC_DEMO_CAPACITY_NETLIFY_ENABLED:'true',LOADGISTIC_DEMO_CAPACITY_NETLIFY_KILL_SWITCH:'false',
  DEMO_CAPACITY_WORKER_SECRET:'c'.repeat(64),DEMO_WORLD_WORKER_SECRET:'d'.repeat(64),
  SESSION_SECRET:'e'.repeat(64)
};
const invocationUrl=origin+'/.netlify/functions/demo-capacity';
const summary={ok:true,accepted:1,completed:1,skipped:0,failed:0,paused:0,
  pending_count:4,oldest_due_age_seconds:30,exhausted_count:0,database_enabled:true,
  catalog_version:2,paused_target_count:0};
const request=()=>new Request(invocationUrl,{method:'POST'});

async function captureLogs(callback){
  const logs=[],originals={info:console.info,error:console.error};
  for(const level of Object.keys(originals))console[level]=value=>logs.push(JSON.parse(value));
  try{return {result:await callback(),logs};}finally{Object.assign(console,originals);}
}

test('Netlify Capacity runs minutely and remains off without every independent activation gate',async()=>{
  assert.deepEqual(config,{schedule:'* 6-7 * * *'});
  for(const change of [
    {LOADGISTIC_DEMO_CAPACITY_NETLIFY_ENABLED:undefined},
    {LOADGISTIC_DEMO_CAPACITY_NETLIFY_ENABLED:'false'},
    {LOADGISTIC_DEMO_CAPACITY_NETLIFY_KILL_SWITCH:undefined},
    {LOADGISTIC_DEMO_CAPACITY_NETLIFY_KILL_SWITCH:'true'},
    {LOADGISTIC_DEMO_WORLD_ENABLED:'false'},
    {LOADGISTIC_DEMO_WORLD_KILL_SWITCH:undefined},
    {LOADGISTIC_DEMO_WORLD_KILL_SWITCH:'true'},
    {LOADGISTIC_SCENARIO_WORKER_ENABLED:'true'},
    {CONTEXT:'deploy-preview'},{CONTEXT:'branch-deploy'},{NODE_ENV:'development'},
    {URL:undefined},{URL:'https://preview.loadgistic.example'},
    {SITE_ID:undefined},{SITE_ID:'2d01c0c0-4554-4747-93b8-34ce3448ab95'},
    {LOADGISTIC_DEMO_WORLD_SITE_ID:undefined},
    {LOADGISTIC_DEMO_WORLD_SITE_ORIGIN:'http://loadgistic.example'},
    {LOADGISTIC_DEMO_WORLD_SITE_ORIGIN:origin+'/path'}
  ]){
    let calls=0;
    const captured=await captureLogs(()=>executeDemoCapacity(request(),{
      environment:{...environment,...change},now,
      fetchImpl:async()=>{calls++;throw Error('MUST_NOT_SEND');}
    }));
    assert.equal(captured.result.status,204);assert.equal(calls,0);assert.deepEqual(captured.logs,[]);
  }
});

test('scheduled adapter signs only a two-actor same-site Capacity budget without extra authority',async()=>{
  let capture;
  const result=await runDemoCapacity({invocationUrl,environment,now,fetchImpl:async(url,options)=>{
    capture={url,options};return Response.json({...summary,privateContact:'must never project'});
  }});
  const {ok,...expected}=summary;
  assert.deepEqual(result,{enabled:true,...expected});
  assert.equal(capture.url.href,origin+DEMO_CAPACITY_ADVANCE_PATH);
  assert.equal(capture.options.method,'POST');assert.equal(capture.options.redirect,'error');
  assert.equal(capture.options.credentials,'omit');assert.ok(capture.options.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(capture.options.body),{limit:2});
  assert.equal(verifyDemoWorldSignature({
    timestamp:capture.options.headers[DEMO_WORLD_TIMESTAMP_HEADER],
    signature:capture.options.headers[DEMO_WORLD_SIGNATURE_HEADER],
    url:capture.url.href,purpose:'capacity-advance',body:capture.options.body
  },environment,now),true);
  assert.equal(verifyDemoWorldSignature({
    timestamp:capture.options.headers[DEMO_WORLD_TIMESTAMP_HEADER],
    signature:capture.options.headers[DEMO_WORLD_SIGNATURE_HEADER],
    url:origin+DEMO_WORLD_ADVANCE_PATH,purpose:'advance',body:capture.options.body
  },environment,now),false);
  assert.doesNotMatch(JSON.stringify(capture),/cccccccc|dddddddd|eeeeeeee/);
});

test('wrong invocation origins, paths and query overrides cannot dispatch work',async()=>{
  let calls=0;
  for(const url of [undefined,'invalid','https://preview.loadgistic.example/.netlify/functions/demo-capacity',
    origin+'/.netlify/functions/demo-world',invocationUrl+'?limit=5',invocationUrl+'#override',
    'https://user:password@loadgistic.example/.netlify/functions/demo-capacity']){
    await assert.rejects(()=>runDemoCapacity({invocationUrl:url,environment,now,
      fetchImpl:async()=>{calls++;throw Error('MUST_NOT_SEND');}}),/DEMO_CAPACITY_ORIGIN_INVALID/);
  }
  for(const change of [{DEMO_CAPACITY_WORKER_SECRET:undefined},
    {DEMO_CAPACITY_WORKER_SECRET:'short'},
    {DEMO_CAPACITY_WORKER_SECRET:environment.DEMO_WORLD_WORKER_SECRET},
    {SESSION_SECRET:environment.DEMO_CAPACITY_WORKER_SECRET},
    {TELEMATICS_GATEWAYS_JSON:'invalid'}]){
    await assert.rejects(()=>runDemoCapacity({invocationUrl,environment:{...environment,...change},now,
      fetchImpl:async()=>{calls++;throw Error('MUST_NOT_SEND');}}),/(?:SECRET|SIGNING_SECRET)_UNAVAILABLE/);
  }
  assert.equal(calls,0);
});

test('scheduled request reaches the ordinary guarded controller and invokes no slower or GPS lane',async()=>{
  const calls=[];
  const lease='22222222-2222-4222-8222-222222222222';
  const captured=await captureLogs(()=>executeDemoCapacity(request(),{environment,now,
    fetchImpl:async(url,options)=>handleDemoCapacityAdvance(new Request(url,options),{environment,now,
      clientFactory:()=>({rpc:async(name,args)=>{
        calls.push({name,args});
        if(name==='demo_world_claim_batch'){
          assert.equal(args.batch_size,2);
          return {data:[1,2].map(step_id=>({step_id,lease_token:lease})),error:null};
        }
        if(name==='demo_world_execute_capacity_step')return {data:{result:'APPLIED'},error:null};
        assert.equal(name,'demo_world_status');
        return {data:{enabled:true,pending_count:4,oldest_due_age_seconds:30,exhausted_count:0,
          catalog_version:2,paused_count:0},error:null};
      }})
    })}));
  assert.equal(captured.result.status,204);
  assert.deepEqual(calls.map(call=>call.name),[
    'demo_world_claim_batch','demo_world_execute_capacity_step','demo_world_execute_capacity_step','demo_world_status'
  ]);
  assert.deepEqual(calls.slice(1,3).map(call=>call.args.step_id),[1,2]);
  assert.deepEqual(captured.logs,[{event:'demo-capacity-scheduled',enabled:true,...summary,accepted:2,completed:2}]);
});

test('one actor pause preserves independent due progress without retry or an extra batch',async()=>{
  const calls=[];
  const captured=await captureLogs(()=>executeDemoCapacity(request(),{environment,now,
    fetchImpl:async(url,options)=>handleDemoCapacityAdvance(new Request(url,options),{environment,now,
      clientFactory:()=>({rpc:async(name,args)=>{
        calls.push({name,args});
        if(name==='demo_world_claim_batch')return {data:[1,2].map(step_id=>({
          step_id,lease_token:'22222222-2222-4222-8222-222222222222'
        })),error:null};
        if(name==='demo_world_execute_capacity_step')return args.step_id===1
          ?{data:null,error:{message:'DEMO_WORLD_ACTOR_REFUSED private authority details'}}
          :{data:{result:'APPLIED'},error:null};
        if(name==='demo_world_pause_step')return {data:{paused:true},error:null};
        assert.equal(name,'demo_world_status');return {data:{enabled:true,pending_count:4,
          oldest_due_age_seconds:30,exhausted_count:0,catalog_version:2,paused_count:1},error:null};
      }})
    })}));
  assert.equal(captured.result.status,204);
  assert.deepEqual(calls.map(call=>call.name),[
    'demo_world_claim_batch','demo_world_execute_capacity_step','demo_world_pause_step',
    'demo_world_execute_capacity_step','demo_world_status'
  ]);
  assert.equal(calls[2].args.reason,'AUTHORITY_CHANGED');
  assert.equal(captured.logs[0].ok,false);assert.equal(captured.logs[0].paused,1);
  assert.equal(captured.logs[0].accepted,2);assert.equal(captured.logs[0].completed,1);
  assert.doesNotMatch(JSON.stringify(captured.logs),/private|authority details/);
});

test('disabled database is an inert successful check, with sanitized health only',async()=>{
  const value={...summary,accepted:0,completed:0,database_enabled:false,privateEmail:'never logged'};
  const captured=await captureLogs(()=>executeDemoCapacity(request(),{environment,now,
    fetchImpl:async()=>Response.json(value)}));
  assert.equal(captured.result.status,204);assert.equal(captured.logs[0].database_enabled,false);
  assert.doesNotMatch(JSON.stringify(captured.logs),/privateEmail|never logged/);
});

test('malformed, oversized, old-catalog and over-budget responses fail closed after one request',async()=>{
  const invalid=[
    {...summary,accepted:3,completed:3},{...summary,accepted:0},{...summary,paused:1},
    {...summary,ok:false},{...summary,catalog_version:1},{...summary,database_enabled:false},
    {...summary,paused_target_count:6},{...summary,paused_target_count:undefined},
    {...summary,pending_count:-1},{...summary,oldest_due_age_seconds:604801},
    {...summary,exhausted_count:'0'}
  ];
  for(const value of invalid){
    let calls=0;
    await assert.rejects(()=>runDemoCapacity({invocationUrl,environment,now,
      fetchImpl:async()=>{calls++;return Response.json(value);}}),/DEMO_CAPACITY_RESPONSE_INVALID/);
    assert.equal(calls,1);
  }
  let cancelled=false;
  const oversized=new Response(new ReadableStream({
    start(controller){controller.enqueue(new Uint8Array(8193));},cancel(){cancelled=true;}
  }));
  for(const response of [new Response(null),new Response('{'),
    new Response('{}',{headers:{'content-length':'8193'}}),oversized]){
    await assert.rejects(()=>runDemoCapacity({invocationUrl,environment,now,
      fetchImpl:async()=>response}),/DEMO_CAPACITY_RESPONSE_INVALID/);
  }
  assert.equal(cancelled,true);
});

test('transport and application failures never retry or expose remote error bodies',async()=>{
  for(const [fetcher,code,httpStatus] of [
    [async()=>{throw Error('secret private@example.invalid');},'UNCLASSIFIED',null],
    ...[401,403,429,500,503].map(status=>[async()=>new Response('secret private@example.invalid',{status}),'DEMO_CAPACITY_ADVANCE_FAILED',status])
  ]){
    let calls=0;
    const captured=await captureLogs(()=>executeDemoCapacity(request(),{environment,now,
      fetchImpl:async(...args)=>{calls++;return fetcher(...args);}}));
    assert.equal(calls,1);assert.equal(captured.result.status,500);
    assert.equal(await captured.result.text(),'');
    assert.deepEqual(captured.logs,[{event:'demo-capacity-scheduled',ok:false,error:'ADVANCE_FAILED',phase:'REQUEST',code,httpStatus}]);
  }
});

test('native Capacity schedule ignores synthetic incoming URL and signs only the configured site/path',async()=>{
  for(const url of ['https://scheduler.invalid/','https://scheduler.invalid/not-a-public-route?synthetic=1',invocationUrl]){
    let calls=0;
    const captured=await captureLogs(()=>executeScheduledDemoCapacity(new Request(url,{method:'POST',
      body:JSON.stringify({next_run:'2026-11-15T06:01:00Z'})}),{environment,now,fetchImpl:async(target,options)=>{
        calls++;assert.equal(target.href,origin+DEMO_CAPACITY_ADVANCE_PATH);
        assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
        assert.deepEqual(JSON.parse(options.body),{limit:2});
        assert.equal(verifyDemoWorldSignature({timestamp:options.headers[DEMO_WORLD_TIMESTAMP_HEADER],
          signature:options.headers[DEMO_WORLD_SIGNATURE_HEADER],url:target.href,purpose:'capacity-advance',body:options.body},environment,now),true);
        return Response.json(summary);
      }}));
    assert.equal(calls,1);assert.equal(captured.result.status,204);assert.equal(captured.logs[0].ok,true);
    assert.doesNotMatch(JSON.stringify(captured.logs),/scheduler\.invalid|synthetic|next_run|cccccccc/);
  }
});

test('native Capacity schedule retains exact site/production/stop/hour gates without reading provider URL',async()=>{
  for(const patch of [{CONTEXT:'deploy-preview'},{NODE_ENV:'development'},{SITE_ID:'wrong'},
    {URL:'https://other.invalid'},{LOADGISTIC_DEMO_CAPACITY_NETLIFY_KILL_SWITCH:'true'},
    {LOADGISTIC_DEMO_WORLD_KILL_SWITCH:'true'},{LOADGISTIC_SCENARIO_WORKER_ENABLED:'true'}]){
    const captured=await captureLogs(()=>executeScheduledDemoCapacity({get url(){throw Error('URL_MUST_NOT_BE_READ');}},
      {environment:{...environment,...patch},now,fetchImpl:async()=>{assert.fail('MUST_NOT_SEND');}}));
    assert.equal(captured.result.status,204);assert.deepEqual(captured.logs,[]);
  }
  const closed=await captureLogs(()=>executeScheduledDemoCapacity(undefined,{environment,now:Date.parse('2026-11-15T08:00:00Z'),fetchImpl:async()=>{assert.fail('MUST_NOT_SEND');}}));
  assert.equal(closed.result.status,204);assert.deepEqual(closed.logs,[]);
});

test('Capacity diagnostic phases distinguish invocation, signature, transport and malformed response without raw errors',async()=>{
  for(const [invoke,phase,code] of [
    [()=>executeDemoCapacity(new Request('https://wrong.invalid/'),{environment,now}),'INVOCATION','DEMO_CAPACITY_ORIGIN_INVALID'],
    [()=>executeScheduledDemoCapacity(undefined,{environment:{...environment,DEMO_CAPACITY_WORKER_SECRET:undefined},now}),'SIGNATURE','DEMO_CAPACITY_SECRET_UNAVAILABLE'],
    [()=>executeScheduledDemoCapacity(undefined,{environment,now,fetchImpl:async()=>{throw new DOMException('private@example.invalid','TimeoutError');}}),'REQUEST','REQUEST_TIMEOUT'],
    [()=>executeScheduledDemoCapacity(undefined,{environment,now,fetchImpl:async()=>Response.json({privateContact:'not logged'})}),'RESPONSE','DEMO_CAPACITY_RESPONSE_INVALID']
  ]){
    const captured=await captureLogs(invoke);assert.equal(captured.result.status,500);
    assert.deepEqual(captured.logs,[{event:'demo-capacity-scheduled',ok:false,error:'ADVANCE_FAILED',phase,code,httpStatus:null}]);
    assert.equal(await captured.result.text(),'');
  }
});
