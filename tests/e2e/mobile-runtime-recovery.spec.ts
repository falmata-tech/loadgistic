import {test,expect} from '@playwright/test';
import type {Page} from 'playwright-core';
import {localAuditService,checked,auditProvider,auditDeleteVehicles} from './audit-helpers';
import {createProviderVehicle} from '../../src/lib/fleet.js';
import {createProviderShipment} from '../../src/lib/provider-tracking.js';
import {localMailpitNumericCode} from './mailpit-helper';
const preview='http://localhost:8084';

test('mobile Featured recovers from unavailable and malformed responses without losing navigation',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(90000);let failure:'unavailable'|'malformed'|'healthy'='unavailable';const errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.name));
 page.on('console',message=>{if(message.type()==='error'&&/Unexpected text node|Text strings must be rendered/.test(message.text()))errors.push('INVALID_NATIVE_TEXT');});
 await page.route('**/api/mobile/public/featured',route=>failure==='healthy'?route.continue():route.fulfill({status:failure==='unavailable'?503:200,contentType:'application/json',body:failure==='unavailable'?JSON.stringify({message:'Please try again.'}):'{}'}));
 await page.goto(preview+'/about');await page.getByRole('tab',{name:'Featured',exact:true}).click();
 await expect(page.getByRole('button',{name:'Try again',exact:true})).toBeVisible();
 failure='malformed';await page.getByRole('button',{name:'Try again',exact:true}).click();
 await expect(page.getByText('Featured is unavailable right now. Please try again.',{exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('featured-recoverable-error.png')});
 failure='healthy';await page.getByRole('button',{name:'Try again',exact:true}).click();
 await expect(page.getByRole('button',{name:'Weekly themes',exact:true})).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:'View schedule',exact:true}).click();
 await expect(page.getByRole('button',{name:'Hide schedule',exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('featured-restored.png')});
 await page.getByRole('tab',{name:'Track',exact:true}).click();await expect(page.getByLabel('Your email',{exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Capacity',exact:true}).click();await expect(page.getByRole('tab',{name:'Open to the public',exact:true})).toBeVisible();
 expect(errors).toEqual([]);
});

test('mobile real email access restores Tracking, opens updates, recovers bad data and closes safely',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(120000);const service=localAuditService(),actor=await auditProvider(service,'native-track-crash');
 const email=`native-track-${actor.suffix}@example.test`,errors:string[]=[];let vehicle='',shipment='';
 page.on('pageerror',error=>errors.push(error.name));
 page.on('console',message=>{if(message.type()==='error'&&/Unexpected text node|Text strings must be rendered/.test(message.text()))errors.push('INVALID_NATIVE_TEXT');});
 try{
  const origin=checked(await service.from('place_catalog').select('id').eq('normalized_name','addis ababa').limit(1).single());
  const destination=checked(await service.from('place_catalog').select('id').eq('normalized_name','adama').limit(1).single());
  vehicle=(await createProviderVehicle(actor,{useBasis:'OWNED',make:'Demo',model:'Tracking test',plate:`NTRK-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false})).id;
  shipment=(await createProviderShipment(actor,{expectedDeliveryDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),vehicleId:vehicle,originPlaceRef:origin.id,destinationPlaceRef:destination.id,cargoSummary:'Synthetic shipment runtime check',customerEmail:email,trackingMode:'STATUS_ONLY'})).id;
  await page.goto(preview+'/about');await page.getByRole('tab',{name:'Track',exact:true}).click();
  await page.getByLabel('Your email',{exact:true}).fill(email);const since=Date.now();
  await page.getByRole('button',{name:'Send email code',exact:true}).click();
  const code=await localMailpitNumericCode(email,since,'Your Loadgistic tracking sign-in code');
  await page.getByLabel('Email verification code',{exact:true}).fill(code);await page.getByRole('button',{name:'Open private access',exact:true}).click();
  await expect(page.getByText('Your shipments',{exact:true})).toBeVisible();await page.reload();
  await expect(page.getByText('Your shipments',{exact:true})).toBeVisible();
  await page.getByRole('link',{name:'View updates',exact:true}).click();
  await expect(page.getByText('Synthetic shipment runtime check',{exact:true})).toBeVisible();
  await expect(page.getByText('Shipment progress',{exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('tracking-verified-updates.png')});
  await page.route(`**/api/mobile/visitor/tracking/shipments/${shipment}`,route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.getByRole('button',{name:'Refresh updates',exact:true}).click();
  await expect(page.getByText('Could not load shipment updates. Please try again.',{exact:true})).toBeVisible();
  await page.unroute(`**/api/mobile/visitor/tracking/shipments/${shipment}`);
  await page.getByRole('button',{name:'Refresh updates',exact:true}).click();
  await expect(page.getByText('Synthetic shipment runtime check',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close private access',exact:true}).click();
  await expect(page.getByLabel('Your email',{exact:true}).filter({visible:true})).toHaveCount(1);
  await page.getByRole('tab',{name:'Featured',exact:true}).click();await expect(page.getByRole('button',{name:'Weekly themes',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
 }finally{
  checked(await service.from('access_email_deliveries').delete().eq('recipient_email',email));
  if(shipment){checked(await service.from('audit_logs').delete().eq('entity_id',shipment));checked(await service.from('provider_shipments').delete().eq('id',shipment));}
  if(vehicle){checked(await service.from('audit_logs').delete().eq('entity_id',vehicle));checked(await auditDeleteVehicles(service,'id',vehicle));}
  checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));
 }
});

test('mobile private-capacity deep entry requires email verification and preserves the public switch',async({page}:{page:Page})=>{
 await page.goto(preview+'/?view=private');
 await expect(page.getByRole('tab',{name:'Privately shared with you',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(page.getByLabel('Your email',{exact:true}).filter({visible:true})).toHaveCount(1);
 await expect(page.getByRole('button',{name:'Send email code',exact:true})).toBeVisible();
 expect(await page.locator('[data-marker-id]').count()).toBe(0);
 await page.getByRole('tab',{name:'Open to the public',exact:true}).click();
 await expect(page.getByRole('tab',{name:'Open to the public',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(page.getByLabel('Your email',{exact:true}).filter({visible:true})).toHaveCount(0);
});
