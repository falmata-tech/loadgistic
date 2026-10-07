import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const env=readFileSync(new URL('../.env.local',import.meta.url),'utf8');assert.match(env,/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:55321\s*$/m);
const key=env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g,'');assert.ok(key);
const service=createClient('http://127.0.0.1:55321',key,{auth:{persistSession:false,autoRefreshToken:false}});
async function call(path,body,token){const r=await fetch('http://127.0.0.1:3100/api/mobile/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(60000)});return {status:r.status,value:await r.json()};}
async function rpc(name,args){const result=await service.rpc(name,args);assert.equal(result.error,null,`Local ${name} failed`);return result.data;}
const input={requestId:randomUUID(),secret:randomBytes(32).toString('hex'),name:'Native Brokerage Test',phone:'+251900000077',origin:'Adama',destination:'Dire Dawa'};let token;
try{
 assert.equal((await call('brokerage')).status,403);
 const start=await call('brokerage/start',input);assert.equal(start.status,201,start.value.error?.message);token=start.value.token;assert.ok(token);assert.equal(start.value.snapshot.request.id,input.requestId);
 const retry=await call('brokerage/start',input);assert.equal(retry.status,201);assert.equal(retry.value.snapshot.request.id,input.requestId);
 const rows=await service.from('transport_service_requests').select('id,status,version').eq('id',input.requestId);assert.equal(rows.error,null);assert.equal(rows.data.length,1);
 assert.equal((await call('brokerage/start',{...input,secret:randomBytes(32).toString('hex')})).status,403);
 assert.equal((await call('brokerage',undefined,token+'x')).status,403);
 assert.equal((await call('brokerage?before=bad',undefined,token)).status,400);
 assert.equal((await call('brokerage',{action:'SEND',messageId:randomUUID(),body:'Bad actor',actorId:input.requestId},token)).status,400);
 const message={action:'SEND',messageId:randomUUID(),body:'Please help arrange this local test load.'};
 assert.equal((await call('brokerage',message,token)).status,200);assert.equal((await call('brokerage',message,token)).status,200);
 assert.equal((await call('brokerage',{...message,body:'Changed duplicate'},token)).status,400);
 const admin=await service.from('profiles').select('id').eq('active',true).eq('role','ADMIN').limit(1).single();assert.equal(admin.error,null);const actor=admin.data.id;
 await rpc('assign_transport_service_request',{actor_user_id:actor,request_id:input.requestId,expected_version:rows.data[0].version,target_user_id:actor,claim:false});
 await rpc('send_transport_chat_message',{request_id:input.requestId,access_digest:null,actor_user_id:actor,message_id:randomUUID(),message_body:'A brokerage agent is reviewing your route.'});
 let read=await call('brokerage',undefined,token);assert.equal(read.status,200);assert.equal(read.value.messages.length,2);assert.ok(read.value.messages.some(item=>item.kind==='BROKER'));assert.ok(read.value.request.assignedName);assert.equal(read.value.staffDetails,undefined);assert.equal(JSON.stringify(read.value).includes('access_digest'),false);
 const earlier=Array.from({length:55},(_,i)=>({id:randomUUID(),request_id:input.requestId,actor_user_id:null,sender_kind:'VISITOR',body:`Synthetic page message ${i}`}));assert.equal((await service.from('transport_chat_messages').insert(earlier)).error,null);
 read=await call('brokerage',undefined,token);assert.equal(read.value.messages.length,50);assert.equal(read.value.hasOlder,true);const older=await call('brokerage?before='+read.value.messages[0].sequence,undefined,token);assert.equal(older.value.messages.length,7);assert.ok(older.value.messages.every(item=>!read.value.messages.some(newer=>newer.id===item.id)));
 const end=await call('brokerage',{action:'END',confirm:true},token);assert.equal(end.status,200);assert.ok(end.value.request.endedAt);assert.equal(end.value.request.status,'NEW');
 assert.equal((await call('brokerage',{action:'SEND',messageId:randomUUID(),body:'After ending'},token)).status,409);assert.equal((await call('brokerage',undefined,token)).status,200);
 const staff=await rpc('transport_chat_snapshot',{request_id:input.requestId,access_digest:null,actor_user_id:actor,after_sequence:0,before_sequence:null});assert.equal(staff.staffDetails.phone,input.phone);assert.ok(staff.request.endedAt);
 console.log('PASS: guest intake/retry deduplication, capability denial, assigned staff reply, duplicate message safety, 57-message pagination, ended-chat read and retained phone follow-up');
}finally{if(token)await call('brokerage',{action:'END',confirm:true},token).catch(()=>undefined);}
