import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {mutationOriginAllowed} from '../src/lib/origin.js';

function load(file,ports){
 const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports',code)(key=>{assert.ok(key in ports,'Unexpected logout boundary '+key);return ports[key];},exports);return exports;
}
function jar(names=[]){
 const values=new Map(names.map(name=>[name,{name,value:'synthetic-session'}]));
 return{getAll:()=>[...values.values()],delete:name=>values.delete(name),set:(name,value,options)=>values.set(name,{name,value,...options})};
}
function managed(signOut){
 let options,signOutArguments;
 const exports=load('src/lib/supabase/logout.ts',{
  '@supabase/ssr':{createServerClient:(_url,_key,next)=>{options=next;return{auth:{signOut:(...args)=>{signOutArguments=args;return signOut(next);}}};}},
  './config':{getSupabasePublicConfig:()=>({url:'https://project.supabase.co',publishableKey:'synthetic-public-key'})}
 });
 return{run:exports.signOutSupabaseRoute,options:()=>options,arguments:()=>signOutArguments};
}
test('managed logout preserves global revocation and expires only this project Auth cookies and chunks',async()=>{
 const own=['sb-project-auth-token','sb-project-auth-token.0','sb-project-auth-token.1','sb-project-auth-token-code-verifier','sb-project-auth-token-flow-synthetic-code-verifier.0','sb-project-auth-token-user'];
 const unrelated=['sb-other-auth-token','private-capacity-session','language','sb-project-auth-token-settings'];
 const request={cookies:jar([...own,...unrelated])},response={cookies:jar()};
 const logout=managed(async options=>{options.cookies.setAll([{name:'sb-project-auth-token.2',value:'synthetic-refreshed',options:{path:'/'}}]);return{error:null};});
 assert.deepEqual(await logout.run(request,response),{remoteRevocationConfirmed:true});assert.deepEqual(logout.arguments(),[]);
 for(const name of[...own,'sb-project-auth-token.2']){const cookie=response.cookies.getAll().find(row=>row.name===name);assert.equal(cookie.value,'');assert.equal(cookie.maxAge,0);assert.equal(cookie.path,'/');assert.equal(cookie.expires.getTime(),0);}
 for(const name of unrelated){assert.ok(request.cookies.getAll().some(cookie=>cookie.name===name));assert.ok(!response.cookies.getAll().some(cookie=>cookie.name===name));}
});
test('an unresponsive Auth operation has a deadline, clears browser credentials, and cannot overwrite them later',async()=>{
 let options;
 const logout=managed(next=>{options=next;return new Promise(()=>{});}),request={cookies:jar(['sb-project-auth-token.0'])},response={cookies:jar()};
 const start=Date.now();assert.deepEqual(await logout.run(request,response,{timeoutMs:10}),{remoteRevocationConfirmed:false});assert.ok(Date.now()-start<500);
 options.cookies.setAll([{name:'sb-project-auth-token.0',value:'late-session',options:{path:'/'}}]);
 assert.equal(response.cookies.getAll().find(cookie=>cookie.name==='sb-project-auth-token.0').value,'');
 const originalFetch=globalThis.fetch;let aborted=false;
 try{globalThis.fetch=async(_input,init)=>{aborted=init.signal.aborted;throw Error('synthetic-abort');};await assert.rejects(()=>options.global.fetch('https://project.supabase.co/auth/v1/logout'));}finally{globalThis.fetch=originalFetch;}
 assert.equal(aborted,true);
});
test('failed managed revocation still clears this browser and never claims remote success',async()=>{
 for(const reject of[false,true]){
  const logout=managed(async()=>{if(reject)throw Error('synthetic-unavailable');return{error:{status:503}};});
  const request={cookies:jar(['sb-project-auth-token'])},response={cookies:jar()};
  assert.deepEqual(await logout.run(request,response),{remoteRevocationConfirmed:false});assert.equal(response.cookies.getAll()[0].maxAge,0);
 }
});
test('logout redirect honestly distinguishes managed success from unconfirmed revocation',async()=>{
 for(const confirmed of[true,false]){
  const response={headers:new Headers()},route=load('src/app/api/auth/logout/route.ts',{
   'next/server.js':{NextResponse:class{constructor(_body,{status,headers}){response.headers=new Headers(headers);response.status=status;return response;}}},
   '@/lib/supabase/logout':{signOutSupabaseRoute:async()=>({remoteRevocationConfirmed:confirmed})}
  });
  await route.POST({url:'http://internal-next:3100/api/auth/logout',headers:new Headers({origin:'https://loadgistic.com'})});
  assert.ok(response.headers.get('Location').startsWith('/login?'));
  const destination=new URL(response.headers.get('Location'),'https://loadgistic.com');assert.equal(destination.origin,'https://loadgistic.com');assert.equal(response.status,303);assert.equal(destination.pathname,'/login');assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.equal(destination.searchParams.has('success'),confirmed);assert.equal(destination.searchParams.has('error'),!confirmed);
  if(!confirmed)assert.match(destination.searchParams.get('error'),/could not confirm sign-out on other devices/);
 }
});
test('only exact origin-validated POST logout bypasses session refresh; every other path still validates Auth',async()=>{
 let refreshes=0;
 const middleware=load('src/middleware.ts',{
  'next/server.js':{NextResponse:{next:()=>({bypass:true}),json:(body,{status})=>({body,status})}},
  '@/lib/origin.js':{mutationOriginAllowed},'@/lib/retired-demand':{retiredDemandResponse:()=>({retired:true})},
  '@/lib/supabase/session-middleware':{refreshSupabaseSession:async()=>{refreshes++;return{refreshed:true};}}
 }).middleware;
 const request=(method,path,origin='https://loadgistic.com')=>({method,url:'https://loadgistic.com'+path,nextUrl:{pathname:path},headers:new Headers({origin})});
 assert.equal((await middleware(request('POST','/api/auth/logout','https://outside.example'))).status,403);assert.equal(refreshes,0);
 assert.deepEqual(await middleware(request('POST','/api/auth/logout')),{bypass:true});assert.equal(refreshes,0);
 for(const [method,path]of[['GET','/api/auth/logout'],['POST','/api/auth/logout/extra'],['POST','/api/support/availability']])assert.deepEqual(await middleware(request(method,path)),{refreshed:true});
 assert.equal(refreshes,3);
});
test('logout is a native POST form rather than a client redirect that can claim success after failure',()=>{
 const source=readFileSync(new URL('../src/components/logout-button.tsx',import.meta.url),'utf8');
 assert.match(source,/<form action="\/api\/auth\/logout" method="post"/);assert.match(source,/<button type="submit"/);assert.doesNotMatch(source,/fetch\(|window\.location/);
});
