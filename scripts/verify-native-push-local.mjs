import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createChunks} from '@supabase/ssr/dist/main/utils/chunker.js';
import {chromium} from 'playwright';
import {expect as baseExpect} from '@playwright/test';
import {processNativePushBatch} from '../src/lib/native-push-worker.js';
import {expoPushProvider} from '../src/lib/native-push-expo.js';

// Real local Auth/API/UI/PostgreSQL. Expo HTTP alone is explicitly fake; no
// provider request, email, hosted mutation or device-delivery claim is made.
const root=new URL('../',import.meta.url),env=readFileSync(new URL('.env.local',root),'utf8');
assert.ok(/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:55321\s*$/m.test(env),'Loadgistic local target required');
const key=name=>env.match(new RegExp('^'+name+'=(.+)$','m'))?.[1]?.trim().replace(/^['"]|['"]$/g,'');
const db=createClient('http://127.0.0.1:55321',key('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
const anon=key('NEXT_PUBLIC_SUPABASE_ANON_KEY')||key('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),web='http://127.0.0.1:3100',suffix=randomUUID().slice(0,8);
const users=[],clients=[],contexts=[],installations=[],chats=[],requests=[],browser=await chromium.launch({headless:true}),expect=baseExpect.configure({timeout:30000});
let stage='setup',currentPage;
const checked=result=>{if(result.error)throw Error('LOCAL_PUSH_FIXTURE_FAILED');return result.data;};
const rpc=async(name,args)=>checked(await db.rpc(name,args));
async function identity(label){const email=`push-audit-${label}-${suffix}@example.test`,user=checked(await db.auth.admin.createUser({email,email_confirm:true})).user;users.push(user.id);return {...user,email};}
async function login(user){const link=checked(await db.auth.admin.generateLink({type:'magiclink',email:user.email})),client=createClient('http://127.0.0.1:55321',anon,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(client);return checked(await client.auth.verifyOtp({type:'magiclink',token_hash:link.properties.hashed_token})).session;}
async function api(path,token,body,status=200){const response=await fetch(web+path,{method:body===undefined?'GET':'POST',headers:{Accept:'application/json','x-forwarded-for':'127.0.0.247',...(token?{Authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(60000)});assert.equal(response.status,status,stage+' HTTP status');return response.json();}
async function staffPage(user){const context=await browser.newContext({viewport:{width:412,height:915},extraHTTPHeaders:{'x-forwarded-for':'127.0.0.247'}});contexts.push(context);const session=await login(user);await context.addCookies(createChunks('sb-127-auth-token','base64-'+Buffer.from(JSON.stringify(session)).toString('base64url')).map(cookie=>({...cookie,url:web,sameSite:'Lax'})));return context.newPage();}
function installation(){const value={installationId:randomUUID(),secret:randomBytes(32).toString('hex'),token:'ExpoPushToken[synthetic-'+randomUUID()+']',locale:'en'};installations.push(value.installationId);return value;}
const store={claim:(workerId,limit)=>rpc('claim_native_push_batch',{worker_id:workerId,batch_size:limit}),context:(id,workerId)=>rpc('native_push_delivery_context',{delivery_id:id,worker_id:workerId}),finish:(id,workerId,result)=>rpc('finish_native_push_delivery',{delivery_id:id,worker_id:workerId,result})};
const sent=[],provider=expoPushProvider({fetcher:async(url,request)=>{
 const body=JSON.parse(request.body);assert.ok(url.startsWith('https://exp.host/--/api/v2/push/'));
 if(url.endsWith('/send')){for(const item of body){assert.equal(item.title,'Loadgistic');assert.deepEqual(Object.keys(item.data).sort(),['app','event','eventId','kind','sourceId']);assert.equal(/Synthetic|example\.test|\+251/.test(JSON.stringify(item)),false);sent.push(item);}return Response.json({data:body.map(()=>({status:'ok',id:'fake-ticket-'+randomUUID()}))});}
 assert.ok(url.endsWith('/getReceipts'));return Response.json({data:Object.fromEntries(body.ids.map(id=>[id,{status:'ok'}]))});
}});
async function dispatch(){return processNativePushBatch({workerId:randomUUID(),store,provider});}
async function dueReceipts(){const rows=checked(await db.from('native_push_outbox').select('id').eq('state','SUBMITTED'));if(rows.length)checked(await db.from('native_push_outbox').update({next_attempt_at:new Date(Date.now()-1000).toISOString()}).in('id',rows.map(row=>row.id)));return rows.length;}
try{
 assert.equal(checked(await db.from('native_push_installations').select('id')).length,0,'Isolated push fixtures required');
 const admin=checked(await db.from('profiles').select('id').eq('role','ADMIN').eq('active',true).limit(1).single()).id;
 const driver=await identity('driver'),agent=await identity('support'),broker=await identity('brokerage');
 checked(await db.from('profiles').update({role:'DRIVER',active:true,full_name:'Synthetic push driver'}).eq('id',driver.id));checked(await db.from('provider_profiles').insert({user_id:driver.id,business_name:'Synthetic push provider',handle:'push-'+suffix,public_visibility:'PRIVATE'}));
 for(const [user,role] of [[agent,'SUPPORT'],[broker,'BROKERAGE']])await rpc('create_managed_support_agent',{actor_user_id:admin,agent_auth_user_id:user.id,command:{name:'Synthetic push '+role,email:user.email,can_manage_support:role==='SUPPORT',can_manage_brokerage:role==='BROKERAGE',available:false,max_open_conversations:20}});
 const session=await login(driver),staffSession=await login(agent),device=installation(),command={action:'REGISTER',...device};
 stage='actual registration authority';const registered=await api('/api/mobile/notifications/devices',session.access_token,command);assert.deepEqual(registered,{ok:true,deliveryEnabled:false});
 await api('/api/mobile/notifications/devices',undefined,command,401);await api('/api/mobile/notifications/devices',session.access_token,{...command,actorId:agent.id},400);await api('/api/mobile/notifications/devices',staffSession.access_token,command,403);await api('/api/mobile/notifications/devices',session.access_token,{...command,secret:randomBytes(32).toString('hex')},403);
 assert.equal(checked(await db.from('native_push_outbox').select('id')).length,0,'No registration history replay');
 console.log('PASS: real Auth-session registration, disabled-delivery truth, forged-body/staff/stolen-device denial and no replay');
 stage='actual Support claim and reply';const created=await api('/api/mobile/support',session.access_token,{category:'ACCOUNT',body:'Synthetic support intake'},201);chats.push(created.id);
 checked(await db.from('support_conversations').update({status:'WAITING',assigned_agent_user_id:null,assigned_at:null,created_at:'1900-01-01T00:00:00Z'}).eq('id',created.id));checked(await db.from('support_agent_profiles').update({available:true}).eq('user_id',agent.id));
 const sp=await staffPage(agent);currentPage=sp;await sp.goto(web+'/support?view=WAITING',{timeout:90000});await sp.locator('form[action="/api/support/conversations/'+created.id+'/claim"]').getByRole('button',{name:'Claim',exact:true}).click();await expect(sp).toHaveURL(new RegExp('/support/'+created.id));stage='Support saved reply visible';
 await sp.getByRole('textbox',{name:'Message',exact:true}).fill('Synthetic staff reply remains private');await sp.getByRole('button',{name:'Send',exact:true}).click();await expect(sp.getByText('Synthetic staff reply remains private',{exact:true})).toBeVisible();
 const readPath='/api/mobile/support/'+created.id+'/read',before=await api(readPath,session.access_token);assert.equal(before.customerSeen,0);
 await api('/api/mobile/support/'+created.id,session.access_token);assert.equal((await api(readPath,session.access_token)).customerSeen,0,'Fetch did not fabricate Seen');
 let stats=await dispatch();assert.ok(stats.sent>=1);assert.ok(sent.some(item=>item.data.kind==='SUPPORT'&&item.data.event==='MESSAGE'));const receipts=await dueReceipts();stats=await dispatch();assert.equal(stats.receipts,receipts);assert.equal((await api(readPath,session.access_token)).customerSeen,0,'Provider receipt did not fabricate Seen');
 console.log('PASS: actual web staff Claim/Send → durable outbox → fake Expo HTTP ticket/receipt; message remains unread');
 stage='read suppresses unsent reply';await api(readPath,session.access_token,{throughSequence:before.latestSequence,assignmentVersion:before.assignmentVersion});await sp.getByRole('textbox',{name:'Message',exact:true}).fill('Synthetic next unread reply');await sp.getByRole('button',{name:'Send',exact:true}).click();await expect(sp.getByText('Synthetic next unread reply',{exact:true})).toBeVisible();
 const seen=await api(readPath,session.access_token);await api(readPath,session.access_token,{throughSequence:seen.latestSequence,assignmentVersion:seen.assignmentVersion});assert.equal((await dispatch()).sent,0);
 stage='guest authority on same installation';const requestId=randomUUID();requests.push(requestId);const guest=await api('/api/mobile/brokerage/start',undefined,{requestId,secret:randomBytes(32).toString('hex'),name:'Synthetic push visitor',phone:'+2519'+String(parseInt(suffix,16)%100000000).padStart(8,'0'),origin:'Adama',destination:'Dire Dawa'},201);
 await api('/api/mobile/notifications/devices',guest.token,command);assert.equal(checked(await db.from('native_push_bindings').select('id').eq('installation_id',device.installationId)).length,2);
 await api('/api/mobile/notifications/devices',undefined,{action:'REMOVE',installationId:device.installationId,secret:device.secret,scope:'MEMBER'});const remaining=checked(await db.from('native_push_bindings').select('audience').eq('installation_id',device.installationId));assert.deepEqual(remaining,[{audience:'GUEST'}]);
 const bp=await staffPage(broker);currentPage=bp;await bp.goto(web+'/brokerage?queue=UNASSIGNED&view=ACTIVE',{timeout:90000});await bp.locator('[data-request-id="'+requestId+'"]').getByRole('button',{name:'Claim request',exact:true}).click();await bp.goto(web+'/brokerage/'+requestId);
 await bp.getByRole('textbox',{name:'Message',exact:true}).fill('Synthetic broker reply remains private');await bp.getByRole('button',{name:'Send message',exact:true}).click();await expect(bp.locator('.transport-chat-message').getByText('Synthetic broker reply remains private',{exact:true})).toBeVisible();
 const guestSeen=await api('/api/mobile/brokerage/read',guest.token);assert.equal(guestSeen.customerSeen,0);stats=await dispatch();assert.ok(stats.sent>=1);assert.ok(sent.some(item=>item.data.kind==='BROKERAGE'&&item.data.event==='MESSAGE'));await dueReceipts();await dispatch();assert.equal((await api('/api/mobile/brokerage/read',guest.token)).customerSeen,0);
 console.log('PASS: independent guest/member scopes, logout revocation, actual Brokerage Claim/Send and generic private delivery without Seen');
 stage='expiry and opt-out cancellation';await bp.getByRole('textbox',{name:'Message',exact:true}).fill('Synthetic reply before expiry');await bp.getByRole('button',{name:'Send message',exact:true}).click();await expect(bp.locator('.transport-chat-message').getByText('Synthetic reply before expiry',{exact:true})).toBeVisible();checked(await db.from('transport_chat_access').update({expires_at:new Date(Date.now()-1000).toISOString()}).eq('request_id',requestId));assert.equal((await dispatch()).sent,0);await api('/api/mobile/notifications/devices',guest.token,command,403);
 await api('/api/mobile/notifications/devices',undefined,{action:'REMOVE',installationId:device.installationId,secret:device.secret,scope:'ALL'});assert.equal(checked(await db.from('native_push_bindings').select('id').eq('installation_id',device.installationId)).length,0);
 console.log('PASS: already-read/expired delivery cancellation, expired registration denial and complete opt-out; no actual Expo/phone delivery asserted');
}catch(error){console.log('CHECK: '+JSON.stringify({stage,assertion:error.matcherResult?.name||null,path:currentPage?new URL(currentPage.url()).pathname.replace(/[0-9a-f-]{36}/g,'[fixture]'):null}));throw Error('LOCAL_NATIVE_PUSH_FAILED: '+stage+' · '+error.name);}
finally{
 for(const context of contexts)await context.close();for(const client of clients)await client.auth.signOut({scope:'local'});
 if(installations.length)checked(await db.from('native_push_installations').delete().in('id',installations));
 for(const id of chats){checked(await db.from('support_conversations').delete().eq('id',id));checked(await db.from('audit_logs').delete().eq('entity_id',id));}
 for(const id of requests){for(const table of ['transport_chat_messages','transport_chat_access','transport_request_events'])checked(await db.from(table).delete().eq('request_id',id));checked(await db.from('transport_service_requests').delete().eq('id',id));checked(await db.from('audit_logs').delete().eq('entity_id',id));}
 for(const id of users){checked(await db.from('audit_logs').delete().eq('actor_user_id',id));checked(await db.from('audit_logs').delete().eq('entity_id',id));checked(await db.auth.admin.deleteUser(id));}
 await browser.close();console.log('CLEANUP: exact local synthetic identities, sessions, chats, requests and push installation');
}
