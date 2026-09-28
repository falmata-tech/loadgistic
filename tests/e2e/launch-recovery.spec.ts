import {test,expect} from '@playwright/test';
import type {Page} from 'playwright-core';
import {createClient} from '@supabase/supabase-js';
import {createChunks} from '@supabase/ssr/dist/main/utils/chunker.js';
import {localAuditService,checked} from './audit-helpers';

test('private truck access recovers from a stalled request without losing email',async({page}:{page:Page})=>{
 await page.goto('/shared-capacity');await expect(page.locator('.language-picker select')).toBeEnabled();await page.clock.install();
 let calls=0,release=()=>{};const held=new Promise<void>(r=>{release=r});
 await page.route('**/api/shared-capacity/otp',async route=>{calls++;await held;await route.abort().catch(()=>{});});
 try{
  await page.getByLabel('Email',{exact:true}).fill('held@example.test');await page.getByRole('button',{name:'Continue with email'}).click();await expect.poll(()=>calls).toBe(1);
  await page.clock.runFor(16000);await expect(page.locator('.form-error[role=alert]')).toContainText('Try again');await expect(page.getByRole('button',{name:'Continue with email'})).toBeEnabled();await expect(page.getByLabel('Email',{exact:true})).toHaveValue('held@example.test');expect(calls).toBe(1);
 }finally{release();await page.unrouteAll({behavior:'wait'});}
});

test('uncertain Tracking creation preserves the draft and prevents another save',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(90000);const service=localAuditService();
 const provider=checked(await service.from('profiles').select('id').eq('role','TRANSPORTER').eq('active',true).limit(1).single());
 const identity=checked(await service.auth.admin.getUserById(provider.id)).user;
 const link=checked(await service.auth.admin.generateLink({type:'magiclink',email:identity.email!}));
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
 const session=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const login=await session.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'magiclink'});expect(login.error).toBeNull();
 const cookies=createChunks(`sb-${new URL(url).hostname.split('.')[0]}-auth-token`,'base64-'+Buffer.from(JSON.stringify(login.data.session)).toString('base64url'));
 await page.context().addCookies(cookies.map(c=>({name:c.name,value:c.value,url:'http://127.0.0.1:3100',sameSite:'Lax' as const})));
 let calls=0,release=()=>{};const held=new Promise<void>(r=>{release=r});
 try{
  await page.goto('/app/provider-shipments/new');await expect(page.locator('.language-picker select')).toBeEnabled();
  await page.getByLabel('Truck',{exact:true}).selectOption({index:1});await page.getByLabel('Cargo summary').fill('Retain this cargo draft');
  for(const [label,query] of [['Origin','Adama'],['Destination','Addis Ababa']]){await page.getByRole('combobox',{name:label,exact:true}).fill(query);await page.getByRole('option',{name:new RegExp(query)}).first().click();}
  await page.getByLabel('Main customer email').fill('held@example.test');
  await page.route('**/api/provider-shipments',async route=>{calls++;await held;await route.abort().catch(()=>{});});await page.clock.install();
  await page.getByRole('button',{name:'Start Tracking',exact:true}).click();await expect.poll(()=>calls).toBe(1);await page.clock.runFor(16000);
  await expect(page.locator('.flash.error[role=alert]')).toContainText('could not confirm whether Tracking was created');await expect(page.getByRole('button',{name:'Start Tracking',exact:true})).toBeDisabled();
  await expect(page.getByLabel('Cargo summary')).toHaveValue('Retain this cargo draft');await expect(page.getByRole('link',{name:'Check my Tracking list'})).toHaveAttribute('href','/app/provider-shipments');expect(calls).toBe(1);
  await page.screenshot({path:info.outputPath('uncertain-tracking.png'),fullPage:true});
 }finally{release();await page.unrouteAll({behavior:'wait'});await session.auth.signOut({scope:'local'});}
});
