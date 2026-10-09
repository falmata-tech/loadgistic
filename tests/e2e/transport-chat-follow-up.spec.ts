import {test,expect as baseExpect} from '@playwright/test';
import type {Page,Browser,BrowserContext} from 'playwright-core';
import {createClient} from '@supabase/supabase-js';
import {createChunks} from '@supabase/ssr/dist/main/utils/chunker.js';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {localAuditService,checked} from './audit-helpers';
const expect=baseExpect.configure({timeout:20000});

for(const assigned of [false,true])test(`visitor ends ${assigned?'assigned':'waiting'} chat and staff retain history, call and resolve`,async({page,browser}:{page:Page;browser:Browser},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(180000);page.setDefaultTimeout(15000);const db=localAuditService(),suffix=randomUUID().slice(0,8),requests:string[]=[],contexts:BrowserContext[]=[];let staffId='';
 const name=`Follow-up ${suffix}`,phone='+2519'+String(Math.floor(Math.random()*100000000)).padStart(8,'0');
 const admin=checked(await db.from('profiles').select('id').eq('role','ADMIN').eq('active',true).limit(1).single());
 let session:ReturnType<typeof createClient>|undefined;
 try{
  const email=`follow-up-${suffix}@example.test`,identity=checked(await db.auth.admin.createUser({email,email_confirm:true})).user;staffId=identity.id;
  checked(await db.rpc('create_managed_support_agent',{actor_user_id:admin.id,agent_auth_user_id:staffId,command:{name:`Broker ${suffix}`,email,can_manage_support:false,can_manage_brokerage:true,max_open_conversations:20}}));
  const bc=await browser.newContext({baseURL:'http://127.0.0.1:3100',viewport:page.viewportSize()!,extraHTTPHeaders:{'x-forwarded-for':'127.0.0.246'}});contexts.push(bc);
  const link=checked(await db.auth.admin.generateLink({type:'magiclink',email})),url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
  session=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  const login=await session.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'magiclink'});expect(login.error).toBeNull();
  await bc.addCookies(createChunks(`sb-${new URL(url).hostname.split('.')[0]}-auth-token`,'base64-'+Buffer.from(JSON.stringify(login.data.session)).toString('base64url')).map(cookie=>({...cookie,url:'http://127.0.0.1:3100',sameSite:'Lax' as const})));
  const bp=await bc.newPage();bp.setDefaultTimeout(15000);
  await page.goto('/about');await page.getByRole('button',{name:'Need help with transport?',exact:true}).click();
  const dialog=page.locator('.public-chat-dialog'),form=dialog.getByRole('form',{name:'Arrange transport',exact:true});
  async function start(){await form.getByLabel('From',{exact:true}).fill('Adama');await form.getByLabel('To',{exact:true}).fill('Dire Dawa');await form.getByLabel('Name',{exact:true}).fill(name);await form.getByLabel('Phone',{exact:true}).fill(phone);
   const response=page.waitForResponse(r=>r.url().endsWith('/api/transport-requests')&&r.request().method()==='POST');await form.getByRole('button',{name:'Start chat',exact:true}).click();const result=await response;expect(result.status()).toBe(200);const id=JSON.parse(result.request().postData()!).requestId;requests.push(id);await expect(dialog.getByRole('textbox',{name:'Message',exact:true})).toBeVisible();return id;}
  const id=await start(),message=`Pickup details ${suffix}`;
  await dialog.getByRole('textbox',{name:'Message',exact:true}).fill(message);await dialog.getByRole('button',{name:'Send message',exact:true}).click();await expect(dialog.getByText(message,{exact:true})).toBeVisible();
  async function claim(view:string){await bp.goto(`/brokerage?queue=UNASSIGNED&view=${view}`);const card=bp.locator(`[data-request-id="${id}"]`);await expect(card).toContainText('Adama');await expect(card).toContainText('Dire Dawa');await expect(card.getByRole('link',{name:phone,exact:true})).toHaveCount(0);await card.getByRole('button',{name:'Claim request',exact:true}).click();await bp.getByRole('navigation',{name:'Brokerage queues'}).getByRole('link',{name:/^Mine/}).click();return bp.locator(`[data-request-id="${id}"]`);}
  if(assigned){const card=await claim('ACTIVE');await card.getByRole('link',{name:'Open conversation',exact:true}).click();await expect(bp.getByRole('link',{name:phone,exact:true})).toHaveAttribute('href',`tel:${phone}`);await expect(bp.getByText(message,{exact:true})).toBeVisible();}
  await dialog.getByRole('textbox',{name:'Message',exact:true}).fill('Unsent draft');await dialog.getByRole('button',{name:'End chat',exact:true}).click();
  const confirmation=dialog.getByRole('region',{name:'End this chat?',exact:true});await expect(confirmation).toContainText('our team can still call you');await confirmation.getByRole('button',{name:'Keep chatting',exact:true}).click();await expect(dialog.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Unsent draft');
  await dialog.getByRole('button',{name:'End chat',exact:true}).click();
  if(!assigned){
   // Verify the real confirmation controls in all locales, without sending requests.
   for(const locale of ['am','om','so','ti']){
    const words=JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
    await dialog.locator(':scope > header button').click();await page.locator('.language-picker select:visible').selectOption(locale);await page.locator('.public-assistance-request').click();
    const end=dialog.getByRole('button',{name:words['End chat'],exact:true});await end.scrollIntoViewIfNeeded();await end.click({trial:true});
    const b=await end.boundingBox(),d=await dialog.boundingBox();expect(b!.x+b!.width).toBeLessThanOrEqual(d!.x+d!.width);expect(b!.y+b!.height).toBeLessThanOrEqual(d!.y+d!.height);expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`end-confirmation-${locale}.png`)});
   }
   await dialog.locator(':scope > header button').click();await page.locator('.language-picker select:visible').selectOption('en');await page.locator('.public-assistance-request').click();
  }
  await page.route('**/api/transport-requests/conversation',async route=>{if(route.request().method()==='PATCH')await route.fulfill({status:503,json:{error:'Unavailable'}});else await route.continue();},{times:1});
  await confirmation.getByRole('button',{name:'End chat',exact:true}).click();await expect(confirmation.getByRole('alert')).toContainText('Please try again');await expect(dialog.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Unsent draft');
  await confirmation.getByRole('button',{name:'End chat',exact:true}).click();await expect(dialog.locator('.transport-chat-state')).toHaveText('Chat ended');await expect(dialog.getByRole('textbox',{name:'Message',exact:true})).toHaveCount(0);await expect(dialog.getByText(message,{exact:true})).toBeVisible();
  const saved=checked(await db.from('transport_service_requests').select('status,version,assigned_agent_user_id').eq('id',id).single());expect(saved.status).toBe('NEW');
  expect((await page.request.patch('/api/transport-requests/conversation')).status()).toBe(200);expect(checked(await db.from('transport_service_requests').select('version').eq('id',id).single()).version).toBe(saved.version);
  expect((await page.request.post('/api/transport-requests/conversation',{data:{messageId:randomUUID(),body:'After ending'}})).status()).toBe(409);
  expect((await page.request.patch('/api/transport-requests/conversation',{headers:{origin:'https://unrelated.example'}})).status()).toBe(403);
  const outsider=await browser.newContext({baseURL:'http://127.0.0.1:3100'});contexts.push(outsider);expect((await outsider.request.patch('/api/transport-requests/conversation')).status()).toBe(403);
  if(!assigned){const card=await claim('FOLLOW_UP');await expect(card).toContainText('Chat ended · call to follow up');await card.getByRole('link',{name:'View chat history',exact:true}).click();}
  await expect(bp.getByRole('textbox',{name:'Message',exact:true})).toHaveCount(0);await expect(bp.getByText(message,{exact:true})).toBeVisible();await expect(bp.getByRole('link',{name:phone,exact:true})).toHaveAttribute('href',`tel:${phone}`);
  await page.reload();await expect(dialog.locator('.transport-chat-state')).toHaveText('Chat ended');await expect(dialog.getByText(message,{exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('ended-chat.png')});await bp.screenshot({path:info.outputPath('staff-follow-up.png')});
  if(!assigned){await dialog.getByRole('button',{name:'Start a new chat',exact:true}).click();expect(await start()).not.toBe(id);await expect(dialog.getByText(message,{exact:true})).toHaveCount(0);expect(checked(await db.from('transport_service_requests').select('status').eq('id',id).single()).status).toBe('NEW');}
  const follow=bp.getByRole('form',{name:'Request follow-up',exact:true});await follow.getByRole('combobox',{name:'Status',exact:true}).selectOption('CLOSED');await follow.getByLabel('Follow-up note',{exact:true}).fill('Called; no longer interested.');await follow.getByRole('button',{name:'Save follow-up',exact:true}).click();await expect(follow.getByText('Follow-up saved.',{exact:true})).toBeVisible();await expect(bp.locator('.transport-chat-state')).toHaveText('Conversation closed');if(assigned)await expect(dialog.locator('.transport-chat-state')).toHaveText('Conversation closed');
  await bp.getByRole('link',{name:'Back to requests',exact:true}).click();await bp.getByRole('navigation',{name:'Transport request status'}).getByRole('link',{name:/^Resolved/}).click();await expect(bp.locator(`[data-request-id="${id}"]`)).toContainText('Called; no longer interested.');
  const projection=await (await page.request.get('/api/transport-requests/conversation')).text();expect(projection).not.toContain('staffDetails');expect(projection).not.toContain(phone);expect(projection).not.toContain('Called; no longer interested.');
  if(assigned){await dialog.getByRole('button',{name:'Start a new chat',exact:true}).click();const next=await start();expect(next).not.toBe(id);await expect(dialog.getByText(message,{exact:true})).toHaveCount(0);}expect(checked(await db.from('transport_chat_messages').select('id').eq('request_id',id))).toHaveLength(1);
 }finally{
  await page.unrouteAll({behavior:'ignoreErrors'}).catch(()=>{});for(const c of contexts)await c.close().catch(()=>{});await session?.auth.signOut({scope:'local'});
  for(const id of requests){for(const table of ['transport_chat_messages','transport_chat_access','transport_request_events'])checked(await db.from(table).delete().eq('request_id',id));checked(await db.from('audit_logs').delete().eq('entity_id',id));checked(await db.from('transport_service_requests').delete().eq('id',id));}
  if(staffId){await db.from('audit_logs').delete().eq('actor_user_id',staffId);await db.from('audit_logs').delete().eq('entity_id',staffId);checked(await db.auth.admin.deleteUser(staffId));}
 }
});
