import test from 'node:test';
import assert from 'node:assert/strict';
import {inspect} from 'node:util';
import {defaultLocalTestIP,isLocalTestURL,localRequestHeaders,localTestIP,scopeLocalRequest,scopeLocalRoute,stripForwardedFor} from './e2e/browser-test-headers.mjs';

test('test IP headers reach only exact local hosts and verified ports, for absolute and relative URLs',()=>{
 for(const origin of ['http://localhost:3100','http://127.0.0.1:8084','http://127.0.0.1:55321']){
  assert.equal(isLocalTestURL(origin+'/api/health'),true);
  assert.equal(isLocalTestURL('/api/health',origin),true);
  assert.equal(isLocalTestURL('../api/health',origin+'/app/'),true);
 }
 for(const url of ['https://tile.openstreetmap.org/0/0/0.png','https://loadgistic.com/api/health','http://localhost.evil:3100','http://127.0.0.2:3100','http://localhost:3101','http://localhost','file://localhost:3100/test','bad url'])assert.equal(isLocalTestURL(url),false);
 assert.equal(isLocalTestURL('//foreign.example/api','http://127.0.0.1:3100'),false);
 assert.equal(isLocalTestURL('/api/health','https://foreign.example'),false);
 assert.equal(isLocalTestURL('/api/health'),false);
});

test('header cleanup preserves all other headers and explicit context/request IPs without mutating inputs',()=>{
 const headers={'X-Forwarded-For':'127.0.0.249',Authorization:'Bearer synthetic',Origin:'http://localhost:3100'};
 assert.equal(localTestIP(),defaultLocalTestIP);assert.equal(localTestIP(headers),'127.0.0.249');
 assert.deepEqual(stripForwardedFor(headers),{Authorization:headers.Authorization,Origin:headers.Origin});
 assert.equal(localRequestHeaders('/api/health',{},localTestIP(headers),'http://localhost:3100')['x-forwarded-for'],'127.0.0.249');
 assert.equal(localRequestHeaders('/api/health',headers,'127.0.0.240','http://localhost:3100')['x-forwarded-for'],'127.0.0.249');
 assert.deepEqual(localRequestHeaders('https://tile.openstreetmap.org/0/0/0.png',headers),stripForwardedFor(headers));
 assert.equal(headers['X-Forwarded-For'],'127.0.0.249');
});

test('request proxy preserves receiver, body/options, cookie ownership and the browser IP for every HTTP method',async()=>{
 const calls=[],request={cookies:['synthetic-cookie'],storageState(){assert.equal(this,request);return this.cookies;}};
 for(const method of ['get','post','put','patch','delete','head','fetch'])request[method]=function(url,options){assert.equal(this,request);calls.push({method,url,options});return Promise.resolve({status:200});};
 let ip='127.0.0.247';const proxy=scopeLocalRequest(request,()=>ip,'http://127.0.0.1:3100');
 for(const method of ['get','post','put','patch','delete','head','fetch']){
  const options={data:{challenge:'synthetic'},headers:{Origin:'http://127.0.0.1:3100'},maxRedirects:0};
  await proxy[method]('/api/tracking/unlock',options);
  const call=calls.at(-1);assert.equal(call.options.headers['x-forwarded-for'],ip);assert.equal(call.options.data,options.data);assert.equal(call.options.maxRedirects,0);assert.deepEqual(options.headers,{Origin:'http://127.0.0.1:3100'});
 }
 ip='127.0.0.248';await proxy.post('/api/tracking/unlock');assert.equal(calls.at(-1).options.headers['x-forwarded-for'],ip);
 await proxy.get('https://tile.openstreetmap.org/0/0/0.png',{headers:{'x-forwarded-for':ip,Accept:'image/png'}});assert.deepEqual(calls.at(-1).options.headers,{Accept:'image/png'});
 const captured={url:()=> 'http://localhost:55321/storage/v1/object/synthetic'};
 await proxy.fetch(captured);assert.equal(calls.at(-1).url,captured);assert.equal(calls.at(-1).options.headers['x-forwarded-for'],ip);
 assert.equal(proxy.storageState(),request.cookies);
});

test('request transport failures reject once with only the wrapped method and a fixed reason',async()=>{
 const secrets=['SENTINEL_COOKIE_VALUE','SENTINEL_BEARER_TOKEN','sentinel-contact@example.test','SENTINEL_BODY_VALUE','SENTINEL_CAUSE_VALUE'];
 const url=`http://127.0.0.1:3100/api/private?token=${secrets[1]}`;
 for(const method of ['get','post','put','patch','delete','head','fetch']){
  const raw=new Error(`apiRequestContext.${method}: read ECONNRESET\nCall log:\nURL ${url}\nCookie ${secrets[0]}\nAuthorization Bearer ${secrets[1]}\nContact ${secrets[2]}\nBody ${secrets[3]}`,{cause:new Error(secrets[4])});
  raw.requestHeaders={cookie:secrets[0],authorization:secrets[1]};raw.requestBody=secrets[3];raw.stack+=`\n${secrets.join(' ')}`;
  let calls=0;const request={[method]:async function(actualURL,options){assert.equal(this,request);assert.equal(actualURL,url);assert.equal(options.headers.Cookie,secrets[0]);calls++;throw raw;}};
  const wrapped=scopeLocalRequest(request,()=>defaultLocalTestIP,'http://127.0.0.1:3100');
  const rejected=wrapped[method](url,{headers:{Cookie:secrets[0],Authorization:`Bearer ${secrets[1]}`},data:{contact:secrets[2],body:secrets[3]}});
  assert.equal(rejected instanceof Promise,true);
  await assert.rejects(rejected,error=>{
   assert.equal(error instanceof Error,true);assert.notEqual(error,raw);
   assert.equal(error.message,`BROWSER_API_REQUEST_${method.toUpperCase()}_FAILED_ECONNRESET`);
   assert.equal(error.cause,undefined);assert.deepEqual(Object.keys(error),[]);
   const exposed=inspect(error,{depth:6})+JSON.stringify(error)+error.stack;
   for(const secret of [...secrets,url,'Call log:','requestHeaders','requestBody'])assert.equal(exposed.includes(secret),false);
   return true;
  });
  assert.equal(calls,1);
 }
});

test('request failure classification accepts only fixed codes, names and the diagnostic first line',async()=>{
 const cases=[
  ...['ECONNRESET','ECONNREFUSED','EPIPE','ENOTFOUND','EAI_AGAIN','ENETUNREACH','EHOSTUNREACH'].map(code=>({error:Object.assign(new Error('opaque'),{code}),reason:code})),
  {error:Object.assign(new Error('opaque'),{code:'ETIMEDOUT'}),reason:'TIMEOUT'},
  {error:Object.assign(new Error('opaque'),{name:'TimeoutError'}),reason:'TIMEOUT'},
  {error:Object.assign(new Error('opaque'),{name:'AbortError'}),reason:'ABORTED'},
  {error:Object.assign(new Error('opaque'),{code:'ABORT_ERR'}),reason:'ABORTED'},
  {error:new Error('apiRequestContext.post: connect ECONNREFUSED\nCookie: SENTINEL_COOKIE_VALUE'),reason:'ECONNREFUSED'},
  {error:new Error('apiRequestContext.post: Timeout 30000ms exceeded.\nAuthorization: SENTINEL_BEARER_TOKEN'),reason:'TIMEOUT'},
  {error:new Error('unknown failure\nCookie: ECONNRESET'),reason:'UNKNOWN'},
  {error:Object.assign(new Error('opaque'),{code:'ECONNRESET SENTINEL_COOKIE_VALUE',name:'TimeoutError SENTINEL_BEARER_TOKEN'}),reason:'UNKNOWN'},
  {error:new Error('SENTINEL_CONTACT@example.test',{cause:Object.assign(new Error('private cause'),{code:'ECONNRESET'})}),reason:'UNKNOWN'},
  {error:'SENTINEL_THROWN_VALUE',reason:'UNKNOWN'},
  {error:undefined,reason:'UNKNOWN'},
  {error:Object.defineProperty({},'message',{get(){throw new Error('SENTINEL_GETTER_VALUE');}}),reason:'UNKNOWN'}
 ];
 for(const {error,reason} of cases){
  let calls=0;const request={post(){calls++;throw error;}};
  const wrapped=scopeLocalRequest(request,()=>defaultLocalTestIP,'http://127.0.0.1:3100');
  await assert.rejects(wrapped.post('/api/private'),{message:`BROWSER_API_REQUEST_POST_FAILED_${reason}`});
  assert.equal(calls,1);
 }
});

test('request proxy returns the original HTTP response even for denied or unsuccessful responses',async()=>{
 for(const status of [200,403,503]){
  const response={status:()=>status,ok:()=>status===200,body:()=>Buffer.from('synthetic response')};
  let calls=0;const request={fetch:async()=>{calls++;return response;}};
  const wrapped=scopeLocalRequest(request,()=>defaultLocalTestIP,'http://127.0.0.1:3100');
  assert.equal(await wrapped.fetch('/api/private',{method:'POST'}),response);assert.equal(calls,1);
 }
});

test('route adapter preserves receivers, cookies, mocks and options while applying the current IP to the effective URL',()=>{
 const calls=[],request={url:()=> 'http://127.0.0.1:3100/api/tracking/unlock',headers:()=>({cookie:'synthetic-cookie',Origin:'http://127.0.0.1:3100','x-forwarded-for':'127.0.0.241'})};
 const route={request(){assert.equal(this,route);return request;},fulfill(options){assert.equal(this,route);return options;}};
 for(const method of ['continue','fetch','fallback'])route[method]=function(options){assert.equal(this,route);calls.push({method,options});return method;};
 let ip='127.0.0.247';const wrapped=scopeLocalRoute(route,()=>ip,'http://127.0.0.1:3100');
 for(const method of ['continue','fetch','fallback']){
  const options={method:'POST',postData:Buffer.from('synthetic'),timeout:1200,maxRedirects:0};
  assert.equal(wrapped[method](options),method);
  const call=calls.at(-1);assert.equal(call.options.postData,options.postData);assert.equal(call.options.timeout,1200);assert.equal(call.options.maxRedirects,0);
  assert.deepEqual(call.options.headers,{cookie:'synthetic-cookie',Origin:'http://127.0.0.1:3100','x-forwarded-for':ip});assert.equal(options.headers,undefined);
 }
 ip='127.0.0.248';wrapped.fetch({url:'http://localhost:8084/api/health'});assert.equal(calls.at(-1).options.headers['x-forwarded-for'],ip);
 wrapped.fetch({url:'https://tile.openstreetmap.org/0/0/0.png'});assert.equal('x-forwarded-for' in calls.at(-1).options.headers,false);
 wrapped.continue({url:'//foreign.example/api',headers:{Accept:'image/png','X-Forwarded-For':ip}});assert.deepEqual(calls.at(-1).options.headers,{Accept:'image/png'});
 wrapped.fallback({url:'/api/health',headers:{'x-forwarded-for':'127.0.0.249'}});assert.equal(calls.at(-1).options.headers['x-forwarded-for'],'127.0.0.249');
 const mock={status:503,json:{error:'synthetic'}};assert.equal(wrapped.fulfill(mock),mock);assert.equal(wrapped.request(),request);
});
