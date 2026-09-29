import {test,expect} from '@playwright/test';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {readFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {removePrivateUpload} from '../../src/lib/private-storage.js';
import {cleanupSupportAttachments} from '../../src/lib/support-attachments.js';

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
  await expect(page).toHaveURL(email.startsWith('support@')?/\/support$/:/\/app\/home(?:\?.*)?$/,{timeout:30000});
  await expect(page.locator('.app-main')).toBeVisible({timeout:30000});
}
async function attach(page:any,name:string,mimeType:string,buffer:Buffer,body:string){
  const form=page.locator('.support-composer');await expect(form).toBeVisible();
  await form.getByLabel('Message',{exact:true}).fill(body);
  await form.locator('input[type=file]').setInputFiles({name,mimeType,buffer});
  await form.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.getByText(body,{exact:true})).toBeVisible({timeout:30000});
  await expect(page.getByRole('link',{name,exact:true})).toBeVisible();
}
async function download(page:any,name:string,bytes:Buffer){
  const link=page.getByRole('link',{name,exact:true});const url=await link.getAttribute('href');
  const completed=page.waitForEvent('download');await link.click();const file=await completed;
  expect(file.suggestedFilename()).toBe(name);expect(Buffer.compare(readFileSync((await file.path())!),bytes)).toBe(0);
  const response=await page.request.get(url);expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(Buffer.compare(await response.body(),bytes)).toBe(0);return url;
}

test('member and staff attach private files, retain old downloads and lose access on reassignment',async({page}:{page:any},info:any)=>{
  test.setTimeout(180000);const service=localService();const suffix=randomUUID().slice(0,8);const chat=randomUUID();let member='';
  const email=`support-attachment-${suffix}@loadgistic.local`;
  const bytes=readFileSync(path.resolve('public/brand/loadgistic-icon.png'));
  const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
  const directory=path.resolve('artifacts/support-attachments-2026-09-14');mkdirSync(directory,{recursive:true});
  try{
    const created=await service.auth.admin.createUser({email,password:'Loadgistic123!',email_confirm:true});expect(created.error).toBeNull();member=created.data.user!.id;
    expect((await service.from('profiles').update({role:'DRIVER',active:true,full_name:'Attachment Test Driver'}).eq('id',member)).error).toBeNull();
    expect((await service.from('provider_profiles').insert({user_id:member,business_name:'Attachment Test Provider',handle:`attachment-${suffix}`})).error).toBeNull();
    const agent=await service.from('profiles').select('id').eq('email','support@loadgistic.local').single();expect(agent.error).toBeNull();
    expect((await service.from('support_conversations').insert({id:chat,customer_user_id:member,assigned_agent_user_id:agent.data!.id,category:'ACCOUNT',status:'OPEN'})).error).toBeNull();
    await login(page,email);await page.goto(`/app/support?conversation=${chat}`);
    await attach(page,'member-proof.png','image/png',bytes,'Member attachment submitted');
    const attachmentUrl=await download(page,'member-proof.png',bytes);
    await page.screenshot({path:path.join(directory,`${info.project.name}-member.png`),fullPage:true,scale:'css'});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    // A misleading extension/MIME fails inspection without creating a text-only reply or released file.
    const form=page.locator('.support-composer');await form.getByLabel('Message',{exact:true}).fill('Invalid image must not send');
    await form.locator('input[type=file]').setInputFiles({name:'invalid.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
    const invalid=page.waitForResponse((r:any)=>r.url().includes(`/api/support/conversations/${chat}/messages`)&&r.request().method()==='POST');
    await form.getByRole('button',{name:'Send',exact:true}).click();expect((await invalid).status()).toBe(303);
    await expect(page).toHaveURL(/error=/);await expect(page.getByText('Invalid image must not send',{exact:true})).toHaveCount(0);
    const reservations=await service.from('support_attachments').select('state').eq('conversation_id',chat);expect(reservations.error).toBeNull();expect(reservations.data!.map((row:{state:string})=>row.state).sort()).toEqual(['ATTACHED','RETIRED']);
    // A failed/unacknowledged upload keeps a grace-period record so a late Storage response cannot orphan bytes.
    expect((await cleanupSupportAttachments(20)).attempted).toBe(0);
    expect((await service.from('support_attachments').update({updated_at:new Date(Date.now()-7200000).toISOString()}).eq('conversation_id',chat).eq('state','RETIRED')).error).toBeNull();
    expect(await cleanupSupportAttachments(20)).toEqual({attempted:1,deleted:1,failed:0});
    expect((await service.from('support_attachments').select('state').eq('conversation_id',chat)).data).toEqual([{state:'ATTACHED'}]);
    await login(page,'support@loadgistic.local');await page.goto(`/support/${chat}`);
    expect((await page.request.get(attachmentUrl)).status()).toBe(200);
    await attach(page,'staff-guide.pdf','application/pdf',pdf,'Staff attachment submitted');await download(page,'staff-guide.pdf',pdf);
    await page.screenshot({path:path.join(directory,`${info.project.name}-staff.png`),fullPage:true,scale:'css'});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect((await service.from('support_conversations').update({assigned_agent_user_id:null,status:'WAITING'}).eq('id',chat)).error).toBeNull();
    expect((await page.request.get(attachmentUrl)).status()).toBe(404);
    await login(page,email);await page.goto(`/app/support?conversation=${chat}`);await download(page,'staff-guide.pdf',pdf);
    expect((await page.request.get(attachmentUrl.replace(chat,randomUUID()))).status()).toBe(404);
    // Both attachments move out of the latest window, then remain downloadable after closing.
    expect((await service.from('support_messages').insert(Array.from({length:55},(_,i)=>({conversation_id:chat,sender_user_id:member,body:`Later attachment history ${i}`,created_at:new Date(Date.now()+1000+i*1000).toISOString()})))).error).toBeNull();
    expect((await service.from('support_conversations').update({status:'CLOSED'}).eq('id',chat)).error).toBeNull();
    await page.reload();await expect(page.getByText('Conversation closed',{exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:'member-proof.png',exact:true})).toHaveCount(0);
    await page.getByRole('link',{name:'Older messages',exact:true}).click();await download(page,'member-proof.png',bytes);await download(page,'staff-guide.pdf',pdf);
    await expect(page.locator('.support-composer')).toHaveCount(0);
    await page.screenshot({path:path.join(directory,`${info.project.name}-closed-history.png`),fullPage:true,scale:'css'});
    await login(page,'transporter@loadgistic.local');expect((await page.request.get(attachmentUrl)).status()).toBe(404);
    await page.context().clearCookies();expect((await page.request.get(attachmentUrl)).status()).toBe(404);
  }finally{
    const files=await service.from('support_attachments').select('file_path').eq('conversation_id',chat);expect(files.error).toBeNull();
    for(const file of files.data||[])await removePrivateUpload(file.file_path);
    expect((await service.from('support_attachments').delete().eq('conversation_id',chat)).error).toBeNull();
    expect((await service.from('audit_logs').delete().eq('entity_id',chat)).error).toBeNull();
    expect((await service.from('support_conversations').delete().eq('id',chat)).error).toBeNull();
    if(member){expect((await service.from('audit_logs').delete().eq('actor_user_id',member)).error).toBeNull();expect((await service.auth.admin.deleteUser(member)).error).toBeNull();}
  }
});
