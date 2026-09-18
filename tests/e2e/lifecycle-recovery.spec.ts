import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {localAuditService,checked,auditLogin,auditProvider} from './audit-helpers';
import {createProviderVehicle} from '../../src/lib/fleet.js';
import {createProviderShipment,updateProviderShipmentStatus} from '../../src/lib/provider-tracking.js';
import {localMailpitNumericCode} from './mailpit-helper';

test('owners and Operations recover Tracking, preserve history and retire trucks safely',async({page,browser}:{page:any;browser:any},info:any)=>{
 test.setTimeout(180000);page.setDefaultTimeout(20000);const service=localAuditService();let actor:any;const vehicles:string[]=[];let shipmentId='';let guest:any;
 const snapshots=path.resolve('artifacts/lifecycle-recovery-2026-09-14');mkdirSync(snapshots,{recursive:true});
 try{
  actor=await auditProvider(service,'lifecycle');
  for(const name of ['First','Replacement']){const vehicle=await createProviderVehicle(actor,{make:'Toyota',model:name,plate:`${name}-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false});vehicles.push(vehicle.id);}
  const origin=checked(await service.from('place_catalog').select('id').eq('normalized_name','addis ababa').limit(1).single());
  const destination=checked(await service.from('place_catalog').select('id').eq('normalized_name','adama').limit(1).single());
  const email=`lifecycle-guest-${randomUUID()}@example.test`;
  const shipment=await createProviderShipment(actor,{vehicleId:vehicles[0],originPlaceRef:origin.id,destinationPlaceRef:destination.id,cargoSummary:'Original audit cargo',customerEmail:email,trackingMode:'LOCATION_AND_STATUS'});shipmentId=shipment.id;
  await updateProviderShipmentStatus(actor,shipment.id,'TO_PICKUP','Travelling to pickup',null,{locationArea:'Around Addis Ababa',approximateLat:'9',approximateLng:'38.7',locationPrecisionKm:'20',locationSource:'DEVICE_OBSCURED'});
  await auditLogin(page,actor.email);await page.goto(`/app/provider-shipments/${shipment.id}`);
  const correction=page.locator('details').filter({has:page.locator('summary',{hasText:'Correct Tracking details'})});await correction.locator('summary').click();
  await correction.getByRole('textbox',{name:'Cargo summary',exact:true}).fill('Corrected audit cargo');await correction.getByLabel('Reason',{exact:true}).fill('Correct the agreed cargo description');
  await correction.getByRole('button',{name:'Save correction'}).click();await expect(page.getByText('Tracking updated. Earlier events are retained.',{exact:true})).toBeVisible();
  await expect(page.locator('.provider-shipment-summary')).toContainText('Corrected audit cargo');
  await page.goto(`/app/fleet/${vehicles[0]}`);const retirement=page.locator('details').filter({has:page.locator('summary',{hasText:'Retire truck'})});await retirement.locator('summary').click();
  await retirement.getByLabel('Reason',{exact:true}).fill('Truck should leave service');await retirement.getByRole('checkbox').check();await retirement.getByRole('button',{name:'Retire truck',exact:true}).click();
  await expect(page.getByText('Resolve or reassign active Tracking before retiring this truck.',{exact:true})).toBeVisible();
  expect(checked(await service.from('vehicles').select('active').eq('id',vehicles[0]).single()).active).toBe(true);
  guest=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize(),extraHTTPHeaders:{'x-forwarded-for':'127.0.0.247'}});const guestPage=await guest.newPage();
  await guestPage.goto('/track');await guestPage.getByLabel('Approved email').fill(email);await guestPage.getByLabel('Tracking code').fill(shipment.trackingCode);
  const requestedAt=Date.now();await guestPage.getByRole('button',{name:'Email me a code'}).click();await guestPage.getByLabel('One-time code').fill(await localMailpitNumericCode(email,requestedAt,'Your shipment Tracking code'));
  await guestPage.getByRole('button',{name:'Open tracking'}).click();await expect(guestPage.getByRole('heading',{name:'Shipment progress'})).toBeVisible({timeout:30000});
  const guestUrl=guestPage.url();
  await auditLogin(page,'admin@loadgistic.local');await page.goto(`/admin/operations/tracking/${shipment.id}`);
  await expect(page.getByRole('heading',{name:'Around Addis Ababa',exact:true})).toBeVisible();await expect(page.locator('.leaflet-container')).toBeVisible();
  await page.screenshot({path:path.join(snapshots,`${info.project.name}-admin-map.png`),fullPage:true,scale:'css'});
  const replacement=checked(await service.from('vehicles').select('platform_number').eq('id',vehicles[1]).single());
  const reassign=page.locator('details').filter({has:page.locator('summary',{hasText:'Reassign Tracking'})});await reassign.locator('summary').click();
  await reassign.getByLabel('Replacement truck number').fill(replacement.platform_number);await reassign.getByLabel('Reason',{exact:true}).fill('The replacement truck takes over');
  await reassign.getByRole('button',{name:'Save reassignment'}).click();await expect(page.getByText('Tracking updated. Earlier events are retained.',{exact:true})).toBeVisible();
  await expect(page.locator('.tracking-location-panel')).toHaveCount(0);
  expect(checked(await service.from('provider_shipments').select('assigned_vehicle_id').eq('id',shipment.id).single()).assigned_vehicle_id).toBe(vehicles[1]);
  await guestPage.reload();await expect(guestPage.getByRole('heading',{name:'Shipment progress'})).toBeVisible();await expect(guestPage.locator('.tracking-location-panel')).toHaveCount(0);
  // Correct a synthetic workspace through the Customers permission boundary.
  await page.goto(`/admin/operations/workspaces/${actor.provider_profile_id}?kind=PROVIDER_PROFILE`);
  await page.getByLabel('Business name',{exact:true}).fill(`Corrected audit business ${actor.suffix}`);await page.getByLabel('Reason',{exact:true}).fill('Correct the business display name');
  await page.getByRole('button',{name:'Save business name'}).click();await expect(page.getByText('Business name corrected.',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:`Corrected audit business ${actor.suffix}`,exact:true})).toBeVisible();
  await page.screenshot({path:path.join(snapshots,`${info.project.name}-workspace-correction.png`),fullPage:true,scale:'css'});
  await auditLogin(page,actor.email);await page.goto(`/app/fleet/${vehicles[0]}`);await retirement.locator('summary').click();await retirement.getByLabel('Reason',{exact:true}).fill('Retire the replaced truck');await retirement.getByRole('checkbox').check();await retirement.getByRole('button',{name:'Retire truck',exact:true}).click();
  await expect(page.getByText('Truck retired. Its history is retained.',{exact:true})).toBeVisible();
  const retired=page.getByRole('region',{name:'Retired trucks'});await retired.getByText('Restore truck',{exact:true}).first().click();
  await retired.getByLabel('Reason',{exact:true}).fill('Return this truck to service');await retired.getByRole('checkbox').check();await retired.getByRole('button',{name:'Restore truck',exact:true}).click();
  await expect(page.getByText('Truck restored. Assign a Driver and publish fresh capacity when ready.',{exact:true})).toBeVisible();
  const last=checked(await service.from('capacities').select('market_status').eq('vehicle_id',vehicles[0]).order('updated_at',{ascending:false}).limit(1).single());expect(last.market_status).toBe('OFF_DUTY');
  await page.goto(`/app/provider-shipments/${shipment.id}`);const cancel=page.locator('details').filter({has:page.locator('summary',{hasText:'Cancel Tracking'})});await cancel.locator('summary').click();
  await cancel.getByLabel('Reason',{exact:true}).fill('The customer cancelled this work');await cancel.getByRole('checkbox').check();await cancel.getByRole('button',{name:'Cancel Tracking',exact:true}).click();
  await expect(page.getByText('Tracking cancelled. Guest access has ended.',{exact:true})).toBeVisible();await expect(page.locator('.provider-shipment-summary')).toContainText('Cancelled');
  await expect(page.getByRole('region',{name:'Tracking recovery'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Tracking cancelled',exact:true})).toBeVisible();
  await expect(page.getByText('Tracking complete',{exact:true})).toHaveCount(0);
  await expect(page.getByLabel('Location privacy radius',{exact:true})).toHaveCount(0);await expect(page.getByText('Tracking truck or Driver reassigned',{exact:true})).toBeVisible();
  await page.screenshot({path:path.join(snapshots,`${info.project.name}-cancelled-history.png`),fullPage:true,scale:'css'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await guestPage.goto(guestUrl);await expect(guestPage.getByRole('heading',{name:'Shipment progress'})).toHaveCount(0);
  expect(checked(await service.from('provider_tracking_recoveries').select('id').eq('shipment_id',shipment.id))).toHaveLength(3);
 }finally{
  if(guest)await guest.close();
  if(shipmentId){checked(await service.from('provider_tracking_recoveries').delete().eq('shipment_id',shipmentId));checked(await service.from('access_email_deliveries').delete().eq('entity_id',shipmentId));checked(await service.from('audit_logs').delete().eq('entity_id',shipmentId));checked(await service.from('provider_shipments').delete().eq('id',shipmentId));}
  if(vehicles.length){checked(await service.from('audit_logs').delete().in('entity_id',vehicles));checked(await service.from('vehicles').delete().in('id',vehicles));}
  if(actor){checked(await service.from('audit_logs').delete().eq('entity_id',actor.provider_profile_id));checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));}
 }
});
