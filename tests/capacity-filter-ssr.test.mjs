import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as filters from '../src/lib/capacity-filter-values.js';
function page({admin=false,actor={id:'synthetic-staff',role:'SUPPORT'},authError=null}={}){
 const calls=[],authCalls=[];
 const source=readFileSync(new URL(admin?'../src/app/admin/capacity-network/page.tsx':'../src/app/page.tsx',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const node=(type,props)=>({type,props:props||{}}),imports={
  'react/jsx-runtime':{jsx:node,jsxs:node},'@/components/localization':{Text:'Text',Localized:'Localized'},'@/components/flash':{Flash:'Flash'},
  '@/lib/auth':{getSharedCapacitySession:async()=>({emailDigest:'synthetic',expiresAt:1}),requireUser:async(roles,options)=>{authCalls.push({roles,options});if(authError)throw authError;return actor;}},
  '@/lib/private-capacity.js':{listSharedCapacity:async(_digest,query)=>{calls.push(query);return{items:[]};},listLoadgisticSharedCapacity:async(user,query)=>{calls.push({user,query});return{items:[],hasMore:false,nextCursor:null,pageSize:100};}},
  '@/lib/capacity-market.js':{listPublicCapacityCursor:async query=>{calls.push(query);return{items:[]};}},
  '@/components/shared-capacity-session-boundary':{SharedCapacitySessionBoundary:'Boundary'},'@/components/locked-capacity-map':{LockedCapacityMap:'LockedMap'},
  '@/lib/auth-flow.js':{localAuthInboxUrl:()=>null},'@/components/public-header':{PublicHeader:'PublicHeader'},
  '@/components/public-capacity-feed':{PublicCapacityFeed:'Feed'},'@/lib/platform-copy.js':{capacityIntroduction:{}},'@/lib/capacity-filter-values.js':filters,
  '@/lib/seo.js':{publicPageMetadata:()=>({})},'next/navigation':{notFound:()=>{throw new Error('SYNTHETIC_NOT_FOUND');}},
  'lucide-react':{Network:'Network'},'@/components/page-header':{PageHeader:'Header'}
 };
 const exports={};new Function('require','exports',compiled)(name=>{assert.ok(name in imports);return imports[name];},exports);
 return{calls,authCalls,render:query=>exports.default({searchParams:Promise.resolve(query)})};
}
function find(tree){if(Array.isArray(tree))return tree.map(find).find(Boolean);if(!tree||typeof tree!=='object')return;if(tree.type==='Feed')return tree;return find(tree.props?.children);}
function businessPage(){
 const calls=[];
 const source=readFileSync(new URL('../src/app/app/business/capacity/page.tsx',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const node=(type,props)=>({type,props:props||{}}),imports={
  'react/jsx-runtime':{jsx:node,jsxs:node},'@/components/public-capacity-feed':{PublicCapacityFeed:'Feed'},
  '@/components/localization':{Text:'Text'},'lucide-react':{MapPinned:'MapPinned'},
  '@/lib/identity/require-business':{requireBusinessWorkspace:async()=>({user:{id:'synthetic-owner'},workspace:{id:'synthetic-business',name:'Synthetic business',membershipRevision:1}})},
  '@/lib/business-capacity/supabase':{listBusinessCapacity:async(_user,_workspace,query)=>{calls.push(query);return{items:[],hasMore:false,nextCursor:null,pageSize:100};}},
  '@/lib/capacity-filter-values.js':filters,
  '@/components/business-workspace.module.css':{__esModule:true,default:{}}
 };
 const exports={};new Function('require','exports',compiled)(name=>{assert.ok(name in imports,name);return imports[name];},exports);
 return{calls,render:query=>exports.default({searchParams:Promise.resolve(query)})};
}
test('SSR canonicalizes valid groups before its single public/private request',async()=>{
 for(const view of ['open','private']){
  const current=page(),feed=find(await current.render({view,status:'PARTIAL,EMPTY',locationSource:'MOBILE,GPS'}));
  assert.equal(current.calls.length,1);assert.equal(current.calls[0].status,'EMPTY,PARTIAL');assert.equal(feed.props.query.locationSource,'GPS,MOBILE');
 }
});
test('old Space needed links cannot leave an invisible map filter active',async()=>{
 for(const view of ['open','private']){
  const current=page(),feed=find(await current.render({view,status:'PARTIAL',loadType:'FTL'}));
  assert.equal(current.calls.length,1);
  assert.equal(current.calls[0].status,'PARTIAL');
  assert.equal(current.calls[0].loadType,undefined);
  assert.equal(feed.props.query.loadType,undefined);
  assert.equal(feed.props.initial.filterError,undefined);
 }
});
test('business Capacity applies published source without retaining an old Space needed link',async()=>{
 const current=businessPage();
 const feed=find(await current.render({status:'PARTIAL',loadType:'FTL',locationSource:'MANUAL,GPS',q:'separate profile search'}));
 assert.equal(current.calls.length,1);
 assert.equal(current.calls[0].status,'PARTIAL');
 assert.equal(current.calls[0].locationSource,'GPS,MANUAL');
 assert.equal(current.calls[0].loadType,undefined);
 assert.equal(current.calls[0].q,'');
 assert.equal(feed.props.query.loadType,undefined);
});
test('SSR repeated arrays and unknown selections remain denied through hydration instead of selecting a first value',async()=>{
 for(const query of [{status:['EMPTY','PARTIAL']},{vehicleCategory:['Cargo van','Mini Box Truck']},{q:['first','second']},{vehicleCategory:'Cargo van,unsupported'}]){
  const current=page(),feed=find(await current.render(query));assert.equal(current.calls.length,0);assert.ok(feed.props.initial.filterError);
  assert.throws(()=>filters.canonicalCapacityFilters(feed.props.query));
 }
});

test('retired admin capacity page does not read or render capacity',async()=>{
 const current=page({admin:true});
 assert.throws(()=>current.render({status:'EMPTY',locationSource:'GPS'}),/SYNTHETIC_NOT_FOUND/);
 assert.equal(current.calls.length,0);
 assert.equal(current.authCalls.length,0);
});
