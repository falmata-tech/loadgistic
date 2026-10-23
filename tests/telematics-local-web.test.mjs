import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {localWebEnvironment} from '../scripts/telematics/start-local-web.mjs';
import {assessDemoGpsPipeline} from '../scripts/telematics/verify-demo-gps-local.mjs';

const demoSecret='f'.repeat(64),gatewaySecret='a'.repeat(64);
const environment={NODE_ENV:'development',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55321',
 LOADGISTIC_DEMO_MOTION_ENABLED:'true',LOADGISTIC_DEMO_MOTION_SECRET:demoSecret};
const gateway={id:randomUUID(),secret:gatewaySecret,apiUrl:'http://127.0.0.1:18082/api/',apiToken:'b'.repeat(32)};
const manifest={purpose:'local-fictional-gps',gatewayId:gateway.id};

test('local web launcher passes only validated protected gateway config to child environment',()=>{
 const protectedJson=JSON.stringify([gateway]);
 const inherited={...environment,TELEMATICS_GATEWAYS_JSON:'[]',TELEMATICS_DEFAULT_GATEWAY_ID:'old',TELEMATICS_DEMO_GATEWAY_ID:'old'};
 const child=localWebEnvironment(inherited,protectedJson,manifest);
 assert.equal(child.TELEMATICS_GATEWAYS_JSON,protectedJson);
 assert.equal(child.TELEMATICS_DEMO_GATEWAY_ID,gateway.id);
 assert.equal(child.TELEMATICS_DEFAULT_GATEWAY_ID,'');
 assert.equal(child.TELEMATICS_LOCAL_SYNTHETIC_ONLY,'true');
 assert.equal(child.NEXT_DIST_DIR,'.next-dev');
 assert.equal(inherited.TELEMATICS_GATEWAYS_JSON,'[]');
});

test('local web launcher refuses remote destinations, disabled demo motion and shared credentials',()=>{
 for(const apiUrl of ['https://loadgistic.com/api/','http://127.0.0.1.evil:18082/api/',
  'http://127.0.0.1:18083/api/','http://user@127.0.0.1:18082/api/','http://127.0.0.1:18082/api/?x=1'])
  assert.throws(()=>localWebEnvironment(environment,JSON.stringify([{...gateway,apiUrl}]),manifest));
 for(const patch of [{NODE_ENV:'production'},{NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co'},
  {LOADGISTIC_DEMO_MOTION_ENABLED:'false'},{LOADGISTIC_DEMO_MOTION_SECRET:gatewaySecret}])
  assert.throws(()=>localWebEnvironment({...environment,...patch},JSON.stringify([gateway]),manifest));
 for(const payload of ['[]',JSON.stringify([gateway,gateway]),'{'])
  assert.throws(()=>localWebEnvironment(environment,payload,manifest));
 for(const badManifest of [undefined,{...manifest,purpose:'real-gps'},{...manifest,gatewayId:randomUUID()}])
  assert.throws(()=>localWebEnvironment(environment,JSON.stringify([gateway]),badManifest));
});

test('fresh GPS verification needs decoded, delivered, saved and public source evidence',()=>{
 const good={decoded:2,delivered:2,reservations:2,appPositions:2,capacityAgeSeconds:30,
  capacitySource:'TELEMATICS',capacityDemo:true,publicFound:true,apiAgeSeconds:35,apiSource:'TELEMATICS',apiDemo:true};
 assert.equal(assessDemoGpsPipeline(good,180),true);
 for(const patch of [{delivered:0},{reservations:0},{appPositions:0},{capacityAgeSeconds:181},
  {capacitySource:'DEVICE_OBSCURED'},{capacityDemo:false},{publicFound:false},{apiAgeSeconds:181},
  {apiSource:'MANUAL'},{apiDemo:false}])assert.equal(assessDemoGpsPipeline({...good,...patch},180),false);
});
