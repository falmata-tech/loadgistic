import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {canManageOwnDriverPortrait} from '../src/lib/driver-portrait-access.js';
import {portraitUpload,portraitRemove} from '../src/lib/mobile/portrait-contract.js';

function load(path,ports){const exports={},code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports',code)(name=>{assert.ok(name in ports,`Unexpected route dependency: ${name}`);return ports[name];},exports);return exports;}
class MobileError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
class NextResponse extends Response{static json(value,init){return Response.json(value,init);}}
const drivingOwner={id:'driving-owner',role:'TRANSPORTER',active:true,organization_id:'owned-fleet',owns_provider_account:true,drives_truck:true};
const denied=[{...drivingOwner,drives_truck:false},{...drivingOwner,owns_provider_account:false},{id:'admin',role:'ADMIN',active:true},{id:'support',role:'SUPPORT',active:true},{...drivingOwner,active:false}];
const image=new File([new Uint8Array([137,80,78,71])],'synthetic-driver.png',{type:'image/png'});

function mobile(){
 let actor=drivingOwner,upload={command:{action:'UPLOAD',consent:true},file:image};const calls=[];
 const route=load('src/app/api/mobile/account/portrait/route.ts',{
  '@/lib/driver-portrait-access.js':{canManageOwnDriverPortrait},
  '@/lib/mobile/server':{mobileActor:async(_request,limited)=>{assert.equal(limited,true);return actor;},mobileBody:request=>request.json(),mobileJson:Response.json,mobileFailure:error=>Response.json({error:{code:error.code||'INTERNAL'}},{status:error.status||500}),MobileError},
  '@/lib/mobile/file-server':{mobileUpload:async()=>upload,fileFailure:error=>{throw error;}},
  '@/lib/mobile/portrait-contract.js':{portraitUpload,portraitRemove},
  '@/lib/driver-portrait-storage.js':{getDriverPortraitWorkspace:async current=>{calls.push({action:'READ',actor:current});return{imageUrl:'/api/public/driver-portraits/synthetic',hasPortrait:true};},updateDriverPortrait:async(current,file,consent)=>calls.push({action:'UPLOAD',actor:current,file,consent}),removeDriverPortrait:async current=>calls.push({action:'REMOVE',actor:current})},
  '@/lib/mobile/public-contract.js':{publicAsset:value=>value},'@/lib/rate-limit':{checkRateLimit:async key=>{assert.equal(key,`mobile-driver-portrait:${actor.id}`);return{allowed:true};}}
 });
 return{route,calls,actor:value=>{actor=value;},upload:value=>{upload=value;}};
}
test('mobile GET and both POST actions admit an exact active driving owner and retain actor/file/consent',async()=>{
 const view=mobile();assert.equal((await view.route.GET(new Request('http://local/api/mobile/account/portrait'))).status,200);assert.equal((await view.route.POST(new Request('http://local/api/mobile/account/portrait',{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=synthetic'}}))).status,200);assert.equal((await view.route.POST(new Request('http://local/api/mobile/account/portrait',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'REMOVE',confirm:true})}))).status,200);assert.deepEqual(view.calls.map(call=>call.action),['READ','UPLOAD','REMOVE']);for(const call of view.calls)assert.equal(call.actor,drivingOwner);assert.equal(view.calls[1].file,image);assert.equal(view.calls[1].consent,true);
});
test('mobile non-driving owners, non-owners, inactive identities and staff reach no portrait storage port',async()=>{
 const view=mobile();for(const actor of denied){view.actor(actor);assert.equal((await view.route.GET(new Request('http://local/api/mobile/account/portrait'))).status,403);assert.equal((await view.route.POST(new Request('http://local/api/mobile/account/portrait',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'REMOVE',confirm:true})}))).status,403);}assert.deepEqual(view.calls,[]);
});
test('driving-owner admission never removes explicit public consent or removal confirmation',async()=>{
 const view=mobile();view.upload({command:{action:'UPLOAD',consent:false},file:image});assert.equal((await view.route.POST(new Request('http://local/api/mobile/account/portrait',{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=synthetic'}}))).status,400);assert.equal((await view.route.POST(new Request('http://local/api/mobile/account/portrait',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'REMOVE',confirm:false})}))).status,400);assert.equal((await view.route.POST(new Request('http://local/api/mobile/account/portrait',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'REMOVE',confirm:true,userId:'another-driver'})}))).status,400);assert.deepEqual(view.calls,[]);
});
test('web portrait upload/remove keeps the current driving owner and denies staff/non-driving identities before storage',async()=>{
 let actor=drivingOwner;const calls=[];
 const route=load('src/app/api/account/portrait/route.ts',{'next/server.js':{NextResponse},'@/lib/driver-portrait-access.js':{canManageOwnDriverPortrait},'@/lib/auth':{getCurrentUser:async options=>{assert.deepEqual(options,{allowLimited:true});return actor;}},'@/lib/driver-portrait-storage.js':{updateDriverPortrait:async(user,file,consent)=>calls.push({action:'UPLOAD',actor:user,file,consent}),removeDriverPortrait:async user=>calls.push({action:'REMOVE',actor:user})},'@/lib/redirects':{text:(form,key)=>String(form.get(key)||''),redirectWith:()=>new Response(null,{status:303})},'@/lib/errors':{errorMessage:error=>error.message}});
 const request=command=>{const form=new FormData();form.set('command',command);if(command==='UPLOAD'){form.set('photo',image);form.set('consent','on');}return new Request('http://local/api/account/portrait',{method:'POST',body:form});};
 assert.equal((await route.POST(request('UPLOAD'))).status,303);assert.equal((await route.POST(request('REMOVE'))).status,303);assert.deepEqual(calls.map(call=>call.action),['UPLOAD','REMOVE']);assert.equal(calls[0].actor,drivingOwner);assert.equal(calls[0].consent,true);assert.equal(calls[0].file.name,image.name);for(const value of denied){actor=value;assert.equal((await route.POST(request('REMOVE'))).status,403);}assert.equal(calls.length,2);actor=null;assert.equal((await route.POST(request('REMOVE'))).status,401);
});
