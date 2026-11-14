import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceDemoCapacity,handleDemoCapacityAdvance} from '../src/lib/demo-world-advance.js';
import {createDemoWorldSignature,DEMO_CAPACITY_ADVANCE_PATH,DEMO_WORLD_ADVANCE_PATH,
 DEMO_WORLD_SIGNATURE_HEADER,DEMO_WORLD_TIMESTAMP_HEADER} from '../src/lib/demo-world-worker-auth.js';
import {verifyDemoWorldSignature} from '../src/lib/demo-world-worker-auth.js';

const origin='https://loadgistic.example',site='11111111-1111-4111-8111-111111111111';
const environment={NODE_ENV:'production',CONTEXT:'production',LOADGISTIC_DEMO_WORLD_ENABLED:'true',
 LOADGISTIC_DEMO_WORLD_KILL_SWITCH:'false',LOADGISTIC_DEMO_WORLD_SITE_ORIGIN:origin,
 LOADGISTIC_DEMO_WORLD_SITE_ID:site,SITE_ID:site,URL:origin,
 DEMO_WORLD_WORKER_SECRET:'a'.repeat(64),DEMO_CAPACITY_WORKER_SECRET:'c'.repeat(64),SESSION_SECRET:'b'.repeat(64)};
const health={enabled:true,catalog_version:2,paused_count:1,pending_count:2,oldest_due_age_seconds:30,exhausted_count:0};
const lease='22222222-2222-4222-8222-222222222222';
const signed=(purpose='capacity-advance',payload='{"limit":5}',path=DEMO_CAPACITY_ADVANCE_PATH)=>{
 const timestamp=String(Date.now()),url=origin+path;
 return new Request(origin+DEMO_CAPACITY_ADVANCE_PATH,{method:'POST',body:payload,headers:{
  [DEMO_WORLD_TIMESTAMP_HEADER]:timestamp,
  [DEMO_WORLD_SIGNATURE_HEADER]:createDemoWorldSignature({timestamp,url,purpose,body:payload},environment)
 }});
};
test('fast capacity endpoint claims bounded work without querying any slow lane',async()=>{
 const calls=[];
 const response=await handleDemoCapacityAdvance(signed(),{environment,clientFactory:()=>({rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='demo_world_claim_batch')return {data:[{step_id:1,lease_token:lease}],error:null};
  if(name==='demo_world_execute_capacity_step')return {data:{result:'APPLIED'},error:null};
  assert.equal(name,'demo_world_status');return {data:health,error:null};
 }})});
 assert.equal(response.status,200);
 assert.deepEqual(calls.map(call=>call.name),['demo_world_claim_batch','demo_world_execute_capacity_step','demo_world_status']);
 assert.deepEqual(await response.json(),{ok:true,accepted:1,completed:1,skipped:0,failed:0,paused:0,
  database_enabled:true,pending_count:2,oldest_due_age_seconds:30,exhausted_count:0,catalog_version:2,paused_target_count:1});
});
test('fast endpoint accepts the dedicated one-step budget but never exceeds five',async()=>{
 let opened=0;
 for(const limit of [1,5]){
  const response=await handleDemoCapacityAdvance(signed('capacity-advance',JSON.stringify({limit})),{
   environment,clientFactory:()=>({rpc:async(name,args)=>{
    opened++;
    if(name==='demo_world_claim_batch'){assert.equal(args.batch_size,limit);return {data:[],error:null};}
    assert.equal(name,'demo_world_status');return {data:health,error:null};
   }})});
  assert.equal(response.status,200);
 }
 assert.equal(opened,4);
 for(const limit of [0,6,1.5,'1']){
  const response=await handleDemoCapacityAdvance(signed('capacity-advance',JSON.stringify({limit})),{
   environment,clientFactory:()=>{throw Error('must not open storage');}});
  assert.equal(response.status,400);
 }
});
test('one human edit pauses only its exact lease and independent claimed actors still execute',async()=>{
 const calls=[],saved=[];
 const result=await advanceDemoCapacity({rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='demo_world_claim_batch')return {data:[1,2,3].map(step_id=>({step_id,lease_token:lease})),error:null};
  if(name==='demo_world_execute_capacity_step'){
   if(args.step_id===1)return {data:null,error:{message:'DEMO_WORLD_PREDECESSOR_CHANGED private data'}};
   if(args.step_id===2)throw Error('temporary network detail');
   saved.push(args.step_id);return {data:{result:'APPLIED'},error:null};
  }
  if(name==='demo_world_pause_step')return {data:{paused:true},error:null};
  assert.equal(name,'demo_world_status');return {data:health,error:null};
 }});
 assert.deepEqual(saved,[3]);assert.equal(result.completed,1);assert.equal(result.failed,2);assert.equal(result.paused,1);
 assert.deepEqual(calls.filter(call=>call.name==='demo_world_pause_step'),[{name:'demo_world_pause_step',args:{step_id:1,lease_token:lease,reason:'STATE_DRIFT'}}]);
 assert.equal(JSON.stringify(result).includes('private'),false);
});
test('legacy-purpose signatures and caller-selected targets or percentages cannot open storage',async()=>{
 let opened=0;const clientFactory=()=>{opened++;throw Error('must not open');};
 for(const request of [signed('advance','{"limit":5}',DEMO_WORLD_ADVANCE_PATH),
  signed('capacity-advance','{"limit":5,"target":"customer"}'),
  signed('capacity-advance','{"limit":5,"available_percent":55}')]){
  const response=await handleDemoCapacityAdvance(request,{environment,clientFactory});
  assert.notEqual(response.status,200);
 }
 assert.equal(opened,0);
});
test('fast endpoint refuses an old installed catalog and never reports unverified execution as current',async()=>{
 const response=await handleDemoCapacityAdvance(signed(),{environment,clientFactory:()=>({rpc:async name=>
  name==='demo_world_claim_batch'?{data:[],error:null}:{data:{...health,catalog_version:1},error:null}})});
 assert.equal(response.status,503);assert.deepEqual(await response.json(),{ok:false,code:'DEMO_WORLD_UNAVAILABLE'});
});
test('fast and infrequent workers have separate cryptographic authority',()=>{
 const timestamp=String(Date.now()),body='{"limit":5}',fastUrl=origin+DEMO_CAPACITY_ADVANCE_PATH,slowUrl=origin+DEMO_WORLD_ADVANCE_PATH;
 const fastOnly={...environment,DEMO_WORLD_WORKER_SECRET:undefined};
 assert.throws(()=>createDemoWorldSignature({timestamp,url:slowUrl,purpose:'advance',body},fastOnly),/SIGNING_SECRET_UNAVAILABLE/);
 const slowOnly={...environment,DEMO_CAPACITY_WORKER_SECRET:undefined};
 assert.throws(()=>createDemoWorldSignature({timestamp,url:fastUrl,purpose:'capacity-advance',body},slowOnly),/SIGNING_SECRET_UNAVAILABLE/);
 // An attacker can choose a signing helper environment; the server's distinct
 // configured key and purpose must still reject the forged request.
 const forgedFast=createDemoWorldSignature({timestamp,url:fastUrl,purpose:'capacity-advance',body},
  {...slowOnly,DEMO_CAPACITY_WORKER_SECRET:environment.DEMO_WORLD_WORKER_SECRET,DEMO_WORLD_WORKER_SECRET:undefined});
 const forgedSlow=createDemoWorldSignature({timestamp,url:slowUrl,purpose:'advance',body},
  {...fastOnly,DEMO_WORLD_WORKER_SECRET:environment.DEMO_CAPACITY_WORKER_SECRET,DEMO_CAPACITY_WORKER_SECRET:undefined});
 assert.equal(verifyDemoWorldSignature({timestamp,signature:forgedFast,url:fastUrl,purpose:'capacity-advance',body},environment),false);
 assert.equal(verifyDemoWorldSignature({timestamp,signature:forgedSlow,url:slowUrl,purpose:'advance',body},environment),false);
 assert.throws(()=>createDemoWorldSignature({timestamp,url:fastUrl,purpose:'capacity-advance',body},
  {...environment,DEMO_CAPACITY_WORKER_SECRET:environment.DEMO_WORLD_WORKER_SECRET}),/SIGNING_SECRET_UNAVAILABLE/);
 for(const purpose of ['status','admin','motion'])assert.throws(()=>createDemoWorldSignature({timestamp,url:fastUrl,purpose,body},fastOnly),/TARGET_INVALID/);
});

test('both world authorities refuse known credential collisions and malformed gateway key lists',()=>{
 const timestamp=String(Date.now()),body='{"limit":5}';
 for(const [purpose,path,key] of [['capacity-advance',DEMO_CAPACITY_ADVANCE_PATH,'DEMO_CAPACITY_WORKER_SECRET'],
  ['advance',DEMO_WORLD_ADVANCE_PATH,'DEMO_WORLD_WORKER_SECRET']]){
  const url=origin+path,secret=environment[key];
  const valid=createDemoWorldSignature({timestamp,url,purpose,body},environment);
  for(const other of ['SESSION_SECRET','HOSTED_DEMO_MOTION_SECRET','LOADGISTIC_DEMO_MOTION_SECRET',
   'SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SEED_SERVICE_ROLE_KEY','GATEWAY_SECRET','SYNTHETIC_GATEWAY_SECRET',
   'GATEWAY_PRIVACY_SECRET','SYNTHETIC_GATEWAY_PRIVACY_SECRET']){
   const collided={...environment,[other]:secret};
   assert.throws(()=>createDemoWorldSignature({timestamp,url,purpose,body},collided),/SIGNING_SECRET_UNAVAILABLE/,other);
   assert.equal(verifyDemoWorldSignature({timestamp,url,purpose,body,signature:valid},collided),false,other);
  }
  for(const gatewayKey of ['TELEMATICS_GATEWAYS_JSON','TELEMATICS_PRIVACY_GATEWAYS_JSON']){
   const gateway={id:site,secret:'d'.repeat(64),...(gatewayKey==='TELEMATICS_GATEWAYS_JSON'
    ?{apiUrl:'https://gateway.example/api/',apiToken:'different-relay-token'}:{})};
   for(const raw of ['{','{}','[null]','[{}]',JSON.stringify([{secret:'d'.repeat(64)}]),
    JSON.stringify([{...gateway,secret}]),JSON.stringify([{...gateway,apiToken:secret}]),
    JSON.stringify([gateway,gateway]),JSON.stringify([{...gateway,id:'invalid'}]),
    JSON.stringify([{...gateway,apiUrl:'http://public.example/api/'}])]){
    const collided={...environment,[gatewayKey]:raw};
    assert.throws(()=>createDemoWorldSignature({timestamp,url,purpose,body},collided),/SIGNING_SECRET_UNAVAILABLE/,gatewayKey);
    assert.equal(verifyDemoWorldSignature({timestamp,url,purpose,body,signature:valid},collided),false,gatewayKey);
   }
   assert.equal(createDemoWorldSignature({timestamp,url,purpose,body},
    {...environment,[gatewayKey]:JSON.stringify([gateway])}),valid);
  }
 }
});
