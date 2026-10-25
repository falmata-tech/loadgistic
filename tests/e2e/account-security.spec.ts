import {auditDeleteVehicles} from './audit-helpers';
import {test,expect} from './browser-test';
import {localAuditService,checked,auditProvider} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {localMailpitNumericCode,localMailpitEmailChangeLink} from './mailpit-helper';
import {accountSecurityIdentity} from '../../src/lib/account-security.js';
import {createProviderVehicle} from '../../src/lib/fleet.js';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
test.use({trace:'off',video:'off',screenshot:'off'});

test('fresh email verification changes login identity and deactivation retains history after resolving work',async({page}:{page:any},info:any)=>{
 test.setTimeout(180000);page.setDefaultTimeout(20000);const service=localAuditService();let actor:any;let vehicleId='';
 const diagnostics:{pageErrors:string[];confirm?:{status:number;stage:string;error:string};signedTargetPreserved?:boolean}={pageErrors:[]};
 page.on('pageerror',(error:{message:string})=>{if(diagnostics.pageErrors.length<10)diagnostics.pageErrors.push(error.message==='frame.join is not a function'?'NEXT_DEV_STACK_FORMAT':'UNCLASSIFIED');});
 const screenshots=path.resolve('artifacts/account-security-2026-09-14');mkdirSync(screenshots,{recursive:true});
 try{
  actor=await auditProvider(service,'account-security');const newEmail=`changed-${actor.suffix}@loadgistic.local`;
  const vehicle=await createProviderVehicle(actor,{useBasis:'OWNED',make:'Toyota',model:'Security audit',plate:`SEC-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false});vehicleId=vehicle.id;
  await localSupportLogin(page,actor.id);await page.goto('/app/more?tab=security',{waitUntil:'domcontentloaded'});const security=page.getByRole('region',{name:'Account security'});await expect(security).toBeVisible();
  await security.getByRole('button',{name:'Deactivate account',exact:true}).click();const initialDeactivation=page.getByRole('dialog',{name:'Deactivate account',exact:true});await expect(initialDeactivation.getByRole('button',{name:'Verify email to deactivate'})).toHaveCount(0);await initialDeactivation.getByRole('button',{name:'Cancel'}).click();
  // A direct closure request is denied before sending mail while work remains.
  const blocked=await page.evaluate(async()=>{const r=await fetch('/api/account/security/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'DEACTIVATE',confirm:'DEACTIVATE'})});return {status:r.status,result:await r.json()};});
  expect(blocked.status).toBe(409);expect(blocked.result.blockers).toContain('ACTIVE_TRUCKS');
  await security.getByRole('button',{name:'Change login email',exact:true}).click();const emailDialog=page.getByRole('dialog',{name:'Change login email',exact:true});await emailDialog.getByLabel('New login email').fill(newEmail);
  let requestedAt=Date.now();await emailDialog.getByRole('button',{name:'Send verification code'}).click();await expect(security.getByLabel('Current email code')).toBeVisible();
  const code=await localMailpitNumericCode(actor.email,requestedAt,'Your Loadgistic sign-in code');
  const beforeTarget=accountSecurityIdentity((await page.context().cookies()).find((cookie:any)=>cookie.name==='lg_account_security')?.value);
  // A code alone cannot change the target chosen by the signed handoff.
  const wrongTarget=await page.evaluate(async()=>{const r=await fetch('/api/account/security/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'EMAIL',email:'wrong-target@example.test',code:'000000'})});return r.status;});expect(wrongTarget).toBe(400);
  const afterTarget=accountSecurityIdentity((await page.context().cookies()).find((cookie:any)=>cookie.name==='lg_account_security')?.value);
  diagnostics.signedTargetPreserved=Boolean(beforeTarget&&afterTarget&&afterTarget.actorId===actor.id&&afterTarget.action==='EMAIL'&&afterTarget.phase==='CURRENT_EMAIL'&&afterTarget.targetDigest===beforeTarget.targetDigest);
  expect(diagnostics.signedTargetPreserved).toBe(true);
  requestedAt=Date.now();await security.getByLabel('Current email code').fill(code).catch(()=>{throw Error('The current email code field was unavailable.');});
  const confirmedResponse=page.waitForResponse((response:any)=>new URL(response.url()).pathname==='/api/account/security/confirm'&&response.request().method()==='POST');
  await security.getByRole('button',{name:'Verify current email'}).click();const confirmation=await confirmedResponse;const confirmed=await confirmation.json();
  const stages=['CURRENT_EMAIL','EMAIL_PENDING','COMPLETE','DEACTIVATED'];
  const errors=['Request a fresh code for this account action.','That code could not be verified. Request a new code if needed.','We could not confirm the email-change request. Check your account and inboxes before trying again.','Account security changes are temporarily unavailable.'];
  diagnostics.confirm={status:confirmation.status(),stage:stages.includes(confirmed.stage)?confirmed.stage:'UNCLASSIFIED',error:typeof confirmed.error==='string'&&errors.includes(confirmed.error)?confirmed.error:confirmed.error?'UNCLASSIFIED':''};
  expect(confirmation.status()).toBe(200);expect(confirmed.ok).toBe(true);expect(confirmed.stage).toBe('EMAIL_PENDING');
  await expect(security.getByRole('button',{name:'Check email change'})).toBeVisible();
  const handoff=(await page.context().cookies()).find((cookie:any)=>cookie.name==='lg_account_security');
  const pendingHandoff=accountSecurityIdentity(handoff?.value);expect(pendingHandoff?.actorId===actor.id).toBe(true);expect(pendingHandoff?.action).toBe('EMAIL');expect(pendingHandoff?.phase).toBe('EMAIL_PENDING');
  // Verify delivery to both exact inboxes, but always prove the new inbox first.
  // Local Auth auto-confirm can complete on that link; secure hosted Auth may
  // still require the current-inbox link. Never consume a now-stale link.
  const links=await Promise.all([newEmail,actor.email].map(email=>localMailpitEmailChangeLink(email,requestedAt)));
  expect(checked(await service.auth.admin.getUserById(actor.id)).user.email).toBe(actor.email);
  for(const link of links){
   try{await page.goto(link);}catch{throw new Error('The local email confirmation did not reach the account page.');}
   await expect(page.getByRole('heading',{name:'Account',exact:true})).toBeVisible({timeout:20000});
   const confirmed=checked(await service.auth.admin.getUserById(actor.id)).user;
   if(confirmed.email===newEmail&&!confirmed.new_email)break;
  }
  await expect(page.getByText('Login email changed.',{exact:true})).toBeVisible();
  await page.screenshot({path:path.join(screenshots,`${info.project.name}-email-confirmed.png`),fullPage:true});
  const profile=checked(await service.from('profiles').select('email,active,role').eq('id',actor.id).single());expect(profile).toEqual({email:newEmail,active:true,role:'DRIVER'});
  expect(checked(await service.auth.admin.getUserById(actor.id)).user.email).toBe(newEmail);
  await page.goto(`/app/fleet/${vehicleId}?view=details`);await page.getByRole('button',{name:'Retire vehicle',exact:true}).click();const retirement=page.getByRole('dialog',{name:'Retire vehicle',exact:true});await page.screenshot({path:info.outputPath('current-vehicle-retirement.png'),fullPage:true});await retirement.getByLabel('Reason',{exact:true}).fill('Resolve vehicle before closing account');await retirement.getByRole('checkbox').check();await retirement.getByRole('button',{name:'Retire vehicle',exact:true}).click();
  await expect(page).toHaveURL(/\/app\/home\/vehicles\?success=/,{timeout:30000});await expect(page.getByRole('navigation',{name:'Manage vehicles',exact:true})).toBeVisible({timeout:30000});
  await expect(page.getByText('Vehicle retired. Its history is retained.',{exact:true})).toBeVisible();expect(checked(await service.from('vehicles').select('active').eq('id',vehicleId).single())).toEqual({active:false});
  await page.goto('/app/more?tab=security',{waitUntil:'domcontentloaded'});await expect(security).toBeVisible();await security.getByRole('button',{name:'Deactivate account',exact:true}).click();const deactivation=page.getByRole('dialog',{name:'Deactivate account',exact:true});await deactivation.getByRole('checkbox').check();
  requestedAt=Date.now();await deactivation.getByRole('button',{name:'Verify email to deactivate'}).click();await security.getByLabel('Current email code').fill(await localMailpitNumericCode(newEmail,requestedAt,'Your Loadgistic sign-in code')).catch(()=>{throw Error('The deactivation code field was unavailable.');});await Promise.all([page.waitForURL(/\/login\?/),security.getByRole('button',{name:'Verify current email'}).click()]);
  await expect(page).toHaveURL(/\/login\?/);await expect(page.getByText('Account deactivated. Your history is retained.',{exact:true})).toBeVisible();
  const closed=checked(await service.from('profiles').select('active,account_deactivated_at').eq('id',actor.id).single());expect(closed.active).toBe(false);expect(closed.account_deactivated_at).toBeTruthy();
  expect(checked(await service.from('vehicles').select('id,active').eq('id',vehicleId).single())).toEqual({id:vehicleId,active:false});
  expect(checked(await service.from('capacities').select('id').eq('vehicle_id',vehicleId)).length).toBeGreaterThan(0);
  expect(checked(await service.auth.admin.getUserById(actor.id)).user.id).toBe(actor.id);
  await page.goto('/app/more');await expect(page.getByRole('region',{name:'Account security'})).toHaveCount(0);
  await page.screenshot({path:path.join(screenshots,`${info.project.name}-deactivated.png`),fullPage:true});
 }finally{
  const diagnosticPath=info.outputPath('security-runtime-diagnostics.json');mkdirSync(path.dirname(diagnosticPath),{recursive:true});writeFileSync(diagnosticPath,JSON.stringify(diagnostics,null,2)+'\n');
  if(vehicleId){checked(await service.from('audit_logs').delete().eq('entity_id',vehicleId));checked(await auditDeleteVehicles(service,'id',vehicleId));}
  if(actor){checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));}
 }
});
