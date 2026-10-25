import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {z} from 'zod';
import * as domain from '../src/lib/business-directory/domain.js';

const actor='20000000-0000-4000-8000-000000000001',target='20000000-0000-4000-8000-000000000002',connectionId='20000000-0000-4000-8000-000000000003';
const baseAccount={kind:'BUSINESS',id:target,name:'Adama Cargo Desk',handle:'adama-cargo',managerName:'Hana',city:'Adama'};
const account={...baseAccount,connectionStatus:null,connectionDirection:null};
function load(path,imports){const exports={};new Function('require','exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{assert.ok(name in imports,'Unexpected import '+name);return imports[name];},exports);return exports;}
function port(reply,networkSize=null){const calls=[],client={rpc:async(name,args)=>{calls.push([name,args]);if(name==='account_directory_statuses')return{data:args.account_ids.map((id,index)=>({kind:args.account_kinds[index],id,status:null})),error:null};if(name==='account_directory_network_sizes')return{data:args.account_ids.map((id,index)=>({kind:args.account_kinds[index],id,network_size:networkSize})),error:null};return typeof reply==='function'?reply(name,args):{data:reply,error:null};}};
 const module=load('src/lib/account-directory.ts',{zod:{z},'./supabase-adapter.js':{createSupabaseAdminClient(){throw Error('NO_IMPLICIT_DB');}},'./business-directory/domain.js':domain});
 return {port:module.accountDirectoryPort(client),calls};
}
test('account directory validates the server projection and rejects extra personal fields',async()=>{
 const valid=[{payload:account,total_count:'1'}];const h=port(valid),result=await h.port.search(actor,'  Adama  ',1);
 assert.equal(result.items[0].name,'Adama Cargo Desk');assert.equal(result.items[0].statusBadge,null);assert.equal(result.items[0].networkSize,null);assert.equal(result.total,1);
 assert.deepEqual(h.calls,[['account_directory_page',{actor_user_id:actor,search_text:'Adama',requested_offset:0,requested_limit:8}],['account_directory_statuses',{actor_user_id:actor,account_kinds:['BUSINESS'],account_ids:[target]}],['account_directory_network_sizes',{actor_user_id:actor,account_kinds:['BUSINESS'],account_ids:[target]}]]);
 const privateRow=structuredClone(valid);privateRow[0].payload.email='private@example.invalid';
 await assert.rejects(port(privateRow).port.search(actor,'',1),/DIRECTORY_UNAVAILABLE/);
 const badTotal=structuredClone(valid);badTotal[0].total_count='9007199254740993';
 await assert.rejects(port(badTotal).port.search(actor,'',1),/DIRECTORY_UNAVAILABLE/);
});
test('network size is a bounded opt-in aggregate and owner preference uses server identity',async()=>{
 const rows=[{payload:account,total_count:1}];
 assert.equal((await port(rows,0).port.search(actor)).items[0].networkSize,0);
 assert.equal((await port(rows,'12').port.search(actor)).items[0].networkSize,12);
 await assert.rejects(port(rows,'9007199254740993').port.search(actor),/DIRECTORY_UNAVAILABLE/);
 const h=port((name)=>({data:name==='business_network_preference'?{visible:false,version:2}:{visible:true,version:3},error:null}));
 assert.deepEqual(await h.port.networkPreference(actor,target),{visible:false,version:2});
 assert.deepEqual(await h.port.setNetworkPreference(actor,target,true,2),{visible:true,version:3});
 assert.deepEqual(h.calls,[['business_network_preference',{actor_user_id:actor,target_workspace_id:target}],['set_business_network_visibility',{actor_user_id:actor,target_workspace_id:target,visible:true,expected_version:2}]]);
 await assert.rejects(h.port.setNetworkPreference(actor,target,'true',2),/NETWORK_INVALID_INPUT/);
 await assert.rejects(h.port.networkPreference(actor,'forged'),/NETWORK_INVALID_INPUT/);
});
test('connection commands bind the actor and exact target, with no client-supplied grants',async()=>{
 const h=port((name)=>({data:name==='request_account_connection'?{id:connectionId,status:'PENDING',created:true}:name==='decide_account_connection'?{id:connectionId,status:'ACCEPTED'}:name==='grant_account_capacity_access'?{id:target,vehicleId:target,connectionId,revision:1,created:true}:name==='revoke_account_capacity_access'?{id:target,revision:2,revoked:true}:[],error:null}));
 assert.deepEqual(await h.port.request(actor,'BUSINESS',target),{id:connectionId,status:'PENDING',created:true});
 assert.deepEqual(h.calls[0],['request_account_connection',{actor_user_id:actor,target_kind:'BUSINESS',target_id:target}]);
 await h.port.decide(actor,connectionId,'ACCEPT');
 assert.deepEqual(h.calls[1],['decide_account_connection',{actor_user_id:actor,target_connection_id:connectionId,decision:'ACCEPT'}]);
 for(const [kind,id] of [['STAFF',target],['BUSINESS','forged']])await assert.rejects(h.port.request(actor,kind,id),/DIRECTORY_INVALID_INPUT/);
 await assert.rejects(h.port.decide(actor,connectionId,'GRANT'),/DIRECTORY_INVALID_INPUT/);
 assert.deepEqual(await h.port.grantVehicle(actor,connectionId,target),{id:target,vehicleId:target,connectionId,revision:1,created:true});
 assert.deepEqual(h.calls[2],['grant_account_capacity_access',{actor_user_id:actor,target_connection_id:connectionId,target_vehicle_id:target}]);
 assert.deepEqual(await h.port.revokeVehicle(actor,target,1),{id:target,revision:2,revoked:true});
 assert.deepEqual(h.calls[3],['revoke_account_capacity_access',{actor_user_id:actor,target_grant_id:target,expected_revision:1}]);
 await assert.rejects(h.port.grantVehicle(actor,target,'forged'),/DIRECTORY_INVALID_INPUT/);
 await assert.rejects(h.port.revokeVehicle(actor,target,0),/DIRECTORY_INVALID_INPUT/);
 assert.equal(h.calls.length,4);
});
test('connection list rejects a hidden email or vehicle identifier from the database',async()=>{
 const payload={id:connectionId,status:'PENDING',direction:'INCOMING',canManage:true,account:baseAccount,createdAt:'2026-10-24T00:00:00Z',updatedAt:'2026-10-24T00:00:00Z'};
 assert.equal((await port([{payload}]).port.connections(actor)).length,1);
 for(const change of [row=>{row.email='private@example.invalid';},row=>{row.account.vehicleIds=[target];}]){
  const rows=[{payload:structuredClone(payload)}];change(rows[0].payload);await assert.rejects(port(rows).port.connections(actor),/DIRECTORY_UNAVAILABLE/);
 }
});
function http(){const calls=[],auth={actor},json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}}),deps={
  '@/lib/business-workspaces/http':{
   BusinessHttpError:class BusinessHttpError extends Error{constructor(status,code){super(code);this.status=status;this.code=code;}},
   businessActor:async()=>{if(!auth.actor)throw new deps['@/lib/business-workspaces/http'].BusinessHttpError(401,'SIGN_IN_REQUIRED');return auth.actor;},
   businessBody:async(request)=>{const value=await request.json();if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID');return value;},
   businessJson:json,businessLimit:async()=>{}
  },
  '@/lib/business-directory/domain.js':domain,
  '@/lib/account-directory':{
   AccountDirectoryError:class AccountDirectoryError extends Error{constructor(code){super(code);this.code=code;}},
   accountDirectoryPort:()=>({search:async(...args)=>{calls.push(['search',...args]);return{items:[],total:0,page:1,pageSize:8,pageCount:1};},connections:async(...args)=>{calls.push(['list',...args]);return[];},request:async(...args)=>{calls.push(['request',...args]);return{id:connectionId,status:'PENDING',created:true};},decide:async(...args)=>{calls.push(['decide',...args]);return{id:connectionId,status:'ACCEPTED'};},grantVehicle:async(...args)=>{calls.push(['grantVehicle',...args]);return{id:target,vehicleId:target,connectionId,revision:1,created:true};},revokeVehicle:async(...args)=>{calls.push(['revokeVehicle',...args]);return{id:target,revision:2,revoked:true};}})
  }
 };
 const routes=[load('src/app/api/account-directory/route.ts',deps),load('src/app/api/account-connections/route.ts',deps),load('src/app/api/account-vehicle-shares/route.ts',deps)];
 return{routes,calls,auth};
}
test('directory and connection HTTP reject caller identity, unknown fields and signed-out requests before database calls',async()=>{
 const h=http(),[directory,connections]=h.routes,base='https://loadgistic.example';
 for(const query of ['?actorId='+target,'?q=a&q=b','?page=0'])assert.equal((await directory.GET(new Request(base+'/api/account-directory'+query))).status,400);
 assert.equal((await directory.GET(new Request(base+'/api/account-directory?q=Adama&page=1'))).status,200);
 assert.deepEqual(h.calls.at(-1),['search',actor,'Adama',1]);
 assert.equal((await connections.POST(new Request(base+'/api/account-connections',{method:'POST',body:JSON.stringify({kind:'BUSINESS',targetId:target,actorId:target})}))).status,400);
 assert.equal((await connections.POST(new Request(base+'/api/account-connections',{method:'POST',body:JSON.stringify({kind:'BUSINESS',targetId:target})}))).status,200);
 assert.deepEqual(h.calls.at(-1),['request',actor,'BUSINESS',target]);
 assert.equal((await connections.PATCH(new Request(base+'/api/account-connections',{method:'PATCH',body:JSON.stringify({id:connectionId,decision:'ACCEPT',vehicleIds:[target]})}))).status,400);
 assert.equal((await connections.GET(new Request(base+'/api/account-connections'))).headers.get('cache-control'),'private, no-store');
 assert.equal((await connections.POST(new Request(base+'/api/account-connections',{method:'POST',body:JSON.stringify({action:'DECIDE',id:connectionId,decision:'ACCEPT'})}))).status,200);
 assert.deepEqual(h.calls.at(-1),['decide',actor,connectionId,'ACCEPT']);
 const before=h.calls.length;h.auth.actor=null;
 assert.equal((await directory.GET(new Request(base+'/api/account-directory'))).status,401);
 assert.equal((await connections.GET(new Request(base+'/api/account-connections'))).status,401);
 assert.equal(h.calls.length,before);
});
test('vehicle-share HTTP accepts exact vehicle commands only for the signed-in actor',async()=>{
 const h=http(),shares=h.routes[2],base='https://loadgistic.example/api/account-vehicle-shares';
 for(const body of [{action:'GRANT',connectionId,vehicleId:target,actorId:target},{action:'GRANT',connectionId,vehicleId:target,vehicles:[target]},{action:'REVOKE',grantId:target,revision:1,actorId:target}])
  assert.equal((await shares.POST(new Request(base,{method:'POST',body:JSON.stringify(body)}))).status,400);
 assert.equal((await shares.POST(new Request(base,{method:'POST',body:JSON.stringify({action:'GRANT',connectionId,vehicleId:target})}))).status,200);
 assert.deepEqual(h.calls.at(-1),['grantVehicle',actor,connectionId,target]);
 assert.equal((await shares.POST(new Request(base,{method:'POST',body:JSON.stringify({action:'REVOKE',grantId:target,revision:1})}))).status,200);
 assert.deepEqual(h.calls.at(-1),['revokeVehicle',actor,target,1]);
 const before=h.calls.length;h.auth.actor=null;
 assert.equal((await shares.POST(new Request(base,{method:'POST',body:JSON.stringify({action:'GRANT',connectionId,vehicleId:target})}))).status,401);
 assert.equal(h.calls.length,before);
});
test('network visibility HTTP accepts only the selected owner setting and never a caller identity',async()=>{
 const calls=[],auth={actor},BusinessHttpError=class BusinessHttpError extends Error{constructor(status,code){super(code);this.status=status;this.code=code;}};
 const deps={
  '@/lib/business-workspaces/http':{BusinessHttpError,businessActor:async()=>{if(!auth.actor)throw new BusinessHttpError(401,'SIGN_IN_REQUIRED');return auth.actor;},businessBody:async request=>await request.json(),businessJson:(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}}),businessLimit:async()=>{}},
  '@/lib/business-workspaces/domain.js':{businessId:domain.directoryIdentity,BusinessWorkspaceError:domain.BusinessDirectoryError},
  '@/lib/account-directory':{AccountDirectoryError:class AccountDirectoryError extends Error{constructor(code){super(code);this.code=code;}},accountDirectoryPort:()=>({networkPreference:async(...args)=>{calls.push(['get',...args]);return{visible:false,version:2};},setNetworkPreference:async(...args)=>{calls.push(['set',...args]);return{visible:true,version:3};}})}
 };
 const route=load('src/app/api/business-workspaces/[workspaceId]/network-visibility/route.ts',deps),context={params:Promise.resolve({workspaceId:target})},url=`https://loadgistic.example/api/business-workspaces/${target}/network-visibility`;
 assert.equal((await route.GET(new Request(url),context)).status,200);
 assert.deepEqual(calls.at(-1),['get',actor,target]);
 for(const body of [{visible:true,expectedVersion:2,actorId:target},{visible:'true',expectedVersion:2},{visible:true}])assert.equal((await route.POST(new Request(url,{method:'POST',body:JSON.stringify(body)}),context)).status,400);
 assert.equal((await route.POST(new Request(url,{method:'POST',body:JSON.stringify({visible:true,expectedVersion:2})}),context)).status,200);
 assert.deepEqual(calls.at(-1),['set',actor,target,true,2]);
 const before=calls.length;auth.actor=null;
 assert.equal((await route.GET(new Request(url),context)).status,401);
 assert.equal(calls.length,before);
});
