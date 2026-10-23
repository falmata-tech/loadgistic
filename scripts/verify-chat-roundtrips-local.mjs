import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {createChunks} from '@supabase/ssr/dist/main/utils/chunker.js';
import {chromium} from 'playwright';
import {expect as baseExpect} from '@playwright/test';

// Actual Expo customer UI and web staff UI, using only disposable local records.
// No email delivery, production credentials, existing staff changes or API mocks.
const root=new URL('../',import.meta.url),env=readFileSync(new URL('.env.local',root),'utf8');
assert.ok(/^NEXT_PUBLIC_SUPABASE_URL=http:\/\/127\.0\.0\.1:55321\s*$/m.test(env),'Loadgistic local services required');
const key=name=>env.match(new RegExp('^'+name+'=(.+)$','m'))?.[1]?.trim().replace(/^['"]|['"]$/g,'');
const db=createClient('http://127.0.0.1:55321',key('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
const anon=key('NEXT_PUBLIC_SUPABASE_ANON_KEY')||key('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');assert.ok(anon);
const expect=baseExpect.configure({timeout:30000}),web='http://127.0.0.1:3100',mobile='http://localhost:8084';
const narrow=process.argv.includes('--brokerage-foreground-only')||process.argv.includes('--support-history-only')||process.argv.includes('--receipt-negatives-only')||process.argv.includes('--brokerage-receipt-recovery-only')||process.argv.includes('--brokerage-history-only')||process.argv.includes('--brokerage-closure-only')||process.argv.includes('--support-closure-only')||process.argv.includes('--support-staff-close-only');
// An interrupted terminal may also stop either preview. Refuse before creating
// fixtures instead of retrying application behavior against a missing server.
for(const [label,url] of [['WEB',web+'/about'],['MOBILE',mobile+'/status']]){
 try{const response=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('HTTP_'+response.status);}
 catch(error){const raw=String(error?.cause?.code||error?.message||''),reason=/^[A-Z0-9_]{1,32}$/.test(raw)?raw:'UNAVAILABLE';throw Error('CHAT_AUDIT_LOCAL_PREVIEW_UNAVAILABLE_'+label+'_'+reason);}
}
// Starting this audit with a waiting backlog would let a real close/create
// command assign unrelated local work. Refuse before creating any fixture.
for(const table of ['support_conversations','guest_support_conversations']){
 const pending=await db.from(table).select('id',{count:'exact',head:true}).eq('status','WAITING');
 if(pending.error||pending.count!==0)throw Error('CHAT_AUDIT_REQUIRES_EMPTY_WAITING_QUEUES');
}
const browser=await chromium.launch({headless:true}),contexts=[],clients=[],users=trackedIds(),chats=trackedIds(),requests=trackedIds();
const suffix=randomUUID().slice(0,8),errors=[],responses=new Map(),receiptPhone='+2519'+String(parseInt(suffix,16)%100000000).padStart(8,'0');
let currentPage,stage='setup',receiptNumbers=null;
const ownership={format:1,sourceSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),mode:process.argv.find(value=>/^--[a-z-]+$/.test(value))||'full',startedAt:new Date().toISOString(),cleanupVerified:false,closed:false};
const ownershipPath=new URL(`.local/chat-roundtrip-owned-${suffix}.json`,root);
function saveOwnership(extra={}){Object.assign(ownership,extra);writeFileSync(ownershipPath,JSON.stringify({...ownership,users:[...users],chats:[...chats],requests:[...requests]},null,2)+'\n',{mode:0o600});}
function trackedIds(){const ids=[];Object.defineProperty(ids,'push',{value:(...values)=>{for(const value of values)assert.match(value,/^[0-9a-f-]{36}$/);const length=Array.prototype.push.apply(ids,values);saveOwnership();return length;}});return ids;}
// UUID-only ownership survives an interrupted runner; contacts, credentials,
// messages and unrelated fixtures are never written to this local manifest.
saveOwnership();
function checked(result){if(result.error){const code=String(result.error.code||'UNKNOWN');throw Error('LOCAL_FIXTURE_FAILED_'+(/^[A-Z0-9_]{1,32}$/.test(code)?code:'UNKNOWN'));}return result.data;}
async function rpc(name,args){return checked(await db.rpc(name,args));}
async function identity(label){const slug=label.toLowerCase().replace(/[^a-z0-9]+/g,'-'),email=`chat-audit-${slug}-${suffix}@example.test`,user=checked(await db.auth.admin.createUser({email,email_confirm:true})).user;users.push(user.id);return {id:user.id,email,name:`Audit ${label} ${suffix}`};}
async function staff(_admin,label,capability){
 const user=await identity(label);
 // Staff provisioning has its own UI/authorization tests. This chat fixture
 // must not invoke its global automatic-assignment side effect. Insert only the
 // newly created identity's exact paused record, never modify existing staff.
 checked(await db.from('profiles').update({role:'SUPPORT',active:true,full_name:user.name}).eq('id',user.id));
 checked(await db.from('support_agent_profiles').insert({user_id:user.id,active:true,available:false,max_open_conversations:20,can_manage_support:capability==='SUPPORT',can_manage_brokerage:capability==='BROKERAGE'}));
 return user;
}
async function noUnrelatedWaiting(){
 for(const table of ['support_conversations','guest_support_conversations']){
  const waiting=checked(await db.from(table).select('id').eq('status','WAITING').limit(100));
  if(waiting.some(row=>table!=='support_conversations'||!chats.includes(row.id))||waiting.length===100)throw Error('CHAT_AUDIT_UNRELATED_WAITING_WORK');
 }
}
async function session(user){const link=checked(await db.auth.admin.generateLink({type:'magiclink',email:user.email})),client=createClient('http://127.0.0.1:55321',anon,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(client);return checked(await client.auth.verifyOtp({type:'magiclink',token_hash:link.properties.hashed_token})).session;}
async function context(){const value=await browser.newContext({baseURL:web,viewport:{width:412,height:915},extraHTTPHeaders:{'x-forwarded-for':'127.0.0.249'}});contexts.push(value);return value;}
async function watch(page){
 page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.name));
 page.on('response',response=>{
  const url=new URL(response.url()),pathname=url.pathname;
  if(!['127.0.0.1','localhost'].includes(url.hostname)||!/^\/api\/(?:mobile\/(?:support|brokerage|account\/policy)|brokerage\/|support\/|chat\/alerts$|notifications\/handover$|admin\/transport-requests\/)/.test(pathname))return;
  const key=response.request().method()+' '+pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi,':id')+' '+response.status();
  if(responses.has(key)||responses.size<40)responses.set(key,(responses.get(key)||0)+1);
 });
 return page;
}
async function staffPage(user){const value=await context(),login=await session(user);await value.addCookies(createChunks('sb-127-auth-token','base64-'+Buffer.from(JSON.stringify(login)).toString('base64url')).map(cookie=>({...cookie,url:web,sameSite:'Lax'})));return watch(await value.newPage());}
async function screenshot(page,name){await page.screenshot({path:new URL(`.local/chat-roundtrip-${suffix}-${name}.png`,root).pathname,fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Phone overflow');}
async function webReply(page,body){await page.getByRole('textbox',{name:'Message',exact:true}).fill(body);await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByText(body,{exact:true})).toBeVisible();}
async function brokerReply(page,body){await page.getByRole('textbox',{name:'Message',exact:true}).fill(body);const saved=page.waitForResponse(response=>/\/api\/brokerage\/[0-9a-f-]+\/messages$/.test(new URL(response.url()).pathname)&&response.request().method()==='POST');await page.getByRole('button',{name:'Send message',exact:true}).click();assert.equal((await saved).status(),200);await expect(page.locator('.transport-chat-message').getByText(body,{exact:true})).toBeVisible();}
async function mobileReply(page,body,label='Message'){await page.getByRole('textbox',{name:label,exact:true}).fill(body);const sent=page.waitForResponse(response=>/\/api\/mobile\/(brokerage|support\/[0-9a-f-]+)$/.test(new URL(response.url()).pathname)&&response.request().method()==='POST');await page.getByRole('button',{name:'Send message',exact:true}).click();assert.equal((await sent).status(),200);await expect(page.getByText(body,{exact:true})).toBeVisible();}
async function acceptVisibleContentPolicy(page){
 const consent=page.getByRole('checkbox',{name:/^[☐☑]? ?I agree to the Terms and content rules\.$/});
 await expect(consent).toBeVisible();await consent.check();await expect(consent).toBeChecked();
 await page.getByRole('button',{name:'Accept and continue',exact:true}).click();
 await expect(consent).toHaveCount(0);
}
async function receiptConversation(staffPage,staffUser,name,body){
 stage='narrow receipt intake';const gc=await context(),gp=await watch(await gc.newPage());currentPage=gp;let visitorToken='';
 gp.on('request',outgoing=>{const pathname=new URL(outgoing.url()).pathname;if(pathname.startsWith('/api/mobile/brokerage'))visitorToken=outgoing.headers().authorization?.replace(/^Bearer /,'')||visitorToken;if(pathname==='/api/mobile/brokerage/start'&&outgoing.method()==='POST'){try{const id=JSON.parse(outgoing.postData()||'{}').requestId;if(typeof id==='string'&&/^[0-9a-f-]{36}$/.test(id)&&!requests.includes(id))requests.push(id);}catch{}}});
 await gp.goto(mobile+'/arrange-transport',{waitUntil:'domcontentloaded',timeout:90000});await gp.bringToFront();
 for(const [field,value] of [['From','Adama'],['To','Dire Dawa'],['Your name',name],['Phone number',receiptPhone]])await gp.getByRole('textbox',{name:field,exact:true}).fill(value);
 const start=gp.waitForResponse(response=>response.url().endsWith('/api/mobile/brokerage/start')&&response.request().method()==='POST');
 await gp.getByRole('button',{name:'Start chat',exact:true}).click();const created=await start;assert.equal(created.status(),201);
 const id=(await created.json()).snapshot.request.id;assert.match(id,/^[0-9a-f-]{36}$/);if(!requests.includes(id))requests.push(id);
 await mobileReply(gp,body,'Message to transport team');
 stage='narrow receipt claim persistence';await staffPage.bringToFront();await staffPage.goto('/brokerage?queue=UNASSIGNED&view=ACTIVE');
 const claimed=staffPage.waitForResponse(response=>new URL(response.url()).pathname===`/api/admin/transport-requests/${id}`&&response.request().method()==='POST');
 await staffPage.locator(`[data-request-id="${id}"]`).getByRole('button',{name:'Claim request',exact:true}).click();
 const saved=await claimed;assert.equal(saved.status(),200);assert.equal((await saved.json()).ok,true);
 await expect.poll(async()=>checked(await db.from('transport_service_requests').select('assigned_agent_user_id').eq('id',id).single()).assigned_agent_user_id,{timeout:30000}).toBe(staffUser.id);
 stage='narrow receipt open assigned chat';await staffPage.getByRole('navigation',{name:'Brokerage queues'}).getByRole('link',{name:/^Mine/}).click();
 await staffPage.locator(`[data-request-id="${id}"]`).getByRole('link',{name:'Open conversation',exact:true}).click();await expect(staffPage.getByText(body,{exact:true})).toBeVisible();
 const digest=checked(await db.from('transport_chat_access').select('credential_digest').eq('request_id',id).single()).credential_digest;
 const guestRead=()=>rpc('chat_read_state',{chat_kind:'BROKERAGE',target_id:id,actor_user_id:null,access_digest:digest});
 const teamRead=()=>rpc('chat_read_state',{chat_kind:'BROKERAGE',target_id:id,actor_user_id:staffUser.id});
 stage='narrow receipt saved join';await expect.poll(async()=>(await teamRead()).teamJoined,{timeout:30000}).toBe(true);
 return {gp,id,guestRead,teamRead,visitorToken:()=>visitorToken};
}

try{
 const admin=checked(await db.from('profiles').select('id').eq('role','ADMIN').eq('active',true).limit(1).single()).id;
 const support=await staff(admin,'Support','SUPPORT'),supportOther=await staff(admin,'Support handoff','SUPPORT'),broker=await staff(admin,'Brokerage','BROKERAGE'),brokerOther=await staff(admin,'Brokerage handoff','BROKERAGE');
 const member=await identity('Driver'),outsider=await identity('Unrelated driver');
 for(const user of [member,outsider]){checked(await db.from('profiles').update({role:'DRIVER',active:true,full_name:user.name}).eq('id',user.id));checked(await db.from('provider_profiles').insert({user_id:user.id,business_name:user.name,handle:`audit-${user.id}`,public_visibility:'PRIVATE'}));}
 const sp=await staffPage(support),op=await staffPage(supportOther),bp=await staffPage(broker),obp=await staffPage(brokerOther);currentPage=sp;
 stage='support staff initial workspace';
 await sp.goto('/support');await expect(sp.getByRole('heading',{name:'Support Inbox',exact:true})).toBeVisible();await expect(sp.locator('.sidebar-nav a[href="/brokerage"]')).toHaveCount(0);
 stage='brokerage staff initial workspace';
 await bp.goto('/brokerage');await expect(bp.getByRole('heading',{name:'Transport requests',exact:true})).toBeVisible();await expect(bp.locator('.sidebar-nav a[href="/support"]')).toHaveCount(0);
 console.log('PASS: actual Support-only and Brokerage-only staff workspaces');

 if(process.argv.includes('--brokerage-foreground-only')){
  stage='narrow brokerage intake';
  const gc=await context(),gp=await watch(await gc.newPage());currentPage=gp;
  await gp.goto(mobile+'/arrange-transport',{waitUntil:'domcontentloaded',timeout:90000});await gp.bringToFront();
  for(const [field,value] of [['From','Adama'],['To','Dire Dawa'],['Your name','Synthetic foreground visitor'],['Phone number',receiptPhone]])await gp.getByRole('textbox',{name:field,exact:true}).fill(value);
  const started=gp.waitForResponse(response=>response.url().endsWith('/api/mobile/brokerage/start')&&response.request().method()==='POST');
  await gp.getByRole('button',{name:'Start chat',exact:true}).click();const created=await started;assert.equal(created.status(),201);
  const id=(await created.json()).snapshot.request.id;requests.push(id);
  await mobileReply(gp,'Synthetic foreground question','Message to transport team');
  stage='narrow brokerage claim';await bp.bringToFront();await bp.goto('/brokerage?queue=UNASSIGNED&view=ACTIVE');
  let card=bp.locator(`[data-request-id="${id}"]`);await card.getByRole('button',{name:'Claim request',exact:true}).click();
  await bp.getByRole('navigation',{name:'Brokerage queues'}).getByRole('link',{name:/^Mine/}).click();card=bp.locator(`[data-request-id="${id}"]`);
  await card.getByRole('link',{name:'Open conversation',exact:true}).click();await expect(bp.getByText('Synthetic foreground question',{exact:true})).toBeVisible();
  await gp.bringToFront();await gp.getByRole('textbox',{name:'Message to transport team',exact:true}).fill('Synthetic preserved foreground draft');
  stage='narrow brokerage staff send';await bp.bringToFront();await brokerReply(bp,'Synthetic foreground staff reply');
  stage='narrow brokerage active visitor receives';await gp.bringToFront();
  await expect(gp.getByText('Synthetic foreground staff reply',{exact:true})).toBeVisible();
  await expect(gp.getByRole('textbox',{name:'Message to transport team',exact:true})).toHaveValue('Synthetic preserved foreground draft');
  stage='narrow brokerage visitor sends';await mobileReply(gp,'Synthetic foreground visitor answer','Message to transport team');
  stage='narrow brokerage active staff receives';await bp.bringToFront();await expect(bp.getByText('Synthetic foreground visitor answer',{exact:true})).toBeVisible();
  const stored=checked(await db.from('transport_chat_messages').select('sender_kind').eq('request_id',id));
  assert.equal(stored.length,3);assert.equal(stored.filter(row=>row.sender_kind==='BROKER').length,1);
  console.log('PASS: narrow actual Brokerage claim and persisted two-way replies with explicit foreground switches and draft preservation');
 }

 if(process.argv.includes('--support-history-only')){
  stage='narrow Support history fixture';const id=randomUUID();chats.push(id);
  checked(await db.from('support_conversations').insert({id,customer_user_id:member.id,assigned_agent_user_id:supportOther.id,category:'ACCOUNT',status:'OPEN'}));
  checked(await db.from('support_messages').insert(Array.from({length:7},(_,index)=>({conversation_id:id,sender_user_id:member.id,body:`Synthetic initial Support ${index}`}))));
  checked(await db.from('support_messages').insert(Array.from({length:55},(_,index)=>({conversation_id:id,sender_user_id:member.id,body:`Synthetic historical Support ${index}`,created_at:new Date(Date.UTC(2020,0,1,0,0,index)).toISOString()}))));
  const mc=await context(),login=await session(member),mp=await watch(await mc.newPage());currentPage=mp;
  await mc.addInitScript(token=>{if(!sessionStorage.getItem('loadgistic.fixture.seeded')){sessionStorage.setItem('loadgistic.account.refresh.v1',token);sessionStorage.setItem('loadgistic.fixture.seeded','1');}},login.refresh_token);
  await mp.goto(mobile+`/support-chat?id=${id}`,{waitUntil:'domcontentloaded',timeout:90000});await mp.bringToFront();await acceptVisibleContentPolicy(mp);
  stage='narrow Support refresh';const refreshed=mp.waitForResponse(response=>new URL(response.url()).pathname===`/api/mobile/support/${id}`&&response.request().method()==='GET');
  await mp.getByRole('button',{name:'Refresh chat',exact:true}).click();assert.equal((await refreshed).status(),200);
  stage='narrow Support Older';const older=mp.waitForResponse(response=>new URL(response.url()).pathname===`/api/mobile/support/${id}`&&new URL(response.url()).searchParams.has('before'));
  await mp.getByRole('button',{name:'Older messages',exact:true}).click();assert.equal((await older).status(),200);
  await expect(mp.getByText('Synthetic historical Support 0',{exact:true})).toBeVisible();await expect(mp.getByRole('textbox',{name:'Message',exact:true})).toHaveCount(0);
  const before=checked(await db.rpc('chat_read_state',{chat_kind:'SUPPORT',target_id:id,actor_user_id:member.id})).customerSeen;
  stage='narrow Support history reply';await op.bringToFront();await op.goto(`/support/${id}`);await webReply(op,'Synthetic reply during historical window');
  await mp.bringToFront();await expect(mp.getByText('Synthetic reply during historical window',{exact:true})).toHaveCount(0);
  assert.equal(checked(await db.rpc('chat_read_state',{chat_kind:'SUPPORT',target_id:id,actor_user_id:member.id})).customerSeen,before);
  stage='narrow Support Latest';await mp.getByRole('button',{name:'Latest messages',exact:true}).click();await expect(mp.getByText('Synthetic reply during historical window',{exact:true})).toBeVisible();
  stage='narrow Support foreign identity';const foreign=await session(outsider);
  const identityClient=createClient('http://127.0.0.1:55321',anon,{auth:{persistSession:false,autoRefreshToken:false}});
  assert.equal(checked(await identityClient.auth.getUser(foreign.access_token)).user.id,outsider.id);
  stage='narrow Support foreign read denial';const denied=await fetch(web+`/api/mobile/support/${id}`,{headers:{Authorization:'Bearer '+foreign.access_token}});assert.equal(denied.status,404);
  assert.equal(checked(await db.from('support_messages').select('id').eq('conversation_id',id)).length,63);
  console.log('PASS: narrow actual Support Refresh Older Latest with 55 retained messages, isolated history replies, saved receipt and verified foreign-member denial');
 }

 if(process.argv.includes('--support-closure-only')){
  stage='narrow Support closure fixture';const id=randomUUID();chats.push(id);
  checked(await db.from('support_conversations').insert({id,customer_user_id:member.id,assigned_agent_user_id:supportOther.id,category:'ACCOUNT',status:'OPEN'}));
  checked(await db.from('support_messages').insert({conversation_id:id,sender_user_id:member.id,body:'Synthetic Support closure history'}));
  const previousMessages=checked(await db.from('support_messages').select('id,body,sequence').eq('conversation_id',id));
  const mc=await context(),login=await session(member),mp=await watch(await mc.newPage());currentPage=mp;let memberToken='';
  mp.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/mobile/support'))memberToken=request.headers().authorization?.replace(/^Bearer /,'')||memberToken;});
  await mc.addInitScript(token=>{if(!sessionStorage.getItem('loadgistic.fixture.seeded')){sessionStorage.setItem('loadgistic.account.refresh.v1',token);sessionStorage.setItem('loadgistic.fixture.seeded','1');}},login.refresh_token);
  await mp.goto(mobile+`/support-chat?id=${id}`,{waitUntil:'domcontentloaded',timeout:90000});await mp.bringToFront();await acceptVisibleContentPolicy(mp);
  await expect(mp.getByText('Synthetic Support closure history',{exact:true}).filter({visible:true})).toBeVisible();
  stage='narrow Support Keep chatting';await mp.getByRole('button',{name:'End chat',exact:true}).click();await mp.getByRole('button',{name:'Keep chatting',exact:true}).click();
  await expect(mp.getByRole('textbox',{name:'Message',exact:true})).toBeVisible();assert.equal(checked(await db.from('support_conversations').select('status').eq('id',id).single()).status,'OPEN');
  stage='narrow Support member End';await mp.getByRole('button',{name:'End chat',exact:true}).click();await noUnrelatedWaiting();
  const ended=mp.waitForResponse(response=>new URL(response.url()).pathname===`/api/mobile/support/${id}`&&response.request().method()==='POST');
  await mp.getByRole('button',{name:'Confirm end chat',exact:true}).click();assert.equal((await ended).status(),200);
  await expect(mp.getByText('Chat ended · history is retained',{exact:true}).filter({visible:true})).toBeVisible();await expect(mp.getByRole('textbox',{name:'Message',exact:true})).toHaveCount(0);
  assert.equal(checked(await db.from('support_conversations').select('status').eq('id',id).single()).status,'CLOSED');
  await op.bringToFront();await op.goto(`/support/${id}`);await expect(op.getByText('Conversation closed',{exact:true})).toBeVisible();
  stage='narrow Support ended-send denial';assert.ok(memberToken);
  const denied=await fetch(web+`/api/mobile/support/${id}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+memberToken},body:JSON.stringify({action:'SEND',body:'Synthetic ended Support write must not persist'})});assert.equal(denied.status,409);
  assert.deepEqual(checked(await db.from('support_messages').select('id,body,sequence').eq('conversation_id',id)),previousMessages);
  stage='narrow Support retained Past chat';await mp.bringToFront();await mp.getByText('Return to Support to start a new chat',{exact:true}).filter({visible:true}).click();
  await expect(mp.getByText('Past chats',{exact:true}).filter({visible:true})).toBeVisible();await mp.getByText('View past chat',{exact:true}).filter({visible:true}).click();
  await expect(mp.getByText('Synthetic Support closure history',{exact:true}).filter({visible:true})).toBeVisible();await expect(mp.getByRole('textbox',{name:'Message',exact:true})).toHaveCount(0);
  await mp.getByText('Return to Support to start a new chat',{exact:true}).filter({visible:true}).click();
  stage='narrow Support separate new chat';await mp.getByRole('button',{name:'New chat',exact:true}).click();await mp.getByRole('textbox',{name:'What do you need help with?',exact:true}).fill('Synthetic separate Support closure request');await noUnrelatedWaiting();
  const created=mp.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/support'&&response.request().method()==='POST');
  await mp.getByRole('button',{name:'Send to support',exact:true}).click();const result=await created;assert.equal(result.status(),201);const nextId=(await result.json()).id;chats.push(nextId);assert.notEqual(nextId,id);
  await expect(mp.getByText('Synthetic separate Support closure request',{exact:true}).filter({visible:true})).toBeVisible();await expect(mp.getByText('Synthetic Support closure history',{exact:true}).filter({visible:true})).toHaveCount(0);
  // Only prepare this new fixture's assignee for the existing Close control.
  // Member-admin handoff has no UI and is not claimed as tested by this setup.
  checked(await db.from('support_conversations').update({assigned_agent_user_id:supportOther.id,status:'OPEN'}).eq('id',nextId));
  stage='narrow Support staff Close';await op.bringToFront();await op.goto(`/support/${nextId}`);await noUnrelatedWaiting();
  const closed=op.waitForResponse(response=>new URL(response.url()).pathname===`/api/support/conversations/${nextId}/close`&&response.request().method()==='POST');
  await op.getByRole('button',{name:'Close conversation',exact:true}).click();const savedClose=await closed;assert.equal(savedClose.status(),303);assert.equal(new URL(savedClose.headers().location,web).searchParams.get('success'),'Conversation closed.');
  assert.equal(checked(await db.from('support_conversations').select('status').eq('id',nextId).single()).status,'CLOSED');await expect(op.getByText('Conversation closed.',{exact:true})).toBeVisible();
  await mp.bringToFront();await expect(mp.getByText('Chat ended · history is retained',{exact:true}).filter({visible:true})).toBeVisible();
  assert.equal(checked(await db.from('support_conversations').select('status').eq('id',nextId).single()).status,'CLOSED');
  assert.deepEqual(checked(await db.from('support_messages').select('id,body,sequence').eq('conversation_id',id)),previousMessages);
  console.log('PASS: narrow actual Support Keep chatting End retained Past chat isolated new request and staff Close; ended sends denied without changing history');
 }
 if(process.argv.includes('--support-staff-close-only')){
  stage='narrow staff Close fixture';const id=randomUUID();chats.push(id);
  checked(await db.from('support_conversations').insert({id,customer_user_id:member.id,assigned_agent_user_id:supportOther.id,category:'ACCOUNT',status:'OPEN'}));
  checked(await db.from('support_messages').insert({conversation_id:id,sender_user_id:member.id,body:'Synthetic Support staff closure history'}));
  const mc=await context(),login=await session(member),mp=await watch(await mc.newPage());currentPage=mp;
  await mc.addInitScript(token=>{if(!sessionStorage.getItem('loadgistic.fixture.seeded')){sessionStorage.setItem('loadgistic.account.refresh.v1',token);sessionStorage.setItem('loadgistic.fixture.seeded','1');}},login.refresh_token);
  await mp.goto(mobile+`/support-chat?id=${id}`,{waitUntil:'domcontentloaded',timeout:90000});await mp.bringToFront();await acceptVisibleContentPolicy(mp);
  await expect(mp.getByText('Synthetic Support staff closure history',{exact:true}).filter({visible:true})).toBeVisible();await expect(mp.getByRole('textbox',{name:'Message',exact:true})).toBeVisible();
  stage='narrow staff Close saved command';await op.bringToFront();await op.goto(`/support/${id}`);await noUnrelatedWaiting();
  const response=op.waitForResponse(response=>new URL(response.url()).pathname===`/api/support/conversations/${id}/close`&&response.request().method()==='POST');
  await op.getByRole('button',{name:'Close conversation',exact:true}).click();const saved=await response;assert.equal(saved.status(),303);
  const destination=new URL(saved.headers().location,web);assert.equal(destination.pathname,'/support');assert.equal(destination.searchParams.get('success'),'Conversation closed.');
  assert.equal(checked(await db.from('support_conversations').select('status').eq('id',id).single()).status,'CLOSED');
  stage='narrow staff Close web projection';await expect(op.getByText('Conversation closed.',{exact:true})).toBeVisible();
  stage='narrow staff Close Expo projection';await mp.bringToFront();await expect(mp.getByText('Chat ended · history is retained',{exact:true}).filter({visible:true})).toBeVisible();
  await expect(mp.getByRole('textbox',{name:'Message',exact:true})).toHaveCount(0);await expect(mp.getByText('Synthetic Support staff closure history',{exact:true}).filter({visible:true})).toBeVisible();
  await mp.reload();await expect(mp.getByText('Chat ended · history is retained',{exact:true}).filter({visible:true})).toBeVisible();
  assert.equal(checked(await db.from('support_messages').select('id').eq('conversation_id',id)).length,1);
  console.log('PASS: narrow actual staff Close saves CLOSED redirects with success and updates Expo to retained read-only history across reload');
 }
 if(!narrow&&!process.argv.includes('--brokerage-only')&&!process.argv.includes('--receipts-only')&&!process.argv.includes('--public-receipts-only')){
 stage='support member consent';
 const mc=await context(),login=await session(member),mp=await watch(await mc.newPage());currentPage=mp;
 await mc.addInitScript(token=>{if(!sessionStorage.getItem('loadgistic.fixture.seeded')){sessionStorage.setItem('loadgistic.account.refresh.v1',token);sessionStorage.setItem('loadgistic.fixture.seeded','1');}},login.refresh_token);
 let memberToken='';mp.on('request',request=>{if(request.url().includes('/api/mobile/support'))memberToken=request.headers().authorization?.replace(/^Bearer /,'')||memberToken;});
 await mp.goto(mobile+'/support',{waitUntil:'domcontentloaded',timeout:90000});await acceptVisibleContentPolicy(mp);
 stage='support member intake';await mp.getByRole('button',{name:'New chat',exact:true}).click();
 await mp.getByRole('textbox',{name:'What do you need help with?',exact:true}).fill('Help with my mobile capacity settings.');
 await noUnrelatedWaiting();const created=mp.waitForResponse(r=>r.url().endsWith('/api/mobile/support')&&r.request().method()==='POST');await mp.getByRole('button',{name:'Send to support',exact:true}).click();const result=await created;assert.equal(result.status(),201);const id=(await result.json()).id;chats.push(id);
 await expect(mp.getByText('Help with my mobile capacity settings.',{exact:true})).toBeVisible();
 // Make only our synthetic conversation the oldest waiting fixture. Existing
 // staff availability/queues are unchanged; automatic routing is tested in SQL.
 checked(await db.from('support_conversations').update({status:'WAITING',assigned_agent_user_id:null,assigned_at:null,created_at:'1900-01-01T00:00:00Z'}).eq('id',id));
 checked(await db.from('support_agent_profiles').update({available:true}).eq('user_id',support.id));
 stage='support staff claim';
 await sp.goto('/support?view=WAITING');const claim=sp.locator(`form[action="/api/support/conversations/${id}/claim"]`);await claim.getByRole('button',{name:'Claim',exact:true}).click();await expect(sp).toHaveURL(new RegExp(`/support/${id}`));
 assert.equal(checked(await db.from('support_conversations').select('assigned_agent_user_id').eq('id',id).single()).assigned_agent_user_id,support.id);
 await expect(mp.getByText(`Assigned to ${support.name}`,{exact:true})).toBeVisible();
 assert.equal((await bp.request.get(`/api/support/updates?conversation=${id}`)).status(),403);assert.equal((await op.request.get(`/api/support/updates?conversation=${id}`)).status(),403);
 stage='support two-way replies';
 await mp.getByRole('textbox',{name:'Message',exact:true}).fill('Keep this mobile draft');await webReply(sp,'Support is reviewing your capacity settings.');await expect(mp.getByText('Support is reviewing your capacity settings.',{exact:true})).toBeVisible();await expect(mp.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Keep this mobile draft');
 await mobileReply(mp,'My capacity is shared privately.');await expect(sp.getByText('My capacity is shared privately.',{exact:true})).toBeVisible();
 console.log('PASS: mobile Support intake, real staff claim, automatic replies both ways, draft retention and other-team/agent denial');
 stage='support private attachment';
 const bytes=readFileSync(new URL('public/brand/loadgistic-icon.png',root));
 await mp.getByRole('textbox',{name:'Message',exact:true}).fill('Synthetic support attachment');const chooser=mp.waitForEvent('filechooser');await mp.getByRole('button',{name:'Choose file',exact:true}).click();await (await chooser).setFiles({name:'audit-support.png',mimeType:'image/png',buffer:bytes});await mp.getByRole('button',{name:'Send message',exact:true}).click();await expect(mp.getByText('Synthetic support attachment',{exact:true})).toBeVisible();await expect(sp.getByText('Synthetic support attachment',{exact:true})).toBeVisible();
 const file=checked(await db.from('support_attachments').select('id,original_name').eq('conversation_id',id).eq('state','ATTACHED').single()),filePath=`/api/support/conversations/${id}/attachments/${file.id}`;
 const download=await sp.request.get(filePath);assert.equal(download.status(),200);assert.deepEqual(await download.body(),bytes);assert.equal((await bp.request.get(filePath)).status(),404);assert.equal((await op.request.get(filePath)).status(),404);
 await mp.getByRole('button',{name:`Open ${file.original_name}`,exact:true}).click();await expect(mp.getByText('Private document',{exact:true})).toBeVisible();await expect(mp.getByRole('img',{name:'Submitted document',exact:true})).toBeVisible();await mp.getByRole('button',{name:'Close document',exact:true}).click();
 await screenshot(mp,'mobile-support');await screenshot(sp,'staff-support');
 stage='support handoff revocation';
 checked(await db.from('support_conversations').update({assigned_agent_user_id:supportOther.id,agent_last_read_at:null,updated_at:new Date().toISOString()}).eq('id',id));
 assert.equal((await sp.request.get(filePath)).status(),404);
 const staleSend=await sp.request.post(`/api/support/conversations/${id}/messages`,{form:{body:'Old assignee must not send'},maxRedirects:0});assert.equal(staleSend.status(),303);assert.ok(new URL(staleSend.headers().location).searchParams.get('error'));assert.equal(checked(await db.from('support_messages').select('id').eq('conversation_id',id).eq('body','Old assignee must not send')).length,0);
 await op.goto(`/support/${id}`);await expect(op.getByText('Synthetic support attachment',{exact:true})).toBeVisible();assert.equal((await op.request.get(filePath)).status(),200);
 await webReply(op,'Your new support agent has the conversation history.');await expect(mp.getByText('Your new support agent has the conversation history.',{exact:true})).toBeVisible();
 await mp.reload();await expect(mp.getByText('Your new support agent has the conversation history.',{exact:true})).toBeVisible();
 stage='support bulk history fixture';
 checked(await db.from('support_messages').insert(Array.from({length:55},(_,index)=>({conversation_id:id,sender_user_id:member.id,body:`Synthetic earlier Support ${index}`,created_at:new Date(Date.UTC(2020,0,1,0,0,index)).toISOString()}))));
 stage='support history refresh';await mp.getByRole('button',{name:'Refresh chat',exact:true}).click();stage='support older page';await mp.getByRole('button',{name:'Older messages',exact:true}).click();await expect(mp.getByText('Synthetic earlier Support 0',{exact:true})).toBeVisible();await expect(mp.getByRole('textbox',{name:'Message',exact:true})).toHaveCount(0);
 stage='support history reply isolation';await webReply(op,'New reply while you read older history.');await expect(mp.getByText('New reply while you read older history.',{exact:true})).toHaveCount(0);stage='support latest restore';await mp.getByRole('button',{name:'Latest messages',exact:true}).click();await expect(mp.getByText('New reply while you read older history.',{exact:true})).toBeVisible();
 stage='support foreign member denial';const foreign=await session(outsider);const denied=await fetch(web+`/api/mobile/support/${id}`,{headers:{Authorization:'Bearer '+foreign.access_token}});assert.equal(denied.status,404);
 stage='support member end';
 await mp.getByRole('button',{name:'End chat',exact:true}).click();await mp.getByRole('button',{name:'Keep chatting',exact:true}).click();await expect(mp.getByRole('textbox',{name:'Message',exact:true})).toBeVisible();await mp.getByRole('button',{name:'End chat',exact:true}).click();await noUnrelatedWaiting();await mp.getByRole('button',{name:'Confirm end chat',exact:true}).click();await expect(mp.getByText('Chat ended · history is retained',{exact:true}).filter({visible:true})).toBeVisible();await expect(op.getByText('Conversation closed',{exact:true})).toBeVisible();
 assert.equal((await op.request.get(filePath)).status(),200);assert.equal((await fetch(web+`/api/mobile/support/${id}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+memberToken},body:JSON.stringify({action:'SEND',body:'After ending'})})).status,409);
 stage='support retained history and new chat';await mp.getByText('Return to Support to start a new chat',{exact:true}).click();await expect(mp.getByText('Past chats',{exact:true})).toBeVisible();await expect(mp.getByText('View past chat',{exact:true})).toBeVisible();await mp.getByRole('button',{name:'New chat',exact:true}).click();await mp.getByRole('textbox',{name:'What do you need help with?',exact:true}).fill('A separate new support request');await noUnrelatedWaiting();const newCreated=mp.waitForResponse(r=>r.url().endsWith('/api/mobile/support')&&r.request().method()==='POST');await mp.getByRole('button',{name:'Send to support',exact:true}).click();const nextId=(await (await newCreated).json()).id;chats.push(nextId);assert.notEqual(nextId,id);
 checked(await db.from('support_conversations').update({assigned_agent_user_id:supportOther.id,status:'OPEN'}).eq('id',nextId));await op.goto(`/support/${nextId}`);await noUnrelatedWaiting();await op.getByRole('button',{name:'Close conversation',exact:true}).click();await expect(mp.getByText('Chat ended · history is retained',{exact:true}).filter({visible:true})).toBeVisible();
 console.log('PASS: mobile file picker/upload/image preview, exact staff download, handoff revocation, reload, member/staff closure, retained private history and new-chat isolation');
 }

 if(!narrow&&!process.argv.includes('--support-only')&&!process.argv.includes('--receipts-only')&&!process.argv.includes('--public-receipts-only')){
 stage='brokerage visitor intake';const gc=await context(),gp=await watch(await gc.newPage());currentPage=gp;await gp.goto(mobile+'/arrange-transport',{waitUntil:'domcontentloaded',timeout:90000});
 await gp.getByRole('textbox',{name:'From',exact:true}).fill('Adama');await gp.getByRole('textbox',{name:'To',exact:true}).fill('Dire Dawa');await gp.getByRole('textbox',{name:'Your name',exact:true}).fill('Synthetic mobile visitor');await gp.getByRole('textbox',{name:'Phone number',exact:true}).fill('+251900000078');
 const start=gp.waitForResponse(r=>r.url().endsWith('/api/mobile/brokerage/start')&&r.request().method()==='POST');await gp.getByRole('button',{name:'Start chat',exact:true}).click();const intake=await start;assert.equal(intake.status(),201);const request=(await intake.json()).snapshot.request.id;if(!requests.includes(request))requests.push(request);
 await expect(gp.getByRole('textbox',{name:'Message to transport team',exact:true})).toBeVisible();await mobileReply(gp,'Please arrange a flatbed for tomorrow.','Message to transport team');
 stage='brokerage staff claim';await bp.goto('/brokerage?queue=UNASSIGNED&view=ACTIVE');let card=bp.locator(`[data-request-id="${request}"]`);await expect(card).toContainText('Awaiting reply');await expect(card.getByRole('link',{name:'+251900000078',exact:true})).toHaveCount(0);
 assert.equal((await sp.request.get(`/api/brokerage/${request}/messages`)).status(),403);assert.equal((await obp.request.get(`/api/brokerage/${request}/messages`)).status(),403);
 await card.getByRole('button',{name:'Claim request',exact:true}).click();await bp.getByRole('navigation',{name:'Brokerage queues'}).getByRole('link',{name:/^Mine/}).click();card=bp.locator(`[data-request-id="${request}"]`);await card.getByRole('link',{name:'Open conversation',exact:true}).click();await expect(bp.getByText('Please arrange a flatbed for tomorrow.',{exact:true})).toBeVisible();await expect(bp.getByRole('link',{name:'+251900000078',exact:true})).toHaveAttribute('href','tel:+251900000078');
 stage='brokerage two-way replies';await gp.getByRole('textbox',{name:'Message to transport team',exact:true}).fill('Preserve brokerage draft');await bp.getByRole('textbox',{name:'Message',exact:true}).fill('We can help. What is the pickup time?');await bp.getByRole('button',{name:'Send message',exact:true}).click();await gp.bringToFront();await expect(gp.getByText('We can help. What is the pickup time?',{exact:true})).toBeVisible();await expect(gp.getByRole('textbox',{name:'Message to transport team',exact:true})).toHaveValue('Preserve brokerage draft');await mobileReply(gp,'Pickup is at nine in the morning.','Message to transport team');await bp.bringToFront();await expect(bp.getByText('Pickup is at nine in the morning.',{exact:true})).toBeVisible();
 await screenshot(gp,'mobile-brokerage');await screenshot(bp,'staff-brokerage');await gp.bringToFront();await gp.reload();await expect(gp.getByText('Pickup is at nine in the morning.',{exact:true})).toBeVisible();
 stage='brokerage handoff';const version=checked(await db.from('transport_service_requests').select('version').eq('id',request).single()).version;await rpc('assign_transport_service_request',{actor_user_id:admin,request_id:request,expected_version:version,target_user_id:brokerOther.id,claim:false});await expect(bp.getByText('This conversation is no longer available in this browser.',{exact:true})).toBeVisible();await expect(bp.getByText('Pickup is at nine in the morning.',{exact:true})).toHaveCount(0);await obp.goto(`/brokerage/${request}`);await expect(obp.getByText('Pickup is at nine in the morning.',{exact:true})).toBeVisible();
 stage='brokerage retained history';checked(await db.from('transport_chat_messages').insert(Array.from({length:55},(_,index)=>({id:randomUUID(),request_id:request,actor_user_id:null,sender_kind:'VISITOR',body:`Synthetic Brokerage history ${index}`}))));
 await gp.reload();await gp.getByRole('button',{name:'Older messages',exact:true}).click();await expect(gp.getByText('Please arrange a flatbed for tomorrow.',{exact:true})).toBeVisible();await expect(gp.getByRole('textbox',{name:'Message to transport team',exact:true})).toHaveCount(0);await gp.getByRole('button',{name:'Latest messages',exact:true}).click();await expect(gp.getByRole('textbox',{name:'Message to transport team',exact:true})).toBeVisible();
 stage='brokerage visitor end';await gp.getByRole('button',{name:'End chat',exact:true}).click();await gp.getByRole('button',{name:'Keep chatting',exact:true}).click();await gp.getByRole('button',{name:'End chat',exact:true}).click();await gp.getByRole('button',{name:'Confirm end chat',exact:true}).click();await expect(gp.getByText('Chat ended. Our team can still call you.',{exact:true})).toBeVisible();await expect(obp.getByText('Chat ended · call to follow up',{exact:true})).toBeVisible();await expect(obp.getByRole('textbox',{name:'Message',exact:true})).toHaveCount(0);
 stage='brokerage private callback follow-up';await obp.getByRole('combobox',{name:'Status',exact:true}).selectOption('CONTACTED');await obp.getByRole('textbox',{name:'Follow-up note',exact:true}).fill('Internal-only synthetic callback note');await obp.getByRole('button',{name:'Save follow-up',exact:true}).click();await expect(obp.getByText('Follow-up saved.',{exact:true})).toBeVisible();
 await obp.goto('/brokerage?queue=MINE&view=FOLLOW_UP');card=obp.locator(`[data-request-id="${request}"]`);await expect(card).toBeVisible();await expect(card.getByText('Awaiting reply',{exact:true})).toHaveCount(0);await card.getByRole('link',{name:'View chat history',exact:true}).click();await expect(obp.getByRole('textbox',{name:'Follow-up note',exact:true})).toHaveValue('Internal-only synthetic callback note');
 stage='brokerage resolution';await obp.getByRole('combobox',{name:'Status',exact:true}).selectOption('CLOSED');await obp.getByRole('button',{name:'Save follow-up',exact:true}).click();await expect(obp.getByText('Conversation closed',{exact:true})).toBeVisible();
 // Ended mobile screens intentionally stop polling. Explicit restore must show
 // resolved state without revealing internal staff notes or resurrecting messaging.
 await gp.reload();await expect(gp.getByText('Request resolved · chat history',{exact:true})).toBeVisible();await gp.getByRole('button',{name:'Older messages',exact:true}).click();await expect(gp.getByText('Pickup is at nine in the morning.',{exact:true})).toBeVisible();await expect(gp.getByText('Internal-only synthetic callback note',{exact:true})).toHaveCount(0);await screenshot(gp,'mobile-resolved-history');
 await obp.goto('/brokerage?queue=MINE&view=CLOSED');await expect(obp.locator(`[data-request-id="${request}"]`)).toBeVisible();await gp.getByRole('button',{name:'Start a new request',exact:true}).click();await expect(gp.getByRole('textbox',{name:'From',exact:true})).toBeVisible();assert.equal(checked(await db.from('transport_service_requests').select('status').eq('id',request).single()).status,'CLOSED');
 console.log('PASS: mobile brokerage intake, web staff claim/contact, automatic replies/drafts, reload, handoff, end, private callback note, Follow-up/Resolved queues, retained history and new-request reset');
 }


 if(process.argv.includes('--receipt-negatives-only')){
  const {gp,id,teamRead}=await receiptConversation(bp,broker,'Synthetic receipt boundary visitor','Synthetic receipt boundary question');
  const state=await teamRead();assert.ok(state.assignmentVersion>0);assert.ok(state.latestSequence>0);
  // Stop the visible chat surfaces before comparing saved cursors, so their
  // ordinary focus acknowledgements cannot be confused with a rejected write.
  await gp.goto('about:blank');await bp.goto('about:blank');
  const cursorBefore=checked(await db.from('transport_chat_read_cursors').select('*').eq('request_id',id).order('participant'));
  const requestBefore=checked(await db.from('transport_service_requests').select('status,assigned_agent_user_id,chat_assignment_version').eq('id',id).single());
  stage='narrow receipt staff identity';const ownStaff=await session(broker);
  const verifier=createClient('http://127.0.0.1:55321',anon,{auth:{persistSession:false,autoRefreshToken:false}});
  assert.equal(checked(await verifier.auth.getUser(ownStaff.access_token)).user.id,broker.id);
  stage='narrow receipt staff mobile denial';
  const mobileDenied=await fetch(web+'/api/mobile/chat-alerts',{headers:{Authorization:'Bearer '+ownStaff.access_token}});
  responses.set('GET /api/mobile/chat-alerts '+mobileDenied.status,1);assert.equal(mobileDenied.status,403);
  stage='narrow receipt forged identity denial';
  const forged=await bp.request.post(`/api/brokerage/${id}/read`,{data:{throughSequence:state.latestSequence,assignmentVersion:state.assignmentVersion,actorId:broker.id}});
  responses.set('POST /api/brokerage/:id/read '+forged.status(),1);assert.equal(forged.status(),400);
  stage='narrow receipt stale assignment denial';
  const stale=await bp.request.post(`/api/brokerage/${id}/read`,{data:{throughSequence:state.latestSequence,assignmentVersion:state.assignmentVersion-1}});
  responses.set('POST /api/brokerage/:id/read '+stale.status(),1);assert.equal(stale.status(),409);
  stage='narrow receipt unchanged saved state';
  assert.deepEqual(checked(await db.from('transport_chat_read_cursors').select('*').eq('request_id',id).order('participant')),cursorBefore);
  assert.deepEqual(checked(await db.from('transport_service_requests').select('status,assigned_agent_user_id,chat_assignment_version').eq('id',id).single()),requestBefore);
  assert.equal(checked(await db.from('transport_chat_messages').select('id').eq('request_id',id)).length,1);
  console.log('PASS: narrow actual guest intake and staff claim with verified staff mobile403, forged receipt400, stale assignment409 and unchanged saved cursors');
 }
 if(process.argv.includes('--brokerage-closure-only')){
  const body='Synthetic native Brokerage closure history';const {gp,id,visitorToken}=await receiptConversation(bp,broker,'Synthetic native closure visitor',body);
  stage='native Brokerage Keep chatting';await gp.bringToFront();await gp.getByRole('textbox',{name:'Message to transport team',exact:true}).fill('Synthetic preserved native closure draft');
  await gp.getByRole('button',{name:'End chat',exact:true}).click();await gp.getByRole('button',{name:'Keep chatting',exact:true}).click();
  await expect(gp.getByRole('textbox',{name:'Message to transport team',exact:true})).toHaveValue('Synthetic preserved native closure draft');
  assert.equal(checked(await db.from('transport_chat_access').select('ended_at').eq('request_id',id).single()).ended_at,null);
  stage='native Brokerage End';await gp.getByRole('button',{name:'End chat',exact:true}).click();const ended=gp.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/brokerage'&&response.request().method()==='POST');
  await gp.getByRole('button',{name:'Confirm end chat',exact:true}).click();assert.equal((await ended).status(),200);
  await expect(gp.getByText('Chat ended. Our team can still call you.',{exact:true})).toBeVisible();await expect(gp.getByRole('textbox',{name:'Message to transport team',exact:true})).toHaveCount(0);await expect(gp.getByText(body,{exact:true})).toBeVisible();
  const savedEnd=checked(await db.from('transport_service_requests').select('status,assigned_agent_user_id').eq('id',id).single());assert.equal(savedEnd.status,'NEW');assert.ok(checked(await db.from('transport_chat_access').select('ended_at').eq('request_id',id).single()).ended_at);assert.equal(savedEnd.assigned_agent_user_id,broker.id);
  stage='native Brokerage ended-send denial';assert.ok(visitorToken());const denied=await fetch(web+'/api/mobile/brokerage',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+visitorToken()},body:JSON.stringify({action:'SEND',messageId:randomUUID(),body:'Synthetic ended native write must not persist'})});assert.equal(denied.status,409);
  stage='native Brokerage retained staff history and call';await bp.bringToFront();await expect(bp.locator('.transport-chat-state')).toHaveText('Chat ended');await expect(bp.getByRole('textbox',{name:'Message',exact:true})).toHaveCount(0);
  await expect(bp.getByText(body,{exact:true})).toBeVisible();await expect(bp.getByRole('link',{name:receiptPhone,exact:true})).toHaveAttribute('href',`tel:${receiptPhone}`);
  await gp.bringToFront();await gp.reload();await expect(gp.getByText('Chat ended. Our team can still call you.',{exact:true})).toBeVisible();await expect(gp.getByText(body,{exact:true})).toBeVisible();
  stage='native Brokerage staff resolve';await bp.bringToFront();const follow=bp.getByRole('form',{name:'Request follow-up',exact:true});await follow.getByRole('combobox',{name:'Status',exact:true}).selectOption('CLOSED');await follow.getByLabel('Follow-up note',{exact:true}).fill('Synthetic call completed; request resolved.');
  const resolved=bp.waitForResponse(response=>new URL(response.url()).pathname===`/api/admin/transport-requests/${id}`&&response.request().method()==='POST');await follow.getByRole('button',{name:'Save follow-up',exact:true}).click();const resolution=await resolved;assert.equal(resolution.status(),200);assert.equal((await resolution.json()).ok,true);await expect(follow.getByText('Follow-up saved.',{exact:true})).toBeVisible();
  assert.equal(checked(await db.from('transport_service_requests').select('status').eq('id',id).single()).status,'CLOSED');
  stage='native Brokerage resolved visitor projection';await gp.bringToFront();const refreshed=gp.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/brokerage'&&response.request().method()==='GET');await gp.getByRole('button',{name:'Refresh conversation',exact:true}).click();assert.equal((await refreshed).status(),200);
  await expect(gp.getByText('Request resolved · chat history',{exact:true})).toBeVisible();await expect(gp.getByText('Synthetic call completed; request resolved.',{exact:true})).toHaveCount(0);
  stage='native Brokerage distinct new request';await gp.getByRole('button',{name:'Start a new request',exact:true}).click();
  for(const [field,value] of [['From','Dire Dawa'],['To','Adama'],['Your name','Synthetic native next visitor'],['Phone number',receiptPhone]])await gp.getByRole('textbox',{name:field,exact:true}).fill(value);
  const started=gp.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/brokerage/start'&&response.request().method()==='POST');await gp.getByRole('button',{name:'Start chat',exact:true}).click();const next=await started;assert.equal(next.status(),201);const nextId=(await next.json()).snapshot.request.id;if(!requests.includes(nextId))requests.push(nextId);assert.notEqual(nextId,id);
  await expect(gp.getByText(body,{exact:true})).toHaveCount(0);assert.equal(checked(await db.from('transport_chat_messages').select('id').eq('request_id',id)).length,1);assert.equal(checked(await db.from('transport_chat_messages').select('id').eq('request_id',nextId)).length,0);
  console.log('PASS: narrow actual native Brokerage Keep End retained private history staff call and resolve and distinct new request; ended writes denied and staff note stays private');
 }
 if(process.argv.includes('--brokerage-receipt-recovery-only')||process.argv.includes('--brokerage-history-only')){
  const {gp,id,guestRead}=await receiptConversation(bp,broker,'Synthetic receipt recovery visitor','Synthetic receipt recovery question');
  if(process.argv.includes('--brokerage-receipt-recovery-only')){
  stage='narrow receipt delivery failure';let failedReceipt=0;const endpoint=mobile+'/api/mobile/brokerage/read';
  // Only failed delivery is injected. Message writes and restored receipt writes
  // still pass through the actual API and database authority.
  await gp.route(endpoint,async route=>{if(route.request().method()==='POST'){failedReceipt++;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'TEMPORARY_UNAVAILABLE',message:'Temporary test transport failure'}})});}else await route.continue();});
  await bp.bringToFront();await brokerReply(bp,'Synthetic narrow receipt recovery reply');const replySequence=(await guestRead()).latestSequence;
  await gp.bringToFront();await expect(gp.getByText('Synthetic narrow receipt recovery reply',{exact:true})).toBeAttached();await gp.getByText('Synthetic narrow receipt recovery reply',{exact:true}).scrollIntoViewIfNeeded();
  await expect.poll(()=>failedReceipt,{timeout:30000}).toBeGreaterThan(0);assert.ok((await guestRead()).customerSeen<replySequence);
  await bp.bringToFront();await expect(bp.locator('.transport-chat-message').filter({hasText:'Synthetic narrow receipt recovery reply'}).getByText('Sent',{exact:true})).toBeVisible();
  stage='narrow restored receipt delivery';await gp.unroute(endpoint);await gp.bringToFront();
  await expect.poll(async()=>(await guestRead()).customerSeen,{timeout:30000}).toBe(replySequence);
  await bp.bringToFront();await expect(bp.locator('.transport-chat-message').filter({hasText:'Synthetic narrow receipt recovery reply'}).getByText('Seen',{exact:true})).toBeVisible();
  console.log('PASS: narrow injected receipt503 retains Sent; actual restored delivery saves Seen on native visitor and web staff');
  }
  const messagesBeforeHistory=checked(await db.from('transport_chat_messages').select('id').eq('request_id',id)).length;
  stage='narrow Brokerage below fold';await gp.bringToFront();await gp.getByRole('button',{name:'Refresh conversation',exact:true}).scrollIntoViewIfNeeded();
  checked(await db.from('transport_chat_messages').insert(Array.from({length:55},(_,index)=>({id:randomUUID(),request_id:id,actor_user_id:broker.id,sender_kind:'BROKER',body:`Synthetic narrow Brokerage history ${index}`}))));
  const downloaded=(await guestRead()).latestSequence;
  const refreshed=gp.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/brokerage'&&response.request().method()==='GET');
  await gp.getByRole('button',{name:'Refresh conversation',exact:true}).click();assert.equal((await refreshed).status(),200);
  await expect(gp.getByText('Synthetic narrow Brokerage history 54',{exact:true})).toBeAttached();
  await new Promise(resolve=>setTimeout(resolve,1000));assert.ok((await guestRead()).customerSeen<downloaded,'Below-fold download must not claim the unseen last message');
  stage='narrow Brokerage Older';const olderResponse=gp.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/brokerage'&&new URL(response.url()).searchParams.has('before')&&response.request().method()==='GET');
  await gp.getByRole('button',{name:'Older messages',exact:true}).click();const older=await olderResponse;assert.equal(older.status(),200);const olderMessages=(await older.json()).messages;assert.ok(Array.isArray(olderMessages)&&olderMessages.length>0&&olderMessages.length<=50);
  const olderMaximum=Math.max(...olderMessages.map(message=>message.sequence));assert.ok(Number.isSafeInteger(olderMaximum));
  await expect(gp.getByText('Synthetic receipt recovery question',{exact:true})).toBeVisible();await expect(gp.getByRole('textbox',{name:'Message to transport team',exact:true})).toHaveCount(0);
  await new Promise(resolve=>setTimeout(resolve,1000));const before=(await guestRead()).customerSeen;assert.ok(before<downloaded);
  stage='narrow Brokerage new reply during history';await bp.bringToFront();await brokerReply(bp,'Synthetic narrow Brokerage reply during history');const future=(await guestRead()).latestSequence;
  await gp.bringToFront();await expect(gp.getByText('Synthetic narrow Brokerage reply during history',{exact:true})).toHaveCount(0);const seen=(await guestRead()).customerSeen;
  receiptNumbers={beforeHistory:before,afterHistory:seen,olderWindowMaximum:olderMaximum,downloadedLatest:downloaded,unseenFuture:future};assert.equal(seen,before);
  console.log('METRICS: '+JSON.stringify(receiptNumbers));
  stage='narrow Brokerage Latest';await gp.getByRole('button',{name:'Latest messages',exact:true}).click();
  await expect(gp.getByText('Synthetic narrow Brokerage reply during history',{exact:true})).toBeAttached();assert.ok((await guestRead()).customerSeen<future);
  await gp.getByText('Synthetic narrow Brokerage reply during history',{exact:true}).scrollIntoViewIfNeeded();
  await expect.poll(async()=>(await guestRead()).customerSeen,{timeout:30000}).toBe(future);
  assert.equal(checked(await db.from('transport_chat_messages').select('id').eq('request_id',id)).length,messagesBeforeHistory+56);
  console.log('PASS: narrow actual Brokerage Refresh Older Latest with55 retained messages; unseen below-fold and history replies stay unread until visibly opened');
 }
 if(process.argv.includes('--public-receipts-only')){
 stage='public Marketplace signed Updates';
 const mw=await staffPage(member);currentPage=mw;await mw.goto('/about');await expect(mw.getByRole('button',{name:'Updates',exact:true})).toBeVisible();
 stage='public Marketplace own Support fixture';
 await noUnrelatedWaiting();const created=await mw.request.post('/api/support/conversations',{form:{category:'ACCOUNT',body:'Synthetic marketplace support inquiry'},maxRedirects:0});assert.equal(created.status(),303);
 const id=new URL(created.headers().location,web).searchParams.get('conversation');assert.match(id,/^[0-9a-f-]{36}$/);chats.push(id);
 checked(await db.from('support_conversations').update({assigned_agent_user_id:support.id,status:'OPEN'}).eq('id',id));
 await sp.goto(`/support/${id}`);await sp.bringToFront();await webReply(sp,'Synthetic reply while provider browses Marketplace');
 const read=()=>rpc('chat_read_state',{chat_kind:'SUPPORT',target_id:id,actor_user_id:member.id});
 assert.equal((await read()).customerSeen,0,'Public browsing must not see private chat bodies');
 stage='public Marketplace unread badge';
 await mw.bringToFront();await expect(mw.getByRole('button',{name:'Updates · 1 new or waiting',exact:true})).toBeVisible();await mw.getByRole('button',{name:'Updates · 1 new or waiting',exact:true}).click();
 stage='public Updates no private body';
 await expect(mw.getByText('1 unread',{exact:true})).toBeVisible();await expect(mw.getByText('Synthetic reply while provider browses Marketplace',{exact:true})).toHaveCount(0);
 assert.equal((await read()).customerSeen,0,'Opening Updates must not acknowledge private chat bodies');
 stage='public Updates phone layout';await mw.setViewportSize({width:320,height:800});await screenshot(mw,'web-marketplace-member-alert');
 stage='public Updates open own chat';await mw.locator('.chat-alert-dialog').locator(`a[href="/app/support?conversation=${id}"]`).click();
 stage='public web content consent';await acceptVisibleContentPolicy(mw);
 stage='public visible reply saves Seen';await expect(mw.getByText('Synthetic reply while provider browses Marketplace',{exact:true})).toBeVisible();
 // Opening a page does not acknowledge text below the phone viewport. Read the
 // actual reply before requiring its saved visible-message receipt.
 await mw.getByText('Synthetic reply while provider browses Marketplace',{exact:true}).scrollIntoViewIfNeeded();await expect.poll(async()=>(await read()).unreadCount,{timeout:30000}).toBe(0);
 // Simulated browser lifecycle events are identified explicitly; the actual reload
 // must reauthorize a now-revoked worker before showing private cached messages.
 stage='persisted private page reauthorization';
 await sp.bringToFront();await sp.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await expect(sp.getByText('Synthetic reply while provider browses Marketplace',{exact:true})).toBeHidden();
 checked(await db.from('support_agent_profiles').update({can_manage_support:false}).eq('user_id',support.id));
 const restored=sp.waitForEvent('domcontentloaded');await sp.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await restored;await expect(sp.getByText('Synthetic reply while provider browses Marketplace',{exact:true})).toHaveCount(0);
 console.log('PASS: signed public Marketplace alerts/unread without private bodies, narrow layout, real opening/Seen and lifecycle-event-injected reauthorization after revoked access');
 }
 if(process.argv.includes('--receipts-only')){
 stage='native receipt intake';
 const gc=await context(),gp=await watch(await gc.newPage());currentPage=gp;
 gp.on('request',outgoing=>{if(new URL(outgoing.url()).pathname==='/api/mobile/brokerage/start'&&outgoing.method()==='POST'){try{const id=JSON.parse(outgoing.postData()||'{}').requestId;if(typeof id==='string'&&/^[0-9a-f-]{36}$/.test(id)&&!requests.includes(id))requests.push(id);}catch{}}});
 await gp.goto(mobile+'/arrange-transport',{waitUntil:'domcontentloaded',timeout:90000});await gp.bringToFront();
 for(const [field,value] of [['From','Adama'],['To','Dire Dawa'],['Your name','Synthetic receipt visitor'],['Phone number',receiptPhone]])await gp.getByRole('textbox',{name:field,exact:true}).fill(value);
 const start=gp.waitForResponse(r=>r.url().endsWith('/api/mobile/brokerage/start')&&r.request().method()==='POST');await gp.getByRole('button',{name:'Start chat',exact:true}).click();const started=await start;assert.equal(started.status(),201);const request=(await started.json()).snapshot.request.id;if(!requests.includes(request))requests.push(request);
 await mobileReply(gp,'Synthetic receipt question','Message to transport team');
 // Local service metadata is inspected independently of the UI; no credentials are logged.
 stage='receipt authority';
 const access=checked(await db.from('transport_chat_access').select('credential_digest').eq('request_id',request).single()).credential_digest;
 const read=()=>rpc('chat_read_state',{chat_kind:'BROKERAGE',target_id:request,actor_user_id:null,access_digest:access});
 stage='visible first native message';
 const firstSequence=(await read()).latestSequence;assert.ok(firstSequence>0);
 await expect.poll(async()=>(await read()).customerSeen,{timeout:30000}).toBe(firstSequence);
 await gp.goto(mobile+'/about',{waitUntil:'domcontentloaded',timeout:90000});await gp.bringToFront();
 stage='actual assignment';
 await bp.goto('/brokerage?queue=UNASSIGNED&view=ACTIVE');const card=bp.locator(`[data-request-id="${request}"]`);await card.getByRole('button',{name:'Claim request',exact:true}).click();
 console.log('PASS: saved staff claim; verifying separate join');
 assert.equal((await read()).teamJoined,false,'Claim is not joining');
 await gp.bringToFront();await expect(gp.getByText('A team member is assigned',{exact:true})).toBeVisible();
 await bp.goto(`/brokerage/${request}`);await bp.bringToFront();await expect(bp.getByText('Synthetic receipt question',{exact:true})).toBeVisible();
 await expect.poll(async()=>(await read()).teamJoined,{timeout:30000}).toBe(true);
 await gp.bringToFront();await expect(gp.getByText('A team member joined your chat',{exact:true})).toBeVisible();
 stage='saved staff reply';
 await bp.bringToFront();await brokerReply(bp,'Synthetic unread reply');
 const replySequence=(await read()).latestSequence;assert.ok(replySequence>firstSequence);
 assert.equal((await read()).customerSeen,firstSequence,'Leaving chat must not see the reply');
 await gp.bringToFront();await expect(gp.getByText('New unread message',{exact:true})).toBeVisible();await screenshot(gp,'native-unread-alert');
 stage='native reopen Seen';
 await gp.getByRole('button',{name:'Open chat',exact:true}).click();await expect(gp.getByText('Synthetic unread reply',{exact:true})).toBeVisible();
 await expect.poll(async()=>(await read()).customerSeen,{timeout:30000}).toBe(replySequence);
 await bp.bringToFront();await expect(bp.getByText('Seen',{exact:true})).toBeVisible();
 // A menu covering a focused native chat must not acknowledge a new message.
 await gp.bringToFront();await gp.getByRole('button',{name:'Open menu',exact:true}).click();await expect(gp.getByRole('button',{name:'Close menu',exact:true})).toBeVisible();
 stage='reply behind native menu';
 await bp.bringToFront();await brokerReply(bp,'Synthetic reply behind menu');
 await gp.bringToFront();await expect(gp.getByRole('button',{name:'Close menu',exact:true})).toBeVisible();await expect.poll(async()=>(await read()).unreadCount,{timeout:30000}).toBe(1);
 await new Promise(resolve=>setTimeout(resolve,1500));assert.equal((await read()).customerSeen,replySequence,'Menu-hidden chat must not be Seen');
 stage='menu close resumes receipt';
 const menuSequence=(await read()).latestSequence;
 await gp.getByRole('button',{name:'Close menu',exact:true}).click();await expect(gp.getByText('Synthetic reply behind menu',{exact:true})).toBeVisible();await expect.poll(async()=>(await read()).customerSeen,{timeout:30000}).toBe(menuSequence);
 stage='native chat updates modal';
 await gp.getByRole('button',{name:'Open menu',exact:true}).click();await gp.getByRole('button',{name:/^Chat updates/}).click();await expect(gp.getByRole('button',{name:'Close menu',exact:true})).toHaveCount(0);await gp.evaluate(async()=>{await Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{})));});await screenshot(gp,'native-chat-updates');await gp.getByRole('button',{name:'Close',exact:true}).click();
 stage='receipt staff identity verification';const ownStaff=await session(broker);
 stage='receipt staff mobile denial';const staffNative=await fetch(web+'/api/mobile/chat-alerts',{headers:{Authorization:'Bearer '+ownStaff.access_token}});assert.equal(staffNative.status,403);
 stage='receipt forged identity denial';const forged=await bp.request.post(`/api/brokerage/${request}/read`,{data:{throughSequence:menuSequence,assignmentVersion:0,actorId:broker.id}});assert.equal(forged.status(),400);
 stage='receipt stale assignment denial';const stale=await bp.request.post(`/api/brokerage/${request}/read`,{data:{throughSequence:menuSequence,assignmentVersion:0}});assert.equal(stale.status(),409);


 stage='temporary receipt delivery failure';
 let failedReceipt=0;const receiptEndpoint=mobile+'/api/mobile/brokerage/read';
 await gp.route(receiptEndpoint,async route=>{if(route.request().method()==='POST'){failedReceipt++;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'TEMPORARY_UNAVAILABLE',message:'Temporary test transport failure'}})});}else await route.continue();});
 await bp.bringToFront();await brokerReply(bp,'Synthetic receipt delivery retry');const retrySequence=(await read()).latestSequence;
 await gp.bringToFront();await expect(gp.getByText('Synthetic receipt delivery retry',{exact:true})).toBeAttached();await gp.getByText('Synthetic receipt delivery retry',{exact:true}).scrollIntoViewIfNeeded();await expect.poll(()=>failedReceipt,{timeout:30000}).toBeGreaterThan(0);
 assert.ok((await read()).customerSeen<retrySequence,'A failed receipt must not claim Seen');
 await bp.bringToFront();await expect(bp.locator('.transport-chat-message').filter({hasText:'Synthetic receipt delivery retry'}).getByText('Sent',{exact:true})).toBeVisible();
 await gp.unroute(receiptEndpoint);await gp.bringToFront();await expect.poll(async()=>(await read()).customerSeen,{timeout:30000}).toBe(retrySequence);
 console.log('PASS: injected temporary receipt transport failure retains Sent; real restored delivery saves Seen');
 stage='native below-fold and history receipts';
 stage='brokerage retained history';checked(await db.from('transport_chat_messages').insert(Array.from({length:55},(_,index)=>({id:randomUUID(),request_id:request,actor_user_id:broker.id,sender_kind:'BROKER',body:`Synthetic below-fold history ${index}`}))));
 const unloadedSequence=(await read()).latestSequence;
 await gp.bringToFront();await gp.getByRole('button',{name:'Refresh conversation',exact:true}).click();await expect(gp.getByText('Synthetic below-fold history 54',{exact:true})).toBeAttached();
 await new Promise(resolve=>setTimeout(resolve,1000));assert.ok((await read()).customerSeen<unloadedSequence,'Downloading below-fold messages must not acknowledge them');
 const beforeHistory=(await read()).customerSeen;await gp.getByRole('button',{name:'Older messages',exact:true}).click();await expect(gp.getByText('Synthetic receipt question',{exact:true})).toBeVisible();
 assert.equal((await read()).customerSeen,beforeHistory,'Older downloaded history cannot see later messages');
 await bp.bringToFront();await brokerReply(bp,'Synthetic reply during older history');const future=(await read()).latestSequence;
 await gp.bringToFront();await expect(gp.getByText('Synthetic reply during older history',{exact:true})).toHaveCount(0);assert.ok((await read()).customerSeen<future);
 await gp.getByRole('button',{name:'Latest messages',exact:true}).click();await expect(gp.getByText('Synthetic reply during older history',{exact:true})).toBeAttached();await gp.getByText('Synthetic reply during older history',{exact:true}).scrollIntoViewIfNeeded();
 await expect.poll(async()=>(await read()).customerSeen,{timeout:30000}).toBe(future);
 console.log('PASS: actual native below-fold download and older-history denial; scrolling a new reply into view saves Seen');
 stage='web updates modal';
 await bp.getByRole('button',{name:/^Updates/}).click();await screenshot(bp,'web-chat-updates-phone');await bp.getByRole('button',{name:'Close',exact:true}).click();
 await bp.setViewportSize({width:1440,height:1000});await bp.getByRole('button',{name:/^Updates/}).click();await screenshot(bp,'web-chat-updates-desktop');await bp.getByRole('button',{name:'Close',exact:true}).click();
 console.log('PASS: actual mobile alerts away from chat, assignment versus join, replies, viewport Seen, overlay denial, web Seen, stale/forged reads and staff mobile denial');
 }

 assert.deepEqual(errors,[],'Browser runtime exceptions');
}catch(error){
 let visibleState=null;const knownTextCounts=[];
 if(currentPage)try{visibleState=await currentPage.evaluate(()=>({visible:document.visibilityState==='visible',focused:document.hasFocus(),controls:['Refresh chat','Refresh conversation','Send message','Older messages','Latest messages'].map(label=>({label,count:[...document.querySelectorAll('button,[role=button]')].filter(node=>node.textContent?.trim()===label).length}))}));}catch{/* No raw page snapshot or request details. */}
 if(currentPage)for(const text of ['Synthetic foreground staff reply','Synthetic foreground visitor answer','Synthetic historical Support 0','Synthetic reply during historical window','Synthetic receipt boundary question','Synthetic receipt recovery question','Synthetic narrow receipt recovery reply','Synthetic narrow Brokerage history 0','Synthetic narrow Brokerage history 54','Synthetic narrow Brokerage reply during history','Synthetic reply while provider browses Marketplace'])try{knownTextCounts.push({text,count:await currentPage.getByText(text,{exact:true}).count()});}catch{/* Fixed synthetic labels only. */}
 let preservedForegroundDraft=null;
 if(currentPage)try{const field=currentPage.getByRole('textbox',{name:'Message to transport team',exact:true});if(await field.count()===1)preservedForegroundDraft=await field.inputValue()==='Synthetic preserved foreground draft';}catch{/* No input value is retained. */}
 const rawMessage=String(error?.message||''),code=/^LOCAL_FIXTURE_FAILED_[A-Z0-9_]+$/.test(rawMessage)?rawMessage:undefined;
 const failureClass=code||(rawMessage.includes('strict mode violation')?'MULTIPLE_MATCH':rawMessage.includes('toHaveValue')?'VALUE_ASSERTION':rawMessage.includes('toBeVisible')?'VISIBILITY_ASSERTION':error?.name||'Error');
 const cause=String(error?.cause?.code||''),networkCause=/^[A-Z0-9_]{1,32}$/.test(cause)?cause:null;
 saveOwnership({failureStage:stage,failureClass});
 console.log('DIAGNOSTICS: '+JSON.stringify({stage,failureClass,networkCause,responses:[...responses].map(([route,count])=>({route,count})),visibleState,knownTextCounts,preservedForegroundDraft,receiptNumbers,runtimeErrorNames:errors}));
 throw Error('CHAT_ROUNDTRIP_FAILED: '+stage+' · '+failureClass);
}
finally{
 // Attempt every exact-scope cleanup even if one earlier provider operation
 // fails. Keep failures visible without printing contacts, paths or sessions.
 let cleanupFailures=0,preserveIdentities=false;
 const clean=async operation=>{try{await operation();return true;}catch{cleanupFailures++;return false;}};
 for(const value of contexts)await clean(()=>value.close());
 for(const client of clients)await clean(()=>client.auth.signOut({scope:'local'}));
 for(const id of chats){
  let filesRemoved=true;
  const readFiles=await clean(async()=>{
   const files=checked(await db.from('support_attachments').select('file_path').eq('conversation_id',id));
   for(const file of files)if(!await clean(async()=>{assert.match(file.file_path,/^supabase:\/\/support-attachment\//);checked(await db.storage.from('support-attachment').remove([file.file_path.slice('supabase://support-attachment/'.length)]));}))filesRemoved=false;
  });
  // Preserve exact file references and their parent identity if bytes could not
  // be removed. A failed cleanup must remain retryable instead of orphaning them.
  if(!readFiles||!filesRemoved){preserveIdentities=true;continue;}
  for(const table of ['support_attachments','support_conversations'])await clean(async()=>checked(await db.from(table).delete().eq(table==='support_conversations'?'id':'conversation_id',id)));
  await clean(async()=>checked(await db.from('audit_logs').delete().eq('entity_id',id)));
 }
 for(const id of requests){
  for(const table of ['transport_chat_messages','transport_chat_access','transport_request_events'])await clean(async()=>checked(await db.from(table).delete().eq('request_id',id)));
  await clean(async()=>checked(await db.from('audit_logs').delete().eq('entity_id',id)));
  await clean(async()=>checked(await db.from('transport_service_requests').delete().eq('id',id)));
 }
 for(const id of preserveIdentities?[]:users){
  await clean(async()=>checked(await db.from('audit_logs').delete().eq('actor_user_id',id)));
  await clean(async()=>checked(await db.from('audit_logs').delete().eq('entity_id',id)));
  await clean(async()=>checked(await db.auth.admin.deleteUser(id)));
 }
 for(const [table,ids] of [['support_conversations',chats],['transport_service_requests',requests],['profiles',users]]){
  if(ids.length)await clean(async()=>assert.equal(checked(await db.from(table).select('id').in('id',ids)).length,0,'Exact synthetic records remain'));
 }
 for(const id of users)await clean(async()=>{const result=await db.auth.admin.getUserById(id);assert.equal(result.error?.status,404,'Exact synthetic Auth identity remains');});
 await clean(()=>browser.close());
 if(cleanupFailures){saveOwnership({closed:true,cleanupVerified:false,cleanupFailures});throw Error('CHAT_AUDIT_CLEANUP_INCOMPLETE: '+cleanupFailures);}
 saveOwnership({closed:true,cleanupVerified:true,completedAt:new Date().toISOString()});
 console.log('CLEANUP: verified exact synthetic records, private objects and sessions only');
}
