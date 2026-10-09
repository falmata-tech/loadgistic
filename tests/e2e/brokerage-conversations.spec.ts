import {test,expect as baseExpect} from '@playwright/test';
import type {Page,Browser,BrowserContext} from 'playwright-core';
import {createClient} from '@supabase/supabase-js';
import {createChunks} from '@supabase/ssr/dist/main/utils/chunker.js';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {localAuditService,checked} from './audit-helpers';
const expect=baseExpect.configure({timeout:20000});

test('visitor and brokerage exchange durable live messages, recover and respect closure and handoff',async({page,browser}:{page:Page;browser:Browser},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(180000);const db=localAuditService(),suffix=randomUUID().slice(0,8);let requestId='';const ids:string[]=[],contexts:BrowserContext[]=[];
 const sessions:ReturnType<typeof createClient>[]=[];
 const admin=checked(await db.from('profiles').select('id').eq('role','ADMIN').eq('active',true).limit(1).single());
 async function staff(brokerage:boolean){const email=`chat-${randomUUID()}@example.test`,user=checked(await db.auth.admin.createUser({email,email_confirm:true})).user;ids.push(user.id);
  checked(await db.rpc('create_managed_support_agent',{actor_user_id:admin.id,agent_auth_user_id:user.id,command:{name:`Broker ${suffix}`,email,can_manage_support:!brokerage,can_manage_brokerage:brokerage,max_open_conversations:20}}));return {id:user.id,email};}
 async function login(identity:{id:string;email:string}){const context=await browser.newContext({baseURL:'http://127.0.0.1:3100',viewport:page.viewportSize()!,extraHTTPHeaders:{'x-forwarded-for':'127.0.0.245'}});contexts.push(context);
  const link=checked(await db.auth.admin.generateLink({type:'magiclink',email:identity.email})),url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const client=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});sessions.push(client);
  const result=await client.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'magiclink'});expect(result.error).toBeNull();
  const cookies=createChunks(`sb-${new URL(url).hostname.split('.')[0]}-auth-token`,'base64-'+Buffer.from(JSON.stringify(result.data.session)).toString('base64url'));
  await context.addCookies(cookies.map(cookie=>({...cookie,url:'http://127.0.0.1:3100',sameSite:'Lax' as const})));return context;}
 try{
  const broker=await staff(true),other=await staff(true),support=await staff(false),bc=await login(broker),sc=await login(support),oc=await login(other);const bp=await bc.newPage();
  await bp.goto('/brokerage?queue=UNASSIGNED&view=ALL');
  await page.goto('/about');await page.getByRole('button',{name:'Need help with transport?',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Need help with transport?',exact:true}),form=dialog.getByRole('form',{name:'Arrange transport',exact:true});
  await expect(form).toBeVisible();await expect(form.locator('input')).toHaveCount(4);
  await form.getByLabel('From',{exact:true}).fill('Adama');await form.getByLabel('To',{exact:true}).fill('Dire Dawa');await form.getByLabel('Name',{exact:true}).fill(`Chat visitor ${suffix}`);await form.getByLabel('Phone',{exact:true}).fill('+2519'+String(Math.floor(Math.random()*100000000)).padStart(8,'0'));
  const sent=page.waitForResponse(r=>r.url().endsWith('/api/transport-requests')&&r.request().method()==='POST');await form.getByRole('button',{name:'Start chat',exact:true}).click();const receipt=await sent;expect(receipt.status()).toBe(200);requestId=JSON.parse(receipt.request().postData()!).requestId;
  await expect(dialog.getByText('Waiting for our transport team',{exact:true})).toBeVisible();
  await expect(dialog.getByText('What are you moving?',{exact:true})).toBeVisible();
  await expect(dialog.getByPlaceholder('Your goods, pickup time, or a question…')).toBeVisible();
  await expect(dialog.getByRole('textbox',{name:'Message',exact:true})).toBeVisible();
  expect((await sc.request.get(`/api/brokerage/${requestId}/messages`)).status()).toBe(403);expect((await oc.request.get(`/api/brokerage/${requestId}/messages`)).status()).toBe(403);
  await dialog.getByRole('textbox',{name:'Message',exact:true}).fill('Can you arrange a covered truck?');
  await dialog.getByRole('button',{name:'Send message',exact:true}).click();await expect(dialog.getByText('Can you arrange a covered truck?',{exact:true})).toBeVisible();
  const card=bp.locator(`[data-request-id="${requestId}"]`);await expect(card.getByText('Awaiting reply',{exact:true})).toBeVisible();
  const claimed=bp.waitForResponse(response=>response.url().endsWith(`/api/admin/transport-requests/${requestId}`)&&response.request().method()==='POST');
  await card.getByRole('button',{name:'Claim request',exact:true}).click();expect((await claimed).status()).toBe(200);await expect(card).toHaveCount(0);await bp.getByRole('link',{name:/^Mine/}).click();await expect(card.getByRole('link',{name:'Open conversation',exact:true})).toBeVisible();await card.getByRole('link',{name:'Open conversation',exact:true}).click();
  await expect(bp.getByRole('heading',{name:'Brokerage conversation',exact:true})).toBeVisible();await expect(bp.getByText('Can you arrange a covered truck?',{exact:true})).toBeVisible();
  await bp.getByRole('textbox',{name:'Message',exact:true}).fill('Yes. What time should we arrange pickup?');await bp.getByRole('button',{name:'Send message',exact:true}).click();
  await expect(dialog.getByText('Yes. What time should we arrange pickup?',{exact:true})).toBeVisible();
  // Simulate a committed write whose acknowledgement is lost; retry must not duplicate.
  await page.route('**/api/transport-requests/conversation',async route=>{if(route.request().method()==='POST'){const response=await route.fetch();expect(response.status()).toBe(200);await route.fulfill({status:503,json:{error:'Message not confirmed. Your draft is kept; try sending again.'}});}else await route.continue();},{times:1});
  await dialog.getByRole('textbox',{name:'Message',exact:true}).fill('Tomorrow at 9 AM.');await dialog.getByRole('button',{name:'Send message',exact:true}).click();
  await expect(dialog.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Tomorrow at 9 AM.');await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.getByRole('button',{name:'Send message',exact:true}).click();await expect(dialog.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('');
  expect(checked(await db.from('transport_chat_messages').select('id').eq('request_id',requestId).eq('body','Tomorrow at 9 AM.'))).toHaveLength(1);
  await expect(bp.getByText('Tomorrow at 9 AM.',{exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('visitor-conversation.png')});await bp.screenshot({path:info.outputPath('broker-conversation.png')});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.reload();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByText('Tomorrow at 9 AM.',{exact:true})).toBeVisible();
  const outsider=await browser.newContext({baseURL:'http://127.0.0.1:3100'});contexts.push(outsider);expect(await (await outsider.request.get('/api/transport-requests/conversation')).json()).toBeNull();expect((await outsider.request.post('/api/transport-requests/conversation',{data:{messageId:randomUUID(),body:'Intrusion',requestId}})).status()).toBe(403);
  const saved=checked(await db.from('transport_service_requests').select('version').eq('id',requestId).single());
  checked(await db.rpc('assign_transport_service_request',{actor_user_id:admin.id,request_id:requestId,expected_version:saved.version,target_user_id:other.id,claim:false}));
  await expect(bp.getByText('This conversation is no longer available in this browser.',{exact:true})).toBeVisible();await expect(bp.getByText('Tomorrow at 9 AM.',{exact:true})).toHaveCount(0);
  const op=await oc.newPage();await op.goto(`/brokerage/${requestId}`);await expect(op.getByText('Tomorrow at 9 AM.',{exact:true})).toBeVisible();
  checked(await db.rpc('update_transport_service_request',{actor_user_id:admin.id,request_id:requestId,expected_version:saved.version+1,next_status:'CLOSED',note:'Internal-only call notes'}));
  await expect(dialog.getByText('Conversation closed',{exact:true})).toBeVisible();await expect(dialog.getByRole('textbox',{name:'Message',exact:true})).toHaveCount(0);await expect(op.getByText('Conversation closed',{exact:true})).toBeVisible();
  const projection=await (await page.request.get('/api/transport-requests/conversation')).text();expect(projection).not.toContain('Internal-only');expect(projection).not.toContain('credential_digest');
  await dialog.getByRole('button',{name:'Start a new chat',exact:true}).click();await expect(form).toBeVisible();
 }finally{
  for(const context of contexts)await context.close();for(const session of sessions)await session.auth.signOut({scope:'local'});
  if(requestId){for(const table of ['transport_chat_messages','transport_chat_access','transport_request_events'])checked(await db.from(table).delete().eq('request_id',requestId));checked(await db.from('audit_logs').delete().eq('entity_id',requestId));checked(await db.from('transport_service_requests').delete().eq('id',requestId));}
  for(const id of ids){await db.from('audit_logs').delete().eq('actor_user_id',id);await db.from('audit_logs').delete().eq('entity_id',id);checked(await db.auth.admin.deleteUser(id));}
 }
});


test('conversation reconnects without losing drafts and fits translated phone layouts',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(90000);const db=localAuditService(),requestId=randomUUID();
 try{
  const response=await page.request.post('/api/transport-requests',{data:{requestId,chatSecret:Buffer.from(randomBytes(32)).toString('hex'),name:'Reconnect test',phone:'+2519'+String(Math.floor(Math.random()*100000000)).padStart(8,'0'),origin:'Adama',destination:'Bishoftu'}});expect(response.status()).toBe(200);
  await page.goto('/about');await page.getByRole('button',{name:'Need help with transport?',exact:true}).click();const dialog=page.locator('.public-chat-dialog');await expect(dialog.getByRole('textbox',{name:'Message',exact:true})).toBeVisible();
  await dialog.getByRole('textbox',{name:'Message',exact:true}).fill('Keep this draft');
  await page.route('**/api/transport-requests/conversation?*',route=>route.fulfill({status:503,json:{error:'Unavailable'}}));
  await expect(dialog.getByText('Connection interrupted. Reconnecting…',{exact:true})).toBeVisible();await expect(dialog.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Keep this draft');
  await page.unroute('**/api/transport-requests/conversation?*');await expect(dialog.getByText('Connection interrupted. Reconnecting…',{exact:true})).toHaveCount(0);
  for(const locale of ['am','om','so','ti']){
   const messages=JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
   await dialog.locator('header button').first().click();await page.locator('.language-picker select:visible').selectOption(locale);await page.locator('.public-assistance-request').click();
   await expect(dialog.getByRole('textbox')).toHaveValue('Keep this draft');await expect(dialog.locator('.transport-chat-state')).toHaveText(messages['Waiting for our transport team']);
   const send=dialog.locator('.transport-chat-composer button');await expect(send).toHaveText(messages['Send message']);await send.scrollIntoViewIfNeeded();await send.click({trial:true});
   const bounds=await send.boundingBox(),container=await dialog.boundingBox();expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(container!.y+container!.height);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`conversation-${locale}.png`)});
  }
 }finally{await page.unrouteAll({behavior:'wait'});for(const table of ['transport_chat_messages','transport_chat_access','transport_request_events'])checked(await db.from(table).delete().eq('request_id',requestId));checked(await db.from('audit_logs').delete().eq('entity_id',requestId));checked(await db.from('transport_service_requests').delete().eq('id',requestId));}
});
