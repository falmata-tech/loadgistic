import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as navigation from '../src/lib/team-navigation.js';
const id='11111111-1111-4111-8111-111111111111';
function route(file,{role='SUPPORT',deny=false}={}){
 const calls=[],user={id,role};
 const command=async(...args)=>{calls.push(args);if(deny)throw Error('FORBIDDEN');};
 const ports={
  'next/server.js':{NextResponse:{json:(body,options)=>({body,status:options?.status||200}),redirect:url=>({login:String(url)})}},
  '@/lib/auth':{getCurrentUser:async()=>user},'@/lib/support.js':{closeSupportConversation:command,claimSupportConversation:command,sendSupportMessage:command},
  '@/lib/errors':{errorMessage:error=>error.message},'@/lib/redirects':{redirectWith:(_request,path,key,value)=>({path,key,value}),text:(form,key)=>typeof form.get(key)==='string'?form.get(key).trim():''},
  '@/lib/team-navigation.js':navigation,'@/lib/support-policy.js':{canSendSupportMessage:()=>true},'@/lib/support-attachments.js':{sendSupportAttachment:command},
  '@/lib/rate-limit':{checkRateLimit:async()=>({allowed:true}),requestKey:()=> 'synthetic-local-test'}
 };
 const source=readFileSync(new URL('../'+file,import.meta.url),'utf8'),code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports',code)(key=>{assert.ok(key in ports,'Unexpected route boundary '+key);return ports[key];},exports);return{post:exports.POST,calls,user};
}
function request(returnTo,form=new FormData(),contentType='multipart/form-data'){
 const nextUrl=new URL('http://127.0.0.1:3100/api/support/test');if(returnTo)nextUrl.searchParams.set('returnTo',returnTo);
 return{url:String(nextUrl),nextUrl,headers:new Headers(contentType?{'content-type':contentType}:{}),formData:async()=>form};
}
test('staff close returns to exact allowed queue; providers never inherit staff navigation',async()=>{
 for(const [role,returnTo,expected]of[
  ['ADMIN','/admin/support?tab=chats&view=WAITING&queuePage=4','/admin/support?tab=chats&view=WAITING&queuePage=4'],
  ['SUPPORT','/support?view=CLOSED&page=2','/support?view=CLOSED&page=2'],
  ['SUPPORT','https://outside.example/steal','/support?view=ASSIGNED&page=1'],
  ['DRIVER','/admin/support?tab=team','/app/support']
 ]){const handler=route('src/app/api/support/conversations/[id]/close/route.ts',{role}),result=await handler.post(request(returnTo),{params:Promise.resolve({id})});assert.equal(result.path,expected);assert.deepEqual(handler.calls,[[handler.user,id]]);}
});
test('a failed close preserves the same safe queue context on the conversation',async()=>{
 const handler=route('src/app/api/support/conversations/[id]/close/route.ts',{deny:true});
 const result=await handler.post(request('/support?view=WAITING&page=3'),{params:Promise.resolve({id})});
 assert.equal(result.key,'error');assert.equal(new URL(result.path,'https://team.invalid').searchParams.get('returnTo'),'/support?view=WAITING&page=3');assert.equal(handler.calls.length,1);
});
test('malformed conversation IDs cannot turn a denied action into an unsafe or failing error redirect',async()=>{
 for(const action of['close','messages']){
  const handler=route(`src/app/api/support/conversations/[id]/${action}/route.ts`,{deny:true}),form=new FormData();form.set('body','Synthetic');
  const result=await handler.post(request('/support?view=WAITING&page=3',form),{params:Promise.resolve({id:'not-a-uuid'})});
  assert.equal(result.path,'/support?view=WAITING&page=3');assert.equal(result.key,'error');assert.equal(result.value,'FORBIDDEN');assert.equal(handler.calls.length,1);
 }
});
test('claim keeps its waiting page and bare POST compatibility without changing command input',async()=>{
 for(const bare of[false,true]){
  const handler=route('src/app/api/support/conversations/[id]/claim/route.ts'),form=new FormData();form.set('returnTo','/support?view=WAITING&page=2');
  const result=await handler.post(request(null,form,bare?'':'multipart/form-data'),{params:Promise.resolve({id})});
  assert.equal(new URL(result.path,'https://team.invalid').pathname,'/support/'+id);
  assert.equal(new URL(result.path,'https://team.invalid').searchParams.get('returnTo'),`/support?view=WAITING&page=${bare?1:2}`);
  assert.deepEqual(handler.calls,[[handler.user,id]]);
 }
});
test('message return context is outside the strict body and cannot bypass invalid message fields',async()=>{
 const handler=route('src/app/api/support/conversations/[id]/messages/route.ts'),form=new FormData();form.set('body','Synthetic response');
 const result=await handler.post(request('/support?view=ASSIGNED&page=5',form),{params:Promise.resolve({id})});
 assert.equal(new URL(result.path,'https://team.invalid').searchParams.get('returnTo'),'/support?view=ASSIGNED&page=5');assert.equal(result.key,'success');assert.deepEqual(handler.calls,[[handler.user,id,'Synthetic response']]);
 for(const invalid of['returnTo','assignee','role']){
  const denied=route('src/app/api/support/conversations/[id]/messages/route.ts'),body=new FormData();body.set('body','Synthetic');body.set(invalid,'ADMIN');
  const response=await denied.post(request('//outside.example',body),{params:Promise.resolve({id})});assert.equal(response.key,'error');assert.equal(response.value,'INVALID_SUPPORT_MESSAGE');assert.equal(denied.calls.length,0);assert.equal(new URL(response.path,'https://team.invalid').searchParams.get('returnTo'),'/support?view=ASSIGNED&page=1');
 }
});

test('Support conversation messages and closure preserve exact account context without changing commands',async()=>{
 const account='/admin/operations/users/'+id;
 for(const action of['messages','close']){const handler=route(`src/app/api/support/conversations/[id]/${action}/route.ts`),form=new FormData();form.set('body','Synthetic response');const result=await handler.post(request(account,form),{params:Promise.resolve({id})});assert.equal(action==='close'?result.path:new URL(result.path,'https://team.invalid').searchParams.get('returnTo'),account);assert.equal(handler.calls.length,1);}
});
