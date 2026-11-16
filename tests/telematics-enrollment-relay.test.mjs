import test from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {chmod,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {enrollmentRelayServer,claimedTraccarUser} from '../infra/telematics/enrollment-relay.mjs';
import {registerPhysicalGatewayDevice,registerAdminSpareGatewayDevice} from '../src/lib/telematics-gateway-registration.js';
import {DEMO_ADMIN_SPARE} from '../src/lib/demo-admin-spare.js';

const relayToken='a'.repeat(64);
const token=(user=7)=>Buffer.concat([Buffer.from([70]),Buffer.alloc(70),Buffer.from(JSON.stringify({i:1,u:user,e:'2099-01-01T00:00:00Z'}))]).toString('base64url');
const traccarToken=token();
const principal={id:7,administrator:false,disabled:false,readonly:false,deviceReadonly:false,
 userLimit:0,deviceLimit:50,limitCommands:true,disableReports:true,email:'private@example.invalid',attributes:{private:'never-return'}};
const physical={name:'Provider tracker',uniqueId:'353456789012345',model:'GT06 hardware',
 attributes:{'loadgistic.imei':'353456789012345','loadgistic.protocol':'gt06','loadgistic.synthetic':false}};
const device=(body=physical,id=41)=>({...body,id,disabled:false,positionId:77,phone:'private-contact',attributes:{...body.attributes,private:'never-return'}});
const upstream=(operations=[],getDevice=()=>device())=>async(url,init)=>{
 const target=new URL(url);operations.push({url:target,init});
 assert.equal(target.origin,'http://traccar:8082');
 assert.equal(init.headers.Authorization,`Bearer ${traccarToken}`);
 assert.equal(init.headers.Cookie,undefined);assert.equal(init.headers['x-forwarded-host'],undefined);
 assert.equal(init.redirect,'error');
 if(target.pathname==='/api/users/7')return Response.json(principal);
 if(target.pathname==='/api/devices'&&init.method==='GET')return Response.json(getDevice()?[getDevice()]:[]);
 if(target.pathname==='/api/devices'&&init.method==='POST')return Response.json(device(JSON.parse(init.body)),{status:201});
 if(target.pathname==='/api/devices/41')return Response.json(getDevice(),{headers:{'Set-Cookie':'private-session=never-forward','Location':'http://private.invalid/'}});
 throw Error('unexpected private request');
};

async function serve(t,fetchImpl,options={}){
 const server=enrollmentRelayServer({scope:options.scope||'real',relayToken,traccarToken},
  {fetchImpl,...(options.deadlineMs?{deadlineMs:options.deadlineMs}:{})});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 return {server,origin:`http://127.0.0.1:${server.address().port}`};
}
async function call(origin,path,method='GET',body,headers={}){
 return fetch(`${origin}${path}`,{method,headers:{Authorization:`Bearer ${relayToken}`,
  ...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},
  ...(body!==undefined?{body:JSON.stringify(body)}:{})});
}

test('only lookup/create/single-read cross the relay; private account/device fields never return',async t=>{
 const operations=[],{origin}=await serve(t,upstream(operations));
 for(const [path,method,body] of [['/api/devices?uniqueId=353456789012345','GET'],['/api/devices/41','GET'],['/api/devices','POST',physical]]){
  const response=await call(origin,path,method,body);
  assert.equal(response.status,method==='POST'?201:200);
  const result=await response.json(),row=Array.isArray(result)?result[0]:result;
  assert.deepEqual(Object.keys(row).sort(),['attributes','disabled','id','model','name','uniqueId']);
  assert.deepEqual(Object.keys(row.attributes).sort(),['loadgistic.imei','loadgistic.protocol','loadgistic.synthetic']);
  assert.equal(JSON.stringify(result).includes('private'),false);
  assert.equal(response.headers.get('set-cookie'),null);
  assert.equal(response.headers.get('location'),null);
 }
 assert.equal(operations.length,6);
 assert.equal(claimedTraccarUser(traccarToken),7);
});

test('in-flight bound refuses excess work before another upstream request',async t=>{
 let release,started=0,allStarted;
 const gate=new Promise(resolve=>{release=resolve;}),ready=new Promise(resolve=>{allStarted=resolve;});
 const {origin}=await serve(t,async(url)=>{
  if(new URL(url).pathname==='/api/users/7'){
   if(++started===4)allStarted();await gate;return Response.json(principal);
  }
  return Response.json(device());
 });
 const pending=Promise.all(Array.from({length:4},()=>call(origin,'/api/devices/41')));
 await ready;
 assert.equal((await call(origin,'/api/devices/41')).status,429);assert.equal(started,4);
 release();assert.ok((await pending).every(response=>response.status===200));
});

test('unauthorized/general proxy/path/query/body/override requests never call Traccar',async t=>{
 let calls=0;const {origin}=await serve(t,async()=>{calls++;throw Error('must not call');});
 assert.equal((await call(origin,'/api/devices/41','GET',undefined,{Authorization:'Bearer wrong'})).status,401);
 const paths=['/api/devices','/api/devices/0','/api/devices/01','/api/devices/9007199254740992',
  '/api/devices/41?x=1','/api/devices?uniqueId=353456789012345&all=true','/api/devices?uniqueId=353456789012345&uniqueId=other',
  '/api/devices?uniqueId=%33%35%33','/api/%64evices/41','/api/commands/send','/api/positions','/api/users/7','/api/permissions','/api/session','/api/reports/route'];
 for(const path of paths)assert.ok((await call(origin,path)).status>=400,path);
 for(const method of ['PUT','PATCH','DELETE','OPTIONS','HEAD'])
  assert.ok((await call(origin,'/api/devices/41',method)).status>=400,method);
 assert.equal((await call(origin,'/api/devices/41','GET',undefined,{Cookie:'session=private'})).status,400);
 assert.equal((await call(origin,'/api/devices/41','GET',undefined,{'X-HTTP-Method-Override':'DELETE'})).status,400);
 for(const body of [{...physical,id:99},{...physical,attributes:{...physical.attributes,command:'engineStop'}},
  {...physical,attributes:{...physical.attributes,'loadgistic.synthetic':true}},
  {...physical,uniqueId:353456789012345},{...physical,attributes:{...physical.attributes,'loadgistic.imei':353456789012345}},
  ...[null,[],{}].flatMap(value=>[{...physical,uniqueId:value},{...physical,attributes:{...physical.attributes,'loadgistic.imei':value}}]),
  {...physical,attributes:{...physical.attributes,'loadgistic.protocol':'teltonika'}},
  {...physical,name:'x'.repeat(4100)}])assert.ok((await call(origin,'/api/devices','POST',body)).status>=400);
 assert.equal(calls,0);
});

test('unauthenticated traffic cannot consume the authenticated enrollment rate budget',async t=>{
 let calls=0;const {origin}=await serve(t,upstream([],()=>{calls++;return device();}));
 for(let index=0;index<65;index++)assert.equal((await call(origin,'/api/devices/41','GET',undefined,{Authorization:'Bearer invalid'})).status,401);
 assert.equal((await call(origin,'/api/devices/41')).status,200);
 assert.equal(calls,1);
 for(let index=1;index<60;index++)assert.equal((await call(origin,'/api/devices/41')).status,200);
 assert.equal((await call(origin,'/api/devices/41')).status,429);
 assert.equal(calls,60);
});

test('admin/manager/changed principal and cross-scope upstream bindings fail closed',async t=>{
 let user=principal,row=device(),writes=0;
 const {origin}=await serve(t,async(url,init)=>{
  if(new URL(url).pathname==='/api/users/7')return Response.json(user);
  if(init.method==='POST')writes++;
  return Response.json(row);
 });
 for(const patch of [{administrator:true},{userLimit:1},{disabled:true},{id:8},{readonly:true},
  {deviceReadonly:true},{limitCommands:false},{disableReports:false},{deviceLimit:-1}]){
  user={...principal,...patch};assert.equal((await call(origin,'/api/devices/41')).status,503);
 }
 user=principal;row=device({...physical,attributes:{...physical.attributes,'loadgistic.synthetic':true}});
 assert.equal((await call(origin,'/api/devices/41')).status,409);
 assert.equal((await call(origin,'/api/devices?uniqueId=990000000000001')).status,403);
 assert.equal(writes,0);
 assert.throws(()=>claimedTraccarUser('not-a-traccar-user-token'),/ENROLLMENT_RELAY_CONFIG_INVALID/);
});

test('synthetic relay creates only the immutable spare and accepts only exact fictional reads',async t=>{
 let creates=0;
 const {origin}=await serve(t,async(url,init)=>{
  assert.equal(new URL(url).hostname,'synthetic-traccar');
  if(new URL(url).pathname==='/api/users/7')return Response.json(principal);
  if(init.method==='POST'){creates++;return Response.json(device(JSON.parse(init.body)),{status:201});}
  return Response.json([]);
 },{scope:'synthetic'});
 const spare={name:DEMO_ADMIN_SPARE.label,uniqueId:DEMO_ADMIN_SPARE.imei,model:DEMO_ADMIN_SPARE.model,
  attributes:{'loadgistic.imei':DEMO_ADMIN_SPARE.imei,'loadgistic.protocol':'gt06','loadgistic.synthetic':true}};
 assert.equal((await call(origin,'/api/devices','POST',spare)).status,201);
 assert.equal((await call(origin,'/api/devices?uniqueId=353456789012345')).status,403);
 assert.equal((await call(origin,'/api/devices?uniqueId=990000000000099')).status,403);
 assert.equal((await call(origin,'/api/devices','POST',{...spare,name:'changed'})).status,403);
 assert.equal(creates,1);
});

test('real registration client preserves exact retry, ambiguous-write reconciliation and pending/conflict outcomes',async t=>{
 let saved=null,posts=0,ambiguous=true,unverifiable=false;
 const {origin}=await serve(t,async(url,init)=>{
  const target=new URL(url);
  if(target.pathname==='/api/users/7')return Response.json(principal);
  if(target.pathname==='/api/devices'&&init.method==='GET')return Response.json(saved?[saved]:[]);
  if(init.method==='POST'){
   posts++;saved=device(JSON.parse(init.body));
   if(ambiguous){ambiguous=false;throw Error('private timeout after write');}
   return Response.json(saved,{status:201});
  }
  return unverifiable?new Response('',{status:503}):Response.json(saved);
 });
 const config={id:randomUUID(),secret:'c'.repeat(64),apiUrl:`${origin}/api/`,apiToken:relayToken};
 const command={gatewayId:config.id,label:physical.name,protocolDeviceId:physical.uniqueId,
  imei:physical.attributes['loadgistic.imei'],protocol:'gt06',synthetic:false,model:physical.model};
 assert.equal(await registerPhysicalGatewayDevice(command,[config]),41);
 assert.equal(await registerPhysicalGatewayDevice(command,[config]),41);assert.equal(posts,1);
 unverifiable=true;await assert.rejects(()=>registerPhysicalGatewayDevice(command,[config]),/GATEWAY_REGISTRATION_PENDING_LINK/);
 unverifiable=false;saved={...saved,name:'different binding'};
 await assert.rejects(()=>registerPhysicalGatewayDevice(command,[config]),/DEVICE_BINDING_CONFLICT/);
 assert.equal(posts,1);
});

test('existing synthetic spare registration crosses the scoped relay and reuses exact binding',async t=>{
 let saved=null,posts=0;
 const {origin}=await serve(t,async(url,init)=>{
  const target=new URL(url);
  if(target.pathname==='/api/users/7')return Response.json(principal);
  if(init.method==='POST'){posts++;saved=device(JSON.parse(init.body));return Response.json(saved,{status:201});}
  return Response.json(target.pathname==='/api/devices'?(saved?[saved]:[]):saved);
 },{scope:'synthetic'});
 const config={id:randomUUID(),secret:'c'.repeat(64),apiUrl:`${origin}/api/`,apiToken:relayToken};
 assert.equal(await registerAdminSpareGatewayDevice(config.id,[config]),41);
 assert.equal(await registerAdminSpareGatewayDevice(config.id,[config]),41);assert.equal(posts,1);
});

test('bounded upstream body, redirection/error and stalled transport return only sanitized failure',async t=>{
 let mode='oversized';
 const {origin}=await serve(t,async(url,init)=>{
  if(new URL(url).pathname==='/api/users/7')return Response.json(principal);
  if(mode==='oversized')return new Response('private'.repeat(3000),{headers:{'Content-Type':'application/json'}});
  if(mode==='error')throw Error('secret upstream auth private@example.invalid');
  if(mode==='redirect')return new Response(null,{status:302,headers:{Location:'http://private.invalid/?secret=never-forward'}});
  if(mode==='malformed')return new Response('{private',{headers:{'Content-Type':'application/json'}});
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>resolve(Response.json(device())),2000);
   init.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(init.signal.reason);},{once:true});
  });
 },{deadlineMs:50});
 for(const value of ['oversized','error','redirect','malformed','stalled']){
  mode=value;const response=await call(origin,'/api/devices/41');assert.equal(response.status,502);
  const body=await response.text();assert.equal(body.includes('private'),false);assert.equal(body.includes('secret'),false);
 }
});

test('raw encoded traversal, duplicate auth and upgrade attempts never reach upstream',async t=>{
 let calls=0;const {origin}=await serve(t,async()=>{calls++;throw Error('must not call');});
 async function raw(path,headers){return new Promise((resolve,reject)=>{
  const request=httpRequest(origin,{path,headers},response=>{response.resume();response.on('end',()=>resolve(response.statusCode));});
  request.on('error',reject);request.end();
 });}
 assert.equal(await raw('/api/devices/../users/7',{Authorization:`Bearer ${relayToken}`}),404);
 assert.equal(await raw('/api/devices/41',{Authorization:[`Bearer ${relayToken}`,`Bearer ${relayToken}`]}),401);
 assert.equal(await raw('/api/devices/41',{Authorization:`Bearer ${relayToken}`,Connection:'upgrade',Upgrade:'websocket'}),403);
 assert.equal(calls,0);
});

test('command POSTs and duplicate JSON keys are refused without an upstream call',async t=>{
 let calls=0;const {origin}=await serve(t,async()=>{calls++;throw Error('must not call');});
 assert.equal((await call(origin,'/api/commands/send','POST',{deviceId:41,type:'engineStop'})).status,404);
 const duplicate=JSON.stringify(physical).replace('"name":','"name":"other","name":');
 const response=await fetch(`${origin}/api/devices`,{method:'POST',headers:{Authorization:`Bearer ${relayToken}`,'Content-Type':'application/json'},body:duplicate});
 assert.equal(response.status,400);assert.equal(calls,0);
});

test('CLI refuses broadly readable or missing credential files without starting or printing their contents',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'loadgistic-relay-credentials-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const relayFile=path.join(directory,'relay-token'),upstreamFile=path.join(directory,'upstream-token');
 await writeFile(relayFile,relayToken,{mode:0o644});await writeFile(upstreamFile,traccarToken,{mode:0o600});
 await chmod(relayFile,0o644);
 for(const file of [relayFile,path.join(directory,'missing')]){
  const result=spawnSync(process.execPath,['infra/telematics/enrollment-relay.mjs'],{
   cwd:new URL('..',import.meta.url),env:{ENROLLMENT_RELAY_SCOPE:'real',ENROLLMENT_RELAY_TOKEN_FILE:file,
    ENROLLMENT_RELAY_UPSTREAM_TOKEN_FILE:upstreamFile},encoding:'utf8',timeout:1000});
  assert.equal(result.status,1);
  assert.deepEqual(JSON.parse(result.stdout),{event:'enrollment_relay_config_invalid'});
  assert.equal(result.stderr,'');assert.equal(result.stdout.includes(relayToken),false);
 }
});
