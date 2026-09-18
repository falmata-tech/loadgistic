import {test,expect} from '@playwright/test';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {readFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {storePrivateUpload,removePrivateUpload} from '../../src/lib/private-storage.js';

function localService(){
  nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
  const endpoint=process.env.NEXT_PUBLIC_SUPABASE_URL||'';const url=new URL(endpoint);
  if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='55321')throw new Error('LOCAL_LOADGISTIC_REQUIRED');
  return createClient(endpoint,process.env.SUPABASE_SERVICE_ROLE_KEY||'',{auth:{persistSession:false,autoRefreshToken:false}});
}
async function login(page:any,email:string){
  await page.context().clearCookies();await page.goto('/login');
  await page.locator('details.auth-fixture-login>summary').click();const form=page.getByTestId('login-form');
  await form.getByLabel('Email',{exact:true}).fill(email);await form.getByLabel('Password').fill('Loadgistic123!');
  await form.getByRole('button',{name:'Log in',exact:true}).click();
  await expect(page).toHaveURL(email.startsWith('support@')?/\/support$/:email.startsWith('admin@')?/\/admin$/:/\/app\/home$/,{timeout:30000});
  await expect(page.locator('.app-main')).toBeVisible({timeout:30000});
}
async function capture(page:any,info:any,label:string){
  const dir=path.resolve('artifacts/support-history-2026-09-14');mkdirSync(dir,{recursive:true});
  // Streaming can leave matching message nodes hidden behind a route fallback.
  if(label!=='guest-history')await expect(page.locator('.support-thread')).toBeVisible({timeout:30000});
  await expect(page.getByRole('navigation',{name:'Message history'}).getByRole(label==='guest-history'?'button':'link',{name:'Latest messages',exact:true})).toBeVisible();
  await page.screenshot({path:path.join(dir,`${info.project.name}-${label}.png`),fullPage:true,scale:'css'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}
async function profiles(service:any){
  const {data,error}=await service.from('profiles').select('id,email').in('email',['driver@loadgistic.local','support@loadgistic.local']);
  expect(error).toBeNull();return {member:data.find((p:any)=>p.email.startsWith('driver@')).id,agent:data.find((p:any)=>p.email.startsWith('support@')).id};
}
const timestamp=(i:number)=>new Date(Date.UTC(2026,0,1,0,0,i)).toISOString();

test('failed history navigation preserves visible messages and draft until retry succeeds',async({page}:{page:any})=>{
  const cursor='00000000-0000-0000-0000-000000000051';let fail=true;
  await page.route('**/api/guest-support/current**',async(route:any)=>{
    const before=new URL(route.request().url()).searchParams.get('before');
    if(before&&fail){fail=false;return route.fulfill({status:503,json:{error:'Unavailable'}});}
    return route.fulfill({json:{presence:{available:true,availableTeamMembers:1},conversation:{id:'synthetic-history',status:'OPEN',
      history_before:before,has_older:!before,next_before:before?null:cursor,
      messages:[{id:before?'older':'latest',sender_kind:'GUEST',body:before?'Earlier message':'Current message',created_at:timestamp(1)}]}}});
  });
  await page.goto('/about');await page.getByRole('button',{name:'Ask Loadgistic',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Ask Loadgistic'});
  await dialog.getByLabel('Reply',{exact:true}).fill('Unsent reply');
  await dialog.getByRole('button',{name:'Older messages',exact:true}).click();
  await expect(dialog.getByRole('status')).toContainText('unavailable');
  await expect(dialog.getByText('Current message',{exact:true})).toBeVisible();
  await expect(dialog.getByLabel('Reply',{exact:true})).toHaveValue('Unsent reply');
  await dialog.getByRole('button',{name:'Older messages',exact:true}).click();
  await expect(dialog.getByText('Earlier message',{exact:true})).toBeVisible();
  await expect(dialog.getByLabel('Reply',{exact:true})).toHaveValue('Unsent reply');
  await dialog.getByRole('button',{name:'Latest messages',exact:true}).click();
  await expect(dialog.getByText('Current message',{exact:true})).toBeVisible();
});

test('member and assigned staff can page every retained message without shifting history',async({page}:{page:any},info:any)=>{
  test.setTimeout(120000);const service=localService();const {member,agent}=await profiles(service);const id=randomUUID();
  expect((await service.from('support_conversations').insert({id,customer_user_id:member,assigned_agent_user_id:agent,category:'ACCOUNT',status:'CLOSED'})).error).toBeNull();
  try{
    expect((await service.from('support_messages').insert(Array.from({length:121},(_,i)=>({id:randomUUID(),conversation_id:id,sender_user_id:member,body:`History message ${i+1}`,created_at:timestamp(i)})))).error).toBeNull();
    await login(page,'driver@loadgistic.local');await page.goto(`/app/support?conversation=${id}`);
    const messages=page.locator('.support-message');await expect(messages).toHaveCount(50);
    await expect(messages.first()).toContainText('History message 72');
    await page.getByRole('link',{name:'Older messages',exact:true}).click();
    await expect(messages.first()).toContainText('History message 22');await expect(messages).toHaveCount(50);
    const historyUrl=page.url();
    expect((await service.from('support_messages').insert({conversation_id:id,sender_user_id:member,body:'New historical import'})).error).toBeNull();
    await page.reload();await expect(messages.first()).toContainText('History message 22');await expect(page).toHaveURL(historyUrl);
    await capture(page,info,'member-history');
    await page.getByRole('link',{name:'Older messages',exact:true}).click();await expect(messages).toHaveCount(21);
    await expect(page.getByText('Beginning of conversation')).toBeVisible();await expect(messages.first()).toContainText('History message 1');
    await page.getByRole('link',{name:'Latest messages',exact:true}).click();await expect(messages.last()).toContainText('New historical import');
    await login(page,'support@loadgistic.local');await page.goto(`/support/${id}`);
    await page.getByRole('link',{name:'Older messages',exact:true}).click();await expect(messages).toHaveCount(50);
    await capture(page,info,'staff-history');
    const staffHistory=page.url();
    expect((await service.from('support_conversations').update({assigned_agent_user_id:null}).eq('id',id)).error).toBeNull();
    // The streaming shell may already have sent 200 before notFound resolves.
    await page.goto(staffHistory);await expect(page.getByRole('heading',{name:'404',exact:true})).toBeVisible();await expect(messages).toHaveCount(0);
    await login(page,'transporter@loadgistic.local');await page.goto(`/app/support?conversation=${id}`);
    await expect(page.getByRole('heading',{name:'404',exact:true})).toBeVisible();await expect(messages).toHaveCount(0);
  }finally{expect((await service.from('support_conversations').delete().eq('id',id)).error).toBeNull();}
});

test('guest launcher and full threads retain drafts, page history and protect old attachments',async({page,browser}:{page:any;browser:any},info:any)=>{
  test.setTimeout(180000);const service=localService();const {agent}=await profiles(service);
  const email=`history-${randomUUID()}@example.test`;let id:string|undefined;let stored:any;let staff:any;
  try{
    await page.goto('/');await page.getByRole('button',{name:'Ask Loadgistic',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Ask Loadgistic'});
    await dialog.getByLabel('Email',{exact:true}).fill(email);await dialog.getByLabel('Callback phone').fill('+251911000000');
    await dialog.getByLabel('What do you need?').fill('Synthetic history test opening');
    const started=page.waitForResponse((r:any)=>r.url().endsWith('/api/guest-support')&&r.request().method()==='POST');
    await dialog.getByRole('button',{name:'Start chat',exact:true}).click();const result=await (await started).json();expect(result.ok).toBe(true);id=result.conversationId;
    await expect(dialog.getByText('Synthetic history test opening')).toBeVisible();
    expect((await service.from('guest_support_messages').update({created_at:timestamp(0)}).eq('conversation_id',id)).error).toBeNull();
    const rows=Array.from({length:120},(_,i)=>({id:randomUUID(),conversation_id:id,sender_kind:'GUEST',body:`Guest history ${i+1}`,created_at:timestamp(i+1)}));
    expect((await service.from('guest_support_messages').insert(rows)).error).toBeNull();
    expect((await service.from('guest_support_conversations').update({assigned_agent_user_id:agent,status:'OPEN'}).eq('id',id)).error).toBeNull();
    const bytes=readFileSync(path.resolve('public/brand/loadgistic-icon.png'));
    stored=await storePrivateUpload(new File([bytes],'history.png',{type:'image/png'}),'guest-support');
    const attachmentId=randomUUID();
    expect((await service.from('guest_support_attachments').insert({id:attachmentId,conversation_id:id,message_id:rows[29].id,file_path:stored.path,original_name:'history.png',mime_type:'image/png',size_bytes:bytes.length})).error).toBeNull();
    await expect(dialog.getByRole('button',{name:'Older messages',exact:true})).toBeVisible({timeout:15000});
    await dialog.getByLabel('Reply',{exact:true}).fill('Keep my unsent draft');
    await dialog.locator('input[type=file]').setInputFiles({name:'draft.png',mimeType:'image/png',buffer:bytes});
    await dialog.getByRole('button',{name:'Older messages',exact:true}).click();
    await expect(dialog.getByText('Guest history 21',{exact:true})).toBeVisible();
    await expect(dialog.locator('.public-chat-messages article')).toHaveCount(50);
    await expect(dialog.getByLabel('Reply',{exact:true})).toHaveValue('Keep my unsent draft');
    await expect(dialog.getByText('draft.png',{exact:true})).toBeVisible();
    const attachmentUrl=await dialog.getByRole('link',{name:'history.png'}).getAttribute('href');
    const downloaded=await page.request.get(attachmentUrl);expect(downloaded.ok()).toBe(true);expect(Buffer.compare(await downloaded.body(),bytes)).toBe(0);
    await capture(page,info,'guest-history');
    // Prove no polling replaces history, and no historical read acknowledges a new reply.
    expect((await service.from('guest_support_conversations').update({guest_last_read_at:null}).eq('id',id)).error).toBeNull();
    expect((await service.from('guest_support_messages').insert({conversation_id:id,sender_kind:'TEAM',sender_user_id:agent,body:'A newer team reply'})).error).toBeNull();
    await page.waitForTimeout(2500);await expect(dialog.getByText('A newer team reply',{exact:true})).toHaveCount(0);
    expect((await service.from('guest_support_conversations').select('guest_last_read_at').eq('id',id).single()).data.guest_last_read_at).toBeNull();
    await dialog.getByRole('button',{name:'Older messages',exact:true}).click();await expect(dialog.getByText('Beginning of conversation')).toBeVisible();
    await dialog.getByRole('button',{name:'Latest messages',exact:true}).click();await expect(dialog.getByText('A newer team reply',{exact:true})).toBeVisible();
    await expect(dialog.getByLabel('Reply',{exact:true})).toHaveValue('Keep my unsent draft');
    const invalid=await page.request.get('/api/guest-support/current?before=invalid');expect(invalid.status()).toBe(400);
    await page.goto(`/help/${id}`);await page.getByRole('link',{name:'Older messages',exact:true}).click();await expect(page.locator('.support-message')).toHaveCount(50);
    await capture(page,info,'recovery-history');
    staff=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize(),extraHTTPHeaders:{'x-forwarded-for':'127.0.0.245'}});const staffPage=await staff.newPage();
    await login(staffPage,'support@loadgistic.local');await staffPage.goto(`/support/assisted/${id}`);
    await staffPage.getByRole('link',{name:'Older messages',exact:true}).click();await expect(staffPage.locator('.support-message')).toHaveCount(50);
    expect((await staffPage.request.get(attachmentUrl)).ok()).toBe(true);
    expect((await service.from('guest_support_conversations').update({assigned_agent_user_id:null,status:'WAITING'}).eq('id',id)).error).toBeNull();
    expect((await staffPage.request.get(attachmentUrl)).ok()).toBe(false);
    await staffPage.goto(`/support/assisted/${id}`);await expect(staffPage.getByRole('heading',{name:'404',exact:true})).toBeVisible();
    await expect(staffPage.locator('.support-message')).toHaveCount(0);
    await page.context().clearCookies();expect((await page.request.get(attachmentUrl)).ok()).toBe(false);
  }finally{
    if(staff)await staff.close();if(stored)await removePrivateUpload(stored.path);
    if(id){expect((await service.from('access_email_deliveries').delete().eq('entity_id',id)).error).toBeNull();expect((await service.from('guest_support_conversations').delete().eq('id',id)).error).toBeNull();}
  }
});
