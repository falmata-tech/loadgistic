import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DEMO_MOTION_TARGETS} from '../src/lib/demo-motion-auth.js';
import {HOSTED_DEMO_MOTION_PATH,hostedDemoMotionConfiguration,
 authenticateHostedDemoMotion,hostedDemoMotionSignature} from '../src/lib/demo-motion-hosted-auth.js';
import {handleHostedDemoMotion} from '../src/lib/demo-motion-hosted-http.js';
import {demoMotionScenarioFix} from '../src/lib/demo-motion-scenario.mjs';
import {hostedMotionClient,runHostedMotionTarget} from '../infra/telematics/hosted-motion-worker.mjs';

const origin='https://loadgistic.example';
const url=origin+HOSTED_DEMO_MOTION_PATH;
const secret='a'.repeat(64),now=1_790_000_000_000;
const environment={NODE_ENV:'production',CONTEXT:'production',URL:origin,
 SITE_ID:'1d01c0c0-4554-4747-93b8-34ce3448ab95',
 LOADGISTIC_HOSTED_MOTION_ENABLED:'true',LOADGISTIC_HOSTED_MOTION_KILL_SWITCH:'false',
 LOADGISTIC_HOSTED_MOTION_SITE_ORIGIN:origin,
 LOADGISTIC_HOSTED_MOTION_SITE_ID:'1d01c0c0-4554-4747-93b8-34ce3448ab95',
 LOADGISTIC_HOSTED_MOTION_SUPABASE_URL:'https://sample.supabase.co',
 NEXT_PUBLIC_SUPABASE_URL:'https://sample.supabase.co',HOSTED_DEMO_MOTION_SECRET:secret,
 SUPABASE_SERVICE_ROLE_KEY:'different-service-key',DEMO_WORLD_WORKER_SECRET:'different-world-secret'};

function signedRequest(input={action:'STATUS',target:'company-truck'},override={}){
 const body=JSON.stringify(input),issuedAt=override.issuedAt||new Date(now).toISOString(),nonce=randomUUID();
 const headers={'Content-Type':'application/json','x-demo-issued-at':issuedAt,
  'x-demo-nonce':nonce,'x-demo-signature':hostedDemoMotionSignature(secret,origin,body,issuedAt,nonce),
  ...override.headers};
 return new Request(override.url||url,{method:override.method||'POST',headers,body:override.method==='GET'?undefined:body});
}

test('hosted motion remains independently disabled without exact site, project, and kill gates',()=>{
 assert.deepEqual(hostedDemoMotionConfiguration(environment,url),{origin,secret});
 for(const patch of [{LOADGISTIC_HOSTED_MOTION_ENABLED:'false'},{LOADGISTIC_HOSTED_MOTION_KILL_SWITCH:'true'},
  {NODE_ENV:'development'},{CONTEXT:'deploy-preview'},{SITE_ID:randomUUID()},
  {URL:'https://preview.loadgistic.example'},{LOADGISTIC_HOSTED_MOTION_SITE_ORIGIN:'http://loadgistic.example'},
  {NEXT_PUBLIC_SUPABASE_URL:'https://another.supabase.co'},
  {HOSTED_DEMO_MOTION_SECRET:environment.DEMO_WORLD_WORKER_SECRET},
  {LOADGISTIC_DEMO_MOTION_SECRET:secret},
  {TELEMATICS_GATEWAYS_JSON:JSON.stringify([{secret}])}])
  assert.throws(()=>hostedDemoMotionConfiguration({...environment,...patch},url),/DEMO_HOSTED_DISABLED/);
 for(const target of [url+'?debug=1',origin+'/api/telematics/demo-motion',
  'https://preview.loadgistic.example'+HOSTED_DEMO_MOTION_PATH])
  assert.throws(()=>hostedDemoMotionConfiguration(environment,target),/DEMO_HOSTED_DISABLED/);
});

test('hosted HMAC binds origin, path, body, timestamp, and nonce',()=>{
 const body='{"action":"STATUS","target":"company-truck"}',issuedAt=new Date(now).toISOString(),nonce=randomUUID();
 const signature=hostedDemoMotionSignature(secret,origin,body,issuedAt,nonce);
 const headers=new Headers({'x-demo-issued-at':issuedAt,'x-demo-nonce':nonce,'x-demo-signature':signature});
 assert.deepEqual(authenticateHostedDemoMotion(headers,body,{origin,secret},now),{nonce});
 for(const changed of [{body:body+' '},{config:{origin:'https://preview.loadgistic.example',secret}},
  {config:{origin,secret:'b'.repeat(64)}},{now:now+30001}])
  assert.throws(()=>authenticateHostedDemoMotion(headers,changed.body||body,changed.config||{origin,secret},changed.now||now),
   /DEMO_HOSTED_AUTH_DENIED/);
 headers.set('x-demo-nonce',randomUUID());
 assert.throws(()=>authenticateHostedDemoMotion(headers,body,{origin,secret},now),/DEMO_HOSTED_AUTH_DENIED/);
});

test('authorized route submits one exact target and nonce to one atomic database command',async()=>{
 const calls=[];
 const response=await handleHostedDemoMotion(signedRequest(),{environment,now,
  clientFactory:()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:{state:'OFF'},error:null};}})});
 assert.equal(response.status,200);
 assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 assert.deepEqual(await response.json(),{ok:true,data:{state:'OFF'}});
 assert.equal(calls.length,1);
 assert.equal(calls[0].name,'hosted_demo_motion_command');
 assert.equal(calls[0].args.target_vehicle_id,DEMO_MOTION_TARGETS['company-truck']);
 assert.deepEqual(calls[0].args.payload,{action:'STATUS',target:'company-truck'});
 assert.match(calls[0].args.request_nonce,/^[0-9a-f-]{36}$/);
});

test('disabled, unsigned, arbitrary-target and REAL-resume requests never open database',async()=>{
 let calls=0;const clientFactory=()=>{calls++;throw Error('MUST_NOT_OPEN_DATABASE');};
 const cases=[
  [signedRequest(),{...environment,LOADGISTIC_HOSTED_MOTION_ENABLED:'false'}],
  [new Request(url,{method:'POST',body:'{}'}),environment],
  [signedRequest({action:'STATUS',target:'customer'}),environment],
  [signedRequest({action:'RESUME',target:'company-truck',seconds:60}),environment],
  [signedRequest({action:'STATUS',target:'company-truck',actorId:randomUUID()}),environment],
  [signedRequest(undefined,{url:'https://preview.loadgistic.example'+HOSTED_DEMO_MOTION_PATH}),environment]
 ];
 for(const [request,env] of cases){const response=await handleHostedDemoMotion(request,{environment:env,now,clientFactory});
  assert.notEqual(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');}
 assert.equal(calls,0);
});

test('database failures return stable codes without raw account or secret details',async()=>{
 const response=await handleHostedDemoMotion(signedRequest(),{environment,now,
  clientFactory:()=>({rpc:async()=>({data:null,error:{message:'private@example.invalid secret'}})})});
 assert.equal(response.status,503);
 const body=await response.text();
 assert.deepEqual(JSON.parse(body),{ok:false,code:'DEMO_HOSTED_UNAVAILABLE'});
 assert.doesNotMatch(body,/private@|secret/);
});

test('database nonce replay is reported as a bounded denial',async()=>{
 const response=await handleHostedDemoMotion(signedRequest(),{environment,now,
  clientFactory:()=>({rpc:async()=>({data:null,error:{message:'DEMO_REQUEST_DENIED'}})})});
 assert.equal(response.status,409);
 assert.deepEqual(await response.json(),{ok:false,code:'DEMO_REQUEST_DENIED'});
});

test('signed arbitrary in-box, wrong-time, stale capture and unavailable scenarios never open storage',async()=>{
 const target='personal-truck',fix=demoMotionScenarioFix(target,now),other=demoMotionScenarioFix(target,now+90000);
 const report={action:'PHONE',target,leaseId:randomUUID(),epoch:4,latitude:fix.latitude,longitude:fix.longitude};
 let opened=0;
 for(const [input,override] of [
  [{...report,latitude:9.03,longitude:38.76},{}],
  [{...report,latitude:other.latitude,longitude:other.longitude},{}],
  [report,{issuedAt:new Date(now-6000).toISOString()}],
  [{action:'CONFIGURE',target:'fleet-08'},{}],
  [{action:'START',target:'fleet-08',seconds:60},{}]
 ]){
  const response=await handleHostedDemoMotion(signedRequest(input,override),{environment,now,clientFactory:()=>{opened++;throw Error('MUST_NOT_OPEN');}});
  assert.equal(response.status,409);
  assert.match((await response.json()).code,/^DEMO_MOTION_(?:REPORT_DENIED|SCENARIO_UNAVAILABLE)$/);
 }
 assert.equal(opened,0);
});

test('valid catalog report uses one atomic RPC and records sanitized scenario/version/step',async()=>{
 const target='personal-truck',fix=demoMotionScenarioFix(target,now);
 const report={action:'PHONE',target,leaseId:randomUUID(),epoch:4,latitude:fix.latitude,longitude:fix.longitude};
 const calls=[],logs=[],old=console.info;console.info=value=>logs.push(JSON.parse(value));
 try{
  const response=await handleHostedDemoMotion(signedRequest(report),{environment,now,clientFactory:()=>({rpc:async(name,args)=>{
   calls.push({name,args});return {data:{recorded:true,source:'MOBILE'},error:null};
  }})});
  assert.equal(response.status,200);const body=await response.json();
  assert.equal(calls.length,1);assert.equal(calls[0].name,'hosted_demo_motion_command');
  assert.deepEqual(calls[0].args.payload,report);
  assert.deepEqual(body.scenario,{scenarioId:fix.scenarioId,scenarioVersion:fix.scenarioVersion,step:fix.step,purpose:'PROTOCOL_LOCAL'});
  assert.deepEqual(logs,[{event:'demo_motion_report',...body.scenario}]);
  assert.doesNotMatch(JSON.stringify(logs),/latitude|longitude|leaseId|email|nonce|secret/);
 }finally{console.info=old;}
});

test('cold-start stale capture retries fresh next cycle while REAL takeover stays sticky',async()=>{
 let clock=now,state='OFF',epoch=0,leaseId,delayed=false,accepted=0;
 const requests=[],database=[],logs=[],oldInfo=console.info;console.info=value=>logs.push(JSON.parse(value));
 const client=hostedMotionClient({enabled:true,origin,secret},{now:()=>clock,fetchImpl:async(destination,options)=>{
  assert.equal(destination,url);const input=JSON.parse(options.body);
  requests.push({input,nonce:options.headers['x-demo-nonce'],issuedAt:options.headers['x-demo-issued-at']});
  // A one-off transport/cold-start delay exceeds capture freshness while its
  // HMAC remains authentic. It must not create a persistent REAL takeover.
  if(input.action==='PHONE'&&!delayed){delayed=true;clock+=6001;}
  return handleHostedDemoMotion(new Request(destination,options),{environment,now:clock,clientFactory:()=>({rpc:async(name,args)=>{
   assert.equal(name,'hosted_demo_motion_command');const command=args.payload;database.push(command.action);
   if(command.action==='STATUS')return {data:{state},error:null};
   if(command.action==='START'){
    state='RUNNING';epoch++;leaseId=randomUUID();
    return {data:{state,source:'MOBILE',epoch,leaseId,expiresAt:new Date(clock+60000).toISOString()},error:null};
   }
   if(command.action==='PHONE'){
    assert.equal(command.leaseId,leaseId);assert.equal(command.epoch,epoch);accepted++;
    return {data:{recorded:true,source:'MOBILE'},error:null};
   }
   if(command.action==='STOP'){if(state==='RUNNING'&&command.leaseId===leaseId&&command.epoch===epoch)state='OFF';return {data:{state},error:null};}
   throw Error('UNEXPECTED_COMMAND');
  }})});
 }});
 try{
  const first=await runHostedMotionTarget('personal-truck',{client,seconds:60,now:()=>clock,sleep:async ms=>{clock+=ms;}});
  assert.equal(first.status,'PAUSED');assert.equal(first.code,'DEMO_MOTION_REPORT_DENIED');assert.equal(first.ticks,0);
  assert.equal(accepted,0);assert.equal(state,'OFF');assert.equal(database.includes('PHONE'),false);
  clock=Math.max(clock,now+30000);
  const recovered=await runHostedMotionTarget('personal-truck',{client,seconds:60,now:()=>clock,sleep:async ms=>{clock+=ms;}});
  assert.equal(recovered.status,'STOPPED');assert.equal(recovered.ticks,2);assert.equal(accepted,2);
  const reports=requests.filter(request=>request.input.action==='PHONE');
  assert.equal(reports.length,3);assert.equal(new Set(requests.map(request=>request.nonce)).size,requests.length);
  assert.notEqual(JSON.stringify(reports[0].input),JSON.stringify(reports[1].input));
  for(const report of reports){const fix=demoMotionScenarioFix('personal-truck',Date.parse(report.issuedAt));
   assert.equal(report.input.latitude,fix.latitude);assert.equal(report.input.longitude,fix.longitude);}
  state='REAL';const before=requests.length;
  const real=await runHostedMotionTarget('personal-truck',{client,seconds:60,now:()=>clock,sleep:async()=>{throw Error('NO_RETRY_AFTER_REAL');}});
  assert.equal(real.status,'REAL');assert.equal(accepted,2);
  assert.deepEqual(requests.slice(before).map(request=>request.input.action),['STATUS']);
  assert.equal(logs.length,2,'only accepted reports produce scenario evidence');
 }finally{console.info=oldInfo;}
});
