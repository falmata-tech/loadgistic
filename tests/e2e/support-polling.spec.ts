import {test,expect} from '@playwright/test';
import {localAuditService,checked,auditLogin,auditProvider} from './audit-helpers';

test('Support skips unchanged transcripts, preserves drafts and rechecks access before 304',async({page,browser}:{page:any;browser:any},info:any)=>{
 test.setTimeout(180000);const service=localAuditService();let actor:any;let chat='';let staff:any;
 try{
  actor=await auditProvider(service,'polling');const agent=checked(await service.from('profiles').select('id').eq('email','support@loadgistic.local').single());
  chat=checked(await service.from('support_conversations').insert({customer_user_id:actor.id,assigned_agent_user_id:agent.id,category:'ACCOUNT',status:'OPEN'}).select('id').single()).id;
  checked(await service.from('support_messages').insert({conversation_id:chat,sender_user_id:actor.id,body:'Polling audit conversation'}));
  await auditLogin(page,actor.email);await page.goto(`/app/support?conversation=${chat}`);
  const endpoint=`/api/support/updates?conversation=${chat}`;
  const initial=await page.request.get(endpoint);expect(initial.status()).toBe(200);const tag=initial.headers().etag;expect(tag).toBeTruthy();
  const unchanged=await page.request.get(endpoint,{headers:{'If-None-Match':tag}});expect(unchanged.status()).toBe(304);expect((await unchanged.body()).length).toBe(0);
  const draft=page.locator('.support-composer textarea');await draft.fill('Keep this unsent draft');
  checked(await service.rpc('send_managed_support_message',{actor_user_id:agent.id,conversation_id:chat,message_body:'A new staff reply'}));
  await expect(page.getByText('A new staff reply',{exact:true})).toBeVisible({timeout:20000});await expect(draft).toHaveValue('Keep this unsent draft');
  const changed=await page.request.get(endpoint,{headers:{'If-None-Match':tag}});expect(changed.status()).toBe(200);expect(changed.headers().etag).not.toBe(tag);
  staff=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize()});const staffPage=await staff.newPage();await auditLogin(staffPage,'support@loadgistic.local');
  const authorized=await staffPage.request.get(endpoint);expect(authorized.status()).toBe(200);
  checked(await service.from('support_conversations').update({assigned_agent_user_id:null,status:'WAITING'}).eq('id',chat));
  const denied=await staffPage.request.get(endpoint,{headers:{'If-None-Match':authorized.headers().etag}});expect(denied.status()).toBe(403);
 }finally{
  if(staff)await staff.close();
  if(chat){checked(await service.from('audit_logs').delete().eq('entity_id',chat));checked(await service.from('support_conversations').delete().eq('id',chat));}
  if(actor){checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));}
 }
});
