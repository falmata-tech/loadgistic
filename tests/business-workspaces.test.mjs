import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as domain from '../src/lib/business-workspaces/domain.js';
const require=createRequire(import.meta.url);
const actor='16000000-0000-4000-8000-000000000001',workspace='16000000-0000-4000-8000-000000000002',other='16000000-0000-4000-8000-000000000003';
function load(path,ports){const exports={};new Function('require','exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{if(name in ports)return ports[name];throw Error(`UNEXPECTED_IMPORT:${name}`);},exports);return exports;}
const summary={id:workspace,name:'Synthetic cargo business',handle:'synthetic-cargo',kind:'SHIPPER',city:null,version:1,actorId:actor,actorRole:'CUSTOMER',membershipRole:'STAFF',membershipRevision:1,permissions:{capacity:true,tracking:false,team:false,owner:false}};
test('business inputs reject client authority, unsupported roles, ambiguous permissions and hidden fields',()=>{
 assert.deepEqual(domain.businessCreation({name:' Test cargo ',handle:'TEST-cargo',kind:'BROKER'}),{name:'Test cargo',handle:'test-cargo',kind:'BROKER',city:null});
 for(const input of [null,[],{name:'Test',handle:'test',kind:'SUPPORT'},{name:'Test',handle:'test',kind:'SHIPPER',ownerId:actor},{name:'Test',handle:'test',kind:'SHIPPER',city:'a\nb'}])assert.throws(()=>domain.businessCreation(input),/INVALID_BUSINESS_INPUT/);
 assert.deepEqual(domain.businessCommand({action:'INVITE',expectedVersion:2,email:' Person+Test@Example.test ',role:'STAFF',capacity:true,tracking:false}),{action:'INVITE',expectedVersion:2,email:'person+test@example.test',role:'STAFF',capacity:true,tracking:false});
 for(const extra of [{actorId:other},{workspaceId:other},{allowLocation:true},{team:true}])assert.throws(()=>domain.businessCommand({action:'LEAVE',expectedVersion:2,...extra}),/INVALID_BUSINESS_INPUT/);
 for(const input of [{action:'INVITE',expectedVersion:1,email:'a@example.test',role:'OWNER',capacity:true,tracking:true},{action:'INVITE',expectedVersion:1,email:'a@example.test',role:'STAFF',capacity:'true',tracking:false},{action:'ARCHIVE',expectedVersion:'1'},{action:'REMOVE_MEMBER',expectedVersion:1,userId:'not-a-uuid'},{action:'UPDATE_DETAILS',expectedVersion:1,name:'Cargo',city:'',email:'hidden@example.test'}])assert.throws(()=>domain.businessCommand(input),/INVALID_BUSINESS_INPUT/);
});
test('application binds every request to verified actor plus exact explicit workspace; return cache keys include membership revision',async()=>{
 const calls=[];const methods=['context','create','select','directory','command','accept','search'];
 const port=Object.fromEntries(methods.map(name=>[name,async(...args)=>{calls.push([name,...args]);return null;}]));
 const {businessWorkspaceService}=load('src/lib/business-workspaces/application.ts',{'./domain.js':domain});const service=businessWorkspaceService(port);
 await service.directory(actor,workspace);await service.command(actor,workspace,{action:'ARCHIVE',expectedVersion:3});await service.select(actor,null);await service.accept(actor,other);
 assert.deepEqual(calls,[['directory',actor,workspace],['command',actor,workspace,{action:'ARCHIVE',expectedVersion:3}],['select',actor,null],['accept',actor,other]]);
 assert.notEqual(domain.businessCacheKey(actor,workspace,1),domain.businessCacheKey(other,workspace,1));assert.notEqual(domain.businessCacheKey(actor,workspace,1),domain.businessCacheKey(actor,workspace,2));
 assert.throws(()=>service.directory(actor,'../../foreign'),/INVALID_BUSINESS_INPUT/);assert.equal(calls.length,4);
});
test('Supabase adapter repeats exact actor/workspace binding and rejects foreign or oversized private projections',async()=>{
 const {supabaseBusinessWorkspacePort}=load('src/lib/business-workspaces/supabase.ts',{'zod':require('zod'),'../supabase-adapter.js':{createSupabaseAdminClient:()=>{throw Error('NO_IMPLICIT_DATABASE');}},'./domain.js':domain});
 let data=summary,error=null;const calls=[];const port=supabaseBusinessWorkspacePort({rpc:async(name,args)=>{calls.push([name,args]);return {data,error};}});
 assert.deepEqual(await port.select(actor,workspace),summary);assert.deepEqual(calls[0],['business_workspace_select',{actor_user_id:actor,target_workspace_id:workspace}]);
 data={...summary,actorId:other};await assert.rejects(port.select(actor,workspace),/BUSINESS_UNAVAILABLE/);
 data={...summary,id:other};await assert.rejects(port.select(actor,workspace),/BUSINESS_UNAVAILABLE/);
 data={...summary,privateEmail:'hidden@example.test'};await assert.rejects(port.select(actor,workspace),/BUSINESS_UNAVAILABLE/);
 data={workspace:summary,members:[{userId:other,firstName:'Synthetic',role:'STAFF',active:true,revision:1,capacity:true,tracking:false,email:'hidden@example.test'}],invitations:[]};
 await assert.rejects(port.directory(actor,workspace),/BUSINESS_UNAVAILABLE/);
 data={workspace:summary,members:[{userId:other,firstName:'Former team member',role:'STAFF',active:false,revision:2,capacity:false,tracking:false,erased:true}],invitations:[]};
 assert.equal((await port.directory(actor,workspace)).members[0].erased,true);
 for(const extra of [{email:'erased@example.test'},{active:true}]){data={...data,members:[{...data.members[0],...extra}]};await assert.rejects(port.directory(actor,workspace),/BUSINESS_UNAVAILABLE/);data={...data,members:[{userId:other,firstName:'Former team member',role:'STAFF',active:false,revision:2,capacity:false,tracking:false,erased:true}]};}
 data={actorId:actor,selectedWorkspaceId:other,workspaces:[summary],invitations:[]};await assert.rejects(port.context(actor),/BUSINESS_UNAVAILABLE/);
 data=null;assert.equal(await port.select(actor,null),null);
 error={message:'SQL details and private data: BUSINESS_FORBIDDEN'};await assert.rejects(port.context(actor),error=>error.message==='BUSINESS_FORBIDDEN');
 error={message:'private infrastructure failure'};await assert.rejects(port.context(actor),error=>error.message==='BUSINESS_UNAVAILABLE');
});
test('invitation email delivery is leased after persistence, escapes user text and reports failure without losing invitation',async()=>{
 const {deliverBusinessInvitation}=load('src/lib/business-workspaces/invitation-email.ts',{'../email-provider.js':{sendManagedEmail:()=>{throw Error('NO_IMPLICIT_EMAIL');}},'./domain.js':domain});
 let lease={id:other,workspaceId:workspace,email:'synthetic@example.test',businessName:'Synthetic <cargo> business',expiresAt:'2026-10-25',lease:actor},records=[],messages=[],fail=false;
 const port={claimInvitationEmail:async(...args)=>{assert.deepEqual(args,[actor,workspace,other]);return lease;},recordInvitationEmail:async(...args)=>{records.push(args);return true;}};
 const sender={send:async(message,key)=>{messages.push([message,key]);if(fail)throw Error('private SMTP details');}};
 assert.equal(await deliverBusinessInvitation(port,actor,workspace,other,sender,'https://loadgistic.com'),'SENT');
 assert.equal(messages[0][0].to,'synthetic@example.test');assert.match(messages[0][0].html,/Synthetic &lt;cargo&gt; business/);assert.match(messages[0][0].text,/https:\/\/loadgistic\.com\/workspaces/);assert.doesNotMatch(messages[0][0].text,/@example\.test|token=|lease=/);
 assert.equal(records[0].at(-1),true);assert.match(messages[0][1],new RegExp(`${other}/${actor}$`));
 fail=true;assert.equal(await deliverBusinessInvitation(port,actor,workspace,other,sender,'https://loadgistic.com'),'FAILED');assert.equal(records.at(-1).at(-1),false);
 lease=null;assert.equal(await deliverBusinessInvitation(port,actor,workspace,other,sender,'https://loadgistic.com'),'PENDING');assert.equal(messages.length,2);
});
