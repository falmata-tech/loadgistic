import type {Page,Request} from 'playwright-core';
import {test,expect} from '@playwright/test';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {readFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {localSupportLogin} from './provider-support-helper';
import {privateContactDigest,guestSupportAccessCode} from '../../src/lib/security.js';
import {storePrivateUpload,removePrivateUpload} from '../../src/lib/private-storage.js';

function localService(){
  nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
  const endpoint=process.env.NEXT_PUBLIC_SUPABASE_URL||'';const url=new URL(endpoint);
  if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='55321')throw new Error('LOCAL_LOADGISTIC_REQUIRED');
  return createClient(endpoint,process.env.SUPABASE_SERVICE_ROLE_KEY||'',{auth:{persistSession:false,autoRefreshToken:false}});
}
const sessions:(()=>Promise<unknown>)[]=[];
test.afterEach(async()=>{for(const close of sessions.splice(0))await close();});
async function login(page:any,email:string){
 const role=email.startsWith('support@')?'SUPPORT':email.startsWith('driver@')?'DRIVER':email.startsWith('admin@')?'ADMIN':'TRANSPORTER';
 const {data,error}=await localService().from('profiles').select('id').eq('role',role).eq('active',true).limit(1).single();expect(error).toBeNull();
 sessions.push(await localSupportLogin(page,data.id));
}
async function capture(page:any,info:any,label:string){
  const dir=path.resolve('artifacts/support-history-2026-09-14');mkdirSync(dir,{recursive:true});
  // Streaming can leave matching message nodes hidden behind a route fallback.
  await expect(page.locator('.support-thread')).toBeVisible({timeout:30000});
  await expect(page.getByRole('navigation',{name:'Message history'}).getByRole('link',{name:'Latest messages',exact:true})).toBeVisible();
  await page.screenshot({path:path.join(dir,`${info.project.name}-${label}.png`),fullPage:true,scale:'css'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}
async function profiles(service:any){
 const member=await service.from('profiles').select('id').eq('role','DRIVER').eq('active',true).limit(1).single();
 const agent=await service.from('profiles').select('id').eq('role','SUPPORT').eq('active',true).limit(1).single();
 expect(member.error).toBeNull();expect(agent.error).toBeNull();return {member:member.data.id,agent:agent.data.id};
}
const timestamp=(i:number)=>new Date(Date.UTC(2026,0,1,0,0,i)).toISOString();

test('invalid archive recovery does not expose a conversation or offer public chat',async({page}:{page:Page})=>{
 await page.goto('/help');await page.getByText('View a previous conversation',{exact:true}).click();
 await page.getByLabel('Email',{exact:true}).fill('unknown@example.test');await page.getByLabel('Recovery code').fill('LG-HELP-0000-0000');
 await page.getByRole('button',{name:'View conversation',exact:true}).click();
 await expect(page.getByText('That email and recovery code could not be verified.')).toBeVisible();
 await expect(page.locator('.support-thread,.public-chat-start')).toHaveCount(0);
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

test('guest archive is read-only, pages retained history and protects old attachments',async({page,browser}:{page:any;browser:any},info:any)=>{
  test.setTimeout(180000);const service=localService();const {agent}=await profiles(service);
  const email=`history-${randomUUID()}@example.test`;let id:string|undefined;let stored:any;let staff:any;
  try{
    id=randomUUID();
    expect((await service.from('guest_support_conversations').insert({id,email,email_digest:privateContactDigest(email),phone:'+251911000000',status:'OPEN',assigned_agent_user_id:agent})).error).toBeNull();
    expect((await service.from('guest_support_messages').insert({conversation_id:id,sender_kind:'GUEST',body:'Synthetic history test opening',created_at:timestamp(0)})).error).toBeNull();
    const rows=Array.from({length:120},(_,i)=>({id:randomUUID(),conversation_id:id,sender_kind:'GUEST',body:`Guest history ${i+1}`,created_at:timestamp(i+1)}));
    expect((await service.from('guest_support_messages').insert(rows)).error).toBeNull();
    expect((await service.from('guest_support_conversations').update({assigned_agent_user_id:agent,status:'OPEN'}).eq('id',id)).error).toBeNull();
    const bytes=readFileSync(path.resolve('public/brand/loadgistic-icon.png'));
    stored=await storePrivateUpload(new File([bytes],'history.png',{type:'image/png'}),'guest-support');
    const attachmentId=randomUUID();
    expect((await service.from('guest_support_attachments').insert({id:attachmentId,conversation_id:id,message_id:rows[29].id,file_path:stored.path,original_name:'history.png',mime_type:'image/png',size_bytes:bytes.length})).error).toBeNull();
    await page.goto('/help');await page.getByText('View a previous conversation',{exact:true}).click();
    await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Recovery code').fill(guestSupportAccessCode(id));
    await page.getByRole('button',{name:'View conversation',exact:true}).click();await expect(page).toHaveURL(new RegExp(`/help/${id}`));
    await expect(page.locator('.support-composer,.public-chat-composer')).toHaveCount(0);await expect(page.getByText('This conversation is read-only.').first()).toBeVisible();
    const requests:string[]=[];page.on('request',(r:Request)=>{if(r.url().includes('/api/support/updates')||r.url().includes('/api/guest-support/current'))requests.push(r.url());});
    await page.getByRole('link',{name:'Older messages',exact:true}).click();await expect(page.locator('.support-message')).toHaveCount(50);
    await expect(page.getByText('Guest history 21',{exact:true})).toBeVisible();
    const attachmentUrl=await page.getByRole('link',{name:'history.png'}).getAttribute('href');
    const downloaded=await page.request.get(attachmentUrl!);expect(downloaded.ok()).toBe(true);expect(Buffer.compare(await downloaded.body(),bytes)).toBe(0);
    await capture(page,info,'guest-history');
    expect((await page.request.post(`/api/guest-support/${id}/messages`,{form:{body:'Cannot reply'}})).status()).toBe(410);
    expect((await service.from('guest_support_messages').insert({conversation_id:id,sender_kind:'TEAM',sender_user_id:agent,body:'A newer team reply'})).error).toBeNull();
    await page.waitForTimeout(2500);await expect(page.getByText('A newer team reply',{exact:true})).toHaveCount(0);expect(requests).toEqual([]);
    await page.getByRole('link',{name:'Older messages',exact:true}).click();await expect(page.getByText('Beginning of conversation')).toBeVisible();
    await page.getByRole('link',{name:'Latest messages',exact:true}).click();await expect(page.getByText('A newer team reply',{exact:true})).toBeVisible();
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
