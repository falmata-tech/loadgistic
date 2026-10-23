import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDemoWorldSignature,demoWorldWorkerEnabled,verifyDemoWorldSignature,
  DEMO_WORLD_ADVANCE_PATH,DEMO_WORLD_BACKGROUND_PATH,DEMO_WORLD_BATCH_LIMIT,
  DEMO_WORLD_SIGNATURE_HEADER,DEMO_WORLD_TIMESTAMP_HEADER
} from '../src/lib/demo-world-worker-auth.js';
import {
  config as scheduleConfig,dispatchDemoWorld,executeDemoWorldDispatch
} from '../netlify/functions/demo-world.mjs';
import {
  config as backgroundConfig,runDemoWorldBatch,executeDemoWorldBackground
} from '../netlify/functions/demo-world-background.mjs';

const now=1_790_000_000_000;
const origin='https://loadgistic.example';
const environment={
  CONTEXT:'production',NODE_ENV:'production',
  URL:origin,SITE_ID:'1d01c0c0-4554-4747-93b8-34ce3448ab95',
  LOADGISTIC_DEMO_WORLD_SITE_ID:'1d01c0c0-4554-4747-93b8-34ce3448ab95',
  LOADGISTIC_DEMO_WORLD_ENABLED:'true',LOADGISTIC_DEMO_WORLD_KILL_SWITCH:'false',
  LOADGISTIC_DEMO_WORLD_SITE_ORIGIN:origin,
  DEMO_WORLD_WORKER_SECRET:'distinct-production-demo-worker-secret-for-tests',
  SESSION_SECRET:'different-session-secret-for-tests-long-enough'
};
const health={database_enabled:true,pending_count:3,oldest_due_age_seconds:420,exhausted_count:0,
  handover_accepted:0,handover_completed:0,handover_pending_count:0,
  handover_last_completed_day:null,handover_next_scheduled_day:'2026-10-26',
  business_share_accepted:0,business_share_completed:0,business_share_replayed:0,
  business_share_enabled:false,business_share_target_bound:false,
  business_share_pending_count:0,business_share_exhausted_count:0,
  business_share_last_completed_phase:null,
  profile_accepted:0,profile_completed:0,profile_replayed:0,
  profile_enabled:false,profile_target_bound:false,
  profile_pending_count:0,profile_exhausted_count:0,
  profile_last_completed_phase:null,
  team_accepted:0,team_completed:0,team_replayed:0,
  team_enabled:false,team_target_bound:false,
  team_pending_count:0,team_exhausted_count:0,
  team_last_completed_phase:null,
  duty_accepted:0,duty_completed:0,duty_replayed:0,duty_enabled:false,
  duty_pending_count:0,duty_exhausted_count:0,duty_last_completed_phase:null};

function signedRequest(path,purpose,body='',override={}){
  const url=new URL(path,origin).href;
  const timestamp=String(now);
  const signature=createDemoWorldSignature({timestamp,url,purpose,body},environment);
  return new Request(url,{method:'POST',headers:{
    [DEMO_WORLD_TIMESTAMP_HEADER]:timestamp,[DEMO_WORLD_SIGNATURE_HEADER]:signature,
    ...override
  },body:body||undefined});
}

async function captureLogs(callback){
  const logs=[];
  const originals={info:console.info,error:console.error,warn:console.warn};
  for(const level of Object.keys(originals))console[level]=value=>logs.push(String(value));
  try{return {result:await callback(),logs};}
  finally{Object.assign(console,originals);}
}

test('marketplace schedule stays separate and off without every explicit production gate',async()=>{
  assert.equal(scheduleConfig.schedule,'*/15 * * * *');
  assert.equal(backgroundConfig.background,true);
  for(const change of [
    {LOADGISTIC_DEMO_WORLD_ENABLED:'false'},
    {LOADGISTIC_DEMO_WORLD_KILL_SWITCH:'true'},
    {LOADGISTIC_DEMO_WORLD_KILL_SWITCH:undefined},
    {CONTEXT:'deploy-preview'},
    {NODE_ENV:'development'},
    {URL:undefined},
    {URL:'https://preview.loadgistic.example'},
    {SITE_ID:undefined},
    {SITE_ID:'2d01c0c0-4554-4747-93b8-34ce3448ab95'},
    {LOADGISTIC_DEMO_WORLD_SITE_ID:undefined},
    {LOADGISTIC_DEMO_WORLD_SITE_ORIGIN:'http://loadgistic.example'},
    {LOADGISTIC_DEMO_WORLD_SITE_ORIGIN:'https://another.example/path'}
  ]){
    const inactive={...environment,...change};
    assert.equal(demoWorldWorkerEnabled(inactive),false);
    let calls=0;
    const scheduled=await executeDemoWorldDispatch(new Request(`${origin}/.netlify/functions/demo-world`),{
      environment:inactive,fetchImpl:async()=>{calls++;throw Error('MUST_NOT_SEND');}
    });
    const background=await executeDemoWorldBackground(signedRequest(DEMO_WORLD_BACKGROUND_PATH,'dispatch'),{
      environment:inactive,runBatch:async()=>{calls++;throw Error('MUST_NOT_RUN');}
    });
    assert.equal(scheduled.status,204);
    assert.equal(background.status,204);
    assert.equal(calls,0);
  }
  assert.equal(demoWorldWorkerEnabled({...environment,CONTEXT:undefined,NODE_ENV:undefined}),true,
    'Netlify Functions need only their read-only runtime URL/SITE_ID, not build-time variables');
});

test('HMAC binds exact production origin, purpose, body, and short issue time',()=>{
  const body=JSON.stringify({limit:DEMO_WORLD_BATCH_LIMIT});
  const target=`${origin}${DEMO_WORLD_ADVANCE_PATH}`;
  const signature=createDemoWorldSignature({timestamp:String(now),url:target,purpose:'advance',body},environment);
  const check=(change={},env=environment,time=now)=>verifyDemoWorldSignature({
    timestamp:String(now),signature,url:target,purpose:'advance',body,...change
  },env,time);
  assert.equal(check(),true);
  assert.equal(check({body:'{"limit":50}'}),false);
  assert.equal(check({purpose:'dispatch'}),false);
  assert.equal(check({url:`${origin}${DEMO_WORLD_BACKGROUND_PATH}`}),false);
  assert.equal(check({url:`https://preview.loadgistic.example${DEMO_WORLD_ADVANCE_PATH}`}),false);
  assert.equal(check({url:`${target}?debug=1`}),false);
  assert.equal(check({},environment,now+2*60_000+1),false);
  assert.equal(check({},environment,now-2*60_000-1),false);
  assert.equal(check({}, {...environment,DEMO_WORLD_WORKER_SECRET:environment.SESSION_SECRET}),false);
  assert.equal(check({}, {...environment,DEMO_WORLD_WORKER_SECRET:''}),false);
  assert.notEqual(signature,createDemoWorldSignature({timestamp:String(now+1),url:target,purpose:'advance',body},environment));
});

test('scheduled dispatcher signs only the same-site background and never contacts previews',async()=>{
  let capture;
  const result=await dispatchDemoWorld({
    invocationUrl:`${origin}/.netlify/functions/demo-world`,environment,now,
    fetchImpl:async(url,options)=>{capture={url,options};return {ok:true,status:202};}
  });
  assert.deepEqual(result,{enabled:true,status:202});
  assert.equal(capture.url.href,`${origin}${DEMO_WORLD_BACKGROUND_PATH}`);
  assert.equal(capture.options.method,'POST');
  assert.equal(capture.options.redirect,'error');
  assert.equal(verifyDemoWorldSignature({
    timestamp:capture.options.headers[DEMO_WORLD_TIMESTAMP_HEADER],
    signature:capture.options.headers[DEMO_WORLD_SIGNATURE_HEADER],
    url:capture.url.href,purpose:'dispatch'
  },environment,now),true);
  assert.doesNotMatch(JSON.stringify(capture),/production-demo-worker-secret|session-secret/);
  await assert.rejects(()=>dispatchDemoWorld({
    invocationUrl:'https://preview.loadgistic.example/.netlify/functions/demo-world',environment,
    fetchImpl:async()=>{throw Error('MUST_NOT_SEND');}
  }),/DEMO_WORLD_DISPATCH_ORIGIN_INVALID/);
});

test('background rejects unsigned, stale, wrong-site and wrong-method invocations before work',async()=>{
  let calls=0;
  const runBatch=async()=>{calls++;return {enabled:true,accepted:0,completed:0,skipped:0,failed:0,...health};};
  const unsigned=new Request(`${origin}${DEMO_WORLD_BACKGROUND_PATH}`,{method:'POST'});
  const stale=signedRequest(DEMO_WORLD_BACKGROUND_PATH,'dispatch','',{
    [DEMO_WORLD_TIMESTAMP_HEADER]:String(now-180_000)
  });
  const wrongSite=new Request(`https://preview.loadgistic.example${DEMO_WORLD_BACKGROUND_PATH}`,{
    method:'POST',headers:signedRequest(DEMO_WORLD_BACKGROUND_PATH,'dispatch').headers
  });
  const wrongMethod=new Request(`${origin}${DEMO_WORLD_BACKGROUND_PATH}`,{
    method:'GET',headers:signedRequest(DEMO_WORLD_BACKGROUND_PATH,'dispatch').headers
  });
  const wrongPath=new Request(`${origin}/.netlify/functions/managed-operations-background`,{
    method:'POST',headers:signedRequest(DEMO_WORLD_BACKGROUND_PATH,'dispatch').headers
  });
  const captured=await captureLogs(async()=>Promise.all([
    unsigned,stale,wrongSite,wrongMethod,wrongPath
  ].map(request=>executeDemoWorldBackground(request,{environment,now,runBatch}))));
  assert.deepEqual(captured.result.map(response=>response.status),[401,401,401,401,401]);
  assert.equal(calls,0);
});

test('authorized background runs only a bounded signed API batch and logs counts',async()=>{
  let capture;
  const response={ok:true,json:async()=>({accepted:5,completed:3,skipped:1,failed:1,...health,privateEmail:'never logged'})};
  const batch=await runDemoWorldBatch({environment,now,fetchImpl:async(url,options)=>{
    capture={url,options};return response;
  }});
  assert.deepEqual(batch,{enabled:true,accepted:5,completed:3,skipped:1,failed:1,...health});
  assert.equal(capture.url.href,`${origin}${DEMO_WORLD_ADVANCE_PATH}`);
  assert.equal(capture.options.method,'POST');
  assert.equal(capture.options.redirect,'error');
  assert.deepEqual(JSON.parse(capture.options.body),{limit:5});
  assert.equal(verifyDemoWorldSignature({
    timestamp:capture.options.headers[DEMO_WORLD_TIMESTAMP_HEADER],
    signature:capture.options.headers[DEMO_WORLD_SIGNATURE_HEADER],
    url:capture.url.href,purpose:'advance',body:capture.options.body
  },environment,now),true);
  const captured=await captureLogs(()=>executeDemoWorldBackground(
    signedRequest(DEMO_WORLD_BACKGROUND_PATH,'dispatch'),{environment,now,runBatch:async()=>batch}
  ));
  assert.equal(captured.result.status,204);
  assert.equal(await captured.result.text(),'');
  assert.deepEqual(captured.logs,[JSON.stringify({event:'demo-world-background',ok:true,
    accepted:5,completed:3,skipped:1,failed:1,...health})]);
});

test('invalid results and API failures reveal no target or error details',async()=>{
  const invalid=[
    {accepted:6,completed:6,skipped:0,failed:0,...health},
    {accepted:2,completed:1,skipped:0,failed:0,...health},
    {accepted:1,completed:1,skipped:0,failed:0,...health,pending_count:-1},
    {accepted:1,completed:1,skipped:0,failed:0,...health,database_enabled:'true'},
    {accepted:1,completed:1,skipped:0,failed:0,...health,handover_accepted:2},
    {accepted:1,completed:1,skipped:0,failed:0,...health,handover_completed:1},
    {accepted:1,completed:1,skipped:0,failed:0,...health,business_share_accepted:2},
    {accepted:1,completed:1,skipped:0,failed:0,...health,business_share_completed:1},
    {accepted:1,completed:1,skipped:0,failed:0,...health,business_share_last_completed_phase:'UNKNOWN'},
    {accepted:1,completed:1,skipped:0,failed:0,...health,profile_accepted:2},
    {accepted:1,completed:1,skipped:0,failed:0,...health,profile_completed:1},
    {accepted:1,completed:1,skipped:0,failed:0,...health,profile_last_completed_phase:'UNKNOWN'},
    {accepted:1,completed:1,skipped:0,failed:0,...health,team_accepted:2},
    {accepted:1,completed:1,skipped:0,failed:0,...health,team_completed:1},
    {accepted:1,completed:1,skipped:0,failed:0,...health,team_last_completed_phase:'UNKNOWN'}
  ];
  for(const value of invalid){
    await assert.rejects(()=>runDemoWorldBatch({environment,now,fetchImpl:async()=>({ok:true,json:async()=>value})}),/DEMO_WORLD_(?:SUMMARY|HEALTH)_INVALID/);
  }
  const captured=await captureLogs(()=>executeDemoWorldBackground(
    signedRequest(DEMO_WORLD_BACKGROUND_PATH,'dispatch'),{
      environment,now,runBatch:async()=>{throw Error('private@example.invalid secret');}
    }
  ));
  assert.equal(captured.result.status,204);
  assert.deepEqual(captured.logs,['{"event":"demo-world-background","ok":false,"error":"BATCH_FAILED"}']);
  assert.doesNotMatch(captured.logs.join(''),/private@example|secret/);
});
