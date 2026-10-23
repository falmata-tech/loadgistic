import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as domain from '../src/lib/business-workspaces/domain.js';
const require=createRequire(import.meta.url);
const actor='16100000-0000-4000-8000-000000000001',vehicle='16100000-0000-4000-8000-000000000002',workspace='16100000-0000-4000-8000-000000000003',grant='16100000-0000-4000-8000-000000000004';
function load(ports){const exports={};new Function('require','exports',ts.transpileModule(readFileSync('src/lib/business-capacity/supabase.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{if(name in ports)return ports[name];throw Error(`UNEXPECTED_IMPORT:${name}`);},exports);return exports;}
function adapter(client,feed=()=>{throw Error('UNEXPECTED_FEED');}){return load({'zod':require('zod'),'../supabase-adapter.js':{createSupabaseAdminClient:()=>{throw Error('NO_IMPLICIT_DATABASE');}},'../repository/supabase.js':{listSupabaseBusinessCapacity:feed},'../business-workspaces/domain.js':domain});}
test('explicit business sharing binds actor, truck and selected business and rejects client authority',async()=>{
 const calls=[];let data={id:grant,vehicleId:vehicle,workspaceId:workspace,revision:1,created:true};
 const {businessCapacitySharingPort}=adapter({});const port=businessCapacitySharingPort({rpc:async(name,args)=>{calls.push([name,args]);return {data,error:null};}});
 assert.deepEqual(await port.command(actor,{action:'GRANT',vehicleId:vehicle,workspaceId:workspace}),data);
 assert.deepEqual(calls[0],['grant_business_capacity_access',{actor_user_id:actor,target_vehicle_id:vehicle,target_workspace_id:workspace}]);
 for(const value of [{action:'GRANT',vehicleId:vehicle,workspaceId:workspace,actorId:actor},{action:'GRANT',vehicleId:vehicle,email:'company@example.test'},{action:'GRANT',vehicleId:vehicle,workspaceId:'not-id'},{action:'REVOKE',grantId:grant,revision:'1'},{action:'REVOKE',grantId:grant,revision:0}])await assert.rejects(port.command(actor,value),/INVALID_BUSINESS_INPUT/);
 assert.equal(calls.length,1);
 data={...data,workspaceId:vehicle};await assert.rejects(port.command(actor,{action:'GRANT',vehicleId:vehicle,workspaceId:workspace}),/BUSINESS_UNAVAILABLE/);
 data={id:grant,revision:2,revoked:true};assert.deepEqual(await port.command(actor,{action:'REVOKE',grantId:grant,revision:1}),data);
 data={...data,id:workspace};await assert.rejects(port.command(actor,{action:'REVOKE',grantId:grant,revision:1}),/BUSINESS_UNAVAILABLE/);
});
test('scope denials retain authorization failures and never return raw database diagnostics',async()=>{
 const {businessCapacitySharingPort}=adapter({});
 for(const [message,expected] of [['private details BUSINESS_FORBIDDEN','BUSINESS_FORBIDDEN'],['BUSINESS_REVISION_CONFLICT','BUSINESS_REVISION_CONFLICT'],['EXCLUSIVE_RECIPIENT_ONLY','INVALID_BUSINESS_INPUT'],['internal credentials error','BUSINESS_UNAVAILABLE']]){
  const port=businessCapacitySharingPort({rpc:async()=>({data:null,error:{message}})});
  await assert.rejects(port.command(actor,{action:'GRANT',vehicleId:vehicle,workspaceId:workspace}),error=>error.message===expected);
 }
});
test('business feed preserves rich shared projection and exact selected workspace, validates before database',async()=>{
 const calls=[],page={items:[],hasMore:false,nextCursor:null,pageSize:100};
 const {listBusinessCapacity}=adapter({},async(...args)=>{calls.push(args);return page;});
 assert.deepEqual(await listBusinessCapacity(actor,workspace,{status:'EMPTY,PARTIAL',cursor:'cursor'}),page);
 assert.deepEqual(calls,[[actor,workspace,{status:'EMPTY,PARTIAL',cursor:'cursor'},{pageSize:100,cursor:'cursor'}]]);
 await assert.rejects(listBusinessCapacity(actor,'foreign-text',{}),/INVALID_BUSINESS_INPUT/);assert.equal(calls.length,1);
 const denied=adapter({},async()=>{throw Error('FORBIDDEN');});await assert.rejects(denied.listBusinessCapacity(actor,workspace,{}),/BUSINESS_FORBIDDEN/);
});
test('business profile search ignores map filters and takes authority only from verified actor and route workspace',async()=>{
 const calls=[];const ports={'../business-workspaces/http':{businessActor:async()=>actor,businessLimit:async(...args)=>calls.push(['limit',...args]),BusinessHttpError:class extends Error{constructor(status,code){super(code);this.status=status;}}},'./supabase':{businessCapacitySearchPort:()=>({search:async(...args)=>{calls.push(['search',...args]);return {items:[],total:0,page:1,pageSize:15,hasMore:false};}})}};
 const exports={};new Function('require','exports',ts.transpileModule(readFileSync('src/lib/business-capacity/http.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>ports[name],exports);
 await exports.businessSearchResult(new Request('http://localhost/api/business-workspaces/'+workspace+'/capacity/search?q=Synthetic&page=2&status=PARTIAL&ownerDocs=IDENTITY&actorId=foreign'),workspace);
 assert.deepEqual(calls[1],['search',actor,workspace,'Synthetic',2]);
 await assert.rejects(exports.businessSearchResult(new Request('http://localhost/?q=one&q=two'),workspace),/INVALID_BUSINESS_INPUT/);assert.equal(calls.filter(c=>c[0]==='search').length,1);
});
test('business search projection accepts only known public profile fields, never an extra hidden location payload',async()=>{
 let data={items:[{key:'PROVIDER:synthetic',kind:'COMPANY',title:'Synthetic transport',subtitle:null,description:null,identifier:'synthetic',handle:'synthetic',capacity_id:null,city:null,status:null,owner:'Synthetic transport',driver:null,documents:[],matching_trucks:1}],total:1,page:1,pageSize:15,hasMore:false};
 const {businessCapacitySearchPort}=adapter({});const port=businessCapacitySearchPort({rpc:async()=>({data,error:null})});
 assert.equal((await port.search(actor,workspace,'Synthetic')).items.length,1);
 data={...data,items:[{...data.items[0],location_lat:12.345}]};await assert.rejects(port.search(actor,workspace,'Synthetic'),/BUSINESS_UNAVAILABLE/);
 for(const [text,page] of [['x'.repeat(121),1],['ok',0],['ok',1.2]])await assert.rejects(port.search(actor,workspace,text,page),/INVALID_BUSINESS_INPUT/);
});
