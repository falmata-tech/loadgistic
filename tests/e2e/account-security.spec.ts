import {test,expect} from '@playwright/test';
import {localAuditService,checked,auditLogin,auditProvider} from './audit-helpers';
import {localMailpitNumericCode,localMailpitEmailChangeLink} from './mailpit-helper';
import {accountSecurityIdentity} from '../../src/lib/account-security.js';
import {createProviderVehicle} from '../../src/lib/fleet.js';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
test.use({trace:'off',video:'off'});

test('fresh email verification changes login identity and deactivation retains history after resolving work',async({page}:{page:any},info:any)=>{
 test.setTimeout(180000);page.setDefaultTimeout(20000);const service=localAuditService();let actor:any;let vehicleId='';
 const screenshots=path.resolve('artifacts/account-security-2026-09-14');mkdirSync(screenshots,{recursive:true});
 try{
  actor=await auditProvider(service,'account-security');const newEmail=`changed-${actor.suffix}@loadgistic.local`;
  const vehicle=await createProviderVehicle(actor,{make:'Toyota',model:'Security audit',plate:`SEC-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false});vehicleId=vehicle.id;
  await auditLogin(page,actor.email);await page.goto('/app/more');const security=page.getByRole('region',{name:'Account security'});
  await security.getByText('Deactivate account',{exact:true}).click();await expect(security.getByRole('button',{name:'Verify email to deactivate'})).toHaveCount(0);
  // A direct closure request is denied before sending mail while work remains.
  const blocked=await page.evaluate(async()=>{const r=await fetch('/api/account/security/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'DEACTIVATE',confirm:'DEACTIVATE'})});return {status:r.status,result:await r.json()};});
  expect(blocked.status).toBe(409);expect(blocked.result.blockers).toContain('ACTIVE_TRUCKS');
  await security.getByText('Change login email',{exact:true}).click();await security.getByLabel('New login email').fill(newEmail);
  let requestedAt=Date.now();await security.getByRole('button',{name:'Send verification code'}).click();await expect(security.getByLabel('Current email code')).toBeVisible();
  const code=await localMailpitNumericCode(actor.email,requestedAt,'Your Loadgistic sign-in code');
  // A code alone cannot change the target chosen by the signed handoff.
  const wrongTarget=await page.evaluate(async()=>{const r=await fetch('/api/account/security/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'EMAIL',email:'wrong-target@example.test',code:'000000'})});return r.status;});expect(wrongTarget).toBe(400);
  requestedAt=Date.now();await security.getByLabel('Current email code').fill(code);await security.getByRole('button',{name:'Verify current email'}).click();await expect(security.getByRole('button',{name:'Check email change'})).toBeVisible();
  const handoff=(await page.context().cookies()).find((cookie:any)=>cookie.name==='lg_account_security');
  expect(accountSecurityIdentity(handoff?.value)).toMatchObject({actorId:actor.id,action:'EMAIL',phase:'EMAIL_PENDING'});
  // Verify delivery to both exact inboxes, but always prove the new inbox first.
  // Local Auth auto-confirm can complete on that link; secure hosted Auth may
  // still require the current-inbox link. Never consume a now-stale link.
  const links=await Promise.all([newEmail,actor.email].map(email=>localMailpitEmailChangeLink(email,requestedAt)));
  expect(checked(await service.auth.admin.getUserById(actor.id)).user.email).toBe(actor.email);
  for(const link of links){
   try{await page.goto(link);}catch{throw new Error('The local email confirmation did not reach the account page.');}
   await expect(page.getByRole('heading',{name:'Account & plan',exact:true})).toBeVisible({timeout:20000});
   const confirmed=checked(await service.auth.admin.getUserById(actor.id)).user;
   if(confirmed.email===newEmail&&!confirmed.new_email)break;
  }
  await expect(page.getByText('Login email changed.',{exact:true})).toBeVisible();
  await page.screenshot({path:path.join(screenshots,`${info.project.name}-email-confirmed.png`),fullPage:true});
  const profile=checked(await service.from('profiles').select('email,active,role').eq('id',actor.id).single());expect(profile).toEqual({email:newEmail,active:true,role:'DRIVER'});
  expect(checked(await service.auth.admin.getUserById(actor.id)).user.email).toBe(newEmail);
  await page.goto(`/app/fleet/${vehicleId}`);const retirement=page.locator('details').filter({has:page.locator('summary',{hasText:'Retire truck'})});await retirement.locator('summary').click();await retirement.getByLabel('Reason',{exact:true}).fill('Resolve truck before closing account');await retirement.getByRole('checkbox').check();await retirement.getByRole('button',{name:'Retire truck',exact:true}).click();
  await expect(page.getByText('Truck retired. Its history is retained.',{exact:true})).toBeVisible();await page.goto('/app/more');await security.getByText('Deactivate account',{exact:true}).click();await security.getByRole('checkbox').check();
  requestedAt=Date.now();await security.getByRole('button',{name:'Verify email to deactivate'}).click();await security.getByLabel('Current email code').fill(await localMailpitNumericCode(newEmail,requestedAt,'Your Loadgistic sign-in code'));await security.getByRole('button',{name:'Verify current email'}).click();
  await expect(page).toHaveURL(/\/login\?/);await expect(page.getByText('Account deactivated. Your history is retained.',{exact:true})).toBeVisible();
  const closed=checked(await service.from('profiles').select('active,account_deactivated_at').eq('id',actor.id).single());expect(closed.active).toBe(false);expect(closed.account_deactivated_at).toBeTruthy();
  expect(checked(await service.from('vehicles').select('id,active').eq('id',vehicleId).single())).toEqual({id:vehicleId,active:false});
  expect(checked(await service.from('capacities').select('id').eq('vehicle_id',vehicleId)).length).toBeGreaterThan(0);
  expect(checked(await service.auth.admin.getUserById(actor.id)).user.id).toBe(actor.id);
  await page.goto('/app/more');await expect(page.getByRole('region',{name:'Account security'})).toHaveCount(0);
  await page.screenshot({path:path.join(screenshots,`${info.project.name}-deactivated.png`),fullPage:true});
 }finally{
  if(vehicleId){checked(await service.from('audit_logs').delete().eq('entity_id',vehicleId));checked(await service.from('vehicles').delete().eq('id',vehicleId));}
  if(actor){checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));}
 }
});
