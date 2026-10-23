import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import net from 'node:net';
import {DEMO_MOTION_COHORT} from '../src/lib/demo-motion-cohort.js';
import {hostedDemoMotionSignature} from '../src/lib/demo-motion-hosted-signature.mjs';
import {crc16X25,gt06Packet} from '../scripts/telematics/simulator.mjs';
import {hostedRouteFix} from '../infra/telematics/hosted-motion-route.mjs';
import {assertHostedMotionWorkerEnvironment,hostedMotionClient,openPrivateGt06,
 runHostedMotionTarget,runHostedMotionCycle} from '../infra/telematics/hosted-motion-worker.mjs';

const origin='https://loadgistic.example',secret='a'.repeat(64);
const env={NODE_ENV:'production',LOADGISTIC_HOSTED_MOTION_WORKER_ENABLED:'true',
 LOADGISTIC_HOSTED_MOTION_WORKER_KILL_SWITCH:'false',
 LOADGISTIC_HOSTED_MOTION_SITE_ORIGIN:origin,LOADGISTIC_HOSTED_MOTION_SITE_ID:randomUUID(),
 LOADGISTIC_HOSTED_MOTION_SUPABASE_URL:'https://sample.supabase.co',
 HOSTED_DEMO_MOTION_SECRET:secret,SYNTHETIC_GT06_HOST:'synthetic-traccar',SYNTHETIC_GT06_PORT:'5023'};

test('worker is inert by default and enabled preflight rejects public or wrong destinations',()=>{
 const inert=spawnSync(process.execPath,['infra/telematics/hosted-motion-worker.mjs','--preflight'],
  {cwd:new URL('..',import.meta.url),env:{...process.env,NODE_ENV:'production'},encoding:'utf8'});
 assert.equal(inert.status,0,inert.stderr);
 assert.deepEqual(JSON.parse(inert.stdout),{event:'hosted_motion_preflight',enabled:false,deploymentAuthorized:false});
 assert.deepEqual(assertHostedMotionWorkerEnvironment({...env,LOADGISTIC_HOSTED_MOTION_WORKER_KILL_SWITCH:'true'}),{enabled:false});
 assert.equal(assertHostedMotionWorkerEnvironment(env).gpsHost,'synthetic-traccar');
 for(const patch of [{NODE_ENV:'development'},{SYNTHETIC_GT06_HOST:'127.0.0.1'},
  {SYNTHETIC_GT06_PORT:'15023'},{LOADGISTIC_HOSTED_MOTION_SITE_ORIGIN:'http://loadgistic.example'},
  {LOADGISTIC_HOSTED_MOTION_SITE_ORIGIN:'https://loadgistic.example/path'},
  {LOADGISTIC_HOSTED_MOTION_SUPABASE_URL:'https://other.example'},
  {HOSTED_DEMO_MOTION_SECRET:'bad'},{GATEWAY_SECRET:secret}])
  assert.throws(()=>assertHostedMotionWorkerEnvironment({...env,...patch}),/HOSTED_MOTION_CONFIG_DENIED/);
});

test('worker client binds exact signed command and rejects arbitrary actions before network',async()=>{
 const calls=[];const config=assertHostedMotionWorkerEnvironment(env);
 const client=hostedMotionClient(config,{now:()=>1790000000000,fetchImpl:async(url,init)=>{
  calls.push({url,init});return Response.json({ok:true,data:{state:'OFF'}});
 }});
 assert.deepEqual(await client({action:'STATUS',target:'company-truck'}),{state:'OFF'});
 const [{url,init}]=calls;
 assert.equal(url,origin+'/api/internal/demo-motion/command');
 assert.equal(init.redirect,'error');
 assert.equal(init.headers['x-demo-signature'],hostedDemoMotionSignature(secret,origin,init.body,
  init.headers['x-demo-issued-at'],init.headers['x-demo-nonce']));
 for(const command of [{action:'RESUME',target:'company-truck',seconds:60},
  {action:'STATUS',target:'customer'},
  {action:'STATUS',target:'company-truck',actorId:randomUUID()},
  {action:'PHONE',target:'company-truck',leaseId:randomUUID(),epoch:1,latitude:9,longitude:38}])
  await assert.rejects(client(command),/HOSTED_MOTION_(TARGET|COMMAND)_DENIED/);
 assert.equal(calls.length,1);
});

test('app timeout and kill responses are bounded without raw details or retry',async()=>{
 let attempts=0;const config=assertHostedMotionWorkerEnvironment(env);
 const unavailable=hostedMotionClient(config,{fetchImpl:async()=>{attempts++;throw Error('secret private@example.invalid');}});
 await assert.rejects(unavailable({action:'STATUS',target:'company-truck'}),/HOSTED_MOTION_TRANSPORT_UNAVAILABLE/);
 assert.equal(attempts,1);
 const killed=hostedMotionClient(config,{fetchImpl:async()=>Response.json({ok:false,code:'DEMO_HOSTED_DISABLED'},{status:503})});
 await assert.rejects(killed({action:'STATUS',target:'company-truck'}),/DEMO_HOSTED_DISABLED/);
});

test('private GT06 socket sends only exact fictional login and reserved position, rejecting commands',async()=>{
 class FakeSocket extends EventEmitter{
  destroyed=false;packets=[];
  write(packet,callback){this.packets.push(packet);
   if(packet[3]===1)queueMicrotask(()=>this.emit('data',gt06Packet(1)));
   callback?.();return true;}
  destroy(){if(!this.destroyed){this.destroyed=true;this.emit('close');}}
 }
 let address;const socket=new FakeSocket();
 const connection=openPrivateGt06(DEMO_MOTION_COHORT['company-truck'].imei,
  {connectFactory:options=>{address=options;queueMicrotask(()=>socket.emit('connect'));return socket;}});
 const gps=await connection;
 assert.deepEqual(address,{host:'synthetic-traccar',port:5023});
 await gps.sendFix({latitude:9.031,longitude:38.748,observedAt:'2026-10-22T12:00:00Z'});
 assert.deepEqual(socket.packets.map(packet=>packet[3]),[1,0x10]);
 socket.emit('data',gt06Packet(0x80));
 assert.equal(socket.destroyed,true);
 await assert.rejects(gps.sendFix({latitude:9.031,longitude:38.748,observedAt:'2026-10-22T12:01:00Z'}),
  /HOSTED_MOTION_STOPPED/);
 assert.throws(()=>openPrivateGt06('123456789012345'),/HOSTED_MOTION_TARGET_DENIED/);
});

test('private GT06 login times out without an ACK and closes its socket',async()=>{
 class SilentSocket extends EventEmitter{
  destroyed=false;write(){}destroy(){this.destroyed=true;this.emit('close');}
 }
 const socket=new SilentSocket();
 await assert.rejects(openPrivateGt06(DEMO_MOTION_COHORT['company-truck'].imei,
  {timeoutMs:1000,connectFactory:()=>{queueMicrotask(()=>socket.emit('connect'));return socket;}}),
 /HOSTED_MOTION_GPS_TIMEOUT/);
 assert.equal(socket.destroyed,true);
});

test('hosted worker makes an offline loopback GT06 login and reserved-position roundtrip',async t=>{
 const types=[],events=[];let acceptPosition;
 const position=new Promise(resolve=>{acceptPosition=resolve;});
 const server=net.createServer(socket=>{
  let pending=Buffer.alloc(0);
  socket.on('data',chunk=>{
   pending=Buffer.concat([pending,chunk]);
   while(pending.length>=5){
    const size=pending[2]+5;if(pending.length<size)break;
    const frame=pending.subarray(0,size);pending=pending.subarray(size);
    assert.deepEqual([...frame.subarray(0,2)],[0x78,0x78]);
    assert.equal(frame.readUInt16BE(size-4),crc16X25(frame.subarray(2,size-4)));
    types.push(frame[3]);
    if(frame[3]===1)socket.write(gt06Packet(1));
    if(frame[3]===0x10){events.push('packet');acceptPosition();}
   }
  });
 });
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});}
 catch(error){
  if(error.code==='EPERM'&&process.env.REQUIRE_GT06_LOOPBACK!=='true'){
   t.skip('local socket sandbox disallows loopback; run with REQUIRE_GT06_LOOPBACK=true outside sandbox');return;
  }
  throw error;
 }
 const port=server.address().port,leaseId=randomUUID();let clock=0;
 try{
  const client=async command=>{
   events.push(command.action);
   if(command.action==='STATUS')return {state:'OFF'};
   if(command.action==='START')return {state:'RUNNING',source:'GPS',leaseId,epoch:7,expiresAt:new Date(60000).toISOString()};
   if(command.action==='GPS')return {latitude:command.latitude,longitude:command.longitude,
    observedAt:new Date(2000).toISOString()};
   return {state:'OFF'};
  };
  const result=await runHostedMotionTarget('company-truck',{client,seconds:60,now:()=>clock,
   sleep:async ms=>{clock+=ms;if(ms>5000)await Promise.race([position,
    new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('LOOPBACK_PACKET_TIMEOUT')),5000);timer.unref();})]);},
   openGps:(imei,{signal})=>openPrivateGt06(imei,{signal,
    connectFactory:options=>{assert.deepEqual(options,{host:'synthetic-traccar',port:5023});
     return net.createConnection({host:'127.0.0.1',port});}})});
  assert.equal(result.status,'STOPPED');assert.equal(result.ticks,1);
  assert.deepEqual(types,[1,0x10]);
  assert.ok(events.indexOf('GPS')<events.indexOf('packet'));
  assert.ok(events.indexOf('packet')<events.indexOf('STOP'));
 }finally{server.close();}
});

test('one target reserves before GT06 send and stops only its returned generation',async()=>{
 const order=[],leaseId=randomUUID();let clock=0;
 const client=async command=>{
  order.push(command.action);
  if(command.action==='STATUS')return {state:'OFF'};
  if(command.action==='START')return {state:'RUNNING',source:'GPS',leaseId,epoch:4,expiresAt:new Date(60000).toISOString()};
  if(command.action==='GPS')return {latitude:command.latitude,longitude:command.longitude,observedAt:new Date(2000).toISOString()};
  if(command.action==='STOP'){assert.equal(command.leaseId,leaseId);assert.equal(command.epoch,4);return {state:'OFF'};}
  throw Error('unexpected');
 };
 const result=await runHostedMotionTarget('company-truck',{client,seconds:60,now:()=>clock,
  sleep:async ms=>{clock+=ms;},openGps:async()=>({sendFix:async()=>{order.push('PACKET');},close:()=>{order.push('CLOSE');}})});
 assert.deepEqual(result,{target:'company-truck',status:'STOPPED',ticks:1});
 assert.deepEqual(order,['STATUS','START','GPS','PACKET','CLOSE','STOP']);
});

test('REAL and live foreign lease pause without opening a GPS socket or starting',async()=>{
 let opened=0,commands=[];const openGps=async()=>{opened++;throw Error('MUST_NOT_OPEN');};
 for(const status of [{state:'REAL'},{state:'RUNNING',expiresAt:new Date(Date.now()+60000).toISOString()}]){
  commands=[];
  const result=await runHostedMotionTarget('company-truck',{client:async command=>{commands.push(command.action);return status;},openGps});
  assert.ok(['REAL','BUSY'].includes(result.status));assert.deepEqual(commands,['STATUS']);
 }
 assert.equal(opened,0);
});

test('changed source and kill between reservation and packet fail closed',async()=>{
 const leaseId=randomUUID();let packets=0,stops=0;
 const base=async command=>{
  if(command.action==='STATUS')return {state:'OFF'};
  if(command.action==='STOP'){stops++;return {state:'OFF'};}
  return {state:'RUNNING',source:'MOBILE',leaseId,epoch:2,expiresAt:new Date(Date.now()+60000).toISOString()};
 };
 const mismatch=await runHostedMotionTarget('company-truck',{client:base,seconds:60,
  openGps:async()=>({sendFix:async()=>{packets++;},close:()=>{}}),sleep:async()=>{}});
 assert.equal(mismatch.status,'PAUSED');assert.equal(mismatch.code,'HOSTED_MOTION_RESPONSE_DENIED');
 assert.equal(packets,0);assert.equal(stops,1);
 const controller=new AbortController();
 const killed=await runHostedMotionTarget('company-truck',{seconds:60,signal:controller.signal,
  client:async command=>{
   if(command.action==='STATUS')return {state:'OFF'};
   if(command.action==='START')return {state:'RUNNING',source:'GPS',leaseId,epoch:3,
    expiresAt:new Date(Date.now()+60000).toISOString()};
   if(command.action==='GPS'){controller.abort();return {latitude:9.031,longitude:38.748,
    observedAt:new Date().toISOString()};}
   return {state:'OFF'};
  },openGps:async()=>({sendFix:async()=>{packets++;},close:()=>{}}),sleep:async()=>{}});
 assert.equal(killed.status,'STOPPED');assert.equal(packets,0);
});

test('binding denial sends no packet, closes socket and does not pause another target',async()=>{
 let packets=0,closed=0;const leaseId=randomUUID();
 const client=async command=>{
  if(command.action==='STATUS')return {state:'OFF'};
  if(command.action==='START')return {state:'RUNNING',source:DEMO_MOTION_COHORT[command.target].source,
   leaseId,epoch:2,expiresAt:new Date(Date.now()+60000).toISOString()};
  if(command.action==='GPS')throw Error('DEMO_REPORT_DENIED');
  if(command.action==='PHONE')return {recorded:true,source:'MOBILE'};
  return {state:'OFF'};
 };
 const cycle=await runHostedMotionCycle({client,targets:['company-truck','personal-truck'],seconds:60,
  sleep:async()=>{},openGps:async()=>({sendFix:async()=>{packets++;},close:()=>{closed++;}})});
 assert.equal(cycle.results.find(row=>row.target==='company-truck').status,'PAUSED');
 assert.equal(cycle.results.find(row=>row.target==='personal-truck').status,'STOPPED');
 assert.equal(packets,0);assert.equal(closed,1);
});

test('kill denial aborts the remaining cohort and sends no later phone update',async()=>{
 let phones=0,closed=0;const leaseId=randomUUID();
 const client=async command=>{
  if(command.action==='STATUS')return {state:'OFF'};
  if(command.action==='START')return {state:'RUNNING',source:DEMO_MOTION_COHORT[command.target].source,
   leaseId,epoch:2,expiresAt:new Date(Date.now()+60000).toISOString()};
  if(command.action==='GPS')throw Error('DEMO_HOSTED_DISABLED');
  if(command.action==='PHONE'){phones++;return {recorded:true,source:'MOBILE'};}
  return {state:'OFF'};
 };
 const sleep=(ms,signal)=>ms===1500?new Promise((_,reject)=>{
  if(signal.aborted)reject(Error('aborted'));else signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});
 }):Promise.resolve();
 const cycle=await runHostedMotionCycle({client,targets:['company-truck','personal-truck'],seconds:60,sleep,
  openGps:async()=>({sendFix:async()=>{throw Error('MUST_NOT_SEND');},close:()=>{closed++;}})});
 assert.equal(cycle.killed,true);assert.equal(phones,0);assert.equal(closed,1);
});

test('route stays bounded and continuous across worker windows',()=>{
 const start=1790000000000;
 for(const target of Object.keys(DEMO_MOTION_COHORT)){
  const a=hostedRouteFix(target,start),b=hostedRouteFix(target,start+1000);
  const base=DEMO_MOTION_COHORT[target];
  for(const fix of [a,b]){
   assert.ok(fix.latitude>=base.latitude&&fix.latitude<=base.latitude+0.005);
   assert.ok(fix.longitude>=base.longitude&&fix.longitude<=base.longitude+0.008);
  }
  assert.ok(Math.hypot(a.latitude-b.latitude,a.longitude-b.longitude)<0.0001);
 }
});
