import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// This test creates disposable member accounts/photos in the isolated local Loadgistic DB.
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
const sessions=[];
async function member(label,type){let value=await loginLocal(`mobile-portrait-${label}-${Date.now()}@loadgistic.local`);sessions.push(value);assert.equal((await call('onboarding',{name:'Native Photo Test',businessName:'Native Photo Transport',phone:'+251900000078',applicationType:type},value.accessToken)).status,200);const refreshed=await call('auth/refresh',{refreshToken:value.refreshToken});assert.equal(refreshed.status,200);sessions[sessions.length-1]=refreshed.value;return refreshed.value;}
try{
 const driver=await member('driver','OWNER_OPERATOR'),owner=await member('owner','TRANSPORT_COMPANY'),path='account/portrait';
 assert.equal((await call(path)).status,401);assert.equal((await call(path,undefined,owner.accessToken)).status,403);
 assert.equal((await call(path,{action:'REMOVE'},driver.accessToken)).status,400);
 assert.equal((await call(path,fileCommand({action:'UPLOAD',consent:false}),driver.accessToken)).status,400);
 assert.equal((await call(path,fileCommand({action:'UPLOAD',consent:true,actorId:owner.user.id}),driver.accessToken)).status,400);
 assert.equal((await call(path,fileCommand({action:'UPLOAD',consent:true},Buffer.from('not an image')),driver.accessToken)).status,400);
 const photo=readFileSync(new URL('../apps/mobile/assets/loadgistic-icon.png',import.meta.url));
 assert.equal((await call(path,fileCommand({action:'UPLOAD',consent:true},photo),owner.accessToken)).status,403);
 const saved=await call(path,fileCommand({action:'UPLOAD',consent:true},photo),driver.accessToken);assert.equal(saved.status,200,saved.value.error?.message);
 const workspace=await call(path,undefined,driver.accessToken);assert.equal(workspace.status,200);assert.equal(workspace.value.hasPortrait,true);assert.ok(workspace.value.image.startsWith('/api/public/driver-portraits/'));assert.equal(workspace.value.file_path,undefined);
 const publicPhoto=await fetch(base+workspace.value.image);assert.equal(publicPhoto.status,200);assert.equal(publicPhoto.headers.get('content-type'),'image/jpeg');assert.ok((await publicPhoto.arrayBuffer()).byteLength>0);
 assert.equal((await call(path,{action:'REMOVE',confirm:true},driver.accessToken)).status,200);assert.equal((await call(path,undefined,driver.accessToken)).value.hasPortrait,false);assert.equal((await fetch(base+workspace.value.image)).status,404);
 console.log('PASS: driver-only photo, explicit consent, actor/content rejection, normalized public image and withdrawal');
}finally{for(const session of sessions)await call('auth/logout',{accessToken:session.accessToken,refreshToken:session.refreshToken}).catch(()=>undefined);}
