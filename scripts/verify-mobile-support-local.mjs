import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// This test creates disposable member accounts/chats in the isolated local Loadgistic DB.
// Never accept a remote target or print credentials, OTPs or mailbox contents.
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
assert.ok(/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:55321\s*$/m.test(env), 'Isolated Loadgistic backend required');
const base = 'http://127.0.0.1:3100';
const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1sAAAAASUVORK5CYII=', 'base64');
const fileCommand = (command, bytes = pngBytes, type = 'image/png') => { const form = new FormData(); form.append('command', JSON.stringify(command)); form.append('file', new Blob([bytes], { type }), 'local-proof.png'); return form; };

async function call(path, body, token) {
 const response = await fetch(base + '/api/mobile/' + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined || body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: 'Bearer '+token } : {}) }, ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }), signal: AbortSignal.timeout(30000) });
 assert.ok(response.headers.get('content-type')?.includes('application/json'), `Expected JSON from ${path}, status ${response.status}`);
 return { status: response.status, value: await response.json() };
}
for (const route of ['session', 'dashboard', 'invitations']) assert.equal((await call(route)).status, 401);
assert.equal((await call('session', undefined, 'a.b.c')).status, 401);
async function loginLocal(email) {
const start = Date.now();
const requested = await call('auth/request', { email });
assert.equal(requested.status, 200); assert.ok(typeof requested.value.handoff === 'string');
let code;
for (let attempt = 0; attempt < 30 && !code; attempt++) {
 const list = await (await fetch('http://127.0.0.1:55324/api/v1/messages')).json();
 const found = (list.messages || []).find(item => new Date(item.Created).getTime() >= start - 2000 && item.To?.some(to => to.Address === email));
 if (found) { const detail = await (await fetch('http://127.0.0.1:55324/api/v1/message/'+encodeURIComponent(found.ID))).json(); code = String(detail.Text || detail.HTML || '').match(/(?:^|\D)(\d{6})(?:\D|$)/)?.[1]; }
 if (!code) await new Promise(resolve => setTimeout(resolve, 250));
}
assert.ok(code, 'Local OTP delivery required');
const login = await call('auth/verify', { handoff: requested.value.handoff, code });
assert.equal(login.status, 200); return login.value;
}

const { createClient } = await import('@supabase/supabase-js');
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
assert.ok(key, 'Local service credential required; never printed');
const service = createClient('http://127.0.0.1:55321', key, { auth: { persistSession: false, autoRefreshToken: false } });
async function rpc(name, args) { const { data, error } = await service.rpc(name, args); assert.equal(error, null, `Local ${name} failed`); return data; }
const sessions = [], chats = [];
async function member(label) {
 let session = await loginLocal(`mobile-support-${label}-${Date.now()}@loadgistic.local`); sessions.push(session);
 assert.equal((await call('onboarding', { name: 'Native Support Test', businessName: 'Native Support Transport', phone: '+251900000091', applicationType: 'OWNER_OPERATOR' }, session.accessToken)).status, 200);
 const refreshed = await call('auth/refresh', { refreshToken: session.refreshToken }); assert.equal(refreshed.status, 200); session = refreshed.value; sessions[sessions.length-1] = session; return session;
}
try {
 const owner = await member('owner'), outsider = await member('outsider'), token = owner.accessToken;
 assert.equal((await call('support')).status, 401);
 assert.equal((await call('support?page=-1', undefined, token)).status, 400);
 assert.equal((await call('support', { category: 'ACCOUNT', body: 'Test', actorId: outsider.user.id }, token)).status, 400);
 const initial = await call('support', undefined, token); assert.equal(initial.status, 200); assert.equal(initial.value.open, null);
 const created = await call('support', { category: 'CAPACITY', body: 'Please help with my truck availability.' }, token); assert.equal(created.status, 201, created.value.error?.message);
 const id = created.value.id; chats.push({id,token}); const path = `support/${id}`;
 assert.equal((await call('support', { category: 'ACCOUNT', body: 'Duplicate active' }, token)).status, 409);
 const active = await call('support', undefined, token); assert.equal(active.value.open.id, id);
 for (const request of [[path,undefined],[path,{action:'SEND',body:'Forbidden'}],[path,{action:'END',confirm:true}]]) assert.equal((await call(request[0],request[1],outsider.accessToken)).status,404);
 assert.equal((await call(path+'?before=invalid', undefined, token)).status,400);
 const first = await call(path, undefined, token); assert.equal(first.status,200); assert.equal(first.value.messages[0].body,'Please help with my truck availability.');
 assert.equal(first.value.messages[0].mine,true); assert.equal(JSON.stringify(first.value).includes('customer_user_id'),false);
 const adminResult = await service.from('profiles').select('id').eq('role','ADMIN').eq('active',true).limit(1).single(); assert.equal(adminResult.error,null);
 const staffId = adminResult.data.id;
 const staffView = await rpc('managed_support_conversation',{actor_user_id:staffId,conversation_id:id,requested_limit:50,mark_read:false});
 assert.equal(staffView.messages[0].body,first.value.messages[0].body,'Web staff service sees native intake');
 await rpc('send_managed_support_message',{actor_user_id:staffId,conversation_id:id,message_body:'The support team can see your request.'});
 const updated = await call(path,undefined,token); assert.equal(updated.value.messages.at(-1).mine,false); assert.equal(updated.value.messages.at(-1).body,'The support team can see your request.');
 assert.equal((await call(path,{action:'SEND',body:'Thank you.'},token)).status,200);
 const bytes=readFileSync(new URL('../apps/mobile/assets/loadgistic-icon.png',import.meta.url));
 const form=new FormData();form.append('command',JSON.stringify({action:'SEND',body:'Synthetic test screenshot'}));form.append('file',new Blob([bytes],{type:'image/png'}),'native-test.png');
 const uploaded=await fetch(`http://127.0.0.1:3100/api/mobile/${path}`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form,signal:AbortSignal.timeout(60000)});
 assert.equal(uploaded.status,200,'Native attachment submission');
 const afterFile=await call(path,undefined,token), file=afterFile.value.messages.find(item=>item.attachment)?.attachment; assert.ok(file?.id);
 const filePath=`${path}/attachments/${file.id}`;
 const read=await call(filePath,undefined,token);assert.equal(read.status,200);assert.deepEqual(Buffer.from(read.value.base64,'base64'),bytes);
 assert.equal((await call(filePath,undefined,outsider.accessToken)).status,404);
 const historyRows=Array.from({length:55},(_,index)=>({conversation_id:id,sender_user_id:owner.user.id,body:`Synthetic earlier message ${index}`,created_at:new Date(Date.now()-120000-index*1000).toISOString()}));
 assert.equal((await service.from('support_messages').insert(historyRows)).error,null);
 const latest=await call(path,undefined,token);assert.equal(latest.value.messages.length,50);assert.equal(latest.value.hasOlder,true);
 const earlier=await call(`${path}?before=${latest.value.nextBefore}`,undefined,token);assert.equal(earlier.status,200);assert.equal(earlier.value.hasOlder,false);
 assert.equal(new Set([...latest.value.messages,...earlier.value.messages].map(item=>item.id)).size,59,'All retained messages reachable without duplication');
 assert.equal((await call(path,{action:'END',confirm:false},token)).status,400);
 assert.equal((await call(path,{action:'END',confirm:true},token)).status,200);
 assert.equal((await call(path,{action:'SEND',body:'After closure'},token)).status,409);
 assert.equal((await call(filePath,undefined,token)).status,200,'Own ended-chat attachment remains readable');
 const closed=await call('support',undefined,token);assert.equal(closed.value.open,null);assert.ok(closed.value.history.some(item=>item.id===id));
 const next=await call('support',{category:'OTHER',body:'A new test request'},token);assert.equal(next.status,201);chats.push({id:next.value.id,token});
 console.log('PASS: member intake reaches staff; staff reply reaches mobile; private attachments; cross-member read/send/end/file denial; strict inputs; active-chat uniqueness; cursor history; closure retention and new chat');
} finally {
 for(const chat of chats) await call(`support/${chat.id}`,{action:'END',confirm:true},chat.token).catch(()=>undefined);
 for(const session of sessions) await call('auth/logout',{accessToken:session.accessToken,refreshToken:session.refreshToken}).catch(()=>undefined);
}
