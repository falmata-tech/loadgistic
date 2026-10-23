import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DEMO_MOTION_TARGETS} from '../src/lib/demo-motion-auth.js';
import {HOSTED_DEMO_MOTION_PATH,hostedDemoMotionConfiguration,
 authenticateHostedDemoMotion,hostedDemoMotionSignature} from '../src/lib/demo-motion-hosted-auth.js';
import {handleHostedDemoMotion} from '../src/lib/demo-motion-hosted-http.js';

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
 const body=JSON.stringify(input),issuedAt=new Date(now).toISOString(),nonce=randomUUID();
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
