import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import http from 'node:http';
import {Readable,Writable,PassThrough} from 'node:stream';
import ts from 'typescript';
import {ApiError,readApiResponse} from '../src/api/response.ts';
import {cargoPhotoApiPathAllowed} from '../src/api/cargo-space-photo-path.ts';
import {businessApiPathAllowed,businessApiArrayResponse} from '../../../src/lib/mobile/business-api-path.js';

const require=createRequire(import.meta.url),proxy=require('../scripts/local-preview-proxy.cjs');
const workspace='16000000-0000-4000-8000-000000000001',shipment='16000000-0000-4000-8000-000000000002',event='16000000-0000-4000-8000-000000000003';
const record=`/api/business-workspaces/${workspace}/tracking/${shipment}`;
const requests=[
 {path:record+'/sharing'},
 {path:record+'/sharing',body:{action:'REVOKE_VIEWER',recipientId:event,expectedRevision:1}},
 {path:record+'/actions',body:{action:'APPROVE'}},
 {path:record+'/actions',body:{action:'REVIEW',rating:5,note:'Synthetic review',termsAccepted:true}},
 {path:record+`/proof/${event}?format=base64`},
];
const denied=[
 `${record}/sharing/allow-location`,`${record}/actions/delete`,`${record}/location`,`${record}/proof`,
 `${record}/proof/not-a-uuid`,`${record}/proof/${event}/extra`,`${record}/proof/${event}/sharing`,
 `${record}/proof/${event}/../../actions`,`${record}/proof/%2e%2e/actions`,`${record}/proof/%5c${event}`,
 `${record}/proof/%ZZ`,`${record}/proof/${event}#private`,`${record}/proof/${event}\u0000`,
 `/api/business-workspaces/not-a-uuid/tracking/${shipment}/sharing`,
 `/api/business-workspaces/${workspace}/tracking/not-a-uuid/actions`,
 `https://foreign.test${record}/sharing`,`//foreign.test${record}/actions`,
 'supabase://shipment-proof/tracking-proof/private.png','/storage/v1/object/private/shipment-proof/private.png',
];

test('business Tracking owner paths reach the shared native and Expo allowlist without adding unknown or private targets',()=>{
 for(const {path} of requests){assert.equal(businessApiPathAllowed(path),true,path);assert.equal(proxy.allowedPath(path),true,path);assert.equal(businessApiArrayResponse(path),false);}
 for(const path of denied){assert.equal(businessApiPathAllowed(path),false,path);assert.equal(proxy.allowedPath(path),false,path);}
 assert.equal(businessApiPathAllowed(`/api/mobile/business-workspaces/${workspace}/tracking/${shipment}/sharing`),false,'business routes keep their canonical prefix');
});

function nativeHttp(fetch){
 const source=ts.transpileModule(readFileSync(new URL('../src/api/http.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const ports={'./response':{ApiError,readApiResponse},'react-native':{Platform:{OS:'web'}},
  './public-capacity':{capacityUrl:base=>new URL('/api/public/capacity',base).href},
  './cargo-space-photo-path':{cargoPhotoApiPathAllowed},
  '../../../../src/lib/mobile/business-api-path.js':{businessApiPathAllowed,businessApiArrayResponse}};
 const exports={};new Function('require','exports','__DEV__','window','fetch',source)(name=>{assert.ok(name in ports,'Unexpected dependency '+name);return ports[name];},exports,true,{location:{origin:'http://local.test'}},fetch);
 return exports;
}

test('actual native HTTP adapter sends existing owner requests to their canonical API and preserves server role denials',async()=>{
 const calls=[],{apiRequest}=nativeHttp(async(url,options)=>{calls.push({url,options});return options.headers.Authorization==='Bearer synthetic-staff-token'
  ?Response.json({error:{code:'TRACKING_APPROVAL_FORBIDDEN',message:'Only the shipment owner can manage sharing.'}},{status:403})
  :Response.json({ok:true});});
 for(const input of requests){assert.deepEqual(await apiRequest(input.path,{token:'synthetic-owner-token',...(input.body?{body:input.body}: {})}),{ok:true});
  const {url,options}=calls.at(-1);assert.equal(url,'http://local.test'+input.path);assert.equal(options.method,input.body?'POST':'GET');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer synthetic-owner-token');assert.equal(options.body,input.body?JSON.stringify(input.body):undefined);}
 await assert.rejects(apiRequest(record+'/sharing',{token:'synthetic-staff-token'}),error=>error instanceof ApiError&&error.status===403&&error.code==='TRACKING_APPROVAL_FORBIDDEN');
 const before=calls.length;for(const path of denied)await assert.rejects(apiRequest(path),/Invalid API path/);assert.equal(calls.length,before,'invalid targets never reach fetch');
});

test('actual Metro middleware forwards canonical Tracking paths only to loopback and keeps bearer, body and private response semantics',async()=>{
 const original=http.request,calls=[];
 try{
  http.request=(options,onResponse)=>{
   const upstream=new PassThrough(),chunks=[];calls.push({options,chunks});upstream.on('data',chunk=>chunks.push(chunk));
   upstream.on('finish',()=>{const response=new PassThrough();response.statusCode=403;response.headers={'content-type':'application/json','cache-control':'private, no-store','set-cookie':['synthetic=discard']};onResponse(response);response.end(JSON.stringify({error:{code:'TRACKING_APPROVAL_FORBIDDEN'}}));});
   return upstream;
  };
  for(const input of requests){
   const request=Readable.from(input.body?[Buffer.from(JSON.stringify(input.body))]:[]);request.url=input.path;request.method=input.body?'POST':'GET';request.headers={host:'localhost:8084',authorization:'Bearer synthetic-staff-token',cookie:'synthetic=discard',...(input.body?{'content-type':'application/json'}:{})};
   const chunks=[],response=new Writable({write(chunk,_encoding,next){chunks.push(chunk);next();}});let status,headers;response.writeHead=(code,value)=>{status=code;headers=value;};
   await new Promise((resolve,reject)=>{response.once('finish',resolve);response.once('error',reject);try{proxy.localPreviewProxy(()=>reject(Error('BUSINESS_TRACKING_FELL_THROUGH_TO_METRO')))(request,response);}catch(error){reject(error);}});
   const forwarded=calls.at(-1);assert.equal(forwarded.options.hostname,'127.0.0.1');assert.equal(forwarded.options.port,3100);assert.equal(forwarded.options.path,input.path);assert.equal(forwarded.options.method,request.method);assert.equal(forwarded.options.headers.authorization,'Bearer synthetic-staff-token');assert.equal(forwarded.options.headers.cookie,undefined);assert.equal(Buffer.concat(forwarded.chunks).toString(),input.body?JSON.stringify(input.body):'');
   assert.equal(status,403);assert.equal(headers['cache-control'],'private, no-store');assert.equal(headers['set-cookie'],undefined);assert.equal(JSON.parse(Buffer.concat(chunks)).error.code,'TRACKING_APPROVAL_FORBIDDEN');
  }
  const before=calls.length;for(const {path} of requests){let status;proxy.localPreviewProxy(()=>assert.fail('canonical path must be recognized'))({url:path,headers:{host:'foreign.test'}},{writeHead:value=>{status=value;},end(){}});assert.equal(status,403);}assert.equal(calls.length,before,'foreign hosts never create an upstream request');
 }finally{http.request=original;}
});
