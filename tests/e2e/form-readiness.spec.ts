import {test,expect as baseExpect} from './browser-test';
const expect=baseExpect.configure({timeout:30000});
import type {Page,Route} from 'playwright-core';

async function holdScripts(page:Page){
 let release=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/_next/static/**',async route=>{if(new URL(route.request().url()).pathname.endsWith('.js'))await gate;await route.continue();});
 return release;
}

test('private email form preserves the first input after delayed hydration',async({page}:{page:Page})=>{
 const release=await holdScripts(page);let submitted='';
 // Isolate readiness from delivery: the real OTP workflow is covered separately.
 await page.route('**/api/shared-capacity/otp',async(route:Route)=>{submitted=route.request().postData()||'';await route.fulfill({json:{verificationRequired:true,message:'Check your email for a one-time code.'}});});
 try{
  await page.goto('/?view=private',{waitUntil:'commit'});
  const email=page.getByLabel('Email',{exact:true}),submit=page.getByRole('button',{name:'Continue with email'});
  await expect(email).toBeDisabled();await expect(submit).toBeDisabled();
  release();await expect(email).toBeEnabled();await email.fill('readiness@example.test');await submit.click();
  await expect(page.getByLabel('6-digit email code')).toBeVisible();
  expect(submitted).toContain('readiness@example.test');await expect(email).toHaveValue('readiness@example.test');
 }finally{release();await page.unrouteAll({behavior:'wait'});}
});

// FEAT-ENT-001: a delayed client bundle must not revive the retired staff flow.
test('retired Brokerage assignment stays unavailable after hydration',async({page}:{page:Page})=>{
 const release=await holdScripts(page);
 try{
  await page.goto('/brokerage',{waitUntil:'commit'});
  release();
  await expect(page.getByRole('heading',{name:'404',exact:true})).toBeVisible();
  await expect(page.locator('[name=assignee],.brokerage-assignment')).toHaveCount(0);
 }finally{release();await page.unrouteAll({behavior:'wait'});}
});
