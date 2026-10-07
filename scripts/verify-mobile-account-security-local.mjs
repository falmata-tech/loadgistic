import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// This test creates disposable accounts and trucks in the isolated local Loadgistic DB.
// Never accept a remote target or print credentials, OTPs or mailbox contents.
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
assert.ok(/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:55321\s*$/m.test(env), 'Isolated Loadgistic backend required');
const base = 'http://127.0.0.1:3100';
const key=env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g,'');
assert.ok(key,'Local service credential required');
const service=createClient('http://127.0.0.1:55321',key,{auth:{persistSession:false,autoRefreshToken:false}});

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

const sessions=[];
async function newMember(label){let value=await loginLocal(`mobile-security-${label}-${Date.now()}@loadgistic.local`);sessions.push(value);assert.equal((await call('onboarding',{name:'Native Security Test',businessName:'Native Security Transport',phone:'+251900000089',applicationType:'OWNER_OPERATOR'},value.accessToken)).status,200);const refreshed=await call('auth/refresh',{refreshToken:value.refreshToken});assert.equal(refreshed.status,200);value=refreshed.value;sessions[sessions.length-1]=value;return value;}
async function mailbox(email,since){
 const list=await (await fetch('http://127.0.0.1:55324/api/v1/messages')).json();
 const messages=list.messages.filter(item=>new Date(item.Created).getTime()>=since-2000&&item.To?.some(to=>to.Address===email));
 return Promise.all(messages.map(async item=>await(await fetch('http://127.0.0.1:55324/api/v1/message/'+item.ID)).json()));
}
async function codeFor(email,since){for(let attempt=0;attempt<30;attempt++){const messages=await mailbox(email,since);for(const item of messages){const code=String(item.Text||item.HTML||'').match(/(?:^|\D)(\d{6})(?:\D|$)/)?.[1];if(code)return code;}await new Promise(resolve=>setTimeout(resolve,250));}throw new Error('Local security code missing');}
try{
 const owner=await newMember('email'), outsider=await newMember('other'), token=owner.accessToken;
 const operation={action:'EMAIL',email:`mobile-security-new-${Date.now()}@loadgistic.local`};
 const path='account/security';
 assert.equal((await call(path)).status,401);
 assert.equal((await call(path,{step:'REQUEST',operation:{...operation,actorId:outsider.user.id}},token)).status,400);
 assert.equal((await call(path,undefined,token)).value.blockers.length,0);
 const requestedAt=Date.now(),requested=await call(path,{step:'REQUEST',operation},token);assert.equal(requested.status,200,requested.value.error?.message);
 const code=await codeFor(owner.user.email,requestedAt),handoff=requested.value.handoff;
 assert.equal((await call(path,{step:'CONFIRM',operation,handoff,code},outsider.accessToken)).status,400,'Cross-actor handoff denied before OTP consumption');
 assert.equal((await call(path,{step:'CONFIRM',operation:{...operation,email:'forged@loadgistic.local'},handoff,code},token)).status,400,'Target cannot change after request');
 const confirmedAt=Date.now(),confirmed=await call(path,{step:'CONFIRM',operation,handoff,code},token);assert.equal(confirmed.status,200,confirmed.value.error?.message);assert.equal(confirmed.value.stage,'EMAIL_PENDING');
 assert.equal((await call(path,{step:'CONFIRM',operation,handoff,code},token)).status,400,'Current-email code cannot replay');
 const pending=await call(path,undefined,token);assert.equal(pending.value.pendingEmail,operation.email);assert.ok(pending.value.pendingHandoff);
 assert.equal((await call(path,{step:'CHECK',operation,handoff:pending.value.pendingHandoff},token)).value.stage,'EMAIL_PENDING');
 const links=new Set();
 for(let attempt=0;attempt<20&&links.size<2;attempt++){
  for(const email of [owner.user.email,operation.email])for(const item of await mailbox(email,confirmedAt)){
   const content=String(item.HTML||item.Text||'').replaceAll('&amp;','&');
   for(const match of content.matchAll(/https?:[^\s"<>]+/g)){try{const url=new URL(match[0]);if(url.origin==='http://127.0.0.1:55321'&&url.pathname==='/auth/v1/verify'&&url.searchParams.get('type')==='email_change')links.add(url.toString());}catch{}}
  }
  if(links.size<2)await new Promise(resolve=>setTimeout(resolve,250));
 }
 assert.equal(links.size,2,'Secure email change requires both local inbox confirmations');
 let confirmedLinks=0;
 for(const link of links){const response=await fetch(link,{redirect:'manual'});assert.ok([302,303].includes(response.status));const location=new URL(response.headers.get('location'));const fragment=new URLSearchParams(location.hash.slice(1)); const failure=location.searchParams.get('error_code')||fragment.get('error_code')||location.searchParams.get('error')||fragment.get('error'); assert.equal(failure,null,`Email confirmation returned ${String(failure).replace(/[^a-z_]/gi,'').slice(0,60)}`); confirmedLinks++; if(confirmedLinks===1)assert.equal((await call(path,{step:'CHECK',operation,handoff:pending.value.pendingHandoff},token)).value.stage,'EMAIL_PENDING','Both inboxes must confirm');}
 assert.equal((await call(path,{step:'CHECK',operation,handoff:pending.value.pendingHandoff},token)).value.stage,'COMPLETE');
 assert.equal((await call('account',undefined,token)).value.email,operation.email,'Confirmed email synchronized into account');
 console.log('PASS: current-email OTP; cross-actor/target denial; code replay denied; both inbox email-change confirmations; authoritative completion and account synchronization');
 const closing=await newMember('close'), closeToken=closing.accessToken, closeOperation={action:'DEACTIVATE',confirm:'DEACTIVATE'};
 const chat=await call('support',{category:'OTHER',body:'Local closure blocker test'},closeToken);assert.equal(chat.status,201);
 assert.ok((await call(path,undefined,closeToken)).value.blockers.includes('OPEN_SUPPORT'));
 assert.equal((await call(path,{step:'REQUEST',operation:closeOperation},closeToken)).status,409);
 assert.equal((await call(`support/${chat.value.id}`,{action:'END',confirm:true},closeToken)).status,200);
 const closeAt=Date.now(),closeRequest=await call(path,{step:'REQUEST',operation:closeOperation},closeToken);assert.equal(closeRequest.status,200);
 const closeCode=await codeFor(closing.user.email,closeAt);
 const deactivated=await call(path,{step:'CONFIRM',operation:closeOperation,handoff:closeRequest.value.handoff,code:closeCode},closeToken);assert.equal(deactivated.status,200,deactivated.value.error?.message);assert.equal(deactivated.value.stage,'DEACTIVATED');
 const denied=await call('dashboard',undefined,closeToken);
 assert.ok([401,403].includes(denied.status),'Stale access token loses workspace access');assert.ok(denied.value.error);
 const retained=await service.from('profiles').select('active').eq('id',closing.user.id).single();assert.equal(retained.error,null);assert.equal(retained.data.active,false);
 const history=await service.from('support_conversations').select('id').eq('id',chat.value.id).single();assert.equal(history.error,null);assert.equal(history.data.id,chat.value.id);
 assert.equal((await call('auth/refresh',{refreshToken:closing.refreshToken})).status,401,'Global closure revokes refresh');
 console.log('PASS: active-support blocker; fresh confirmation; retained-history deactivation; stale access/refresh denial');
}finally{for(const value of sessions)await call('auth/logout',{accessToken:value.accessToken,refreshToken:value.refreshToken}).catch(()=>undefined);}
