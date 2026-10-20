import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {capacityFilterParams} from '../src/lib/capacity-filter-values.js';

function route(path,authorized=true,failure=null){
 const calls=[];
 const list=async(...args)=>{calls.push(args);if(failure)throw failure;return{items:[],hasMore:false,nextCursor:null};};
 const source=readFileSync(new URL(path,import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const imports={
  'next/server.js':{NextResponse:{json:(body,options={})=>({body,status:options.status||200,headers:options.headers||{}})}},
  '@/lib/capacity-filter-values.js':{capacityFilterParams},
  '@/lib/capacity-market.js':{listPublicCapacityCursor:list},
  '@/lib/capacity-search':{searchCapacity:list},'@/lib/security.js':{privateContactDigest:()=>''},'@/lib/rate-limit':{checkRateLimit:async()=>({allowed:true})},
  '@/lib/retired-brokerage':{retiredPlatformCapacityResponse:()=>({status:410})},
  '@/lib/auth':{getSharedCapacitySession:async()=>authorized?{emailDigest:'synthetic'}:null,getCurrentUser:async()=>authorized?{id:'synthetic'}:null},
  '@/lib/private-capacity.js':{listSharedCapacity:list,listLoadgisticSharedCapacity:list}
 };
 const exports={};new Function('require','exports',compiled)(name=>{assert.ok(name in imports);return imports[name];},exports);
 return{calls,get:query=>exports.GET({url:`http://127.0.0.1/test?${query}`,headers:{get:()=>null}})};
}
for(const path of ['../src/app/api/public/capacity/route.ts','../src/app/api/shared-capacity/route.ts','../src/app/api/capacity-search/route.ts']){
 test(`${path}: canonical group parsing occurs once and repeated/unknown selections never call persistence`,async()=>{
  const api=route(path);
  const accepted=await api.get('status=PARTIAL,EMPTY&loadType=PTL,FTL&vehicleCategory=Pickup+truck,Cargo+van&locationSource=MOBILE,GPS,MOBILE');
  assert.equal(accepted.status,200);assert.equal(api.calls.length,1);
  const filters=api.calls[0].find(value=>value?.status);
  assert.equal(filters.status,'EMPTY,PARTIAL');assert.equal(filters.loadType,'FTL,PTL');assert.equal(filters.vehicleCategory,'Cargo van,Pickup truck');assert.equal(filters.locationSource,'GPS,MOBILE');
  for(const query of ['status=EMPTY&status=PARTIAL','status=EMPTY,FULL','loadType=FTL&status=PARTIAL','locationSource=GPS,UNKNOWN','locationSource=GPS&locationSource=MOBILE','q=a&q=b'])assert.equal((await api.get(query)).status,400);
  assert.equal(api.calls.length,1);
 });
}
test('invalid filter input cannot bypass the existing private authentication boundary',async()=>{
 for(const path of ['../src/app/api/shared-capacity/route.ts']){
  const api=route(path,false);assert.equal((await api.get('status=EMPTY&status=PARTIAL')).status,401);assert.equal(api.calls.length,0);
 }
 const search=route('../src/app/api/capacity-search/route.ts',false);
 assert.equal((await search.get('view=private&status=EMPTY&status=PARTIAL')).status,401);assert.equal(search.calls.length,0);
 assert.equal((await search.get('view=loadgistic&status=EMPTY&status=PARTIAL')).status,410);assert.equal(search.calls.length,0);
});
test('public map repository failure is a non-cacheable503 without internal cause or fake empty results',async()=>{
 const api=route('../src/app/api/public/capacity/route.ts',true,new Error('PRIVATE_REPOSITORY_SENTINEL',{cause:{code:'57014',details:'PRIVATE_CAUSE_SENTINEL'}}));
 const failed=await api.get('status=PARTIAL&vehicleCategory=Cargo+van');
 assert.equal(failed.status,503);
 assert.deepEqual(failed.body,{error:'Could not finish loading vehicles. Please try again.'});
 assert.deepEqual(failed.headers,{'Cache-Control':'private, no-store, max-age=0','CDN-Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store'});
 assert.equal(api.calls.length,1);
 assert.equal((await api.get('status=UNKNOWN')).status,400);
 assert.equal(api.calls.length,1,'invalid filters must still fail before persistence');
 const healthy=await route('../src/app/api/public/capacity/route.ts').get('status=PARTIAL');
 assert.equal(healthy.status,200);assert.deepEqual(healthy.body,{items:[],hasMore:false,nextCursor:null});
});
