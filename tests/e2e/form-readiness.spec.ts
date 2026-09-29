import {test,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:30000});
import type {Page,Route} from 'playwright-core';
import {randomUUID} from 'node:crypto';
import {localAuditService,checked} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';

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

test('brokerage fields wait for hydration and the first assignment persists',async({page}:{page:Page})=>{
 test.setTimeout(90000);const db=localAuditService(),id=randomUUID();let agentId='',logout:undefined|(()=>Promise<unknown>);const release=await holdScripts(page);
 try{
  const admin=checked(await db.from('profiles').select('id').eq('role','ADMIN').eq('active',true).limit(1).single());
  agentId=checked(await db.auth.admin.createUser({email:`ready-${id}@example.test`,email_confirm:true})).user.id;
  checked(await db.from('profiles').update({active:true,role:'SUPPORT',full_name:'Readiness broker'}).eq('id',agentId));
  checked(await db.from('support_agent_profiles').insert({user_id:agentId,active:true,available:false,max_open_conversations:3,can_manage_support:false,can_manage_brokerage:true}));
  checked(await db.rpc('create_transport_service_request',{request_id:id,command:{name:'Readiness test',phone:'+251900000013',origin:'Adama',destination:'Dire Dawa'}}));
  logout=await localSupportLogin(page,admin.id);const documentResponse=await page.goto('/brokerage?queue=ALL&view=ALL',{waitUntil:'commit'});
  expect(/<select[^>]*name="assignee"[^>]*disabled/.test(await documentResponse!.text()),'server HTML keeps assignment disabled before scripts').toBe(true);
  const card=page.locator(`[data-request-id="${id}"]`),assignment=card.getByRole('combobox',{name:'Assigned to',exact:true});
  await expect(assignment).toBeDisabled();await expect(card.getByRole('combobox',{name:'Status',exact:true})).toBeDisabled();await expect(card.getByLabel('Follow-up note')).toBeDisabled();
  release();await assignment.selectOption(agentId);await card.getByRole('button',{name:'Save assignment'}).click();
  await expect.poll(async()=>checked(await db.from('transport_service_requests').select('assigned_agent_user_id').eq('id',id).single()).assigned_agent_user_id,{timeout:15000}).toBe(agentId);
 }finally{
  release();await page.unrouteAll({behavior:'wait'});if(logout)await logout();
  checked(await db.from('transport_request_events').delete().eq('request_id',id));checked(await db.from('transport_service_requests').delete().eq('id',id));checked(await db.from('audit_logs').delete().eq('entity_id',id));
  if(agentId)checked(await db.auth.admin.deleteUser(agentId));
 }
});
