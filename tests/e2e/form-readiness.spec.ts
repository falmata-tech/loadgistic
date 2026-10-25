import {test,expect as baseExpect} from './browser-test';
const expect=baseExpect.configure({timeout:30000});
import type {Page,Route} from 'playwright-core';

async function holdScripts(page:Page){
 let release=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/_next/static/**',async route=>{if(new URL(route.request().url()).pathname.endsWith('.js'))await gate;await route.fallback();});
 return release;
}

test('account signup choice and email remain usable while client scripts are delayed',async({page}:{page:Page})=>{
 const release=await holdScripts(page);let submitted='';
 // Isolate first-input readiness from actual email delivery.
 await page.route('**/api/applications/email-otp/request',async(route:Route)=>{submitted=route.request().postData()||'';await route.fulfill({status:303,headers:{location:'/signup?audience=PROVIDER'},body:''});});
 try{
  await page.goto('/signup',{waitUntil:'commit'});
  const email=page.getByLabel('Email',{exact:true}),submit=page.getByRole('button',{name:'Email me a code'});
  await expect(email).toBeEnabled();await page.getByRole('radio',{name:/Put your vehicles on the map/}).check();
  await email.fill('readiness@example.test');release();await submit.click();
  await expect.poll(()=>submitted).toContain('email=readiness%40example.test');
  expect(submitted).toContain('audience=PROVIDER');
 }finally{release();}
});

// FEAT-ENT-001: a delayed client bundle must not revive the retired staff flow.
test('retired Brokerage assignment stays unavailable after hydration',async({page}:{page:Page})=>{
 const release=await holdScripts(page);
 try{
  await page.goto('/brokerage',{waitUntil:'commit'});
  release();
  await expect(page.getByRole('heading',{name:'404',exact:true})).toBeVisible();
  await expect(page.locator('[name=assignee],.brokerage-assignment')).toHaveCount(0);
 }finally{release();}
});
