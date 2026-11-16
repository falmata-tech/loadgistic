import {createServer} from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DEMO_MOTION_COHORT} from '../../src/lib/demo-motion-cohort.js';
import {DEMO_ADMIN_SPARE} from '../../src/lib/demo-admin-spare.js';

const fictional=new Set([...Object.values(DEMO_MOTION_COHORT).map(row=>row.imei),DEMO_ADMIN_SPARE.imei]);
const identifier=/^[A-Za-z0-9_-]{5,40}$/;
const upstreams={real:'http://traccar:8082/api/',synthetic:'http://synthetic-traccar:8082/api/'};
const attributes=['loadgistic.imei','loadgistic.protocol','loadgistic.synthetic'];
const digest=value=>createHash('sha256').update(value).digest();
const positive=value=>Number.isSafeInteger(value)&&value>0;
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)
 &&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const safeText=(value,min,max)=>typeof value==='string'&&value.length>=min&&value.length<=max
 &&value.trim()===value&&!/[\u0000-\u001f\u007f]/.test(value);
const refused=(status,code)=>Object.assign(Error(code),{status,code});

/** Envelope decoding locates a self-read; only Traccar authenticates the token. */
export function claimedTraccarUser(token,now=Date.now()){
 try{
  if(!/^[A-Za-z0-9_-]{80,4096}$/.test(token))throw Error();
  const bytes=Buffer.from(token,'base64url'),length=bytes[0];
  if(length<64||length>80||bytes.length<=length+1)throw Error();
  const value=JSON.parse(bytes.subarray(length+1).toString('utf8'));
  const expiry=typeof value.e==='number'?value.e:Date.parse(value.e);
  if(!exactKeys(value,['i','u','e'])||!positive(value.u)||!Number.isFinite(expiry)||expiry<=now)throw Error();
  return value.u;
 }catch{throw Error('ENROLLMENT_RELAY_CONFIG_INVALID');}
}

function configuration(value){
 if(!value||!Object.hasOwn(upstreams,value.scope)||!/^[a-f0-9]{64}$/.test(value.relayToken||'')
  ||value.relayToken===value.traccarToken)throw Error('ENROLLMENT_RELAY_CONFIG_INVALID');
 return {scope:value.scope,relayTokenDigest:digest(value.relayToken),traccarToken:value.traccarToken,
  userId:claimedTraccarUser(value.traccarToken),upstream:upstreams[value.scope]};
}

function scopeIdentity(config,uniqueId,imei){
 if(typeof uniqueId!=='string'||typeof imei!=='string'||!identifier.test(uniqueId)||!/^[0-9]{15}$/.test(imei)||/^0+$/.test(imei))return false;
 return config.scope==='synthetic'?uniqueId===imei&&fictional.has(imei):!fictional.has(uniqueId)&&!fictional.has(imei);
}

function creation(config,value){
 if(!exactKeys(value,['name','uniqueId','model','attributes'])||!safeText(value.name,2,100)
  ||!safeText(value.model,2,80)||!exactKeys(value.attributes,attributes)
  ||value.attributes['loadgistic.protocol']!=='gt06'
  ||value.attributes['loadgistic.synthetic']!==(config.scope==='synthetic')
  ||!scopeIdentity(config,value.uniqueId,value.attributes['loadgistic.imei']))throw refused(400,'ENROLLMENT_RELAY_INPUT_DENIED');
 if(config.scope==='synthetic'&&(value.uniqueId!==DEMO_ADMIN_SPARE.imei
  ||value.name!==DEMO_ADMIN_SPARE.label||value.model!==DEMO_ADMIN_SPARE.model))throw refused(403,'ENROLLMENT_RELAY_SCOPE_DENIED');
 return {name:value.name,uniqueId:value.uniqueId,model:value.model,attributes:{
  'loadgistic.imei':value.attributes['loadgistic.imei'],'loadgistic.protocol':'gt06',
  'loadgistic.synthetic':config.scope==='synthetic'}};
}

function binding(config,value){
 if(!positive(value?.id)||!safeText(value.name,2,100)||!safeText(value.model,2,80)
  ||typeof value.disabled!=='boolean'||value.attributes?.['loadgistic.protocol']!=='gt06'
  ||value.attributes?.['loadgistic.synthetic']!==(config.scope==='synthetic')
  ||!scopeIdentity(config,value.uniqueId,value.attributes?.['loadgistic.imei']))throw refused(409,'ENROLLMENT_RELAY_BINDING_DENIED');
 return {id:value.id,name:value.name,uniqueId:value.uniqueId,model:value.model,disabled:value.disabled,
  attributes:Object.fromEntries(attributes.map(key=>[key,value.attributes[key]]))};
}

async function upstreamJSON(response){
 if(!response.body||Number(response.headers.get('content-length')||0)>16384
  ||response.headers.get('content-type')?.split(';')[0]!=='application/json')throw refused(502,'ENROLLMENT_RELAY_UPSTREAM_UNAVAILABLE');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
  if(size>16384){await reader.cancel();throw Error();}chunks.push(part.value);}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
 }catch{throw refused(502,'ENROLLMENT_RELAY_UPSTREAM_UNAVAILABLE');}
 finally{reader.releaseLock();}
}

function canonicalRoute(request,config){
 const raw=request.url||'',method=request.method;
 if(request.headers.cookie||request.headers.upgrade||request.headers['x-http-method-override']
  ||request.headers['x-method-override']||request.headers['transfer-encoding'])throw refused(400,'ENROLLMENT_RELAY_INPUT_DENIED');
 let match;
 if(method==='GET'&&(match=/^\/api\/devices\?uniqueId=([A-Za-z0-9_-]{5,40})$/.exec(raw))){
  if(config.scope==='synthetic'&&!fictional.has(match[1])||config.scope==='real'&&fictional.has(match[1]))throw refused(403,'ENROLLMENT_RELAY_SCOPE_DENIED');
  return {kind:'lookup',path:`devices?uniqueId=${match[1]}`,identifier:match[1]};
 }
 if(method==='GET'&&(match=/^\/api\/devices\/([1-9][0-9]{0,15})$/.exec(raw))&&positive(Number(match[1])))
  return {kind:'read',path:`devices/${match[1]}`,id:Number(match[1])};
 if(method==='POST'&&raw==='/api/devices')return {kind:'create',path:'devices'};
 throw refused(404,'ENROLLMENT_RELAY_ROUTE_DENIED');
}

function respond(response,status,value){
 response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',Connection:'close'});
 response.end(JSON.stringify(value));
}

/** Three operations only. No client header or upstream cookie is forwarded. */
export function createEnrollmentRelay(value,{fetchImpl=fetch,now=Date.now,deadlineMs=3500}={}){
 const config=configuration(value);
 if(!Number.isInteger(deadlineMs)||deadlineMs<1||deadlineMs>3500)throw Error('ENROLLMENT_RELAY_CONFIG_INVALID');
 let inflight=0,windowAt=now(),requests=0;
 return async function enrollmentRelay(request,response){
  if(now()-windowAt>=60000){windowAt=now();requests=0;}
  if(inflight>=4){respond(response,429,{code:'ENROLLMENT_RELAY_BUSY'});return;}
  inflight++;const controller=new AbortController();
  const timer=setTimeout(()=>{controller.abort();if(!request.complete)request.destroy();},deadlineMs);
  const abort=()=>controller.abort();request.once('aborted',abort);
  response.once('close',()=>{if(!response.writableEnded)controller.abort();});
  try{
   const authorization=request.headers.authorization||'';
   const supplied=authorization.startsWith('Bearer ')?authorization.slice(7):'';
   const authCount=request.rawHeaders.filter((_,index)=>index%2===0&&request.rawHeaders[index].toLowerCase()==='authorization').length;
   const matched=timingSafeEqual(digest(supplied),config.relayTokenDigest);
   if(authCount!==1||!/^[a-f0-9]{64}$/.test(supplied)||!matched)throw refused(401,'ENROLLMENT_RELAY_UNAUTHORIZED');
   if(++requests>60)throw refused(429,'ENROLLMENT_RELAY_BUSY');
   const route=canonicalRoute(request,config),length=request.headers['content-length'];let body;
   if(route.kind==='create'){
    if(request.headers['content-type']!=='application/json'||!/^([1-9][0-9]{0,3})$/.test(length||'')||Number(length)>4096)
     throw refused(400,'ENROLLMENT_RELAY_INPUT_DENIED');
    const chunks=[];let size=0;
    for await(const chunk of request){size+=chunk.length;if(size>4096)throw refused(413,'ENROLLMENT_RELAY_INPUT_DENIED');chunks.push(chunk);}
    if(size!==Number(length))throw refused(400,'ENROLLMENT_RELAY_INPUT_DENIED');
    let parsed;try{
     const raw=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));parsed=JSON.parse(raw);
     // The existing app sends JSON.stringify. Canonical bytes reject duplicate
     // keys/extra JSON instead of allowing two interpretations at this boundary.
     if(JSON.stringify(parsed)!==raw)throw Error();
    }
    catch{throw refused(400,'ENROLLMENT_RELAY_INPUT_DENIED');}
    body=creation(config,parsed);
   }else if(length!==undefined&&length!=='0')throw refused(400,'ENROLLMENT_RELAY_INPUT_DENIED');
   const call=async(relative,method='GET',payload)=>fetchImpl(new URL(relative,config.upstream),{
    method,headers:{Authorization:`Bearer ${config.traccarToken}`,Accept:'application/json',
     ...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{}),
    signal:controller.signal,redirect:'error',credentials:'omit',cache:'no-store'});
   // The ID came from an untrusted decoded envelope. This authenticated self-read
   // is what proves the signed token's exact current regular-user principal.
   const principalResponse=await call(`users/${config.userId}`);
   if(!principalResponse.ok)throw refused(503,'ENROLLMENT_RELAY_PRINCIPAL_DENIED');
   const principal=await upstreamJSON(principalResponse);
   if(principal.id!==config.userId||principal.administrator!==false||principal.disabled!==false
    ||principal.readonly!==false||principal.deviceReadonly!==false||principal.userLimit!==0
    ||principal.limitCommands!==true||principal.disableReports!==true||!positive(principal.deviceLimit))
    throw refused(503,'ENROLLMENT_RELAY_PRINCIPAL_DENIED');
   const upstream=await call(route.path,route.kind==='create'?'POST':'GET',body);
   if(!upstream.ok)throw refused([403,404,409].includes(upstream.status)?upstream.status:502,'ENROLLMENT_RELAY_UPSTREAM_UNAVAILABLE');
   const result=await upstreamJSON(upstream);let output;
   if(route.kind==='lookup'){
    if(!Array.isArray(result)||result.length>1)throw refused(409,'ENROLLMENT_RELAY_BINDING_DENIED');
    output=result.map(row=>binding(config,row));
    if(output.some(row=>row.uniqueId!==route.identifier))throw refused(409,'ENROLLMENT_RELAY_BINDING_DENIED');
   }else{
    output=binding(config,result);
    if(route.kind==='read'&&output.id!==route.id)throw refused(409,'ENROLLMENT_RELAY_BINDING_DENIED');
    if(body&&(output.name!==body.name||output.model!==body.model||output.uniqueId!==body.uniqueId
     ||attributes.some(key=>output.attributes[key]!==body.attributes[key])))throw refused(409,'ENROLLMENT_RELAY_BINDING_DENIED');
   }
   if(controller.signal.aborted)throw Error();
   respond(response,route.kind==='create'?201:200,output);
  }catch(error){
   if(!response.headersSent&&!response.destroyed){
    const code=typeof error?.code==='string'&&/^ENROLLMENT_RELAY_[A-Z_]+$/.test(error.code)?error.code:'ENROLLMENT_RELAY_UPSTREAM_UNAVAILABLE';
    respond(response,[400,401,403,404,409,413,429,502,503].includes(error?.status)?error.status:502,{code});
   }
  }finally{clearTimeout(timer);request.removeListener('aborted',abort);inflight--;}
 };
}

export function enrollmentRelayServer(config,options){
 const server=createServer({maxHeaderSize:8192},createEnrollmentRelay(config,options));
 server.requestTimeout=4000;server.headersTimeout=4000;server.keepAliveTimeout=1000;
 server.maxRequestsPerSocket=1;server.maxConnections=32;
 const refuse=(_request,socket)=>socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
 server.on('upgrade',refuse);server.on('connect',refuse);
 server.on('checkContinue',(_request,response)=>respond(response,417,{code:'ENROLLMENT_RELAY_INPUT_DENIED'}));
 server.on('clientError',(_error,socket)=>socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'));
 return server;
}

async function secretFile(file){
 if(!path.isAbsolute(file||''))throw Error();
 const info=await stat(file);
 if(!info.isFile()||info.size<1||info.size>4096||(info.mode&0o077)!==0||info.uid!==process.getuid())throw Error();
 return (await readFile(file,'utf8')).trim();
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const relayToken=await secretFile(process.env.ENROLLMENT_RELAY_TOKEN_FILE);
  const traccarToken=await secretFile(process.env.ENROLLMENT_RELAY_UPSTREAM_TOKEN_FILE);
  const config={scope:process.env.ENROLLMENT_RELAY_SCOPE,relayToken,traccarToken};
  const server=enrollmentRelayServer(config);
  server.on('error',()=>{console.log(JSON.stringify({event:'enrollment_relay_unavailable'}));process.exitCode=1;});
  server.listen(8080,'0.0.0.0',()=>console.log(JSON.stringify({event:'enrollment_relay_started',scope:config.scope})));
  const stop=()=>{server.close();server.closeAllConnections();};process.on('SIGTERM',stop);process.on('SIGINT',stop);
 }catch{console.log(JSON.stringify({event:'enrollment_relay_config_invalid'}));process.exitCode=1;}
}
