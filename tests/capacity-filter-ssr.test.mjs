import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as filters from '../src/lib/capacity-filter-values.js';
function page({admin=false,actor=null,authError=null}={}){
 const calls=[],authCalls=[];
 const source=readFileSync(new URL(admin?'../src/app/admin/capacity-network/page.tsx':'../src/app/page.tsx',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const node=(type,props)=>({type,props:props||{}}),imports={
  'react/jsx-runtime':{jsx:node,jsxs:node},'@/components/localization':{Text:'Text',Localized:'Localized'},'@/components/flash':{Flash:'Flash'},
  '@/lib/auth':{getCurrentUser:async options=>{authCalls.push(options);if(authError)throw authError;return actor;},requireUser:async(roles,options)=>{authCalls.push({roles,options});if(authError)throw authError;return actor;}},
  '@/lib/private-capacity.js':{listAccountCapacity:async(_user,query)=>{calls.push(query);return{items:[],hasMore:false,nextCursor:null,pageSize:100};}},
  '@/lib/business-capacity/supabase':{listBusinessCapacity:async(_user,_workspace,query)=>{calls.push(query);return{items:[],hasMore:false,nextCursor:null,pageSize:100};}},
  '@/lib/capacity-market.js':{listPublicCapacityCursor:async query=>{calls.push(query);return{items:[]};}},
  '@/lib/auth-flow.js':{localAuthInboxUrl:()=>null},'@/components/public-header':{PublicHeader:'PublicHeader'},
  '@/components/public-capacity-feed':{PublicCapacityFeed:'Feed'},'@/lib/platform-copy.js':{capacityIntroduction:{}},'@/lib/capacity-filter-values.js':filters,
  '@/lib/seo.js':{publicPageMetadata:()=>({})},'next/navigation':{notFound:()=>{throw new Error('SYNTHETIC_NOT_FOUND');},redirect:path=>{throw new Error(`SYNTHETIC_REDIRECT:${path}`);}},
  'lucide-react':{Network:'Network'},'@/components/page-header':{PageHeader:'Header'}
 };
 const exports={};new Function('require','exports',compiled)(name=>{assert.ok(name in imports);return imports[name];},exports);
 return{calls,authCalls,render:query=>exports.default({searchParams:Promise.resolve(query)})};
}
function find(tree){if(Array.isArray(tree))return tree.map(find).find(Boolean);if(!tree||typeof tree!=='object')return;if(tree.type==='Feed')return tree;return find(tree.props?.children);}
function businessPage(){
 const source=readFileSync(new URL('../src/app/app/business/capacity/page.tsx',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const imports={'next/navigation':{redirect:path=>{throw new Error(`SYNTHETIC_REDIRECT:${path}`);}}};
 const exports={};new Function('require','exports',compiled)(name=>{assert.ok(name in imports,name);return imports[name];},exports);
 return{render:query=>exports.default({searchParams:Promise.resolve(query)})};
}
test('public SSR canonicalizes valid groups before its one map request',async()=>{
 const current=page(),feed=find(await current.render({status:'PARTIAL,EMPTY',locationSource:'MOBILE,GPS'}));
 assert.equal(current.calls.length,1);assert.equal(current.calls[0].status,'EMPTY,PARTIAL');assert.equal(feed.props.query.locationSource,'GPS,MOBILE');
});
test('public and signed-in business Capacity preserve canonical area location and radius',async()=>{
 const area={currentAreaPlaceRef:'ethiopia-adama',currentArea:'Adama',currentAreaRadiusKm:'50',status:'PARTIAL'};
 const publicPage=page(),publicFeed=find(await publicPage.render(area));
 assert.equal(publicPage.calls.length,1);for(const key of ['currentAreaPlaceRef','currentArea','currentAreaRadiusKm'])assert.equal(publicPage.calls[0][key],area[key]);
 assert.equal(publicFeed.props.query.currentAreaPlaceRef,area.currentAreaPlaceRef);
 const actor={id:'synthetic-owner',role:'CUSTOMER',active:true,selected_business_workspace:{id:'synthetic-business',membershipRevision:1,permissions:{capacity:true}}};
 const business=page({actor}),businessFeed=find(await business.render({...area,view:'private'}));
 assert.equal(business.calls.length,1);for(const key of ['currentAreaPlaceRef','currentArea','currentAreaRadiusKm'])assert.equal(business.calls[0][key],area[key]);
 assert.equal(businessFeed.props.query.currentAreaPlaceRef,area.currentAreaPlaceRef);
});
test('old Space needed links cannot leave an invisible map filter active',async()=>{
 const current=page(),feed=find(await current.render({status:'PARTIAL',loadType:'FTL'}));
 assert.equal(current.calls.length,1);
 assert.equal(current.calls[0].status,'PARTIAL');
 assert.equal(current.calls[0].loadType,undefined);
 assert.equal(feed.props.query.loadType,undefined);
 assert.equal(feed.props.initial.filterError,undefined);
});
test('signed-out private Capacity stays in the same map destination but requires sign-in',async()=>{
 const current=page();
 await assert.rejects(current.render({view:'private',status:'EMPTY'}),/SYNTHETIC_REDIRECT:\/login\?from=shared-capacity/);
 assert.equal(current.calls.length,0);
});
test('business Capacity opens the private map and ignores an old Space needed link',async()=>{
 const legacy=businessPage();
 await assert.rejects(legacy.render({status:'PARTIAL',loadType:'FTL',locationSource:'MANUAL,GPS',q:'separate profile search'}),/SYNTHETIC_REDIRECT:\/\?/);
 const actor={id:'synthetic-owner',role:'CUSTOMER',active:true,selected_business_workspace:{id:'synthetic-business',membershipRevision:1,permissions:{capacity:true}}};
 const current=page({actor}),feed=find(await current.render({view:'private',status:'PARTIAL',loadType:'FTL',locationSource:'MANUAL,GPS',q:'separate profile search'}));
 assert.equal(current.calls.length,1);
 assert.equal(current.calls[0].status,'PARTIAL');
 assert.equal(current.calls[0].locationSource,'GPS,MANUAL');
 assert.equal(current.calls[0].loadType,undefined);
 assert.equal(current.calls[0].q,'');
 assert.equal(feed.props.query.loadType,undefined);
 assert.equal(feed.props.apiPath,'/api/business-workspaces/synthetic-business/capacity');
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
