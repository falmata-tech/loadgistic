import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {localDemoMotionConfiguration} from '../src/lib/demo-motion-auth.js';
import {hostedDemoMotionConfiguration} from '../src/lib/demo-motion-hosted-auth.js';
import {assertHostedMotionWorkerEnvironment} from '../infra/telematics/hosted-motion-worker.mjs';
import {loadGatewayConfigurations} from '../src/lib/telematics-gateway-auth.js';
import {loadPrivacyConfigurations} from '../src/lib/telematics-privacy-auth.js';
import {handleHostedDemoMotion} from '../src/lib/demo-motion-hosted-http.js';
import {hostedDemoMotionSignature} from '../src/lib/demo-motion-hosted-signature.mjs';

const secret='a'.repeat(64),other='b'.repeat(64),origin='https://loadgistic.example',siteId=randomUUID();
const local={NODE_ENV:'development',LOADGISTIC_DEMO_MOTION_ENABLED:'true',LOADGISTIC_DEMO_MOTION_SECRET:secret,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55321'};
const hosted={NODE_ENV:'production',CONTEXT:'production',URL:origin,SITE_ID:siteId,
 LOADGISTIC_HOSTED_MOTION_ENABLED:'true',LOADGISTIC_HOSTED_MOTION_KILL_SWITCH:'false',
 LOADGISTIC_HOSTED_MOTION_SITE_ORIGIN:origin,LOADGISTIC_HOSTED_MOTION_SITE_ID:siteId,
 LOADGISTIC_HOSTED_MOTION_SUPABASE_URL:'https://sample.supabase.co',NEXT_PUBLIC_SUPABASE_URL:'https://sample.supabase.co',HOSTED_DEMO_MOTION_SECRET:secret};
const worker={NODE_ENV:'production',LOADGISTIC_HOSTED_MOTION_WORKER_ENABLED:'true',LOADGISTIC_HOSTED_MOTION_WORKER_KILL_SWITCH:'false',
 LOADGISTIC_HOSTED_MOTION_SITE_ORIGIN:origin,LOADGISTIC_HOSTED_MOTION_SITE_ID:siteId,
 LOADGISTIC_HOSTED_MOTION_SUPABASE_URL:'https://sample.supabase.co',HOSTED_DEMO_MOTION_SECRET:secret,
 SYNTHETIC_GT06_HOST:'synthetic-traccar',SYNTHETIC_GT06_PORT:'5023'};
const subjects=[
 {name:'local',base:local,own:'LOADGISTIC_DEMO_MOTION_SECRET',code:'DEMO_REQUEST_DENIED',check:env=>localDemoMotionConfiguration(env,'http://127.0.0.1:3100/api/telematics/demo-motion')},
 {name:'hosted app',base:hosted,own:'HOSTED_DEMO_MOTION_SECRET',code:'DEMO_HOSTED_DISABLED',check:env=>hostedDemoMotionConfiguration(env,origin+'/api/internal/demo-motion/command')},
 {name:'hosted worker',base:worker,own:'HOSTED_DEMO_MOTION_SECRET',code:'HOSTED_MOTION_CONFIG_DENIED',check:assertHostedMotionWorkerEnvironment}
];
const gateway={id:randomUUID(),secret:other,apiUrl:'http://127.0.0.1:18082/api/',apiToken:'separate-api-token-for-offline-tests'};
const privacy={id:randomUUID(),secret:other};
const scalarKeys=['DEMO_CAPACITY_WORKER_SECRET','DEMO_WORLD_WORKER_SECRET','HOSTED_DEMO_MOTION_SECRET',
 'LOADGISTIC_DEMO_MOTION_SECRET','SESSION_SECRET','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SEED_SERVICE_ROLE_KEY',
 'GATEWAY_SECRET','SYNTHETIC_GATEWAY_SECRET','GATEWAY_PRIVACY_SECRET','SYNTHETIC_GATEWAY_PRIVACY_SECRET'];

test('every motion receiver/worker rejects fast/world/session/gateway capability reuse with bounded errors',()=>{
 for(const subject of subjects){
  assert.equal(subject.check(subject.base).secret,secret);
  for(const key of scalarKeys.filter(key=>key!==subject.own)){
   assert.throws(()=>subject.check({...subject.base,[key]:secret}),error=>{
    assert.equal(error.message,subject.code,subject.name+': '+key);
    assert.equal(error.message.includes(secret),false);return true;
   });
   assert.doesNotThrow(()=>subject.check({...subject.base,[key]:other}),subject.name+': distinct '+key);
  }
 }
});

test('existing valid gateway/privacy contracts remain accepted, but HMAC and API-token collisions deny',()=>{
 const ingestion=JSON.stringify([gateway]),privacyList=JSON.stringify([privacy]);
 assert.equal(loadGatewayConfigurations(ingestion).length,1);assert.equal(loadPrivacyConfigurations(privacyList).length,1);
 for(const subject of subjects){
  assert.doesNotThrow(()=>subject.check({...subject.base,TELEMATICS_GATEWAYS_JSON:ingestion,TELEMATICS_PRIVACY_GATEWAYS_JSON:privacyList}));
  for(const patch of [
   {TELEMATICS_GATEWAYS_JSON:JSON.stringify([{...gateway,secret}])},
   {TELEMATICS_GATEWAYS_JSON:JSON.stringify([{...gateway,apiToken:secret}])},
   {TELEMATICS_PRIVACY_GATEWAYS_JSON:JSON.stringify([{...privacy,secret}])}
  ])assert.throws(()=>subject.check({...subject.base,...patch}),{message:subject.code});
 }
});

test('configured malformed gateway/privacy lists fail closed instead of being skipped',()=>{
 const gatewayBad=['not-json','{}','null','[null]','[[]]',JSON.stringify([{id:gateway.id,secret:other}]),
  JSON.stringify([{...gateway,id:'not-uuid'}]),JSON.stringify([{...gateway,secret:'short'}]),
  JSON.stringify([{...gateway,apiToken:'short'}]),JSON.stringify([{...gateway,extra:true}]),
  JSON.stringify([{...gateway,apiUrl:'https://user:pass@example.invalid'}]),
  JSON.stringify([{...gateway,apiUrl:'http://public.example.invalid'}]),
  JSON.stringify([{...gateway,apiUrl:'ftp://example.invalid'}]),JSON.stringify([gateway,gateway]),
  JSON.stringify(Array.from({length:11},()=>({...gateway,id:randomUUID()})))];
 const privacyBad=['not-json','{}','null','[null]','[[]]',JSON.stringify([{id:privacy.id}]),
  JSON.stringify([{...privacy,secret:'short'}]),JSON.stringify([{...privacy,apiToken:'unexpected'}]),
  JSON.stringify([privacy,privacy]),JSON.stringify(Array.from({length:11},()=>({...privacy,id:randomUUID()})))];
 for(const subject of subjects){
  for(const raw of gatewayBad)assert.throws(()=>subject.check({...subject.base,TELEMATICS_GATEWAYS_JSON:raw}),{message:subject.code});
  for(const raw of privacyBad)assert.throws(()=>subject.check({...subject.base,TELEMATICS_PRIVACY_GATEWAYS_JSON:raw}),{message:subject.code});
  // Empty optional values retain the existing loaders' unset/empty-list meaning.
  assert.doesNotThrow(()=>subject.check({...subject.base,TELEMATICS_GATEWAYS_JSON:'',TELEMATICS_PRIVACY_GATEWAYS_JSON:'[]'}));
 }
});

test('signed hosted requests with colliding or malformed authority configuration never open storage',async()=>{
 const now=1790000000000,issuedAt=new Date(now).toISOString(),body=JSON.stringify({action:'STATUS',target:'company-truck'});
 let opened=0;
 for(const patch of [{DEMO_CAPACITY_WORKER_SECRET:secret},
  {TELEMATICS_GATEWAYS_JSON:JSON.stringify([{id:gateway.id,secret:other}])},
  {TELEMATICS_PRIVACY_GATEWAYS_JSON:'[null]'}]){
  const nonce=randomUUID(),request=new Request(origin+'/api/internal/demo-motion/command',{method:'POST',body,
   headers:{'x-demo-issued-at':issuedAt,'x-demo-nonce':nonce,'x-demo-signature':hostedDemoMotionSignature(secret,origin,body,issuedAt,nonce)}});
  const response=await handleHostedDemoMotion(request,{environment:{...hosted,...patch},now,clientFactory:()=>{opened++;throw Error('MUST_NOT_OPEN_STORAGE');}});
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{ok:false,code:'DEMO_HOSTED_DISABLED'});
 }
 assert.equal(opened,0);
});
