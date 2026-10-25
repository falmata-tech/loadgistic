import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as domain from '../src/lib/business-workspaces/domain.js';
const actor='16000000-0000-4000-8000-000000000001',workspace='16000000-0000-4000-8000-000000000002';
function load(path,ports){const exports={};new Function('require','exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{if(name in ports)return ports[name];throw Error(`UNEXPECTED_IMPORT:${name}`);},exports);return exports;}
function harness(){
 let identity={id:actor,email:'synthetic@example.test',email_confirmed_at:'2026-10-18',app_metadata:{}},error=null,policy=true,rate=true;const events=[];
 const client={auth:{getUser:async()=>{events.push('verified-getUser');return {data:{user:identity},error};}}};
 const http=load('src/lib/business-workspaces/http.ts',{
  '@supabase/supabase-js':{createClient:(url,key,options)=>{events.push(['bearer-client',options.global.headers.Authorization]);return client;}},
  '../supabase/server':{createSupabaseServerClient:async()=>{events.push('cookie-client');return client;}},'../supabase/config':{getSupabasePublicConfig:()=>({url:'http://localhost',publishableKey:'public-test-key'})},
  '../rate-limit.js':{checkRateLimit:async()=>({allowed:rate})},'../origin.js':{mutationOriginAllowed:headers=>headers.get('origin')!=='https://foreign.test'},
  '../privacy/content-policy.js':{contentPolicyAccepted:async()=>policy},'../privacy/review-access.js':{reviewAccountAllowed:async()=>false},
  './domain.js':domain,'./application':{businessWorkspaceService:()=>({})},'./supabase':{supabaseBusinessWorkspacePort:()=>({})},'./invitation-email':{deliverBusinessInvitation:async()=>{throw Error('NO_IMPLICIT_EMAIL');}}
 });
 return {http,events,setIdentity:value=>identity=value,setError:value=>error=value,setPolicy:value=>policy=value,setRate:value=>rate=value};
}
const request=(path='',body,headers={})=>new Request(`http://localhost/api/business-workspaces${path}`,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'content-type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
test('verified identity adapter validates cookie/bearer with Auth and never trusts user-selected actor or unverified email',async()=>{
 const h=harness();assert.equal(await h.http.businessActor(request()),actor);assert.deepEqual(h.events,['cookie-client','verified-getUser']);
 assert.deepEqual(await h.http.businessActorIdentity(request()),{id:actor,email:'synthetic@example.test'});
 h.events.length=0;assert.equal(await h.http.businessActor(request('',undefined,{authorization:'Bearer synthetic-token'})),actor);assert.deepEqual(h.events,[['bearer-client','Bearer synthetic-token'],'verified-getUser']);
 await assert.rejects(h.http.businessActor(request('',undefined,{authorization:'invalid'})),/SIGN_IN_REQUIRED/);
 h.setIdentity({id:actor,email:'synthetic@example.test'});await assert.rejects(h.http.businessActor(request()),/VERIFIED_EMAIL_REQUIRED/);
 h.setIdentity(null);await assert.rejects(h.http.businessActor(request()),/SIGN_IN_REQUIRED/);
});
test('mutations require origin and content consent; body limits, private headers and sanitized errors hold',async()=>{
 const h=harness();await assert.rejects(h.http.businessActor(request('',{}, {origin:'https://foreign.test'})),/INVALID_ORIGIN/);
 h.setPolicy(false);await assert.rejects(h.http.businessActor(request('',{})),/POLICY_REQUIRED/);
 await assert.rejects(h.http.businessBody(request('',{name:'x'.repeat(9000)})),error=>error.status===413);
 await assert.rejects(h.http.businessBody(request('',[])),error=>error.status===400);
 const good=await h.http.businessBody(request('',{action:'SELECT',workspaceId:null}));assert.equal(good.workspaceId,null);
 const response=h.http.businessJson({ok:true});assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('Vary'),'Cookie, Authorization');assert.match(response.headers.get('X-Robots-Tag'),/noindex/);
 assert.equal((await h.http.businessFailure(new Error('secret connection details')).json()).error.code,'BUSINESS_UNAVAILABLE');
 h.setRate(false);await assert.rejects(h.http.businessLimit(actor,'create'),/RATE_LIMITED/);
});
test('API uses verified actor, explicit route workspace, exact actions and no email/authority spoofing',async()=>{
 const h=harness(),calls=[];const service={context:async id=>{calls.push(['context',id]);return {actorId:id};},create:async(id,input)=>{calls.push(['create',id,input]);domain.businessCreation(input);return {};},select:async(id,selected)=>{calls.push(['select',id,selected]);return {};},directory:async(id,selected)=>{calls.push(['directory',id,selected]);return {};},command:async(id,selected,input)=>{domain.businessCommand(input);calls.push(['command',id,selected,input]);return {};},accept:async(id,invitation)=>{calls.push(['accept',id,invitation]);return {};},search:async(id,q)=>{calls.push(['search',id,q]);return [];}};
 const ports={'@/lib/business-workspaces/http':{...h.http,businessService:()=>service,businessInviteDelivery:async()=>{calls.push(['delivery']);return 'SENT';}},'@/lib/business-workspaces/domain.js':domain};
 const route=load('src/app/api/business-workspaces/route.ts',ports);
 assert.equal((await route.GET(request())).status,200);assert.equal((await route.POST(request('',{action:'SELECT',workspaceId:workspace}))).status,200);
 assert.equal((await route.POST(request('',{action:'CREATE',name:'Synthetic business',handle:'synthetic',kind:'BROKER'}))).status,201);
 assert.equal((await route.POST(request('',{action:'CREATE',name:'Synthetic',handle:'synthetic',kind:'BROKER',actorId:workspace}))).status,400);
 assert.equal((await route.POST(request('',{action:'SELECT',workspaceId:workspace,role:'OWNER'}))).status,400);
 const detail=load('src/app/api/business-workspaces/[workspaceId]/route.ts',ports),context={params:Promise.resolve({workspaceId:workspace})};
 assert.equal((await detail.POST(request(`/${workspace}`,{action:'LEAVE',expectedVersion:1}),context)).status,200);
 assert.deepEqual(calls.find(item=>item[0]==='command'),['command',actor,workspace,{action:'LEAVE',expectedVersion:1}]);
 const accept=load('src/app/api/business-workspaces/invitations/[invitationId]/accept/route.ts',ports);
 assert.equal((await accept.POST(request('',{email:'foreign@example.test'}),{params:Promise.resolve({invitationId:workspace})})).status,400);
 assert.equal((await accept.POST(request('',{}),{params:Promise.resolve({invitationId:workspace})})).status,200);
 const search=load('src/app/api/business-workspaces/search/route.ts',ports);
 assert.equal((await search.GET(request('/search?q=a&q=b'))).status,400);assert.equal((await search.GET(request('/search?q=cargo'))).status,200);
 assert.deepEqual(calls.at(-1),['search',actor,'cargo']);
});
