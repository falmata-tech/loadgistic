import {chooseDate} from './date-picker-helper';
import {test,expect} from '@playwright/test';
import type {Page} from 'playwright-core';
import {localAuditService,auditIdentity} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';

test('private truck access recovers from a stalled request without losing email',async({page}:{page:Page})=>{
 await page.goto('/shared-capacity');await expect(page.locator('.language-picker select:visible')).toBeEnabled();await page.clock.install();
 let calls=0,release=()=>{};const held=new Promise<void>(r=>{release=r});
 await page.route('**/api/shared-capacity/otp',async route=>{calls++;await held;await route.abort().catch(()=>{});});
 try{
  await page.getByLabel('Email',{exact:true}).fill('held@example.test');await page.getByRole('button',{name:'Continue with email'}).click();await expect.poll(()=>calls).toBe(1);
  await page.clock.runFor(16000);await expect(page.locator('.form-error[role=alert]')).toContainText('Try again');await expect(page.getByRole('button',{name:'Continue with email'})).toBeEnabled();await expect(page.getByLabel('Email',{exact:true})).toHaveValue('held@example.test');expect(calls).toBe(1);
 }finally{release();await page.unrouteAll({behavior:'wait'});}
});

test('uncertain Tracking creation preserves the draft and prevents another save',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(90000);const service=localAuditService();
 const provider=await auditIdentity(service,'transporter@loadgistic.local');
 const logout=await localSupportLogin(page,provider.id);
 let calls=0,release=()=>{};const held=new Promise<void>(r=>{release=r});
 try{
  await page.goto('/app/provider-shipments/new');await expect(page.locator('.language-picker select:visible')).toBeEnabled();
  await page.getByLabel('Truck',{exact:true}).selectOption({index:1});await page.getByLabel('Cargo summary').fill('Retain this cargo draft');
  for(const [label,query] of [['Origin','Adama'],['Destination','Addis Ababa']]){await page.getByRole('combobox',{name:label,exact:true}).fill(query);await page.getByRole('option',{name:new RegExp(query)}).first().click();}
  await chooseDate(page,'Expected delivery',new Date(Date.now()+2*86400000).toISOString().slice(0,10));await page.getByLabel('Shipment owner email').fill('held@example.test');
  // Let date-field validation settle before replacing browser timers. Otherwise
  // the fake clock can freeze the prior required-date validity and prevent submit.
  await expect.poll(()=>page.locator('form.form-card').evaluate(form=>form.matches(':valid')),{timeout:15000}).toBe(true);
  await page.route('**/api/provider-shipments',async route=>{calls++;await held;await route.abort().catch(()=>{});});await page.clock.install();
  await page.getByRole('button',{name:'Start Tracking',exact:true}).click();await expect.poll(()=>calls).toBe(1);await page.clock.runFor(16000);
  await expect(page.locator('.flash.error[role=alert]')).toContainText('could not confirm whether Tracking was created');await expect(page.getByRole('button',{name:'Start Tracking',exact:true})).toBeDisabled();
  await expect(page.getByLabel('Cargo summary')).toHaveValue('Retain this cargo draft');await expect(page.getByRole('link',{name:'Check my Tracking list'})).toHaveAttribute('href','/app/provider-shipments');expect(calls).toBe(1);
  await page.screenshot({path:info.outputPath('uncertain-tracking.png'),fullPage:true});
 }finally{release();if(!page.isClosed())await page.unrouteAll({behavior:'wait'});await logout();}
});
