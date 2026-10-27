import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {readMobileMultipart,privateFilePayload} from '../src/lib/mobile/file-contract.js';
import {privateDocumentHeaders} from '../src/lib/private-storage.js';
import {CargoPhotoError} from '../src/lib/cargo-space-photo/server.js';
import * as businessDomain from '../src/lib/business-workspaces/domain.js';

const actor='16000000-0000-4000-8000-000000000001';
const workspace='16000000-0000-4000-8000-000000000002';
const foreignWorkspace='16000000-0000-4000-8000-000000000003';
const vehicle='16000000-0000-4000-8000-000000000004';
const photo='16000000-0000-4000-8000-000000000005';
const bytes=Uint8Array.from([0xff,0xd8,0xff,0xd9]);

function load(path,imports){
 const exports={};
 const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',code)((name)=>{
  assert.ok(name in imports,`Unexpected import ${name} in ${path}`);
  return imports[name];
 },exports);
 return exports;
}
class NextResponse extends Response{}
const context=params=>({params:Promise.resolve(params)});
const get=(path,headers={})=>new Request(`http://localhost${path}`,{headers});
const json=(path,body,headers={})=>new Request(`http://localhost${path}`,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
const remove=(path,headers={})=>new Request(`http://localhost${path}`,{method:'DELETE',headers});
function upload(path,form,headers={}){
 return new Request(`http://localhost${path}`,{method:'POST',headers,body:form});
}

function harness({multipartReader=readMobileMultipart}={}){
 let user={id:actor,email:'synthetic@example.test',email_confirmed_at:'2026-10-26',app_metadata:{}};
 let consent=true;
 let authError=null;
 let service={};
 const calls=[];
 const client={auth:{getUser:async()=>({data:{user},error:authError})}};
 const businessHttp=load('src/lib/business-workspaces/http.ts',{
  '@supabase/supabase-js':{createClient:(_url,_key,options)=>{
   calls.push(['bearer',options.global.headers.Authorization]);
   return options.global.headers.Authorization==='Bearer invalid-token'
    ?{auth:{getUser:async()=>({data:{user:null},error:new Error('invalid')})}}:client;
  }},
  '../supabase/server':{createSupabaseServerClient:async()=>client},
  '../supabase/config':{getSupabasePublicConfig:()=>({url:'http://localhost',publishableKey:'public-test-key'})},
  '../rate-limit.js':{checkRateLimit:async()=>({allowed:true})},
  '../origin.js':{mutationOriginAllowed:headers=>headers.get('origin')!=='https://foreign.test'},
  '../privacy/content-policy.js':{contentPolicyAccepted:async()=>consent},
  '../privacy/review-access.js':{reviewAccountAllowed:async()=>false},
  './domain.js':businessDomain,
  './application':{businessWorkspaceService:()=>({})},
  './supabase':{supabaseBusinessWorkspacePort:()=>({})},
  './invitation-email':{deliverBusinessInvitation:async()=>{throw new Error('UNEXPECTED_EMAIL');}}
 });
 const photoHttp=load('src/lib/cargo-space-photo/http.ts',{
  '../business-workspaces/http':businessHttp,
  './server.js':{CargoPhotoError,cargoPhotoService:()=>service},
  '../mobile/file-contract.js':{readMobileMultipart:multipartReader}
 });
 const ports={
  '@/lib/cargo-space-photo/http':photoHttp,
  'next/server.js':{NextResponse},
  '@/lib/private-storage.js':{privateDocumentHeaders},
  '@/lib/mobile/file-contract.js':{privateFilePayload},
  '@/lib/cargo-space-photo/server.js':{CargoPhotoError}
 };
 return {
  calls,
  setUser:value=>{user=value;},
  setAuthError:value=>{authError=value;},
  setConsent:value=>{consent=value;},
  setService:value=>{service=value;},
  provider:load('src/app/api/capacity/cargo-space-photos/route.ts',ports),
  providerFile:load('src/app/api/capacity/cargo-space-photos/[photoId]/route.ts',ports),
  business:load('src/app/api/business-workspaces/[workspaceId]/capacity/photos/route.ts',ports),
  businessFile:load('src/app/api/business-workspaces/[workspaceId]/capacity/photos/[photoId]/route.ts',ports),
  request:load('src/app/api/business-workspaces/[workspaceId]/capacity/photo-requests/route.ts',ports)
 };
}

function assertPrivate(response){
 assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 assert.equal(response.headers.get('CDN-Cache-Control'),'no-store');
 assert.equal(response.headers.get('Netlify-CDN-Cache-Control'),'no-store');
 assert.match(response.headers.get('X-Robots-Tag'),/noimageindex/);
}

test('all photo reads and mutations deny anonymous or invalid Bearer before calling the photo service',async()=>{
 const h=harness();let serviceCalls=0;
 h.setService(new Proxy({}, {get:()=>async()=>{serviceCalls++;return {};}}));
 const providerPath=`/api/capacity/cargo-space-photos?vehicleId=${vehicle}`;
 const businessPath=`/api/business-workspaces/${workspace}/capacity/photos?vehicleId=${vehicle}`;
 const requests=[
  ()=>h.provider.GET(get(providerPath)),
  ()=>h.providerFile.GET(get(`/api/capacity/cargo-space-photos/${photo}`),context({photoId:photo})),
  ()=>h.providerFile.DELETE(remove(`/api/capacity/cargo-space-photos/${photo}`),context({photoId:photo})),
  ()=>h.business.GET(get(businessPath),context({workspaceId:workspace})),
  ()=>h.businessFile.GET(get(`/api/business-workspaces/${workspace}/capacity/photos/${photo}`),context({workspaceId:workspace,photoId:photo})),
  ()=>h.request.POST(json(`/api/business-workspaces/${workspace}/capacity/photo-requests`,{vehicleId:vehicle,idempotencyKey:photo}),context({workspaceId:workspace})),
  ()=>h.provider.POST(upload('/api/capacity/cargo-space-photos',new FormData()))
 ];
 h.setUser(null);
 for(const invoke of requests){const response=await invoke();assert.equal(response.status,401);assertPrivate(response);}
 h.setUser({id:actor,email:'synthetic@example.test',email_confirmed_at:'2026-10-26'});
 assert.equal((await h.provider.GET(get(providerPath,{authorization:'Bearer invalid-token'}))).status,401);
 assert.equal((await h.business.GET(get(businessPath,{authorization:'Basic credential'}),context({workspaceId:workspace}))).status,401);
 assert.equal(serviceCalls,0);
});

test('photo writes deny foreign origin and missing content-policy consent before parsing or storage',async()=>{
 const h=harness();let serviceCalls=0;
 h.setService(new Proxy({}, {get:()=>async()=>{serviceCalls++;return {};}}));
 const target=`/api/business-workspaces/${workspace}/capacity/photo-requests`;
 const deniedOrigin=await h.request.POST(json(target,{vehicleId:vehicle,idempotencyKey:photo},{origin:'https://foreign.test'}),context({workspaceId:workspace}));
 assert.equal(deniedOrigin.status,403);assert.equal((await deniedOrigin.json()).error.code,'INVALID_ORIGIN');assertPrivate(deniedOrigin);
 h.setConsent(false);
 const deniedPolicy=await h.providerFile.DELETE(remove(`/api/capacity/cargo-space-photos/${photo}`),context({photoId:photo}));
 assert.equal(deniedPolicy.status,403);assert.equal((await deniedPolicy.json()).error.code,'POLICY_REQUIRED');
 const deniedUpload=await h.provider.POST(upload('/api/capacity/cargo-space-photos',new FormData()));
 assert.equal(deniedUpload.status,403);assert.equal((await deniedUpload.json()).error.code,'POLICY_REQUIRED');
 assert.equal(serviceCalls,0);
});

test('malformed multipart upload and unsupported request bodies fail without reaching the service',async()=>{
 const h=harness();let serviceCalls=0;
 h.setService({upload:async()=>{serviceCalls++;return {};},request:async()=>{serviceCalls++;return {};}});
 const badType=await h.provider.POST(new Request('http://localhost/api/capacity/cargo-space-photos',{method:'POST',headers:{'content-type':'text/plain'},body:'bad'}));
 assert.equal(badType.status,400);assert.equal((await badType.json()).error.code,'MULTIPART_REQUIRED');assertPrivate(badType);
 const repeated=new FormData();repeated.append('command','{}');repeated.append('command','{}');repeated.append('file',new File([bytes],'cargo.jpg',{type:'image/jpeg'}));
 const badParts=await h.provider.POST(upload('/api/capacity/cargo-space-photos',repeated));
 assert.equal(badParts.status,400);assert.equal((await badParts.json()).error.code,'INVALID_UPLOAD');
 const badJson=await h.request.POST(new Request(`http://localhost/api/business-workspaces/${workspace}/capacity/photo-requests`,{method:'POST',headers:{'content-type':'text/plain'},body:'{}'}),context({workspaceId:workspace}));
 assert.equal(badJson.status,415);assertPrivate(badJson);
 assert.equal(serviceCalls,0);
});

test('an unexpected upload-parser failure is not returned to the client',async()=>{
 const h=harness({multipartReader:async()=>{throw new Error('private parser diagnostic');}});
 h.setService({upload:async()=>{throw new Error('UNEXPECTED_STORAGE_CALL');}});
 const response=await h.provider.POST(upload('/api/capacity/cargo-space-photos',new FormData()));
 assert.equal(response.status,503);assertPrivate(response);
 const body=await response.text();
 assert.match(body,/CARGO_PHOTO_UNAVAILABLE/);
 assert.doesNotMatch(body,/private parser diagnostic/);
});

test('valid upload and owner removal use verified actor and private responses',async()=>{
 const h=harness();const calls=[];
 h.setService({
  upload:async(...args)=>{calls.push(['upload',...args]);return {id:photo,vehicleId:vehicle};},
  remove:async(...args)=>{calls.push(['remove',...args]);return {id:photo,removed:true};}
 });
 const form=new FormData();
 form.set('command',JSON.stringify({vehicleId:vehicle,source:'UPLOAD'}));
 form.set('file',new File([bytes],'cargo.jpg',{type:'image/jpeg'}));
 const saved=await h.provider.POST(upload('/api/capacity/cargo-space-photos',form));
 assert.equal(saved.status,201);assertPrivate(saved);assert.equal((await saved.json()).photo.id,photo);
 const deleted=await h.providerFile.DELETE(remove(`/api/capacity/cargo-space-photos/${photo}`),context({photoId:photo}));
 assert.equal(deleted.status,200);assertPrivate(deleted);assert.equal((await deleted.json()).removed,true);
 assert.deepEqual(calls[0].slice(0,3),['upload',actor,{vehicleId:vehicle,source:'UPLOAD'}]);
 assert.equal(calls[0][3].type,'image/jpeg');
 assert.deepEqual(calls[1],['remove',actor,photo]);
});

test('workspace route passes the URL workspace, denies a foreign workspace and returns no private bytes',async()=>{
 const h=harness();const calls=[];
 h.setService({
  businessState:async(actorId,workspaceId,vehicleId)=>{
   calls.push(['summary',actorId,workspaceId,vehicleId]);
   if(workspaceId===foreignWorkspace)throw new CargoPhotoError('CARGO_PHOTO_FORBIDDEN');
   return {photo:null,request:null};
  },
  businessFile:async(actorId,workspaceId,photoId)=>{
   calls.push(['file',actorId,workspaceId,photoId]);
   if(workspaceId===foreignWorkspace)throw new CargoPhotoError('CARGO_PHOTO_FORBIDDEN');
   return {bytes,mimeType:'image/jpeg',receivedAt:'2026-10-26T10:00:00Z'};
  },
  request:async(actorId,workspaceId,vehicleId,key)=>{
   calls.push(['request',actorId,workspaceId,vehicleId,key]);
   if(workspaceId===foreignWorkspace)throw new CargoPhotoError('CARGO_PHOTO_FORBIDDEN');
   return {created:true};
  }
 });
 const path=`/api/business-workspaces/${foreignWorkspace}/capacity/photos`;
 const summary=await h.business.GET(get(`${path}?vehicleId=${vehicle}`),context({workspaceId:foreignWorkspace}));
 assert.equal(summary.status,403);assertPrivate(summary);
 const image=await h.businessFile.GET(get(`${path}/${photo}`),context({workspaceId:foreignWorkspace,photoId:photo}));
 assert.equal(image.status,403);assertPrivate(image);assert.equal(image.headers.get('Content-Type'),'application/json');
 assert.notDeepEqual(new Uint8Array(await image.arrayBuffer()),bytes);
 const mutation=await h.request.POST(json(`/api/business-workspaces/${foreignWorkspace}/capacity/photo-requests`,{vehicleId:vehicle,idempotencyKey:photo,actorId:'spoofed'}),context({workspaceId:foreignWorkspace}));
 assert.equal(mutation.status,403);assertPrivate(mutation);
 assert.deepEqual(calls,[['summary',actor,foreignWorkspace,vehicle],['file',actor,foreignWorkspace,photo],['request',actor,foreignWorkspace,vehicle,photo]]);
});

test('successful provider and business photo responses keep private cache headers for JSON and image formats',async()=>{
 const h=harness();const calls=[];
 h.setService({
  providerState:async(...args)=>{calls.push(['providerState',...args]);return {photo:null,requests:[]};},
  providerFile:async(...args)=>{calls.push(['providerFile',...args]);return {bytes,mimeType:'image/jpeg',receivedAt:'2026-10-26T10:00:00Z'};},
  businessState:async(...args)=>{calls.push(['businessState',...args]);return {photo:null,request:null};},
  businessFile:async(...args)=>{calls.push(['businessFile',...args]);return {bytes,mimeType:'image/jpeg',receivedAt:'2026-10-26T10:00:00Z'};},
  request:async(...args)=>{calls.push(['request',...args]);return {created:true};}
 });
 const summary=await h.provider.GET(get(`/api/capacity/cargo-space-photos?vehicleId=${vehicle}`));
 assert.equal(summary.status,200);assertPrivate(summary);
 const business=await h.business.GET(get(`/api/business-workspaces/${workspace}/capacity/photos?vehicleId=${vehicle}`),context({workspaceId:workspace}));
 assert.equal(business.status,200);assertPrivate(business);
 for(const [handler,path,params] of [
  [h.providerFile,`/api/capacity/cargo-space-photos/${photo}`,{photoId:photo}],
  [h.businessFile,`/api/business-workspaces/${workspace}/capacity/photos/${photo}`,{workspaceId:workspace,photoId:photo}]
 ]){
  const image=await handler.GET(get(path),context(params));
  assert.equal(image.status,200);assertPrivate(image);assert.equal(image.headers.get('X-Content-Type-Options'),'nosniff');
  assert.equal(image.headers.get('Content-Type'),'image/jpeg');assert.deepEqual(new Uint8Array(await image.arrayBuffer()),bytes);
  const encoded=await handler.GET(get(`${path}?format=base64`),context(params));
  assert.equal(encoded.status,200);assertPrivate(encoded);assert.equal((await encoded.json()).base64,Buffer.from(bytes).toString('base64'));
 }
 const created=await h.request.POST(json(`/api/business-workspaces/${workspace}/capacity/photo-requests`,{vehicleId:vehicle,idempotencyKey:photo}),context({workspaceId:workspace}));
 assert.equal(created.status,201);assertPrivate(created);
 assert.deepEqual(calls[0],['providerState',actor,vehicle]);
 assert.deepEqual(calls[1],['businessState',actor,workspace,vehicle]);
 assert.deepEqual(calls.at(-1),['request',actor,workspace,vehicle,photo]);
});
