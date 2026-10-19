import {test,expect} from './browser-test';
import type {Page} from 'playwright-core';
import {randomUUID} from 'node:crypto';
import {localAuditService} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';

function checked<T=unknown>(result:{data:unknown;error:unknown}):T{
 if(result.error)throw Error('LOCAL_SUPPORT_READINESS_FIXTURE_FAILED');
 return result.data as T;
}
async function holdScripts(page:Page){
 let release=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/_next/static/**',async route=>{
  if(new URL(route.request().url()).pathname.endsWith('.js'))await gate;
  await route.continue();
 });
 return release;
}

test('retired guest staff pages expose no assignment before or after hydration',async({page})=>{
 test.setTimeout(120000);
 const db=localAuditService(),id=randomUUID(),errors:string[]=[];
 let agentId='',logout:undefined|(()=>Promise<unknown>),release=()=>{},stage='FIXTURE';
 page.on('pageerror',error=>errors.push(error.name));
 try{
  const admin=checked<{id:string}>(await db.from('profiles').select('id').eq('role','ADMIN').eq('active',true).limit(1).single());
  const identity=await db.auth.admin.createUser({email:`support-ready-${id}@example.test`,email_confirm:true});
  if(identity.error||!identity.data.user)throw Error('LOCAL_SUPPORT_READINESS_FIXTURE_FAILED');
  agentId=identity.data.user.id;
  checked(await db.from('profiles').update({active:true,role:'SUPPORT',full_name:'Synthetic readiness Support'}).eq('id',agentId));
  // Direct insertion affects only this new fixture. It does not run automatic
  // assignment, change existing workers or drain any waiting queue.
  checked(await db.from('support_agent_profiles').insert({user_id:agentId,active:true,available:true,max_open_conversations:3,can_manage_support:true,can_manage_brokerage:false}));
  checked(await db.from('guest_support_conversations').insert({id,email:`support-ready-${id}@example.test`,email_digest:randomUUID().replaceAll('-','').repeat(2),phone:'+251900000019',status:'WAITING'}));
  stage='LOGIN';logout=await localSupportLogin(page,admin.id);
  release=await holdScripts(page);
  stage='SERVER_READINESS';
  await page.goto(`/support/assisted/${id}`,{waitUntil:'commit'});
  await expect(page.getByRole('heading',{name:'404',exact:true})).toBeVisible();
  await expect(page.getByRole('form',{name:'Support assignment',exact:true})).toHaveCount(0);
  await expect(page.locator('.guest-support-thread')).toHaveCount(0);
  stage='HYDRATED_RETIREMENT';release();
  await expect(page.getByRole('heading',{name:'404',exact:true})).toBeVisible();
  await expect(page.getByRole('form',{name:'Support assignment',exact:true})).toHaveCount(0);
  stage='PRESERVED_PRIVATE_RECORD';
  expect(checked(await db.from('guest_support_conversations').select('assigned_agent_user_id,status').eq('id',id).single())).toEqual({assigned_agent_user_id:null,status:'WAITING'});
  expect(checked(await db.from('guest_support_events').select('id').eq('conversation_id',id).eq('event_type','REASSIGNED'))).toHaveLength(0);
  expect((await page.request.post('/api/guest-support',{data:{}})).status()).toBe(410);
  expect((await page.request.get('/api/guest-support/current')).status()).toBe(410);
  expect(errors).toEqual([]);
 }catch{
  // Never include Playwright's request/cookie diagnostics in the public output.
  throw Error('SUPPORT_STAFF_READINESS_WORKFLOW_FAILED: '+stage);
 }finally{
  release();await page.unrouteAll({behavior:'wait'});
  await logout?.();
  checked(await db.from('guest_support_conversations').delete().eq('id',id));
  checked(await db.from('audit_logs').delete().eq('entity_id',id));
  if(agentId){
   checked(await db.from('audit_logs').delete().eq('actor_user_id',agentId));
   checked(await db.from('audit_logs').delete().eq('entity_id',agentId));
   checked(await db.auth.admin.deleteUser(agentId));
  }
 }
});
