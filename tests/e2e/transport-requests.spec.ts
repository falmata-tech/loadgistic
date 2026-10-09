import {test,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:30000});
import type {Page} from 'playwright-core';
import {createClient} from '@supabase/supabase-js';
import {createChunks} from '@supabase/ssr/dist/main/utils/chunker.js';
import {randomUUID} from 'node:crypto';
import {localAuditService,checked} from './audit-helpers';

// Keep the happy-path browser separate from other suites' intentional rate-limit probes.
test.use({extraHTTPHeaders:{'x-forwarded-for':'127.0.0.233'}});

test('transport request goes from the four-field public form to private admin follow-up without email',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(120000);page.setDefaultTimeout(15000);const service=localAuditService(),name=`Callback test ${randomUUID().slice(0,8)}`;let id='',session:ReturnType<typeof createClient>|undefined;
 const phone=`+2519${String(Math.floor(Math.random()*100000000)).padStart(8,'0')}`;
 const helpWrites:string[]=[];page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/guest-support')&&request.method()==='POST')helpWrites.push(request.url());});
 const emailCount=await service.from('access_email_deliveries').select('id',{count:'exact',head:true});expect(emailCount.error).toBeNull();
 try{
  await page.goto('/about');await page.getByRole('button',{name:'Need help with transport?',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Need help with transport?',exact:true}),form=dialog.getByRole('form',{name:'Arrange transport',exact:true});
  await expect(form).toBeVisible();await expect(form.locator('input')).toHaveCount(4);await expect(form.locator('input[type=email]')).toHaveCount(0);
  await expect(form.getByRole('heading')).toHaveCount(0);
  await expect(dialog.getByRole('heading',{name:'Need help with transport?',exact:true})).toHaveCount(1);
  await expect(form).toContainText('No account needed. We’ll agree the service and fee with you first.');
  await expect(form).toContainText('Tell us what you need to move and where.');
  await expect(dialog.getByRole('button',{name:'Close',exact:true})).toBeVisible();
  await form.getByLabel('From',{exact:true}).fill('Adama');await form.getByLabel('To',{exact:true}).fill('Dire Dawa');await form.getByLabel('Name',{exact:true}).fill(name);await form.getByLabel('Phone',{exact:true}).fill(phone);
  await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(page.getByRole('button',{name:'Ask for help',exact:true})).toHaveCount(0);
  await page.locator('.public-assistance-request').click();await expect(form.getByLabel('Name',{exact:true})).toHaveValue(name);
  await page.screenshot({path:info.outputPath('request-form.png'),fullPage:true});
  const submitted=page.waitForResponse(r=>r.url().endsWith('/api/transport-requests')&&r.request().method()==='POST');
  await form.getByRole('button',{name:'Start chat'}).click();const response=await submitted;expect(response.status()).toBe(200);
  await expect(dialog.getByText('Waiting for our transport team',{exact:true})).toBeVisible();await expect(dialog.getByRole('textbox',{name:'Message',exact:true})).toBeVisible();expect(helpWrites).toHaveLength(0);await expect(dialog.locator(':scope > header')).not.toContainText(/Team available|Leave a message/);await page.screenshot({path:info.outputPath('request-receipt.png'),fullPage:true});
  const row=checked(await service.from('transport_service_requests').select('*').eq('requester_name',name).single());id=row.id;expect(row).toMatchObject({phone,origin:'Adama',destination:'Dire Dawa',status:'NEW'});
  const repeat=await page.request.post('/api/transport-requests',{data:JSON.parse(response.request().postData()!)});expect(repeat.status()).toBe(200);
  expect((await service.from('transport_service_requests').select('id',{count:'exact',head:true}).eq('requester_name',name)).count).toBe(1);
  expect((await service.from('access_email_deliveries').select('id',{count:'exact',head:true})).count).toBe(emailCount.count);
  expect((await page.request.post(`/api/admin/transport-requests/${id}`,{form:{version:'1',status:'CLOSED',note:''}})).status()).toBe(403);
  await page.goto('/admin/support/transport-requests');await expect(page).toHaveURL(/\/login/);
  const admin=checked(await service.from('profiles').select('id').eq('role','ADMIN').eq('active',true).limit(1).single());
  const identity=checked(await service.auth.admin.getUserById(admin.id)).user;
  const link=checked(await service.auth.admin.generateLink({type:'magiclink',email:identity.email!}));
  const apiUrl=process.env.NEXT_PUBLIC_SUPABASE_URL!;
  session=createClient(apiUrl,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  const login=await session.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'magiclink'});expect(login.error).toBeNull();expect(login.data.user?.id).toBe(admin.id);
  // Use the installed SSR cookie chunker with an ordinary locally verified
  // session. This avoids Playwright's CJS/ESM SSR-client import collision.
  const cookieName=`sb-${new URL(apiUrl).hostname.split('.')[0]}-auth-token`;
  const cookies=createChunks(cookieName,'base64-'+Buffer.from(JSON.stringify(login.data.session)).toString('base64url'));
  await page.context().addCookies(cookies.map(c=>({name:c.name,value:c.value,url:new URL(page.url()).origin,sameSite:'Lax' as const})));
  await test.step('Open the private inbox from Support',async()=>{await page.goto('/admin/support');const waiting=await service.from('transport_service_requests').select('id',{count:'exact',head:true}).eq('status','NEW');expect(waiting.error).toBeNull();await expect(page.locator('.callback-queue-summary strong')).toHaveText(`New requests: ${waiting.count}`);await expect(page.locator('.callback-queue-summary')).toContainText('Oldest request:');await page.screenshot({path:info.outputPath('admin-queue-summary.png'),fullPage:true});await page.getByRole('link',{name:'Transport requests',exact:true}).click();});
  await page.getByRole('link',{name:/^Active chats/}).click();
  const card=page.locator('.transport-request-card').filter({has:page.getByText(name,{exact:true})});await expect(card).toBeVisible();
  await expect(card.getByRole('link',{name:phone,exact:true})).toHaveAttribute('href',`tel:${phone}`);
  await test.step('Enter the offline follow-up',async()=>{await card.getByRole('combobox',{name:'Status',exact:true}).selectOption('CONTACTED');await card.getByLabel('Follow-up note').fill('Called requester; referred offline to demo fleet.');});
  const saved=page.waitForResponse(r=>r.url().endsWith(`/api/admin/transport-requests/${id}`)&&r.request().method()==='POST');await card.getByRole('button',{name:'Save follow-up'}).click();expect((await saved).status()).toBe(200);await expect(card).toBeVisible();await expect(card.getByRole('combobox',{name:'Status',exact:true})).toHaveValue('CONTACTED');
  await page.getByRole('link',{name:/^Active chats/}).click();await expect(page).toHaveURL(/view=ACTIVE/,{timeout:15000});await expect(page.getByRole('link',{name:/^Active chats/})).toHaveAttribute('aria-current','page',{timeout:15000});await expect(card).toBeVisible();await expect(card.getByLabel('Follow-up note')).toHaveValue('Called requester; referred offline to demo fleet.');
  await page.screenshot({path:info.outputPath('admin-follow-up.png'),fullPage:true});
  // A concurrent saved edit must not silently replace the administrator's draft.
  checked(await service.rpc('update_transport_service_request',{actor_user_id:admin.id,request_id:id,expected_version:2,next_status:'CONTACTED',note:'Concurrent team update'}));
  await card.getByLabel('Follow-up note').fill('Keep this draft');await card.getByRole('button',{name:'Save follow-up'}).click();await expect(card.getByRole('alert')).toContainText('Another team member');await expect(card.getByLabel('Follow-up note')).toHaveValue('Keep this draft');
  await page.reload();await expect(card.getByLabel('Follow-up note')).toHaveValue('Concurrent team update');await card.getByRole('combobox',{name:'Status',exact:true}).selectOption('CLOSED');const closed=page.waitForResponse(r=>r.url().endsWith(`/api/admin/transport-requests/${id}`)&&r.request().method()==='POST');await card.getByRole('button',{name:'Save follow-up'}).click();expect((await closed).status()).toBe(200);await expect(card).toHaveCount(0,{timeout:15000});
  await page.getByRole('link',{name:/^Resolved/}).click();await expect(page).toHaveURL(/view=CLOSED/,{timeout:15000});await expect(page.getByRole('link',{name:/^Resolved/})).toHaveAttribute('aria-current','page',{timeout:15000});await expect(card).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{
  if(session)await session.auth.signOut({scope:'local'});
  const rows=checked(await service.from('transport_service_requests').select('id').eq('requester_name',name));
  for(const row of rows){checked(await service.from('transport_chat_messages').delete().eq('request_id',row.id));checked(await service.from('transport_chat_access').delete().eq('request_id',row.id));checked(await service.from('audit_logs').delete().eq('entity_type','transport_service_request').eq('entity_id',row.id));checked(await service.from('transport_request_events').delete().eq('request_id',row.id));checked(await service.from('transport_service_requests').delete().eq('id',row.id));}
 }
});

test('request errors preserve input and duplicate clicks cannot create duplicate submissions',async({page}:{page:Page})=>{
 let count=0;let release=()=>{};const pending=new Promise<void>(r=>{release=r;});
 await page.route('**/api/transport-requests',async route=>{count++;await pending;await route.fulfill({status:503,json:{ok:false,error:'We could not confirm your request. Please try again.'}});});
 try{
  await page.goto('/about');await page.getByRole('button',{name:'Need help with transport?',exact:true}).click();const form=page.getByRole('form',{name:'Arrange transport',exact:true});
  await form.getByLabel('From',{exact:true}).fill('Adama');await form.getByLabel('To',{exact:true}).fill('Bishoftu');await form.getByLabel('Name',{exact:true}).fill('Test request');await form.getByLabel('Phone',{exact:true}).fill('+251900000001');
  await form.getByRole('button',{name:'Start chat'}).click();await expect(form.getByRole('button',{name:'Opening chat…'})).toBeDisabled();
  await form.evaluate(f=>f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));release();
  await expect(form.getByRole('alert')).toContainText('Please try again');await expect(form.getByLabel('From',{exact:true})).toHaveValue('Adama');await expect(form.getByRole('button',{name:'Start chat'})).toBeEnabled();expect(count).toBe(1);
 }finally{release();await page.unrouteAll({behavior:'wait'});}
});
