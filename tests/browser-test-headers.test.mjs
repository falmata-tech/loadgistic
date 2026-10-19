import test from 'node:test';
import assert from 'node:assert/strict';
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
