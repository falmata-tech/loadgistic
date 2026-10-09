import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {localAuditService,checked} from './audit-helpers';
import {localMailpitNumericCode} from './mailpit-helper';
import type {Page,Browser,BrowserContext} from 'playwright-core';

test('owner administrator provisions two independent staff responsibilities; all staff are web-only',async({page,browser}:{page:Page;browser:Browser},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(240000);const db=localAuditService(),ids:string[]=[],contexts:BrowserContext[]=[];
 const ownerEmail='falmata.dawano@gmail.com';
 let owner=checked(await db.from('profiles').select('id,role,active').eq('email',ownerEmail).maybeSingle());let temporaryOwner='';
 if(!owner){temporaryOwner=checked(await db.auth.admin.createUser({email:ownerEmail,email_confirm:true})).user.id;checked(await db.from('profiles').update({role:'ADMIN',active:true}).eq('id',temporaryOwner));owner=checked(await db.from('profiles').select('id,role,active').eq('id',temporaryOwner).single());}
 expect(owner.role).toBe('ADMIN');expect(owner.active).toBe(true);
 async function webLogin(p:Page,email:string,destination:RegExp){
  await p.goto('/login');const requestedAt=Date.now();await p.getByTestId('email-code-request-form').getByLabel('Email',{exact:true}).fill(email);
  await p.getByRole('button',{name:'Email me a code',exact:true}).click();await expect(p.getByTestId('email-code-form')).toBeVisible();
  const code=await localMailpitNumericCode(email,requestedAt,['Your Loadgistic signup code','Your Loadgistic sign-in code']);
  await p.getByLabel('Six-digit code',{exact:true}).fill(code);await p.getByRole('button',{name:'Continue',exact:true}).click();await expect(p).toHaveURL(destination,{timeout:30000});
 }
 async function assertMobileBlocked(p:Page,email:string,id:string){
  const context=await browser.newContext({viewport:{width:412,height:915}});contexts.push(context);const app=await context.newPage();
  await app.goto('http://localhost:8084/account',{waitUntil:'domcontentloaded',timeout:90000});await app.getByRole('textbox',{name:'Email',exact:true}).fill(email);
  const requestedAt=Date.now(),requested=app.waitForResponse(r=>r.url().endsWith('/api/mobile/auth/request')&&r.request().method()==='POST');await app.getByRole('button',{name:'Send code',exact:true}).click();expect((await requested).status()).toBe(200);await expect(app.getByRole('textbox',{name:'Sign-in code',exact:true})).toBeVisible({timeout:30000});
  const code=await localMailpitNumericCode(email,requestedAt,['Your Loadgistic signup code','Your Loadgistic sign-in code']);await app.getByRole('textbox',{name:'Sign-in code',exact:true}).fill(code);
  const result=app.waitForResponse(r=>r.url().endsWith('/api/mobile/auth/verify')&&r.request().method()==='POST');await app.getByRole('button',{name:'Sign in',exact:true}).click();const response=await result;
  expect(response.status()).toBe(403);const denial=await response.json();expect(denial.error.code).toBe('WEB_ONLY');expect(denial.accessToken).toBeUndefined();expect(denial.refreshToken).toBeUndefined();
  await expect(app.getByText('Use the website for staff access.',{exact:true}).first()).toBeVisible();expect(await app.evaluate(()=>sessionStorage.getItem('loadgistic.account.refresh.v1'))).toBeNull();
  await app.screenshot({path:info.outputPath(`web-only-${id}.png`)});
  // A legitimate web session presented to mobile cannot bypass refresh/read guards.
  const link=checked(await db.auth.admin.generateLink({type:'magiclink',email})),url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const client=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  const login=checked(await client.auth.verifyOtp({type:'magiclink',token_hash:link.properties.hashed_token})).session;
  for(const route of ['session','dashboard','support','capacity']){const read=await p.request.get(`/api/mobile/${route}`,{headers:{Authorization:`Bearer ${login.access_token}`}});expect(read.status()).toBe(403);expect((await read.json()).error.code).toBe('WEB_ONLY');}
  const refresh=await p.request.post('/api/mobile/auth/refresh',{data:{refreshToken:login.refresh_token}});expect(refresh.status()).toBe(403);expect((await refresh.json()).error.code).toBe('WEB_ONLY');
  await client.auth.signOut({scope:'local'});
  if(id===owner!.id)expect((await p.request.get('/admin/support')).status()).toBe(200);
 }
 try{
  await webLogin(page,ownerEmail,/\/admin$/);await page.goto('/admin/support');await expect(page.getByRole('heading',{name:'Customer Support',exact:true})).toBeVisible();
  for(const responsibility of ['SUPPORT','BROKERAGE']){
   const email=`staff-owner-audit-${responsibility.toLowerCase()}-${randomUUID()}@example.test`,form=page.locator('form[action="/api/admin/support-agents"]');
   await page.locator('details').filter({has:form}).locator('summary').click();await form.getByLabel('Name',{exact:true}).fill(`Audit ${responsibility}`);await form.getByLabel('Sign-in email',{exact:true}).fill(email);
   await form.locator('[name=canManageSupport]').setChecked(responsibility==='SUPPORT');await form.locator('[name=canManageBrokerage]').setChecked(responsibility==='BROKERAGE');await form.getByRole('button',{name:'Create member',exact:true}).click();await expect(page).toHaveURL(/\/admin\/support\?success=/);
   const user=checked(await db.from('profiles').select('id,role,active').eq('email',email).single());ids.push(user.id);expect(user.role).toBe('SUPPORT');expect(user.active).toBe(true);
   const permissions=checked(await db.from('support_agent_profiles').select('*').eq('user_id',user.id).single());expect(permissions.can_manage_support).toBe(responsibility==='SUPPORT');expect(permissions.can_manage_brokerage).toBe(responsibility==='BROKERAGE');
   for(const field of ['can_manage_customers','can_manage_operations','can_manage_trust','can_manage_billing','can_manage_featured'])expect(permissions[field]).toBe(false);
   const context=await browser.newContext({baseURL:'http://127.0.0.1:3100',viewport:page.viewportSize()!});contexts.push(context);const staff=await context.newPage();await webLogin(staff,email,responsibility==='SUPPORT'?/\/support$/:/\/brokerage$/);
   expect((await staff.request.post('/api/admin/support-agents',{form:{name:'Forbidden',email:`denied-${randomUUID()}@example.test`}})).status()).toBe(403);
   await assertMobileBlocked(staff,email,user.id);await page.goto('/admin/support');
  }
  await assertMobileBlocked(page,ownerEmail,owner!.id);
  for(const width of [412,1440]){await page.setViewportSize({width,height:915});await page.goto('/admin/support');await page.screenshot({path:info.outputPath(`owner-admin-${width}.png`),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 }finally{if(temporaryOwner){checked(await db.from('audit_logs').delete().eq('actor_user_id',temporaryOwner));checked(await db.auth.admin.deleteUser(temporaryOwner));}for(const context of contexts)await context.close();for(const id of ids){checked(await db.from('audit_logs').delete().eq('actor_user_id',id));checked(await db.from('audit_logs').delete().eq('entity_id',id));checked(await db.auth.admin.deleteUser(id));}}
});
