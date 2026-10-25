import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {capacityFilterParams} from '../src/lib/capacity-filter-values.js';

const member={id:'member-1',email:'member@example.invalid',active:true,role:'CUSTOMER'};
function route(path,{user=member,fail=false}={}){
 const calls=[];
 class MobileError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
 const imports={
  'next/server.js':{NextResponse:{json:(body,options={})=>({body,status:options.status||200,headers:options.headers||{}})}},
  '@/lib/auth':{getCurrentUser:async()=>user,getSharedCapacitySession:async()=>null},
  '@/lib/private-capacity.js':{listAccountCapacity:async(...args)=>{calls.push(args);if(fail)throw Error('PRIVATE_DATABASE_DETAILS');return {items:[],hasMore:false,nextCursor:null,pageSize:100};}},
  '@/lib/capacity-filter-values.js':{capacityFilterParams},
  '@/lib/capacity-search':{searchCapacity:async(...args)=>{calls.push(args);return {items:[],total:0,page:1,pageSize:15,hasMore:false};}},
  '@/lib/security.js':{privateContactDigest:email=>`digest:${email}`},
  '@/lib/retired-brokerage':{retiredPlatformCapacityResponse:()=>({status:410})},
  '@/lib/rate-limit':{checkRateLimit:async()=>({allowed:true})},
  '@/lib/mobile/server':{
   mobileActor:async()=>{if(!user)throw new MobileError(401,'SIGN_IN_REQUIRED','Sign in.');return user;},
   mobileJson:(body,status=200)=>({body,status,headers:{'Cache-Control':'private, no-store'}}),
   mobileFailure:error=>({body:{error:{code:error instanceof MobileError?error.code:'UNAVAILABLE'}},status:error instanceof MobileError?error.status:503}),
   MobileError
  }
 };
 const output={};
 const source=readFileSync(new URL(path,import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',compiled)(name=>{assert.ok(name in imports,`Unexpected import ${name}`);return imports[name];},output);
 return {calls,get:query=>output.GET({url:`https://loadgistic.example/api/test?${query}`,headers:{get:()=>null}})};
}

test('account Capacity requires a signed-in customer/provider/driver before parsing or reading filters',async()=>{
 for(const path of ['../src/app/api/account-capacity/route.ts','../src/app/api/capacity-search/route.ts']){
  for(const user of [null,{...member,role:'SUPPORT'},{...member,role:'ADMIN'}]){
   const api=route(path,{user});
   const response=await api.get(path.includes('capacity-search')?'view=account&status=EMPTY':'status=EMPTY');
   assert.equal(response.status,401);assert.equal(api.calls.length,0);
  }
 }
});

test('account Capacity uses the current verified account and canonical filters, never caller email or digest',async()=>{
 const api=route('../src/app/api/account-capacity/route.ts');
 const response=await api.get('status=PARTIAL,EMPTY&recipient_digest=forged&actor_user_id=foreign');
 assert.equal(response.status,200);assert.match(response.headers['Cache-Control'],/no-store/);
 assert.equal(api.calls.length,1);assert.equal(api.calls[0][0],member);
 assert.equal(api.calls[0][1].status,'EMPTY,PARTIAL');
 for(const query of ['status=EMPTY&status=PARTIAL','status=UNKNOWN',`cursor=${'x'.repeat(513)}`]){
  assert.equal((await api.get(query)).status,400);assert.equal(api.calls.length,1);
 }
 const unavailable=route('../src/app/api/account-capacity/route.ts',{fail:true});
 const failed=await unavailable.get('');assert.equal(failed.status,503);
 assert.ok(!JSON.stringify(failed.body).includes('PRIVATE_DATABASE_DETAILS'));
});

test('account transporter search derives its digest from authenticated identity only',async()=>{
 const api=route('../src/app/api/capacity-search/route.ts');
 const response=await api.get('view=account&q=Sheger&digest=forged');
 assert.equal(response.status,200);assert.equal(api.calls.length,1);
 assert.equal(api.calls[0][1].audience,'ACCOUNT');
 assert.equal(api.calls[0][1].actorId,member.id);
 assert.equal(api.calls[0][1].digest,'digest:member@example.invalid');
 assert.equal((await api.get('view=account&status=EMPTY&status=PARTIAL')).status,400);
 assert.equal(api.calls.length,1);
});

test('mobile account Capacity and profile search require a bearer account and use its identity',async()=>{
 for(const [path,query] of [
  ['../src/app/api/mobile/account-capacity/route.ts','status=EMPTY&recipient_digest=forged'],
  ['../src/app/api/mobile/account-capacity/search/route.ts','q=Sheger&digest=forged']
 ]){
  const denied=route(path,{user:null});assert.equal((await denied.get(query)).status,401);assert.equal(denied.calls.length,0);
  const api=route(path);const response=await api.get(query);assert.equal(response.status,200);assert.match(response.headers['Cache-Control'],/no-store/);
  assert.equal(api.calls.length,1);
  if(path.includes('/search/')){assert.equal(api.calls[0][1].digest,'digest:member@example.invalid');assert.equal(api.calls[0][1].audience,'ACCOUNT');assert.equal(api.calls[0][1].actorId,member.id);}
  else assert.equal(api.calls[0][0],member);
  assert.equal((await api.get(path.includes('/search/')?'q=one&q=two':'status=EMPTY&status=PARTIAL')).status,400);
  assert.equal(api.calls.length,1);
 }
});

test('account profile search uses the account-authorized database projection',async()=>{
 const calls=[];
 const source=readFileSync(new URL('../src/lib/capacity-search.ts',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const output={};
 const imports={
  './supabase-adapter.js':{createSupabaseAdminClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return{data:{items:[],total:0,page:1,pageSize:15,hasMore:false},error:null};}})},
  './capacity-viewport.js':{capacityDatabaseFilters:filters=>filters},
  './capacity-filter-places.js':{resolveCapacityFilterPlaces:async()=>({places:{}})}
 };
 new Function('require','exports',compiled)(name=>{assert.ok(name in imports,name);return imports[name];},output);
 await output.searchCapacity({q:'Sheger',page:'2'},{audience:'ACCOUNT',actorId:member.id,digest:'verified-digest'});
 assert.equal(calls.length,1);
 assert.equal(calls[0].name,'account_capacity_search_results');
 assert.deepEqual(calls[0].args,{actor_user_id:member.id,recipient_digest:'verified-digest',query:{q:'Sheger',page:'2'},requested_page:2});
});
