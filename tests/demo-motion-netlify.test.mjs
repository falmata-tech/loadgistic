import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {NETLIFY_MOTION_PATH,NETLIFY_MOTION_BACKGROUND,NETLIFY_MOTION_SCHEDULE,NETLIFY_MOTION_TARGETS,
 netlifyMotionConfiguration,authenticateNetlifyMotion,signedNetlifyMotion,netlifyMotionClient,runNetlifyMotionWindow} from '../src/lib/demo-motion-netlify.mjs';
import {handleNetlifyDemoMotion} from '../src/lib/demo-motion-netlify-http.js';
import {demoMotionScenarioFix} from '../src/lib/demo-motion-scenario.mjs';
import {dispatchNetlifyMotion} from '../netlify/functions/demo-motion.mjs';
import {executeNetlifyMotion} from '../netlify/functions/demo-motion-background.mjs';

const origin='https://demo-motion.example',site=randomUUID(),at=Date.parse('2026-11-15T06:00:00Z');
const environment={NODE_ENV:'production',CONTEXT:'production',SITE_ID:site,URL:origin,
 NEXT_PUBLIC_SUPABASE_URL:'https://demo-motion.supabase.co',
 LOADGISTIC_HOSTED_MOTION_ENABLED:'true',LOADGISTIC_HOSTED_MOTION_KILL_SWITCH:'false',
 LOADGISTIC_HOSTED_MOTION_SITE_ID:site,LOADGISTIC_HOSTED_MOTION_SITE_ORIGIN:origin,
 LOADGISTIC_HOSTED_MOTION_SUPABASE_URL:'https://demo-motion.supabase.co',HOSTED_DEMO_MOTION_SECRET:'a'.repeat(64),
 LOADGISTIC_DEMO_MOTION_NETLIFY_ENABLED:'true',LOADGISTIC_DEMO_MOTION_NETLIFY_KILL_SWITCH:'false'};
const config={origin,secret:environment.HOSTED_DEMO_MOTION_SECRET};
function request(input,{path=NETLIFY_MOTION_PATH,issuedAt=at,headers={},raw}={}){
 const body=raw??JSON.stringify(input);
 return new Request(origin+path,{method:'POST',body,headers:{...signedNetlifyMotion(config,path,body,issuedAt),...headers}});
}

test('Netlify motion is default-off and rejects another site, preview, project or shared credential',async()=>{
 let calls=0;
 for(const patch of [{LOADGISTIC_DEMO_MOTION_NETLIFY_ENABLED:undefined},
  {LOADGISTIC_DEMO_MOTION_NETLIFY_KILL_SWITCH:undefined},{LOADGISTIC_HOSTED_MOTION_WORKER_ENABLED:'true'}]){
  assert.deepEqual(await dispatchNetlifyMotion(new Request(origin+NETLIFY_MOTION_SCHEDULE),{
   environment:{...environment,...patch},fetchImpl:async()=>{calls++;throw Error('unexpected');}}),{enabled:false});
 }
 assert.equal(calls,0);
 for(const patch of [{CONTEXT:'deploy-preview'},{NODE_ENV:'development'},{SITE_ID:randomUUID()},{URL:'https://other.example'},
  {NEXT_PUBLIC_SUPABASE_URL:'https://other.supabase.co'},{DEMO_CAPACITY_WORKER_SECRET:config.secret},
  {SESSION_SECRET:config.secret},{TELEMATICS_GATEWAYS_JSON:JSON.stringify([{id:randomUUID(),secret:config.secret,apiUrl:'https://gateway.example/api/',apiToken:'b'.repeat(64)}])}])
  assert.throws(()=>netlifyMotionConfiguration({...environment,...patch},origin+NETLIFY_MOTION_PATH,NETLIFY_MOTION_PATH));
 assert.throws(()=>netlifyMotionConfiguration(environment,'https://other.example'+NETLIFY_MOTION_PATH,NETLIFY_MOTION_PATH));
});

test('native Functions may omit build-time NODE_ENV while the application receiver stays strict',()=>{
 const missing={...environment};delete missing.NODE_ENV;
 assert.equal(netlifyMotionConfiguration(missing,origin+NETLIFY_MOTION_SCHEDULE,NETLIFY_MOTION_SCHEDULE).origin,origin);
 assert.equal(netlifyMotionConfiguration(missing,origin+NETLIFY_MOTION_BACKGROUND,NETLIFY_MOTION_BACKGROUND).origin,origin);
 assert.throws(()=>netlifyMotionConfiguration(missing,origin+NETLIFY_MOTION_PATH,NETLIFY_MOTION_PATH));
 assert.throws(()=>netlifyMotionConfiguration({...missing,CONTEXT:'deploy-preview'},origin+NETLIFY_MOTION_SCHEDULE,NETLIFY_MOTION_SCHEDULE));
});

test('signed motion requests bind exact body, path, nonce, origin and fresh time',()=>{
 const body=JSON.stringify({action:'CLAIM',runId:randomUUID()}),headers=new Headers(signedNetlifyMotion(config,NETLIFY_MOTION_PATH,body,at));
 assert.ok(authenticateNetlifyMotion(headers,body,config,NETLIFY_MOTION_PATH,at).nonce);
 for(const attempt of [()=>authenticateNetlifyMotion(headers,body+' ',config,NETLIFY_MOTION_PATH,at),
  ()=>authenticateNetlifyMotion(headers,body,config,NETLIFY_MOTION_BACKGROUND,at),
  ()=>authenticateNetlifyMotion(headers,body,{...config,origin:'https://other.example'},NETLIFY_MOTION_PATH,at),
  ()=>authenticateNetlifyMotion(headers,body,config,NETLIFY_MOTION_PATH,at+30001)])assert.throws(attempt);
});

test('serverless producer accepts no caller-selected geometry, actor, source, clock or unknown target',async()=>{
 let opened=0;
 const options={environment,now:at,clientFactory:()=>{opened++;throw Error('unexpected');}};
 for(const patch of [{latitude:9},{vehicleId:randomUUID()},{actorId:randomUUID()},{source:'GPS'},{now:at},{capturedAt:new Date(at).toISOString()}]){
  const response=await handleNetlifyDemoMotion(request({action:'REPORT',runId:randomUUID(),target:'company-truck',...patch}),options);
  assert.equal(response.status,403);
 }
 assert.equal((await handleNetlifyDemoMotion(request({action:'REPORT',runId:randomUUID(),target:'customer'}),options)).status,403);
 assert.equal((await handleNetlifyDemoMotion(request({action:'REPORT',runId:randomUUID(),target:'fleet-08'}),options)).status,409);
 assert.equal((await handleNetlifyDemoMotion(request({}, {raw:'x'.repeat(513)}),options)).status,403);
 assert.equal(opened,0);
});

test('authorized report uses the server clock/catalog and only the private Netlify command',async()=>{
 const calls=[],runId=randomUUID();
 const response=await handleNetlifyDemoMotion(request({action:'REPORT',target:'personal-truck',runId}),{
  environment,now:at,clientFactory:()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:{recorded:true},error:null};}})
 });
 assert.equal(response.status,200);assert.equal(calls.length,1);
 const fix=demoMotionScenarioFix('personal-truck',at);
 assert.equal(calls[0].name,'netlify_demo_motion_command');
 assert.equal(calls[0].args.run_id,runId);assert.equal(calls[0].args.target_name,'personal-truck');
 assert.deepEqual(calls[0].args.command,{action:'REPORT',latitude:fix.latitude,longitude:fix.longitude,speedKph:fix.speedKph,course:fix.course,capturedAt:new Date(at).toISOString()});
 assert.equal((await response.json()).data.recorded,true);
});

test('native scheduler dispatches one signed background request and requires asynchronous acceptance',async()=>{
 const calls=[];
 assert.deepEqual(await dispatchNetlifyMotion(new Request(origin+NETLIFY_MOTION_SCHEDULE),{
  environment,now:()=>at,fetchImpl:async(url,init)=>{calls.push({url,init});return new Response(null,{status:202});}
 }),{enabled:true});
 assert.equal(calls.length,1);assert.equal(calls[0].url,origin+NETLIFY_MOTION_BACKGROUND);
 const {init}=calls[0];assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');
 authenticateNetlifyMotion(new Headers(init.headers),init.body,config,NETLIFY_MOTION_BACKGROUND,at);
 assert.deepEqual(Object.keys(JSON.parse(init.body)),['runId']);
 await assert.rejects(dispatchNetlifyMotion(new Request(origin+NETLIFY_MOTION_SCHEDULE),{
  environment,now:()=>at,fetchImpl:async()=>new Response(null,{status:200})}),/DISPATCH_FAILED/);
});

test('client signs fresh nonces and does not automatically retry an ambiguous transport failure',async()=>{
 const nonces=[];
 const client=netlifyMotionClient(config,{now:()=>at,fetchImpl:async(url,init)=>{
  assert.equal(url,origin+NETLIFY_MOTION_PATH);nonces.push(init.headers['x-demo-nonce']);
  if(nonces.length===2)throw Error('ambiguous');return Response.json({ok:true,data:{claimed:false}});
 }});
 await client({action:'CLAIM',runId:randomUUID()});
 await assert.rejects(client({action:'CLAIM',runId:randomUUID()}),/ambiguous/);
 assert.equal(new Set(nonces).size,2);assert.equal(nonces.length,2);
});

test('parallel targets keep their durable thirty-second due times and unavailable geometry stays blocked',async()=>{
 let clock=at;const timers=[],reports=new Map(),calls=[];
 const client=async input=>{
  calls.push(input);
  if(input.action==='CLAIM')return {claimed:true,expiresAt:new Date(at+55000).toISOString()};
  if(input.target==='fleet-08')throw Error('DEMO_MOTION_SCENARIO_UNAVAILABLE');
  if(input.action==='PREPARE')return {ready:true,dueAt:new Date(at+1100).toISOString()};
  const entries=reports.get(input.target)||[];entries.push(clock);reports.set(input.target,entries);
  return {recorded:true,dueAt:new Date(clock+30000).toISOString()};
 };
 let finished=false,result;
 const running=runNetlifyMotionWindow({client,runId:randomUUID(),now:()=>clock,
  sleep:ms=>new Promise(resolve=>timers.push({at:clock+ms,resolve}))}).then(value=>{result=value;finished=true;});
 for(let iteration=0;iteration<12&&!finished;iteration++){
  await new Promise(resolve=>setImmediate(resolve));
  if(timers.length){clock=Math.min(...timers.map(timer=>timer.at));
   const due=timers.filter(timer=>timer.at===clock);for(const timer of due){timers.splice(timers.indexOf(timer),1);timer.resolve();}}
 }
 await running;
 assert.deepEqual(result,{claimed:true,recorded:18,notDue:0,unavailable:1,failed:0});
 assert.equal(reports.size,9);
 for(const times of reports.values())assert.deepEqual(times,[at+1100,at+31100]);
 assert.equal(calls.some(call=>call.action==='REPORT'&&call.target==='fleet-08'),false);
 assert.equal(NETLIFY_MOTION_TARGETS.length,10);
});

test('duplicate or expired windows cannot start target work',async()=>{
 const calls=[];
 const result=await runNetlifyMotionWindow({runId:randomUUID(),now:()=>at,client:async input=>{calls.push(input);return {claimed:false};}});
 assert.equal(result.claimed,false);assert.equal(calls.length,1);
 await assert.rejects(runNetlifyMotionWindow({runId:randomUUID(),now:()=>at,client:async()=>({claimed:true,expiresAt:new Date(at-1).toISOString()})}),/RESPONSE_DENIED/);
});

test('claim network time cannot reject a valid server expiry or extend the worker deadline',async()=>{
 let clock=at;let prepared=0;
 const result=await runNetlifyMotionWindow({runId:randomUUID(),now:()=>clock,client:async input=>{
  if(input.action==='CLAIM'){clock+=250;return {claimed:true,expiresAt:new Date(clock+55000).toISOString()};}
  prepared++;throw Error('DEMO_MOTION_SCENARIO_UNAVAILABLE');
 }});
 assert.equal(prepared,10);assert.equal(result.unavailable,10);assert.equal(result.failed,0);
});

test('background rejects expired signed retries and oversize bodies before any API call',async()=>{
 let calls=0;
 const options={environment,now:()=>at+30001,fetchImpl:async()=>{calls++;throw Error('unexpected');}};
 await assert.rejects(executeNetlifyMotion(request({runId:randomUUID()},{path:NETLIFY_MOTION_BACKGROUND}),options),/AUTH_DENIED/);
 await assert.rejects(executeNetlifyMotion(request({},{path:NETLIFY_MOTION_BACKGROUND,raw:'x'.repeat(513)}),options),/INPUT_DENIED/);
 assert.equal(calls,0);
});
