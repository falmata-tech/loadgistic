import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import net from 'node:net';
import {EventEmitter} from 'node:events';
import {simulate,gt06Packet} from '../scripts/telematics/simulator.mjs';
import {localDemoMotionConfiguration,demoMotionSignature,authenticateDemoMotion,executeDemoMotion,demoMotionCommand} from '../src/lib/demo-motion-auth.js';
import {demoRouteFix,demoMotionClient,runDemoMotion} from '../scripts/telematics/demo-motion-runtime.mjs';
const secret='f'.repeat(64),url='http://127.0.0.1:3100/api/telematics/demo-motion';
const environment={NODE_ENV:'development',LOADGISTIC_DEMO_MOTION_ENABLED:'true',LOADGISTIC_DEMO_MOTION_SECRET:secret,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55321'};
test('demo adapter is opt-in and refuses production, customer databases and shared credentials',()=>{
 assert.deepEqual(localDemoMotionConfiguration(environment,url),{secret});
 for(const patch of [{NODE_ENV:'production'},{LOADGISTIC_DEMO_MOTION_ENABLED:'false'},{NEXT_PUBLIC_SUPABASE_URL:'https://customer.supabase.co'},
  {NEXT_PUBLIC_SUPABASE_URL:'http://localhost:54321'},{NEXT_PUBLIC_SUPABASE_URL:'http://user@127.0.0.1:55321'},
  {SUPABASE_SERVICE_ROLE_KEY:secret},{TELEMATICS_GATEWAYS_JSON:JSON.stringify([{secret}])},{TELEMATICS_PRIVACY_GATEWAYS_JSON:JSON.stringify([{secret}])}])
  assert.throws(()=>localDemoMotionConfiguration({...environment,...patch},url),/DEMO_REQUEST_DENIED/);
 for(const bad of ['https://loadgistic.com/api/telematics/demo-motion',url+'?target=customer',url.replace(':3100',':8084')])assert.throws(()=>localDemoMotionConfiguration(environment,bad));
});
test('HMAC binds exact body, timestamp and nonce, independently of gateway credentials',()=>{
 const now=Date.now(),issuedAt=new Date(now).toISOString(),nonce=randomUUID(),body='{"action":"STATUS","target":"company-truck"}';
 const headers=new Headers({'x-demo-issued-at':issuedAt,'x-demo-nonce':nonce,'x-demo-signature':demoMotionSignature(secret,body,issuedAt,nonce)});
 assert.deepEqual(authenticateDemoMotion(headers,body,{secret},now),{nonce});
 assert.throws(()=>authenticateDemoMotion(headers,body+' ',{secret},now));assert.throws(()=>authenticateDemoMotion(headers,body,{secret},now+30001));
 headers.set('x-demo-nonce',randomUUID());assert.throws(()=>authenticateDemoMotion(headers,body,{secret},now));
});
test('command port accepts only fixed target names and no actor, arbitrary RPC, source or radius override',async()=>{
 const calls=[],rpc=async(name,args)=>{calls.push({name,args});return true;};
 await executeDemoMotion({action:'START',target:'company-truck',seconds:60},rpc);
 assert.deepEqual(calls,[{name:'start_demo_motion',args:{target_vehicle_id:'caf1d0db-4d8e-4ce9-a879-6c7b6017de3a',requested_seconds:60,explicit_resume:false}}]);
 for(const input of [{action:'START',target:'customer',seconds:60},{action:'START',target:'company-truck',seconds:60,actorId:randomUUID()},
  {action:'PHONE',target:'personal-truck',leaseId:randomUUID(),epoch:2,latitude:9,longitude:38,precisionKm:1},
  {action:'MANUAL',target:'company-truck'},{action:'START',target:'company-truck',seconds:3601}])assert.equal(demoMotionCommand.safeParse(input).success,false);
});
test('runtime credential has no database API and refuses public destinations',async()=>{
 assert.throws(()=>demoMotionClient({url:'https://loadgistic.com/api/telematics/demo-motion',secret}));assert.throws(()=>demoMotionClient({url,secret,nodeEnv:'production'}));
 let sent;const request=demoMotionClient({url,secret,fetch:async(destination,options)=>{sent={destination,options};return Response.json({ok:true,data:{state:'OFF'}});}});
 assert.deepEqual(await request({action:'STATUS',target:'company-truck'}),{state:'OFF'});
 assert.equal(sent.options.redirect,'error');assert.equal(sent.options.credentials,'omit');assert.equal(sent.options.headers.Authorization,undefined);assert.ok(sent.options.headers['x-demo-signature']);
});
test('fictional route is bounded and moves at plausible speed without random cross-country jumps',()=>{
 for(const target of ['company-truck','personal-truck'])for(let seconds=0;seconds<2400;seconds+=5){
  const a=demoRouteFix(target,seconds),b=demoRouteFix(target,seconds+5),distance=Math.hypot((b.latitude-a.latitude)*111195,(b.longitude-a.longitude)*111195*Math.cos(a.latitude*Math.PI/180));
  assert.ok(distance<=28);assert.ok(a.latitude>9.02&&a.latitude<9.04&&a.longitude>38.74&&a.longitude<38.78);
 }
 assert.throws(()=>demoRouteFix('customer',0));assert.throws(()=>demoRouteFix('company-truck',-1));
});
test('phone takeover stops its reports and never changes source/radius or manual data',async()=>{
 const calls=[],leaseId=randomUUID(),states=[];let clock=0,reports=0;
 const request=async input=>{calls.push(input);if(input.action==='CONFIGURE')return {configured:true};if(input.action==='START')return {state:'RUNNING',source:'MOBILE',epoch:2,leaseId,expiresAt:new Date(60000).toISOString()};
  if(input.action==='PHONE'){if(++reports>1)throw Error('DEMO_REPORT_DENIED');return {recorded:true};}if(input.action==='STOP')return {state:'REAL',epoch:3};throw Error('UNEXPECTED_COMMAND');};
 const result=await runDemoMotion({request,simulate:()=>assert.fail('No GPS in phone target'),seconds:60,targets:['personal-truck'],now:()=>clock,
  sleep:async ms=>{clock+=ms;},onState:value=>states.push(structuredClone(value))});
 assert.equal(result.failed,true);assert.equal(reports,2);assert.equal(calls.filter(row=>row.action==='STOP').length,1);
 assert.equal(calls.some(row=>'source'in row||'precisionKm'in row||row.action==='MANUAL'),false);assert.equal(states.at(-1)[0].status,'PAUSED');
});
test('cleanup releases the first lease if the second target refuses to start',async()=>{
 const calls=[],leaseId=randomUUID();
 const request=async input=>{calls.push(input);if(input.action==='CONFIGURE')return {};if(input.action==='START'){
  if(input.target==='personal-truck')throw Error('DEMO_REAL_DEVICE_TAKEOVER');return {state:'RUNNING',source:'GPS',epoch:2,leaseId,expiresAt:new Date(Date.now()+60000).toISOString()};}return {};};
 await assert.rejects(()=>runDemoMotion({request,simulate:()=>assert.fail(),seconds:60}),/DEMO_REAL_DEVICE_TAKEOVER/);
 assert.deepEqual(calls.at(-1),{action:'STOP',target:'company-truck',leaseId,epoch:2});
});
test('an aborted runner emits no late phone report and still releases its own lease',async()=>{
 const controller=new AbortController(),calls=[];
 const request=async input=>{calls.push(input);if(input.action==='START')return {state:'RUNNING',source:'MOBILE',epoch:2,leaseId:randomUUID(),expiresAt:new Date(Date.now()+60000).toISOString()};return {};};
 await assert.rejects(()=>runDemoMotion({request,simulate:()=>assert.fail(),targets:['personal-truck'],signal:controller.signal,sleep:async()=>{controller.abort();throw Error('abort');}}),/abort/);
 assert.equal(calls.filter(row=>row.action==='PHONE').length,0);assert.equal(calls.at(-1).action,'STOP');
});
test('GPS stop closes its socket and discards a late reservation before packet emission',async()=>{
 const original=net.createConnection,controller=new AbortController(),writes=[];let release,reserving;
 const entered=new Promise(resolve=>{reserving=resolve;}),gate=new Promise(resolve=>{release=resolve;});
 class Socket extends EventEmitter{destroyed=false;writableEnded=false;write(bytes){writes.push(bytes);return true;}end(){this.writableEnded=true;queueMicrotask(()=>this.emit('close'));}destroy(error){this.destroyed=true;if(error)this.emit('error',error);this.emit('close');}}
 net.createConnection=()=>{const socket=new Socket();queueMicrotask(()=>{socket.emit('connect');socket.emit('data',gt06Packet(1));});return socket;};
 try{
  const pending=simulate({durationMs:10000,signal:controller.signal,beforeReport:async point=>{reserving();await gate;return point;}});
  await entered;controller.abort();const result=await pending;release();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(result.positions,0);assert.equal(writes.length,1);assert.equal(writes[0][3],1);
 }finally{release();net.createConnection=original;}
});
test('a phone response reaching the bounded deadline schedules no negative delay',async()=>{
 let clock=0,reports=0;const delays=[];
 const request=async input=>{
  if(input.action==='START')return {state:'RUNNING',source:'MOBILE',epoch:1,leaseId:randomUUID(),expiresAt:new Date(10000).toISOString()};
  if(input.action==='PHONE'){reports++;clock=10001;}return {};
 };
 const result=await runDemoMotion({request,simulate:()=>assert.fail(),seconds:10,targets:['personal-truck'],now:()=>clock,sleep:async milliseconds=>{assert.ok(milliseconds>=0);delays.push(milliseconds);clock+=milliseconds;}});
 assert.equal(reports,1);assert.deepEqual(delays,[1100]);assert.equal(result.failed,false);assert.equal(result.targets[0].status,'STOPPED');
});
test('GPS expiry during its final reservation ends normally without hiding an earlier denial',async()=>{
 let clock=0;
 const request=async input=>{if(input.action==='START')return {state:'RUNNING',source:'GPS',epoch:1,leaseId:randomUUID(),expiresAt:new Date(10000).toISOString()};if(input.action==='GPS'){clock=10001;throw Error('DEMO_REPORT_DENIED');}return {};};
 const result=await runDemoMotion({request,seconds:10,targets:['company-truck'],now:()=>clock,sleep:async ms=>{clock+=ms;},simulate:async options=>{assert.equal(await options.beforeReport(),null);}});
 assert.equal(result.failed,false);assert.equal(result.targets[0].status,'STOPPED');
});
