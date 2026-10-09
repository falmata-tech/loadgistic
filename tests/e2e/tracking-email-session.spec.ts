import {auditDeleteVehicles} from './audit-helpers';
import {test,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:15000});
import {localAuditService,checked,auditProvider} from './audit-helpers';
import {createProviderVehicle} from '../../src/lib/fleet.js';
import {createProviderShipment} from '../../src/lib/provider-tracking.js';
import {localMailpitNumericCode} from './mailpit-helper';
import {createSessionToken} from '../../src/lib/security.js';
import {trackingSessionSubject} from '../../src/lib/tracking-session.js';

test('one email code opens shared shipments; activity, expiry and revocation stay scoped',async({page,context}:{page:any;context:any},info:any)=>{
 test.setTimeout(150000);
 const service=localAuditService(),actor=await auditProvider(service,'tracking-email');
 const email=`tracking-${actor.suffix}@example.test`,vehicles:string[]=[],shipments:string[]=[],actors=[actor];
 try{
  await context.setExtraHTTPHeaders({'x-forwarded-for':info.project.name.startsWith('mobile')?'127.0.0.234':'127.0.0.233'});
  const origin=checked(await service.from('place_catalog').select('id').eq('normalized_name','addis ababa').limit(1).single());
  const destination=checked(await service.from('place_catalog').select('id').eq('normalized_name','adama').limit(1).single());
  for(let index=0;index<3;index++){
   const provider=index===0?actor:await auditProvider(service,'tracking-email');if(index>0)actors.push(provider);
   const truck=await createProviderVehicle(provider,{useBasis:'OWNED',make:'Toyota',model:'Session test',plate:`SESS-${actor.suffix}-${index}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false});vehicles.push(truck.id);
   const shipment=await createProviderShipment(provider,{expectedDeliveryDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),vehicleId:truck.id,originPlaceRef:origin.id,destinationPlaceRef:destination.id,cargoSummary:`Session cargo ${index}`,customerEmail:index<2?email:`other-${actor.suffix}@example.test`,trackingMode:'STATUS_ONLY'});shipments.push(shipment.id);
  }
  await page.clock.install();
  await page.goto('/track');await expect(page.getByLabel('Shipment access code')).toHaveCount(0);
  await page.getByLabel('Email',{exact:true}).fill(email);await page.screenshot({path:info.outputPath('tracking-email-entry.png'),fullPage:true});
  const requested=Date.now();const response=page.waitForResponse((r:any)=>r.url().endsWith('/api/tracking/otp'),{timeout:20000});
  await page.getByRole('button',{name:'Email me a code',exact:true}).click();const challenge=await (await response).json();
  const otp=await localMailpitNumericCode(email,requested,'Your Loadgistic tracking sign-in code');
  await page.getByLabel('6-digit email code').fill(otp==='000000'?'111111':'000000');
  await page.getByRole('button',{name:'Open tracking',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('6-digit email code').fill(otp);await page.getByRole('button',{name:'Open tracking',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your shipments'})).toBeVisible({timeout:15000});
  await expect(page.locator('a.card[href^="/track/"]')).toHaveCount(2);
  const session=(await context.cookies()).find((c:any)=>c.name==='lg_tracking_grant')!;
  expect(session.httpOnly).toBe(true);expect(session.sameSite).toBe('Lax');expect(session.expires-Date.now()/1000).toBeGreaterThan(4*60);expect(session.expires-Date.now()/1000).toBeLessThanOrEqual(5*60);
  const replay=await page.request.post('/api/tracking/unlock',{form:{email,challengeId:challenge.challengeId,code:otp}});expect(replay.status()).toBe(401);
  await page.reload();await expect(page.getByRole('heading',{name:'Your shipments'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Log out',exact:true})).toBeEnabled();
  expect((await context.cookies()).find((c:any)=>c.name==='lg_tracking_grant')!.expires).toBe(session.expires);
  const renew=page.waitForResponse((r:any)=>r.url().endsWith('/api/tracking/session')&&r.request().method()==='POST',{timeout:15000});await page.keyboard.press('Tab');expect((await renew).ok()).toBe(true);
  await page.screenshot({path:info.outputPath('shared-shipments.png'),fullPage:true});
  await page.locator(`a[href="/track/${shipments[0]}"]`).click();await expect(page.getByText('Private shipment tracking',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Review code',{exact:true})).toHaveCount(0);
  await page.goto(`/track/${shipments[2]}`);await expect(page.getByRole('heading',{name:'Your shipments'})).toBeVisible();await expect(page.getByText('Session cargo 2')).toHaveCount(0);
  const crossOrigin=await page.request.post('/api/tracking/session',{headers:{origin:'https://unrelated.example'}});expect(crossOrigin.status()).toBe(403);
  const party=checked(await service.from('provider_tracking_recipients').select('recipient_email_digest').eq('shipment_id',shipments[0]).single());
  checked(await service.from('provider_tracking_recipients').update({revoked_at:new Date().toISOString()}).eq('shipment_id',shipments[0]));
  await page.goto(`/track/${shipments[0]}`);await expect(page.getByRole('heading',{name:'Your shipments'})).toBeVisible();await expect(page.locator('a.card[href^="/track/"]')).toHaveCount(1);
  await page.getByRole('button',{name:'Log out',exact:true}).click();await expect(page.getByRole('heading',{name:'Follow your shipment'})).toBeVisible();
  expect((await context.cookies()).find((c:any)=>c.name==='lg_tracking_grant')).toBeUndefined();
  // Expired and legacy sessions cannot renew into an email-wide session.
  for(const sub of [trackingSessionSubject(party.recipient_email_digest,Date.now()-8*60*60*1000),`provider-tracking:${shipments[1]}:${party.recipient_email_digest}`]){
   await context.addCookies([{name:'lg_tracking_grant',value:createSessionToken(sub,1800),url:info.project.use.baseURL!,httpOnly:true,sameSite:'Lax'}]);
   expect((await page.request.post('/api/tracking/session')).status()).toBe(401);
  }
  await context.clearCookies();
  // A fresh real code opens the remaining single shipment directly.
  await page.goto('/track');await page.getByLabel('Email',{exact:true}).fill(email);const again=Date.now();await page.getByRole('button',{name:'Email me a code',exact:true}).click();
  await page.getByLabel('6-digit email code').fill(await localMailpitNumericCode(email,again,'Your Loadgistic tracking sign-in code'));await page.getByRole('button',{name:'Open tracking',exact:true}).click();await expect(page).toHaveURL(new RegExp(`/track/${shipments[1]}$`),{timeout:15000});
  await page.screenshot({path:info.outputPath('tracking-session.png'),fullPage:true});
  await expect(page.getByRole('button',{name:'Log out',exact:true})).toBeEnabled();
  let renewals=0;page.on('request',(r:any)=>{if(r.url().endsWith('/api/tracking/session')&&r.method()==='POST')renewals++;});
  await page.clock.fastForward(6*60*1000);
  await expect(page.getByRole('heading',{name:'Follow your shipment'})).toBeVisible();expect(renewals).toBe(0);
  expect((await context.cookies()).find((c:any)=>c.name==='lg_tracking_grant')).toBeUndefined();
  expect(checked(await service.from('profiles').select('id').eq('email',email))).toHaveLength(0);
 }finally{
  const recipients=[email,`other-${actor.suffix}@example.test`];
  checked(await service.from('access_email_deliveries').delete().in('recipient_email',recipients));
  for(const id of shipments){checked(await service.from('audit_logs').delete().eq('entity_id',id));checked(await service.from('provider_shipments').delete().eq('id',id));}
  for(const id of vehicles){checked(await service.from('audit_logs').delete().eq('entity_id',id));checked(await auditDeleteVehicles(service,'id',id));}
  for(const provider of actors){checked(await service.from('audit_logs').delete().eq('actor_user_id',provider.id));checked(await service.auth.admin.deleteUser(provider.id));}
 }
});
