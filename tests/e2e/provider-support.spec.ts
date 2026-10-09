import {test,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:30000});
import type {Page,Browser} from 'playwright-core';
import {randomUUID} from 'node:crypto';
import {localAuditService,checked} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';

test('transport companies, owner-operators and company drivers retain dashboard conversations',async({page,browser}:{page:Page;browser:Browser},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(180000);const service=localAuditService(),id=checked(await service.auth.admin.createUser({email:`provider-support-${randomUUID()}@example.test`,email_confirm:true})).user.id;
 const admin=checked(await service.from('profiles').select('id').eq('role','ADMIN').eq('active',true).limit(1).single());
 const staff=await browser.newContext({baseURL:'http://127.0.0.1:3100',viewport:page.viewportSize()!}),staffPage=await staff.newPage();
 const signouts:(()=>Promise<unknown>)[]=[];let chat='',organization='';
 try{
  signouts.push(await localSupportLogin(staffPage,admin.id));
  organization=checked(await service.from('organizations').insert({name:'Support fixture fleet',handle:`support-${id}`,type:'TRANSPORT_COMPANY',public_visibility:'PRIVATE'}).select('id').single()).id;
  checked(await service.from('company_pages').insert({organization_id:organization,published:false}));
  for(const kind of ['SELF_MANAGED','COMPANY','TRANSPORTER']){
   const role=kind==='TRANSPORTER'?'TRANSPORTER':'DRIVER';
   checked(await service.from('organization_members').delete().eq('user_id',id));
   checked(await service.from('provider_profiles').delete().eq('user_id',id));
   if(kind==='SELF_MANAGED'){const provider=checked(await service.from('provider_profiles').insert({user_id:id,business_name:'Owner-driver support fixture',handle:`support-${id}`,public_visibility:'PRIVATE'}).select('id').single());checked(await service.from('company_pages').insert({provider_profile_id:provider.id,published:false}));}
   else checked(await service.from('organization_members').insert({user_id:id,organization_id:organization,membership_role:kind==='COMPANY'?'DRIVER':'OWNER'}));
   checked(await service.from('profiles').update({role,active:true,full_name:'Provider support review'}).eq('id',id));
   signouts.push(await localSupportLogin(page,id));await page.goto('/app/home');
   await page.getByRole('link',{name:'Support',exact:true}).filter({visible:true}).first().click();await expect(page).toHaveURL(/\/app\/support/);
   await page.goto('/app/more');await expect(page.getByRole('heading',{name:'Account',exact:true})).toBeVisible();await page.locator('.workspace-support-shortcut').click();
   await page.getByRole('link',{name:'New chat',exact:true}).click();
   await page.getByLabel('What do you need?').fill(`Help with ${role} capacity`);await page.getByRole('button',{name:'Send to support'}).click();
   await expect(page.getByText(`Help with ${role} capacity`,{exact:true})).toBeVisible();await expect(page.getByRole('combobox',{name:'Language'})).toBeEnabled();chat=new URL(page.url()).searchParams.get('conversation')!;expect(chat).toBeTruthy();
   await page.getByLabel('Message',{exact:true}).fill('My dashboard question');await expect(page.getByLabel('Message',{exact:true})).toHaveValue('My dashboard question');const sent=page.waitForResponse(r=>r.url().endsWith(`/api/support/conversations/${chat}/messages`)&&r.request().method()==='POST');await page.getByRole('button',{name:'Send',exact:true}).click();expect((await sent).status()).toBe(303);await expect(page.getByText('My dashboard question',{exact:true})).toBeVisible();
   await staffPage.goto(`/support/${chat}`);await staffPage.getByLabel('Message',{exact:true}).fill('We can help you update your capacity.');await staffPage.getByRole('button',{name:'Send',exact:true}).click();
   await expect(page.getByText('We can help you update your capacity.',{exact:true})).toBeVisible({timeout:20000});
   await page.screenshot({path:info.outputPath(`${kind.toLowerCase()}-support.png`),fullPage:true});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.getByRole('button',{name:'End chat',exact:true}).click();await expect(page.getByRole('link',{name:'New chat',exact:true})).toBeVisible();expect(checked(await service.from('support_conversations').select('status').eq('id',chat).single()).status).toBe('CLOSED');
  }
  for(const role of ['SHIPPER','RECEIVER']){
   checked(await service.from('profiles').update({role}).eq('id',id));signouts.push(await localSupportLogin(page,id));
   expect((await page.request.post('/api/support/conversations',{form:{category:'ACCOUNT',body:'Denied'}})).status()).toBe(403);
   expect((await page.request.post(`/api/support/conversations/${chat}/messages`,{form:{body:'Denied'}})).status()).toBe(403);
  }
 }finally{
  for(const signout of signouts)await signout();await staff.close();
  checked(await service.from('support_conversations').delete().eq('customer_user_id',id));
  checked(await service.from('audit_logs').delete().eq('actor_user_id',id));checked(await service.auth.admin.deleteUser(id));if(organization)checked(await service.from('organizations').delete().eq('id',organization));
 }
});
