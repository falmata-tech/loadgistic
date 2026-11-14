import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {bridgeDatabaseConfiguration,createGatewayHealth,writeGatewayHealth,
 checkGatewayHealthFile,probeTraccarReadiness,observeGatewayApplication} from '../infra/telematics/gateway-health.mjs';
import {processPositionBatch} from '../infra/telematics/bridge-processing.mjs';

test('database deadlines cannot be disabled by a connection URI option',()=>{
 const config=bridgeDatabaseConfiguration('postgres://loadgistic_bridge:fixture@database:5432/traccar');
 assert.equal(config.connectionTimeoutMillis,5000);
 assert.equal(config.statement_timeout,5000);
 assert.equal(config.query_timeout,6000);
 assert.equal(config.lock_timeout,2000);
 for(const suffix of ['?statement_timeout=0','?options=-c%20statement_timeout%3D0','#private'])
  assert.throws(()=>bridgeDatabaseConfiguration(`postgres://loadgistic_bridge:fixture@database:5432/traccar${suffix}`),/GATEWAY_DATABASE_CONFIG_INVALID/);
});

test('fresh heartbeat is not ready before successful dependency checks, or after a failed cycle',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'loadgistic-gateway-health-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const file=path.join(directory,'health.json');let time=1790000000000;
 const health=createGatewayHealth({now:()=>time});
 assert.equal(await checkGatewayHealthFile({file,now:()=>time}),false);
 await writeGatewayHealth(health.snapshot(),{file});
 assert.equal(await checkGatewayHealthFile({file,now:()=>time}),false);
 health.checked({pending:2,lag_seconds:14});health.cycled();
 await writeGatewayHealth(health.snapshot(),{file});
 assert.equal(await checkGatewayHealthFile({file,now:()=>time}),true);
 assert.equal((await stat(file)).mode&0o777,0o600);
 assert.equal(JSON.parse(await readFile(file,'utf8')).lagSeconds,14);
 health.unavailable('secret database://credential@example.invalid');health.cycled();
 await writeGatewayHealth(health.snapshot(),{file});
 assert.equal(await checkGatewayHealthFile({file,now:()=>time}),false);
 assert.equal((await readFile(file,'utf8')).includes('credential'),false);
 assert.equal(health.snapshot().failureCode,'CYCLE_UNAVAILABLE');
 health.checked({pending:0,lag_seconds:0});health.cycled();
 await writeGatewayHealth(health.snapshot(),{file});
 assert.equal(await checkGatewayHealthFile({file,now:()=>time}),true);
 time+=90001;health.cycled();await writeGatewayHealth(health.snapshot(),{file});
 assert.equal(await checkGatewayHealthFile({file,now:()=>time}),false,'an active loop cannot conceal stale dependency checks');
});

test('Traccar readiness aborts a stalled transport within its bounded deadline',async()=>{
 const started=Date.now();let aborted=false;
 await assert.rejects(()=>probeTraccarReadiness('http://traccar:8082/api/server',{
  timeoutMs:25,fetchImpl:async(_url,init)=>new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>resolve({status:200}),2000);
   init.signal.addEventListener('abort',()=>{aborted=true;clearTimeout(timer);reject(init.signal.reason);},{once:true});
  })}),/TRACCAR_UNAVAILABLE/);
 assert.equal(aborted,true);assert.ok(Date.now()-started<1000);
});

test('malformed, future, oversized and unexpected heartbeat fields fail closed',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'loadgistic-gateway-health-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const file=path.join(directory,'health.json'),time=1790000000000;
 const health=createGatewayHealth({now:()=>time});health.checked({pending:0,lag_seconds:0});health.cycled();
 const good=health.snapshot();
 for(const value of ['{',JSON.stringify({...good,secret:'never-output'}),JSON.stringify({...good,writtenAt:time+6000}),
  JSON.stringify({...good,lagSeconds:-1}),JSON.stringify({...good,ready:'true'}),' '.repeat(4097)]){
  await writeFile(file,value,{mode:0o600});
  assert.equal(await checkGatewayHealthFile({file,now:()=>time}),false);
 }
 assert.throws(()=>health.checked({pending:Infinity,lag_seconds:0}),/GATEWAY_HEALTH_INVALID/);
});

test('fresh checks cannot conceal a stuck telemetry cycle or clear a newer concurrent failure',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'loadgistic-gateway-health-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const file=path.join(directory,'health.json');let time=1790000000000;
 const health=createGatewayHealth({now:()=>time});health.checked({pending:0,lag_seconds:0});health.cycled();
 time+=90001;health.checked({pending:0,lag_seconds:0});await writeGatewayHealth(health.snapshot(),{file});
 assert.equal(await checkGatewayHealthFile({file,now:()=>time}),false);
 const check=health.beginCheck();health.unavailable('INGEST_UNAVAILABLE');
 assert.equal(health.checked({pending:0,lag_seconds:0},check),false);
 assert.equal(health.snapshot().ready,false);
 assert.equal(health.checked({pending:0,lag_seconds:0},health.beginCheck()),true);
});

test('batch transport failure retains retries and unhealthy state until a newer full dependency check',async()=>{
 const health=createGatewayHealth(),settlements=[];
 health.checked({pending:1,lag_seconds:2});health.cycled();
 const payload={id:1,deviceId:1,protocol:'gt06',uniqueId:'990000000000001',valid:true,
  fixTime:'2026-11-13T12:00:00Z',serverTime:'2026-11-13T12:00:01Z',latitude:9.031,longitude:38.748,
  speed:0,course:0,attributes:{ignition:false}};
 await processPositionBatch([{id:1,payload}],()=>observeGatewayApplication(async()=>{
  throw Error('raw upstream error and credentials');},health),async result=>settlements.push(result));
 assert.equal(settlements[0].delivery,'RETRY');
 health.cycled();assert.equal(health.snapshot().ready,false);
 await observeGatewayApplication(async()=>[],health);health.cycled();
 assert.equal(health.snapshot().ready,false,'ordinary transport success is not a full dependency check');
 health.checked({pending:0,lag_seconds:0},health.beginCheck());assert.equal(health.snapshot().ready,true);
});

test('Traccar readiness accepts only the fixed private server endpoint and discards its body',async()=>{
 let request,cancelled=false;
 await probeTraccarReadiness('http://synthetic-traccar:8082/api/server',{fetchImpl:async(url,init)=>{
  request={url:String(url),init};
  return {status:200,body:{cancel:async()=>{cancelled=true;}}};
 }});
 assert.equal(request.url,'http://synthetic-traccar:8082/api/server');
 assert.equal(request.init.redirect,'error');
 assert.equal(request.init.headers.Authorization,undefined);
 assert.ok(request.init.signal instanceof AbortSignal);assert.equal(cancelled,true);
 for(const url of ['https://example.invalid/api/server','http://traccar:8082/api/devices',
  'http://user:password@traccar:8082/api/server','http://traccar:8082/api/server?token=private'])
  await assert.rejects(()=>probeTraccarReadiness(url,{fetchImpl:()=>assert.fail('must not fetch')}),/TRACCAR_READINESS_INVALID/);
 for(const url of ['http://traccar/api/server','http://traccar:8083/api/server','http://traccar:8082/api/server#private'])
  await assert.rejects(()=>probeTraccarReadiness(url,{fetchImpl:()=>assert.fail('must not fetch')}),/TRACCAR_READINESS_INVALID/);
 await assert.rejects(()=>probeTraccarReadiness('http://traccar:8082/api/server',{
  fetchImpl:async()=>{throw Error('raw secret response');}}),/TRACCAR_UNAVAILABLE/);
 await assert.rejects(()=>probeTraccarReadiness('http://traccar:8082/api/server',{
  fetchImpl:async()=>({status:503,body:{cancel:async()=>{}}})}),/TRACCAR_UNAVAILABLE/);
});
