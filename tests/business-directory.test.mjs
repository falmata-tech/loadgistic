import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {z} from 'zod';
import * as domain from '../src/lib/business-directory/domain.js';
import * as workspaceDomain from '../src/lib/business-workspaces/domain.js';
import {readMobileMultipart} from '../src/lib/mobile/file-contract.js';

const actor='17000000-0000-4000-8000-000000000001',workspace='17000000-0000-4000-8000-000000000002',foreign='17000000-0000-4000-8000-000000000003',requestId='17000000-0000-4000-8000-000000000004';
function load(path,ports){const exports={};new Function('require','exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{assert.ok(name in ports,'Unexpected import '+name);return ports[name];},exports);return exports;}
const badge=()=>['IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS'].map(type=>({type,verified:false,expired:false,reviewedAt:null,expiresOn:null}));
const business=()=>({id:workspace,name:'Highland Freight Desk',handle:'highland-desk',kind:'BROKER',city:'Adama',managerName:'Meron',documents:badge()});
const center=(canManage=true)=>({workspaceId:workspace,name:'Highland Freight Desk',handle:'highland-desk',managerName:'Meron',canManage,documents:badge(),subjects:canManage?[{subject_type:'BUSINESS_WORKSPACE',subject_id:workspace,name:'Highland Freight Desk',type:'Shipper / broker account',verification_types:['IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS'],vehicles:[],approved_documents:[]}]:[],requests:[]});
const rawRequest=()=>({id:requestId,subject_type:'BUSINESS_WORKSPACE',subject_id:workspace,verification_type:'IDENTITY',status:'PENDING',document_name:'National ID',submitted_at:'2026-10-18T12:00:00Z',reviewed_at:null,expires_on:null,review_note:null,has_file:true,stale:false});
function port(data){const calls=[],client={rpc:async(name,args)=>{calls.push({name,args});return typeof data==='function'?data(name,args,calls.length):{data,error:null};}};const module=load('src/lib/business-directory/supabase.ts',{zod:{z},'../supabase-adapter.js':{createSupabaseAdminClient(){throw Error('NO_IMPLICIT_CLIENT');}},'./domain.js':domain});return{port:module.supabaseBusinessDirectoryPort(client),calls};}
test('directory domain bounds query and page, preserves Unicode names and refuses malformed identities',()=>{
 assert.deepEqual(domain.directorySearch('  Ａዲስ  ','2'),{query:'Aዲስ',page:2});assert.deepEqual(domain.directorySearch(),{query:'',page:1});assert.equal(domain.directoryIdentity(actor),actor);
 for(const value of [null,'a','/../',{},1])assert.throws(()=>domain.directoryIdentity(value),/INVALID_BUSINESS_INPUT/);
 for(const [q,page] of [[null,1],['a'.repeat(121),1],['x\n',1],['x',0],['x','1.5'],['x','10000'],['x','1e2'],['x',{}]])assert.throws(()=>domain.directorySearch(q,page),/INVALID_BUSINESS_INPUT/);
});
test('strict directory RPC uses verified actor, bounded offset and one first-page recovery only',async()=>{
 const h=port((_name,_args,n)=>({data:n===1?[]:[{payload:business(),total_count:'13'}],error:null}));
 const result=await h.port.search(actor,'  Highland ',3);assert.equal(result.page,1);assert.equal(result.pageCount,2);assert.equal(result.total,13);
 assert.deepEqual(h.calls,[{name:'provider_business_directory',args:{actor_user_id:actor,search_text:'Highland',requested_offset:24,requested_limit:12}},{name:'provider_business_directory',args:{actor_user_id:actor,search_text:'Highland',requested_offset:0,requested_limit:12}}]);
 const empty=port([]);assert.deepEqual(await empty.port.search(actor,'',1),{items:[],total:0,page:1,pageSize:12,pageCount:1});assert.equal(empty.calls.length,1);
 const stillEmpty=port([]);assert.equal((await stillEmpty.port.search(actor,'',999)).page,1);assert.equal(stillEmpty.calls.length,2);
});
test('strict directory RPC rejects extra hidden fields, missing/duplicate badges and inconsistent totals',async()=>{
 const valid=[{payload:business(),total_count:'1'}];assert.equal((await port(valid).port.search(actor,'',1)).items[0].managerName,'Meron');
 for(const mutate of [rows=>{rows[0].payload.email='private@example.test';},rows=>{rows[0].payload.documents.pop();},rows=>{rows[0].payload.documents[1]=structuredClone(rows[0].payload.documents[0]);},rows=>{rows[0].payload.documents[0].storage_path='private/proof';},rows=>{rows[0].total_count='1e10';},rows=>{rows.push({...structuredClone(rows[0]),payload:{...business(),id:foreign},total_count:'2'});},rows=>{rows[0].total_count='9007199254740993';}]){
  const malformed=structuredClone(valid);mutate(malformed);await assert.rejects(port(malformed).port.search(actor,'',1),/BUSINESS_DIRECTORY_UNAVAILABLE/);
 }
});
test('document RPC binds every subject/request to the requested workspace and strips team request metadata',async()=>{
 const owner=center();owner.requests=[rawRequest()];const result=await port(owner).port.documents(actor,workspace);assert.equal(result.canManage,true);assert.equal(result.requests[0].subjectId,workspace);assert.deepEqual(result.subjects[0].allowedTypes,['BUSINESS_LICENSE','BUSINESS_ADDRESS']);
 const staff=await port(center(false)).port.documents(actor,workspace);assert.equal(staff.canManage,false);assert.deepEqual(staff.subjects,[]);assert.deepEqual(staff.requests,[]);
 for(const mutate of [data=>{data.workspaceId=foreign;},data=>{data.subjects[0].subject_id=foreign;},data=>{data.subjects=[];},data=>{data.requests[0].subject_id=foreign;},data=>{data.requests[0].storage_path='private';},data=>{data.documents[0].private_email='private@example.test';},data=>{data.canManage=false;}]){const bad=structuredClone(owner);mutate(bad);await assert.rejects(port(bad).port.documents(actor,workspace),/BUSINESS_DIRECTORY_UNAVAILABLE/);}
 const denied=port(()=>({data:null,error:{message:'FORBIDDEN sensitive detail'}}));await assert.rejects(denied.port.documents(actor,workspace),error=>error.message==='FORBIDDEN');
 const unknown=port(()=>({data:null,error:{message:'private connection string'}}));await assert.rejects(unknown.port.documents(actor,workspace),error=>error.message==='BUSINESS_DIRECTORY_UNAVAILABLE');
});
function httpHarness(){
 let verified=true,canManage=true,limit=true,uploadError='',command={verificationType:'IDENTITY',documentName:'National ID'},subjects=['IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS'];const calls=[];
 const http=load('src/lib/business-workspaces/http.ts',{
  '@supabase/supabase-js':{createClient:()=>client},'../supabase/server':{createSupabaseServerClient:async()=>client},'../supabase/config':{getSupabasePublicConfig:()=>({url:'http://localhost',publishableKey:'synthetic-public-key'})},
  '../rate-limit.js':{checkRateLimit:async()=>({allowed:limit})},'../origin.js':{mutationOriginAllowed:headers=>headers.get('origin')!=='https://foreign.test'},'../privacy/content-policy.js':{contentPolicyAccepted:async()=>true},'../privacy/review-access.js':{reviewAccountAllowed:async()=>true},'./domain.js':workspaceDomain,'./application':{businessWorkspaceService:()=>({})},'./supabase':{supabaseBusinessWorkspacePort:()=>({})},'./invitation-email':{deliverBusinessInvitation:async()=>{throw Error('NO_MAIL');}}
 });
 const client={auth:{getUser:async()=>{calls.push('identity');return{data:{user:verified?{id:actor,email:'synthetic@example.test',email_confirmed_at:'2026-10-18',app_metadata:{}}:null},error:null};}}};
 const directoryHttp=load('src/lib/business-directory/http.ts',{'./domain.js':domain,'../business-workspaces/http':http});
 const ports={zod:{z},'@/lib/business-workspaces/http':http,'@/lib/business-directory/domain.js':domain,'@/lib/business-directory/http':directoryHttp,
  '@/lib/business-directory/supabase':{supabaseBusinessDirectoryPort:()=>({search:async(id,q,page)=>{calls.push(['search',id,q,page]);return{items:[],total:0,page,pageSize:12,pageCount:1};},documents:async(id,workspaceId)=>{calls.push(['preflight',id,workspaceId]);return{canManage,subjects:[{allowedTypes:subjects}]};}})},
  '@/lib/mobile/file-contract.js':{readMobileMultipart:async()=>{calls.push('multipart');if(uploadError)throw Error(uploadError);return{command,file:{name:'proof.pdf',type:'application/pdf',size:10}};}},
  '@/lib/verification/supabase.js':{submitSupabaseVerification:async(user,input,file)=>{calls.push(['submit',user,input,file]);return requestId;}}
 };
 const directory=load('src/app/api/business-directory/route.ts',ports),documents=load('src/app/api/business-workspaces/[workspaceId]/documents/route.ts',ports);
 return{directory,documents,calls,config(input){if('verified'in input)verified=input.verified;if('canManage'in input)canManage=input.canManage;if('limit'in input)limit=input.limit;if('command'in input)command=input.command;if('uploadError'in input)uploadError=input.uploadError;if('subjects'in input)subjects=input.subjects;}};
}
const request=(path,method='GET',headers={})=>new Request(`http://localhost${path}`,{method,headers});
const context=(workspaceId=workspace)=>({params:Promise.resolve({workspaceId})});
test('directory GET refuses unknown/duplicate params and never accepts a client actor',async()=>{
 const h=httpHarness();for(const query of ['?actorId='+foreign,'?q=a&q=b','?page=1&page=2','?role=ADMIN','?page=0'])assert.equal((await h.directory.GET(request('/api/business-directory'+query))).status,400);
 assert.equal(h.calls.some(call=>Array.isArray(call)&&call[0]==='search'),false);
 const good=await h.directory.GET(request('/api/business-directory?q=Meron&page=2'));assert.equal(good.status,200);assert.deepEqual(h.calls.at(-1),['search',actor,'Meron',2]);assert.equal(good.headers.get('cache-control'),'private, no-store');assert.match(good.headers.get('x-robots-tag'),/noindex/);
 h.config({verified:false});assert.equal((await h.directory.GET(request('/api/business-directory'))).status,401);
});
test('document commands authorize owner before multipart/storage and derive exact actor/subject from verified context',async()=>{
 const h=httpHarness(),url=`/api/business-workspaces/${workspace}/documents`;
 h.config({canManage:false});assert.equal((await h.documents.POST(request(url,'POST'),context())).status,403);assert.equal(h.calls.includes('multipart'),false);assert.equal(h.calls.some(call=>Array.isArray(call)&&call[0]==='submit'),false);
 h.config({canManage:true});h.calls.length=0;assert.equal((await h.documents.POST(request(url,'POST'),context())).status,200);assert.deepEqual(h.calls.slice(0,3),['identity',['preflight',actor,workspace],'multipart']);
 assert.deepEqual(h.calls[3],['submit',{id:actor},{subjectType:'BUSINESS_WORKSPACE',subjectId:workspace,verificationType:'IDENTITY',documentName:'National ID',expiresOn:''},{name:'proof.pdf',type:'application/pdf',size:10}]);
 const before=h.calls.length;assert.equal((await h.documents.GET(request(url),context('bad-workspace'))).status,400);assert.equal(h.calls.length,before+1);
 h.config({limit:false});assert.equal((await h.documents.POST(request(url,'POST'),context())).status,429);
 h.config({limit:true});assert.equal((await h.documents.POST(request(url,'POST',{origin:'https://foreign.test'}),context())).status,403);
});
test('only the three business categories and bounded exact command fields can reach document storage',async()=>{
 const h=httpHarness(),url=`/api/business-workspaces/${workspace}/documents`;
 for(const verificationType of ['IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS']){h.config({command:{verificationType,documentName:'  Current proof  ',expiresOn:'2027-10-18'}});assert.equal((await h.documents.POST(request(url,'POST'),context())).status,200);const saved=h.calls.at(-1)[2];assert.equal(saved.documentName,'Current proof');assert.equal(saved.verificationType,verificationType);}
 const invalid=[{verificationType:'DRIVER_IDENTITY',documentName:'x'},{verificationType:'IDENTITY',documentName:''},{verificationType:'IDENTITY',documentName:'x'.repeat(151)},{verificationType:'IDENTITY',documentName:'x',subjectId:foreign},{verificationType:'IDENTITY',documentName:'x',actorId:foreign},{verificationType:'IDENTITY',documentName:'x',expiresOn:'tomorrow'}];
 for(const command of invalid){h.config({command});const before=h.calls.filter(call=>Array.isArray(call)&&call[0]==='submit').length;assert.equal((await h.documents.POST(request(url,'POST'),context())).status,400);assert.equal(h.calls.filter(call=>Array.isArray(call)&&call[0]==='submit').length,before);}
 h.config({command:{verificationType:'IDENTITY',documentName:'x'},subjects:['BUSINESS_LICENSE']});assert.equal((await h.documents.POST(request(url,'POST'),context())).status,409);
});
test('invalid calendar expiry cannot reach storage',async()=>{
 const h=httpHarness(),url=`/api/business-workspaces/${workspace}/documents`;
 for(const expiresOn of ['2026-99-99','2027-02-29','2026-02-30']){h.config({command:{verificationType:'IDENTITY',documentName:'x',expiresOn}});assert.equal((await h.documents.POST(request(url,'POST'),context())).status,400);assert.equal(h.calls.some(call=>Array.isArray(call)&&call[0]==='submit'),false);}
});
test('multipart failures and unknown storage details are sanitized before response',async()=>{
 const h=httpHarness(),url=`/api/business-workspaces/${workspace}/documents`;
 for(const [uploadError,status,code] of [['FILE_TOO_LARGE',413,'FILE_TOO_LARGE'],['INVALID_UPLOAD',400,'INVALID_INPUT'],['private secret storage failure',503,'BUSINESS_UNAVAILABLE']]){h.config({uploadError});const response=await h.documents.POST(request(url,'POST'),context()),body=await response.json();assert.equal(response.status,status);assert.equal(body.error.code,code);assert.ok(body.error.message&&body.error.message!==uploadError);assert.ok(!JSON.stringify(body).includes('private secret'));assert.equal(h.calls.some(call=>Array.isArray(call)&&call[0]==='submit'),false);}
});
test('real bounded multipart parser rejects duplicate command/files, spoof fields and malformed JSON before any storage',async()=>{
 const create=(entries)=>{const body=new FormData();for(const [key,value] of entries)body.append(key,value);return new Request('http://localhost/documents',{method:'POST',body});},file=()=>new File(['proof'],'proof.pdf',{type:'application/pdf'}),command=JSON.stringify({verificationType:'IDENTITY',documentName:'ID'});
 const valid=await readMobileMultipart(create([['command',command],['file',file()]]));assert.equal(valid.command.verificationType,'IDENTITY');
 for(const entries of [[['command',command],['command',command],['file',file()]],[['command',command],['file',file()],['file',file()]],[['command',command],['file',file()],['actorId',foreign]],[['command','not json'],['file',file()]]])await assert.rejects(readMobileMultipart(create(entries)),/INVALID_UPLOAD/);
});
