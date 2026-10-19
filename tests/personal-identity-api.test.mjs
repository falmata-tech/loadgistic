import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

function load(path,ports){const exports={};const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports',code)(name=>{if(!(name in ports))throw Error(`UNEXPECTED_IMPORT:${name}`);return ports[name];},exports);return exports;}
class NextResponse extends Response {static json(value,init){return Response.json(value,init);}static redirect(url,status){return new Response(null,{status,headers:{Location:String(url)}});}}
const common={'next/server.js':{NextResponse},'@/lib/errors':{errorMessage:error=>error.message},'@/lib/redirects':{text:(form,key)=>String(form.get(key)||''),redirectWith:()=>new Response(null,{status:303})}};
test('private own image preview authenticates the subject, permits limited owners and rejects subject selection',async()=>{
  let actor={id:'owner-a',role:'TRANSPORTER',active:true},reads=[],mimeType='image/jpeg';
  const route=load('src/app/api/company-page/image/route.ts',{...common,
    '@/lib/workspace-form-navigation.js':{workspaceFormReturnPath:()=>'/app/company-page'},
    '@/lib/auth':{getCurrentUser:async options=>{assert.deepEqual(options,{allowLimited:true});return actor;}},
    '@/lib/provider-profile.js':{readOwnProviderProfileImage:async user=>{reads.push(user.id);return {bytes:new Uint8Array(user.id==='owner-a'?[1,2,3]:[4,5,6]),mimeType};},removeProviderProfileImage:async()=>{},updateProviderProfileImage:async()=>{}}
  });
  const request=query=>new Request(`http://localhost/api/company-page/image${query||''}`);
  let response=await route.GET(request('?preview=10000000-0000-4000-8000-000000000001&v=2026-10-13T10%3A00%3A00Z'));
  assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('Vary'),'Cookie');assert.equal(response.headers.get('Content-Type'),'image/jpeg');assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1,2,3]);
  for(const permitted of ['image/png','image/webp']){
    mimeType=permitted;response=await route.GET(request());assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),permitted);assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1,2,3]);
  }
  for(const unsupported of ['image/svg+xml','text/html']){mimeType=unsupported;assert.equal((await route.GET(request())).status,404);}mimeType='image/jpeg';
  actor={id:'owner-b',role:'DRIVER',active:true};response=await route.GET(request('?preview=10000000-0000-4000-8000-000000000001&v=1'));assert.equal(response.status,200);assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[4,5,6]);
  for(const query of ['?target_user_id=owner-a','?preview=foreign','?v=1&v=2'])assert.equal((await route.GET(request(query))).status,400);
  actor={id:'employee',role:'DRIVER',driver_kind:'COMPANY',active:true};assert.equal((await route.GET(request())).status,403);
  actor=null;assert.equal((await route.GET(request())).status,401);assert.deepEqual(reads,['owner-a','owner-a','owner-a','owner-a','owner-a','owner-b']);
});
test('native account form preserves untouched hidden callback but keeps explicit empty intent and rejects duplicate markers',async()=>{
  const writes=[],actor={id:'owner',publicCallbackPhone:''};
  const route=load('src/app/api/account/details/route.ts',{...common,'@/lib/auth':{getCurrentUser:async()=>actor},'@/lib/identity/account-details':{updateOwnAccountDetails:async(user,input)=>writes.push(input)}});
  const request=(fields,duplicate=false)=>{const form=new FormData();for(const [key,value]of Object.entries(fields))form.append(key,value);if(duplicate)form.append('publicCallbackChanged','1');return new Request('http://localhost/api/account/details',{method:'POST',body:form});};
  const input={firstName:'Aster',lastName:'',phone:'',publicCallbackPhone:''};
  assert.equal((await route.POST(request({...input,publicCallbackChanged:'0'}))).status,303);assert.equal('publicCallbackPhone'in writes[0],false);assert.equal('publicCallbackChanged'in writes[0],false);
  await route.POST(request({...input,publicCallbackChanged:'1'}));assert.equal(writes[1].publicCallbackPhone,'');assert.equal('publicCallbackChanged'in writes[1],false);
  await route.POST(request({...input,publicCallbackPhone:'+1.612.555.0100'}));assert.equal(writes[2].publicCallbackPhone,'+1.612.555.0100');
  await route.POST(request({...input,publicCallbackChanged:'invalid'}));await route.POST(request({...input,publicCallbackChanged:'0'},true));assert.equal(writes.length,3);
});
