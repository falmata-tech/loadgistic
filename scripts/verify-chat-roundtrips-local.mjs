import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
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
const browser=await chromium.launch({headless:true}),contexts=[],clients=[],users=[],chats=[],requests=[];
const suffix=randomUUID().slice(0,8),errors=[],receiptPhone='+2519'+String(parseInt(suffix,16)%100000000).padStart(8,'0');
let currentPage,stage='setup';
function checked(result){if(result.error)throw Error('LOCAL_FIXTURE_FAILED');return result.data;}
async function rpc(name,args){return checked(await db.rpc(name,args));}
async function identity(label){const slug=label.toLowerCase().replace(/[^a-z0-9]+/g,'-'),email=`chat-audit-${slug}-${suffix}@example.test`,user=checked(await db.auth.admin.createUser({email,email_confirm:true})).user;users.push(user.id);return {id:user.id,email,name:`Audit ${label} ${suffix}`};}
async function staff(admin,label,capability){const user=await identity(label);await rpc('create_managed_support_agent',{actor_user_id:admin,agent_auth_user_id:user.id,command:{name:user.name,email:user.email,can_manage_support:capability==='SUPPORT',can_manage_brokerage:capability==='BROKERAGE',available:false,max_open_conversations:20}});return user;}
async function session(user){const link=checked(await db.auth.admin.generateLink({type:'magiclink',email:user.email})),client=createClient('http://127.0.0.1:55321',anon,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(client);return checked(await client.auth.verifyOtp({type:'magiclink',token_hash:link.properties.hashed_token})).session;}
async function context(){const value=await browser.newContext({baseURL:web,viewport:{width:412,height:915},extraHTTPHeaders:{'x-forwarded-for':'127.0.0.249'}});contexts.push(value);return value;}
async function watch(page){page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.name));return page;}
async function staffPage(user){const value=await context(),login=await session(user);await value.addCookies(createChunks('sb-127-auth-token','base64-'+Buffer.from(JSON.stringify(login)).toString('base64url')).map(cookie=>({...cookie,url:web,sameSite:'Lax'})));return watch(await value.newPage());}
async function screenshot(page,name){await page.screenshot({path:new URL(`.local/chat-roundtrip-${name}.png`,root).pathname,fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Phone overflow');}
async function webReply(page,body){await page.getByRole('textbox',{name:'Message',exact:true}).fill(body);await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByText(body,{exact:true})).toBeVisible();}
async function brokerReply(page,body){await page.getByRole('textbox',{name:'Message',exact:true}).fill(body);const saved=page.waitForResponse(response=>/\/api\/brokerage\/[0-9a-f-]+\/messages$/.test(new URL(response.url()).pathname)&&response.request().method()==='POST');await page.getByRole('button',{name:'Send message',exact:true}).click();assert.equal((await saved).status(),200);await expect(page.locator('.transport-chat-message').getByText(body,{exact:true})).toBeVisible();}
async function mobileReply(page,body,label='Message'){await page.getByRole('textbox',{name:label,exact:true}).fill(body);const sent=page.waitForResponse(response=>/\/api\/mobile\/(brokerage|support\/[0-9a-f-]+)$/.test(new URL(response.url()).pathname)&&response.request().method()==='POST');await page.getByRole('button',{name:'Send message',exact:true}).click();assert.equal((await sent).status(),200);await expect(page.getByText(body,{exact:true})).toBeVisible();}

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

 if(!process.argv.includes('--brokerage-only')&&!process.argv.includes('--receipts-only')&&!process.argv.includes('--public-receipts-only')){
 const mc=await context(),login=await session(member),mp=await watch(await mc.newPage());currentPage=mp;
 await mc.addInitScript(token=>{if(!sessionStorage.getItem('loadgistic.fixture.seeded')){sessionStorage.setItem('loadgistic.account.refresh.v1',token);sessionStorage.setItem('loadgistic.fixture.seeded','1');}},login.refresh_token);
 let memberToken='';mp.on('request',request=>{if(request.url().includes('/api/mobile/support'))memberToken=request.headers().authorization?.replace(/^Bearer /,'')||memberToken;});
 await mp.goto(mobile+'/support',{waitUntil:'domcontentloaded',timeout:90000});await mp.getByRole('button',{name:'New chat',exact:true}).click();
 await mp.getByRole('textbox',{name:'What do you need help with?',exact:true}).fill('Help with my mobile capacity settings.');
 const created=mp.waitForResponse(r=>r.url().endsWith('/api/mobile/support')&&r.request().method()==='POST');await mp.getByRole('button',{name:'Send to support',exact:true}).click();const result=await created;assert.equal(result.status(),201);const id=(await result.json()).id;chats.push(id);
 await expect(mp.getByText('Help with my mobile capacity settings.',{exact:true})).toBeVisible();
 // Make only our synthetic conversation the oldest waiting fixture. Existing
 // staff availability/queues are unchanged; automatic routing is tested in SQL.
 checked(await db.from('support_conversations').update({status:'WAITING',assigned_agent_user_id:null,assigned_at:null,created_at:'1900-01-01T00:00:00Z'}).eq('id',id));
 checked(await db.from('support_agent_profiles').update({available:true}).eq('user_id',support.id));
 await sp.goto('/support?view=WAITING');const claim=sp.locator(`form[action="/api/support/conversations/${id}/claim"]`);await claim.getByRole('button',{name:'Claim',exact:true}).click();await expect(sp).toHaveURL(new RegExp(`/support/${id}`));
 assert.equal(checked(await db.from('support_conversations').select('assigned_agent_user_id').eq('id',id).single()).assigned_agent_user_id,support.id);
 await expect(mp.getByText(`Assigned to ${support.name}`,{exact:true})).toBeVisible();
 assert.equal((await bp.request.get(`/api/support/updates?conversation=${id}`)).status(),403);assert.equal((await op.request.get(`/api/support/updates?conversation=${id}`)).status(),403);
 await mp.getByRole('textbox',{name:'Message',exact:true}).fill('Keep this mobile draft');await webReply(sp,'Support is reviewing your capacity settings.');await expect(mp.getByText('Support is reviewing your capacity settings.',{exact:true})).toBeVisible();await expect(mp.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Keep this mobile draft');
 await mobileReply(mp,'My capacity is shared privately.');await expect(sp.getByText('My capacity is shared privately.',{exact:true})).toBeVisible();
 console.log('PASS: mobile Support intake, real staff claim, automatic replies both ways, draft retention and other-team/agent denial');
 const bytes=readFileSync(new URL('public/brand/loadgistic-icon.png',root));
 await mp.getByRole('textbox',{name:'Message',exact:true}).fill('Synthetic support attachment');const chooser=mp.waitForEvent('filechooser');await mp.getByRole('button',{name:'Choose file',exact:true}).click();await (await chooser).setFiles({name:'audit-support.png',mimeType:'image/png',buffer:bytes});await mp.getByRole('button',{name:'Send message',exact:true}).click();await expect(mp.getByText('Synthetic support attachment',{exact:true})).toBeVisible();await expect(sp.getByText('Synthetic support attachment',{exact:true})).toBeVisible();
 const file=checked(await db.from('support_attachments').select('id,original_name').eq('conversation_id',id).eq('state','ATTACHED').single()),filePath=`/api/support/conversations/${id}/attachments/${file.id}`;
 const download=await sp.request.get(filePath);assert.equal(download.status(),200);assert.deepEqual(await download.body(),bytes);assert.equal((await bp.request.get(filePath)).status(),404);assert.equal((await op.request.get(filePath)).status(),404);
 await mp.getByRole('button',{name:`Open ${file.original_name}`,exact:true}).click();await expect(mp.getByText('Private document',{exact:true})).toBeVisible();await expect(mp.getByRole('img',{name:'Submitted document',exact:true})).toBeVisible();await mp.getByRole('button',{name:'Close document',exact:true}).click();
 await screenshot(mp,'mobile-support');await screenshot(sp,'staff-support');
 checked(await db.from('support_conversations').update({assigned_agent_user_id:supportOther.id,agent_last_read_at:null,updated_at:new Date().toISOString()}).eq('id',id));
 assert.equal((await sp.request.get(filePath)).status(),404);
 const staleSend=await sp.request.post(`/api/support/conversations/${id}/messages`,{form:{body:'Old assignee must not send'},maxRedirects:0});assert.equal(staleSend.status(),303);assert.ok(new URL(staleSend.headers().location).searchParams.get('error'));assert.equal(checked(await db.from('support_messages').select('id').eq('conversation_id',id).eq('body','Old assignee must not send')).length,0);
 await op.goto(`/support/${id}`);await expect(op.getByText('Synthetic support attachment',{exact:true})).toBeVisible();assert.equal((await op.request.get(filePath)).status(),200);
 await webReply(op,'Your new support agent has the conversation history.');await expect(mp.getByText('Your new support agent has the conversation history.',{exact:true})).toBeVisible();
 await mp.reload();await expect(mp.getByText('Your new support agent has the conversation history.',{exact:true})).toBeVisible();
 checked(await db.from('support_messages').insert(Array.from({length:55},(_,index)=>({conversation_id:id,sender_user_id:member.id,body:`Synthetic earlier Support ${index}`,created_at:new Date(Date.UTC(2020,0,1,0,0,index)).toISOString()}))));
 await mp.getByRole('button',{name:'Refresh chat',exact:true}).click();await mp.getByRole('button',{name:'Older messages',exact:true}).click();await expect(mp.getByText('Synthetic earlier Support 0',{exact:true})).toBeVisible();await expect(mp.getByRole('textbox',{name:'Message',exact:true})).toHaveCount(0);
 await webReply(op,'New reply while you read older history.');await expect(mp.getByText('New reply while you read older history.',{exact:true})).toHaveCount(0);await mp.getByRole('button',{name:'Latest messages',exact:true}).click();await expect(mp.getByText('New reply while you read older history.',{exact:true})).toBeVisible();
 const foreign=await session(outsider);const denied=await fetch(web+`/api/mobile/support/${id}`,{headers:{Authorization:'Bearer '+foreign.access_token}});assert.equal(denied.status,404);
 await mp.getByRole('button',{name:'End chat',exact:true}).click();await mp.getByRole('button',{name:'Keep chatting',exact:true}).click();await expect(mp.getByRole('textbox',{name:'Message',exact:true})).toBeVisible();await mp.getByRole('button',{name:'End chat',exact:true}).click();await mp.getByRole('button',{name:'Confirm end chat',exact:true}).click();await expect(mp.getByText('Chat ended · history is retained',{exact:true}).filter({visible:true})).toBeVisible();await expect(op.getByText('Conversation closed',{exact:true})).toBeVisible();
 assert.equal((await op.request.get(filePath)).status(),200);assert.equal((await fetch(web+`/api/mobile/support/${id}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+memberToken},body:JSON.stringify({action:'SEND',body:'After ending'})})).status,409);
 await mp.getByText('Return to Support to start a new chat',{exact:true}).click();await expect(mp.getByText('Past chats',{exact:true})).toBeVisible();await expect(mp.getByText('View past chat',{exact:true})).toBeVisible();await mp.getByRole('button',{name:'New chat',exact:true}).click();await mp.getByRole('textbox',{name:'What do you need help with?',exact:true}).fill('A separate new support request');const newCreated=mp.waitForResponse(r=>r.url().endsWith('/api/mobile/support')&&r.request().method()==='POST');await mp.getByRole('button',{name:'Send to support',exact:true}).click();const nextId=(await (await newCreated).json()).id;chats.push(nextId);assert.notEqual(nextId,id);
 checked(await db.from('support_conversations').update({assigned_agent_user_id:supportOther.id,status:'OPEN'}).eq('id',nextId));await op.goto(`/support/${nextId}`);await op.getByRole('button',{name:'Close conversation',exact:true}).click();await expect(mp.getByText('Chat ended · history is retained',{exact:true}).filter({visible:true})).toBeVisible();
 console.log('PASS: mobile file picker/upload/image preview, exact staff download, handoff revocation, reload, member/staff closure, retained private history and new-chat isolation');
 }

 if(!process.argv.includes('--support-only')&&!process.argv.includes('--receipts-only')&&!process.argv.includes('--public-receipts-only')){
 const gc=await context(),gp=await watch(await gc.newPage());currentPage=gp;await gp.goto(mobile+'/arrange-transport',{waitUntil:'domcontentloaded',timeout:90000});
 await gp.getByRole('textbox',{name:'From',exact:true}).fill('Adama');await gp.getByRole('textbox',{name:'To',exact:true}).fill('Dire Dawa');await gp.getByRole('textbox',{name:'Your name',exact:true}).fill('Synthetic mobile visitor');await gp.getByRole('textbox',{name:'Phone number',exact:true}).fill('+251900000078');
 const start=gp.waitForResponse(r=>r.url().endsWith('/api/mobile/brokerage/start')&&r.request().method()==='POST');await gp.getByRole('button',{name:'Start chat',exact:true}).click();const intake=await start;assert.equal(intake.status(),201);const request=(await intake.json()).snapshot.request.id;if(!requests.includes(request))requests.push(request);
 await expect(gp.getByRole('textbox',{name:'Message to transport team',exact:true})).toBeVisible();await mobileReply(gp,'Please arrange a flatbed for tomorrow.','Message to transport team');
 await bp.goto('/brokerage?queue=UNASSIGNED&view=ACTIVE');let card=bp.locator(`[data-request-id="${request}"]`);await expect(card).toContainText('Awaiting reply');await expect(card.getByRole('link',{name:'+251900000078',exact:true})).toHaveCount(0);
 assert.equal((await sp.request.get(`/api/brokerage/${request}/messages`)).status(),403);assert.equal((await obp.request.get(`/api/brokerage/${request}/messages`)).status(),403);
 await card.getByRole('button',{name:'Claim request',exact:true}).click();await bp.getByRole('navigation',{name:'Brokerage queues'}).getByRole('link',{name:/^Mine/}).click();card=bp.locator(`[data-request-id="${request}"]`);await card.getByRole('link',{name:'Open conversation',exact:true}).click();await expect(bp.getByText('Please arrange a flatbed for tomorrow.',{exact:true})).toBeVisible();await expect(bp.getByRole('link',{name:'+251900000078',exact:true})).toHaveAttribute('href','tel:+251900000078');
 await gp.getByRole('textbox',{name:'Message to transport team',exact:true}).fill('Preserve brokerage draft');await bp.getByRole('textbox',{name:'Message',exact:true}).fill('We can help. What is the pickup time?');await bp.getByRole('button',{name:'Send message',exact:true}).click();await expect(gp.getByText('We can help. What is the pickup time?',{exact:true})).toBeVisible();await expect(gp.getByRole('textbox',{name:'Message to transport team',exact:true})).toHaveValue('Preserve brokerage draft');await mobileReply(gp,'Pickup is at nine in the morning.','Message to transport team');await expect(bp.getByText('Pickup is at nine in the morning.',{exact:true})).toBeVisible();
 await screenshot(gp,'mobile-brokerage');await screenshot(bp,'staff-brokerage');await gp.reload();await expect(gp.getByText('Pickup is at nine in the morning.',{exact:true})).toBeVisible();
 const version=checked(await db.from('transport_service_requests').select('version').eq('id',request).single()).version;await rpc('assign_transport_service_request',{actor_user_id:admin,request_id:request,expected_version:version,target_user_id:brokerOther.id,claim:false});await expect(bp.getByText('This conversation is no longer available in this browser.',{exact:true})).toBeVisible();await expect(bp.getByText('Pickup is at nine in the morning.',{exact:true})).toHaveCount(0);await obp.goto(`/brokerage/${request}`);await expect(obp.getByText('Pickup is at nine in the morning.',{exact:true})).toBeVisible();
 checked(await db.from('transport_chat_messages').insert(Array.from({length:55},(_,index)=>({id:randomUUID(),request_id:request,actor_user_id:null,sender_kind:'VISITOR',body:`Synthetic Brokerage history ${index}`}))));
 await gp.reload();await gp.getByRole('button',{name:'Older messages',exact:true}).click();await expect(gp.getByText('Please arrange a flatbed for tomorrow.',{exact:true})).toBeVisible();await expect(gp.getByRole('textbox',{name:'Message to transport team',exact:true})).toHaveCount(0);await gp.getByRole('button',{name:'Latest messages',exact:true}).click();await expect(gp.getByRole('textbox',{name:'Message to transport team',exact:true})).toBeVisible();
 await gp.getByRole('button',{name:'End chat',exact:true}).click();await gp.getByRole('button',{name:'Keep chatting',exact:true}).click();await gp.getByRole('button',{name:'End chat',exact:true}).click();await gp.getByRole('button',{name:'Confirm end chat',exact:true}).click();await expect(gp.getByText('Chat ended. Our team can still call you.',{exact:true})).toBeVisible();await expect(obp.getByText('Chat ended · call to follow up',{exact:true})).toBeVisible();await expect(obp.getByRole('textbox',{name:'Message',exact:true})).toHaveCount(0);
 await obp.getByRole('combobox',{name:'Status',exact:true}).selectOption('CONTACTED');await obp.getByRole('textbox',{name:'Follow-up note',exact:true}).fill('Internal-only synthetic callback note');await obp.getByRole('button',{name:'Save follow-up',exact:true}).click();await expect(obp.getByText('Follow-up saved.',{exact:true})).toBeVisible();
 await obp.goto('/brokerage?queue=MINE&view=FOLLOW_UP');card=obp.locator(`[data-request-id="${request}"]`);await expect(card).toBeVisible();await expect(card.getByText('Awaiting reply',{exact:true})).toHaveCount(0);await card.getByRole('link',{name:'View chat history',exact:true}).click();await expect(obp.getByRole('textbox',{name:'Follow-up note',exact:true})).toHaveValue('Internal-only synthetic callback note');
 await obp.getByRole('combobox',{name:'Status',exact:true}).selectOption('CLOSED');await obp.getByRole('button',{name:'Save follow-up',exact:true}).click();await expect(obp.getByText('Conversation closed',{exact:true})).toBeVisible();
 // Ended mobile screens intentionally stop polling. Explicit restore must show
 // resolved state without revealing internal staff notes or resurrecting messaging.
 await gp.reload();await expect(gp.getByText('Request resolved · chat history',{exact:true})).toBeVisible();await gp.getByRole('button',{name:'Older messages',exact:true}).click();await expect(gp.getByText('Pickup is at nine in the morning.',{exact:true})).toBeVisible();await expect(gp.getByText('Internal-only synthetic callback note',{exact:true})).toHaveCount(0);await screenshot(gp,'mobile-resolved-history');
 await obp.goto('/brokerage?queue=MINE&view=CLOSED');await expect(obp.locator(`[data-request-id="${request}"]`)).toBeVisible();await gp.getByRole('button',{name:'Start a new request',exact:true}).click();await expect(gp.getByRole('textbox',{name:'From',exact:true})).toBeVisible();assert.equal(checked(await db.from('transport_service_requests').select('status').eq('id',request).single()).status,'CLOSED');
 console.log('PASS: mobile brokerage intake, web staff claim/contact, automatic replies/drafts, reload, handoff, end, private callback note, Follow-up/Resolved queues, retained history and new-request reset');
 }


 if(process.argv.includes('--public-receipts-only')){
 stage='signed public Marketplace support alert';
 const mw=await staffPage(member);currentPage=mw;await mw.goto('/about');await expect(mw.getByRole('button',{name:'Updates',exact:true})).toBeVisible();
 const created=await mw.request.post('/api/support/conversations',{form:{category:'ACCOUNT',body:'Synthetic marketplace support inquiry'},maxRedirects:0});assert.equal(created.status(),303);
 const id=new URL(created.headers().location,web).searchParams.get('conversation');assert.match(id,/^[0-9a-f-]{36}$/);chats.push(id);
 checked(await db.from('support_conversations').update({assigned_agent_user_id:support.id,status:'OPEN'}).eq('id',id));
 await sp.goto(`/support/${id}`);await sp.bringToFront();await webReply(sp,'Synthetic reply while provider browses Marketplace');
 const read=()=>rpc('chat_read_state',{chat_kind:'SUPPORT',target_id:id,actor_user_id:member.id});
 assert.equal((await read()).customerSeen,0,'Public browsing must not see private chat bodies');
 await mw.bringToFront();await expect(mw.getByRole('button',{name:'Updates · 1 new or waiting',exact:true})).toBeVisible();await mw.getByRole('button',{name:'Updates · 1 new or waiting',exact:true}).click();
 await expect(mw.getByText('1 unread',{exact:true})).toBeVisible();await expect(mw.getByText('Synthetic reply while provider browses Marketplace',{exact:true})).toHaveCount(0);
 await mw.setViewportSize({width:320,height:800});await screenshot(mw,'web-marketplace-member-alert');await mw.locator(`a[href="/app/support?conversation=${id}"]`).click();await expect(mw.getByText('Synthetic reply while provider browses Marketplace',{exact:true})).toBeVisible();await expect.poll(async()=>(await read()).unreadCount,{timeout:30000}).toBe(0);
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
 stage='forged, stale and mobile staff denial';
 const ownStaff=await session(broker);const staffNative=await fetch(web+'/api/mobile/chat-alerts',{headers:{Authorization:'Bearer '+ownStaff.access_token}});assert.equal(staffNative.status,403);
 const forged=await bp.request.post(`/api/brokerage/${request}/read`,{data:{throughSequence:menuSequence,assignmentVersion:0,actorId:broker.id}});assert.equal(forged.status(),400);
 const stale=await bp.request.post(`/api/brokerage/${request}/read`,{data:{throughSequence:menuSequence,assignmentVersion:0}});assert.equal(stale.status(),409);


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
 checked(await db.from('transport_chat_messages').insert(Array.from({length:55},(_,index)=>({id:randomUUID(),request_id:request,actor_user_id:broker.id,sender_kind:'BROKER',body:`Synthetic below-fold history ${index}`}))));
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
}catch(error){if(currentPage)await currentPage.screenshot({path:new URL('.local/chat-roundtrip-failure.png',root).pathname,fullPage:true}).catch(()=>{});throw Error('CHAT_ROUNDTRIP_FAILED: '+stage+' · '+(error?.name||'Error'));}
finally{
 // Clean only test-created identities, rows and exact private attachment objects.
 for(const value of contexts)await value.close();for(const client of clients)await client.auth.signOut({scope:'local'});
 for(const id of chats){const files=checked(await db.from('support_attachments').select('file_path').eq('conversation_id',id));for(const file of files){assert.match(file.file_path,/^supabase:\/\/support-attachment\//);checked(await db.storage.from('support-attachment').remove([file.file_path.slice('supabase://support-attachment/'.length)]));}checked(await db.from('support_attachments').delete().eq('conversation_id',id));checked(await db.from('support_conversations').delete().eq('id',id));checked(await db.from('audit_logs').delete().eq('entity_id',id));}
 for(const id of requests){for(const table of ['transport_chat_messages','transport_chat_access','transport_request_events'])checked(await db.from(table).delete().eq('request_id',id));checked(await db.from('transport_service_requests').delete().eq('id',id));checked(await db.from('audit_logs').delete().eq('entity_id',id));}
 for(const id of users){checked(await db.from('audit_logs').delete().eq('actor_user_id',id));checked(await db.from('audit_logs').delete().eq('entity_id',id));checked(await db.auth.admin.deleteUser(id));}await browser.close();
 console.log('CLEANUP: disposable local records, private objects and sessions only');
}
