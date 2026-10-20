import {auditDeleteVehicles} from './audit-helpers';
import {test,expect as baseExpect} from './browser-test';
// Native form redirects stream a loading shell before their final outcome.
// These are workflow assertions; the unchanged scale suite owns latency limits.
const expect=baseExpect.configure({timeout:20000});
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {localAuditService,checked,auditLogin,auditProvider,auditFleetProvider,auditFleetDriver,auditOpenTrackingProgress} from './audit-helpers';
import {createProviderVehicle} from '../../src/lib/fleet.js';
import {createProviderShipment,updateProviderShipmentStatus} from '../../src/lib/provider-tracking.js';
import {localMailpitNumericCode} from './mailpit-helper';

test('owners and Operations recover Tracking, preserve history and retire trucks safely',async({page,browser}:{page:any;browser:any},info:any)=>{
 test.setTimeout(180000);page.setDefaultTimeout(20000);const service=localAuditService();let actor:any;const vehicles:string[]=[];const drivers:any[]=[];let shipmentId='';let guest:any;
 const snapshots=path.dirname(info.outputPath('lifecycle-state.png'));mkdirSync(snapshots,{recursive:true});
 const diagnostics={stage:'SETUP',errorClass:'',otpStatus:0,activeOwnerRecipients:0,activeShipperGrants:0,challengeStored:false,outbox:[] as {status:string;attempts:number}[]};let challengeId='';
 function phase(stage:string){diagnostics.stage=stage;writeFileSync(info.outputPath('lifecycle-diagnostics.json'),JSON.stringify(diagnostics,null,2)+'\n');}
 try{
  actor=await auditFleetProvider(service,'lifecycle');
  for(const name of ['First','Replacement']){const vehicle=await createProviderVehicle(actor,{useBasis:'OWNED',make:'Toyota',model:name,plate:`${name}-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false});vehicles.push(vehicle.id);drivers.push(await auditFleetDriver(service,actor,vehicle.id));}
  const origin=checked(await service.from('place_catalog').select('id').eq('normalized_name','addis ababa').limit(1).single());
  const destination=checked(await service.from('place_catalog').select('id').eq('normalized_name','adama').limit(1).single());
  const email=`lifecycle-guest-${randomUUID()}@example.test`;
  const shipment=await createProviderShipment(actor,{expectedDeliveryDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),vehicleId:vehicles[0],originPlaceRef:origin.id,destinationPlaceRef:destination.id,passingPlaceRef:checked(await service.from('place_catalog').select('id').eq('normalized_name','dire dawa').limit(1).single()).id,cargoSummary:'Original audit cargo',customerEmail:email,trackingMode:'LOCATION_AND_STATUS'});shipmentId=shipment.id;
  await updateProviderShipmentStatus(drivers[0],shipment.id,'TO_PICKUP','Travelling to pickup',null,{locationArea:'Around Addis Ababa',approximateLat:'9',approximateLng:'38.7',locationPrecisionKm:'10',locationSource:'DEVICE_OBSCURED'});
  phase('PROVIDER_CORRECTION');await auditLogin(page,actor.email);await page.goto(`/app/provider-shipments/${shipment.id}`);
  await page.getByRole('button',{name:'Edit details',exact:true}).click();const correction=page.getByRole('dialog',{name:'Correct Tracking details',exact:true});
  await correction.getByRole('textbox',{name:'Cargo summary',exact:true}).fill('Corrected audit cargo');await correction.getByLabel('Reason',{exact:true}).fill('Correct the agreed cargo description');
  await correction.getByRole('button',{name:'Save correction'}).click();await expect(page.getByText('Tracking updated. Earlier events are retained.',{exact:true})).toBeVisible();
  await expect(page.locator('.provider-shipment-summary')).toContainText('Corrected audit cargo');
  phase('ACTIVE_RETIREMENT_DENIED');await page.goto(`/app/fleet/${vehicles[0]}`);await page.getByRole('link',{name:'Vehicle details',exact:true}).click();await page.getByRole('button',{name:'Retire vehicle',exact:true}).click();const retirement=page.getByRole('dialog',{name:'Retire vehicle',exact:true});
  await retirement.getByLabel('Reason',{exact:true}).fill('Truck should leave service');await retirement.getByRole('checkbox').check();await retirement.getByRole('button',{name:'Retire vehicle',exact:true}).click();
  // Wait for the streamed workspace after the denied POST redirects; the
  // loading shell is not the completed retirement response.
  await expect(page.getByText('Resolve active Tracking before changing or retiring this vehicle.',{exact:true})).toBeVisible({timeout:20000});
  expect(checked(await service.from('vehicles').select('active').eq('id',vehicles[0]).single()).active).toBe(true);
  phase('GUEST_SCOPE');diagnostics.activeOwnerRecipients=checked(await service.from('provider_tracking_recipients').select('id').eq('shipment_id',shipment.id).eq('recipient_email',email).eq('recipient_role','OWNER').is('revoked_at',null)).length;
  diagnostics.activeShipperGrants=checked(await service.from('shipment_party_grants').select('id').eq('shipment_id',shipment.id).eq('party_role','SHIPPER').is('revoked_at',null)).length;
  expect(diagnostics.activeOwnerRecipients).toBe(1);expect(diagnostics.activeShipperGrants).toBe(1);
  guest=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize(),extraHTTPHeaders:{'x-forwarded-for':'127.0.0.247'}});const guestPage=await guest.newPage();
  await guestPage.goto('/track');await guestPage.getByLabel('Email',{exact:true}).fill(email);
  phase('GUEST_CODE_REQUEST');const requestedAt=Date.now();const sent=guestPage.waitForResponse((response:any)=>new URL(response.url()).pathname==='/api/tracking/otp'&&response.request().method()==='POST',{timeout:20000});await guestPage.getByRole('button',{name:'Email me a code',exact:true}).click();const response=await sent;diagnostics.otpStatus=response.status();expect(response.status()).toBe(200);
  const payload=await response.json();challengeId=typeof payload.challengeId==='string'&&/^[a-f0-9-]{36}$/.test(payload.challengeId)?payload.challengeId:'';expect(Boolean(challengeId)).toBe(true);
  diagnostics.challengeStored=checked(await service.from('provider_tracking_email_otps').select('id').eq('id',challengeId)).length===1;expect(diagnostics.challengeStored).toBe(true);
  diagnostics.outbox=checked(await service.from('access_email_deliveries').select('status,attempts').eq('entity_id',challengeId)).map((row:any)=>({status:['QUEUED','FAILED','SENT'].includes(row.status)?row.status:'OTHER',attempts:row.attempts}));
  phase('GUEST_CODE_DELIVERY');await expect(guestPage.getByLabel('6-digit email code')).toBeVisible();await guestPage.getByLabel('6-digit email code').fill(await localMailpitNumericCode(email,requestedAt,'Your Loadgistic tracking sign-in code'));
  phase('GUEST_CODE_VERIFY');await guestPage.getByRole('button',{name:'Open tracking',exact:true}).click();await expect(guestPage.getByRole('button',{name:'Shipment progress',exact:true})).toBeVisible({timeout:30000});
  const guestUrl=guestPage.url();
  phase('OPERATIONS_MAP');await auditLogin(page,'admin@loadgistic.local');await page.goto(`/admin/operations/tracking/${shipment.id}`);
  await expect(page.locator('.tracking-reported-area')).toContainText('Around Addis Ababa');await expect(page.locator('.tracking-reported-area')).toHaveAttribute('data-location-radius-km','10');await expect(page.locator('.leaflet-container')).toBeVisible();await expect(page.locator('.tracking-approximate-circle')).toHaveCount(1);await expect(page.locator('[data-route-stop]')).toHaveCount(3);
  await page.screenshot({path:path.join(snapshots,`${info.project.name}-admin-map.png`),fullPage:true,scale:'css'});
  const replacement=checked(await service.from('vehicles').select('platform_number').eq('id',vehicles[1]).single());
  phase('OPERATIONS_REASSIGN');await page.getByRole('button',{name:'Change vehicle',exact:true}).click();const reassign=page.getByRole('dialog',{name:'Reassign Tracking',exact:true});
  await reassign.getByLabel('Replacement vehicle number').fill(replacement.platform_number);await reassign.getByLabel('Reason',{exact:true}).fill('The replacement truck takes over');
  await reassign.getByRole('button',{name:'Save reassignment'}).click();await expect(page.getByText('Tracking updated. Earlier events are retained.',{exact:true})).toBeVisible();
  await expect(page.locator('.tracking-reported-area')).toHaveCount(0);await expect(page.locator('.tracking-truck-marker')).toHaveCount(0);
  expect(checked(await service.from('provider_shipments').select('assigned_vehicle_id').eq('id',shipment.id).single()).assigned_vehicle_id).toBe(vehicles[1]);
  await guestPage.reload();await expect(guestPage.getByRole('button',{name:'Shipment progress',exact:true})).toBeVisible();await expect(guestPage.locator('.tracking-reported-area')).toHaveCount(0);await expect(guestPage.locator('.tracking-truck-marker')).toHaveCount(0);
  // Correct a synthetic workspace through the Customers permission boundary.
  phase('CUSTOMER_CORRECTION');await page.goto(`/admin/operations/workspaces/${actor.organization_id}?kind=ORGANIZATION`);
  await page.getByRole('button',{name:'Edit business name',exact:true}).click();await page.getByLabel('Business name',{exact:true}).fill(`Corrected audit business ${actor.suffix}`);await page.getByLabel('Reason',{exact:true}).fill('Correct the business display name');
  await page.getByRole('button',{name:'Save business name'}).click();await expect(page.getByText('Business name corrected.',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:`Corrected audit business ${actor.suffix}`,exact:true})).toBeVisible();
  await page.screenshot({path:path.join(snapshots,`${info.project.name}-workspace-correction.png`),fullPage:true,scale:'css'});
  phase('RETIRED_TRUCK_RESTORE');await auditLogin(page,actor.email);await page.goto(`/app/fleet/${vehicles[0]}`);await page.getByRole('link',{name:'Vehicle details',exact:true}).click();await page.getByRole('button',{name:'Retire vehicle',exact:true}).click();await retirement.getByLabel('Reason',{exact:true}).fill('Retire the replaced truck');await retirement.getByRole('checkbox').check();await retirement.getByRole('button',{name:'Retire vehicle',exact:true}).click();
  await expect(page.getByText('Vehicle retired. Its history is retained.',{exact:true})).toBeVisible();
  await page.getByRole('link',{name:/^Retired vehicles/}).click();const retired=page.getByRole('region',{name:'Retired vehicles'});await retired.getByText('Restore vehicle',{exact:true}).first().click();
  const restore=page.getByRole('dialog',{name:'Restore vehicle',exact:true});await restore.getByLabel('Reason',{exact:true}).fill('Return this truck to service');await restore.getByRole('checkbox').check();await restore.getByRole('button',{name:'Restore vehicle',exact:true}).click();
  await expect(page.getByText('Vehicle restored. Assign a Driver and publish fresh capacity when ready.',{exact:true})).toBeVisible();
  const last=checked(await service.from('capacities').select('market_status').eq('vehicle_id',vehicles[0]).order('updated_at',{ascending:false}).limit(1).single());expect(last.market_status).toBe('OFF_DUTY');
  phase('PROVIDER_CANCEL_DENIED');await page.goto(`/app/provider-shipments/${shipment.id}`);const cancel=page.getByRole('dialog',{name:'Cancel Tracking',exact:true});await expect(page.getByRole('button',{name:'Cancel Tracking',exact:true})).toHaveCount(0);
  const current=checked(await service.from('provider_shipments').select('updated_at').eq('id',shipment.id).single());
  const deniedCancel=await page.request.post(`/api/provider-shipments/${shipment.id}/recovery`,{form:{action:'CANCEL',confirm:'CANCEL',reason:'The customer cancelled this work',revision:current.updated_at},maxRedirects:0});
  expect(deniedCancel.status()).toBe(303);expect(new URL(deniedCancel.headers().location).searchParams.get('error')).toBe('Ask the team to review and release this agreed tracking session.');
  expect(checked(await service.from('provider_shipments').select('operational_status').eq('id',shipment.id).single()).operational_status).not.toBe('CANCELLED');
  phase('INVESTIGATED_CANCEL');await auditLogin(page,'admin@loadgistic.local');await page.goto(`/admin/operations/tracking/${shipment.id}`);await page.getByRole('button',{name:'Cancel Tracking',exact:true}).click();
  await cancel.getByLabel('Reason',{exact:true}).fill('Investigated and confirmed the customer cancellation');await cancel.getByRole('checkbox').check();await cancel.getByRole('button',{name:'Cancel Tracking',exact:true}).click();
  await expect(page.getByText('Tracking cancelled. Guest access has ended.',{exact:true})).toBeVisible({timeout:20000});
  await auditLogin(page,actor.email);await page.goto(`/app/provider-shipments/${shipment.id}`);await expect(page.locator('.provider-shipment-summary')).toContainText('Cancelled');
  await expect(page.getByRole('region',{name:'Tracking recovery'})).toHaveCount(0);
  await auditOpenTrackingProgress(page);
  await expect(page.getByRole('heading',{name:'Tracking cancelled',exact:true})).toBeVisible();
  await expect(page.getByText('Tracking complete',{exact:true})).toHaveCount(0);
  await expect(page.getByLabel('Location privacy radius',{exact:true})).toHaveCount(0);await expect(page.getByText('Tracking truck or Driver reassigned',{exact:true})).toBeVisible();
  await page.screenshot({path:path.join(snapshots,`${info.project.name}-cancelled-history.png`),fullPage:true,scale:'css'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  phase('GUEST_REVOCATION');await guestPage.goto(guestUrl);await expect(guestPage.getByRole('button',{name:'Shipment progress',exact:true})).toHaveCount(0);
  expect(checked(await service.from('provider_tracking_recoveries').select('id').eq('shipment_id',shipment.id))).toHaveLength(3);
  phase('COMPLETE');
 }catch(error){const name=error instanceof Error?error.name:'';diagnostics.errorClass=['Error','TimeoutError','AssertionError','TypeError'].includes(name)?name:'OTHER';phase(diagnostics.stage);throw Error('TRACKING_LIFECYCLE_FAILED '+diagnostics.stage);}
 finally{
  if(guest)await guest.close();
  if(challengeId)checked(await service.from('access_email_deliveries').delete().eq('entity_id',challengeId).eq('delivery_kind','TRACKING_OTP'));
  if(shipmentId){checked(await service.from('provider_tracking_recoveries').delete().eq('shipment_id',shipmentId));checked(await service.from('access_email_deliveries').delete().eq('entity_id',shipmentId));checked(await service.from('audit_logs').delete().eq('entity_id',shipmentId));checked(await service.from('provider_shipments').delete().eq('id',shipmentId));}
  if(vehicles.length){checked(await service.from('audit_logs').delete().in('entity_id',vehicles));checked(await auditDeleteVehicles(service,'id',vehicles));}
  if(actor){checked(await service.from('audit_logs').delete().eq('entity_id',actor.organization_id));checked(await service.from('audit_logs').delete().in('actor_user_id',[actor.id,...drivers.map(driver=>driver.id)]));for(const driver of drivers)checked(await service.auth.admin.deleteUser(driver.id));checked(await service.auth.admin.deleteUser(actor.id));checked(await service.from('organizations').delete().eq('id',actor.organization_id));}
 }
});
