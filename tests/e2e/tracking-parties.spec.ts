import {createRegisteredTrackingShipment as createProviderShipment,cleanupTrackingOwnerFixtures,openTrackingFixtureLink} from './tracking-session-fixtures';
import {auditDeleteVehicles,auditLogin,auditProvider,auditTrackingOwnerLogin,checked,localAuditService} from './audit-helpers';
import {test,expect} from './browser-test';
import {createProviderVehicle,updateFleetDriverAccess} from '../../src/lib/fleet.js';


test.use({actionTimeout:15_000,trace:'off',screenshot:'off'});

test('registered owner shares one load by link and code; guests cannot gain owner actions and revocation ends access',async({page,browser},info)=>{
 test.setTimeout(180000);
 const baseURL=info.project.use.baseURL;if(!baseURL)throw Error('LOCAL_BROWSER_BASE_URL_REQUIRED');
 const service=localAuditService();let actor:any;let vehicleId='';let shipmentId='';let ownerContext:any;let viewerContext:any;
 try{
  actor=await auditProvider(service,'party-audit');
  vehicleId=(await createProviderVehicle(actor,{useBasis:'OWNED',make:'Toyota',model:'Party test',plate:`TEST-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false})).id;
  expect(checked(await service.rpc('set_provider_driving_mode',{actor_user_id:actor.id,requested_drives_truck:true}))).toBe(true);
  await updateFleetDriverAccess(actor,actor.id,{vehicleId,canManageCapacity:true,canManageTracking:true});
  const city=async(name:string)=>checked(await service.from('place_catalog').select('id').eq('normalized_name',name).limit(1).single()).id;
  const ownerEmail=`owner-${actor.suffix}@example.test`,viewerEmail=`viewer-${actor.suffix}@example.test`;
  shipmentId=(await createProviderShipment(actor,{expectedDeliveryDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),vehicleId,
   originPlaceRef:await city('addis ababa'),passingPlaceRef:await city('adama'),destinationPlaceRef:await city('dire dawa'),
   cargoSummary:'Synthetic owner sharing verification',customerEmail:ownerEmail,trackingMode:'LOCATION_AND_STATUS'})).id;
  checked(await service.from('provider_shipment_events').insert({shipment_id:shipmentId,status:'CREATED',event_type:'LOCATION',
   location_area:'Synthetic owner-only area',location_lat:9.02,location_lng:38.76,location_precision_km:3,
   location_source:'DEVICE_OBSCURED',created_by:actor.id}));

  // Email invitations stay retired; per-load sharing does not add recipients.
  await auditLogin(page,actor.email);
  const retired=await page.request.post(`/api/provider-shipments/${shipmentId}/recipients`,{headers:{origin:baseURL,accept:'application/json'},form:{action:'ADD',email:viewerEmail}});
  expect(retired.status()).toBe(400);
  expect(checked(await service.from('provider_tracking_recipients').select('id').eq('shipment_id',shipmentId))).toHaveLength(1);
  const browserOptions={baseURL,viewport:page.viewportSize()!,isMobile:Boolean(info.project.use.isMobile),hasTouch:Boolean(info.project.use.hasTouch)};
  ownerContext=await browser.newContext({...browserOptions,extraHTTPHeaders:{'x-forwarded-for':'127.0.0.246'}});
  const owner=await ownerContext.newPage(),session=await auditTrackingOwnerLogin(owner,ownerEmail,shipmentId);
  expect(new URL(owner.url()).pathname).toBe(`/app/tracking/${session.id}`);
  await expect(owner.getByLabel('Viewer email')).toHaveCount(0);
  await owner.getByLabel('Link expiry',{exact:true}).selectOption('1');
  const issued=owner.waitForResponse((response:any)=>new URL(response.url()).pathname===`/api/tracking/sessions/${session.id}/links`&&response.request().method()==='POST');
  await owner.getByRole('button',{name:'Create Tracking link',exact:true}).click();
  const issuedResponse=await issued;expect(issuedResponse.status()).toBe(201);const link=(await issuedResponse.json()).data.link;
  await expect(owner.getByLabel('Tracking link',{exact:true})).toHaveValue(link.url);
  await expect(owner.getByLabel('Tracking code',{exact:true})).toHaveValue(link.code);
  expect(link.allowLocation).toBe(false);
  viewerContext=await browser.newContext({...browserOptions,extraHTTPHeaders:{'x-forwarded-for':'127.0.0.247'}});
  const viewer=await viewerContext.newPage();await viewer.goto(new URL(link.url).pathname);
  await expect(viewer.getByLabel('Email',{exact:true})).toHaveCount(0);
  const wrongCode=link.code==='0000-0000'?'1111-1111':'0000-0000';
  const wrong=await viewerContext.request.post('/api/tracking/access',{data:{linkToken:new URL(link.url).pathname.split('/').at(-1),code:wrongCode}});
  expect(wrong.status()).toBe(401);expect(JSON.stringify(await wrong.json())).not.toContain(shipmentId);
  const shared=await openTrackingFixtureLink(viewer,link);
  expect(shared.id).toBe(session.id);expect(shared.tracking.shipmentId).toBe(shipmentId);expect(shared.tracking.location).toBeNull();
  expect(shared.tracking.events.every((event:any)=>!event.hasProof)).toBe(true);
  await expect(viewer.locator('[data-route-stop]')).toHaveCount(3);
  await expect(viewer.locator('.tracking-truck-marker')).toHaveCount(0);
  for(const name of['Create Tracking link','Revoke link','Approve unloading','Open proof','Publish review'])await expect(viewer.getByRole('button',{name,exact:true})).toHaveCount(0);
  for(const [suffix,body]of[['/approve',{}],['/review',{rating:5,note:'Forbidden guest review',termsAccepted:true}],['/links',{expiresInDays:1,allowLocation:false}],['/sharing',{action:'DETACH_BUSINESS',expectedRevision:0}]]as const){
   const denied=await viewerContext.request.post(`/api/tracking/sessions/${session.id}${suffix}`,{data:body});expect(denied.status()).toBe(401);
  }
  expect((await viewerContext.request.get(`/api/tracking/sessions/${session.id}?view=manager`)).status()).toBe(401);
  expect(checked(await service.from('profiles').select('id').eq('email',viewerEmail))).toHaveLength(0);
  expect(checked(await service.from('access_email_deliveries').select('id').eq('recipient_email',viewerEmail))).toHaveLength(0);
  const removed=owner.waitForResponse((response:any)=>new URL(response.url()).pathname===`/api/tracking/sessions/${session.id}/links`&&response.request().method()==='DELETE');
  await owner.getByRole('button',{name:'Revoke link',exact:true}).click();expect((await removed).status()).toBe(200);
  const managerRead=await owner.request.get(`/api/tracking/sessions/${session.id}?view=manager`);expect(managerRead.status()).toBe(200);
  expect((await managerRead.json()).data.links.find((saved:any)=>saved.id===link.id).revokedAt).not.toBeNull();
  const refreshed=viewer.waitForResponse((response:any)=>new URL(response.url()).pathname===`/api/tracking/sessions/${session.id}`);
  await viewer.getByRole('button',{name:'Refresh updates',exact:true}).click();expect((await refreshed).status()).toBe(401);
  const ended=viewer.getByRole('status').filter({hasText:'Tracking access ended. Open the link and enter its code again.'});
  await expect(ended).toBeVisible();
  await expect(ended.getByRole('button',{name:'Enter code again',exact:true})).toBeVisible();
  await expect(viewer.locator('.tracking-truck-marker')).toHaveCount(0);
  expect((await viewerContext.request.post('/api/tracking/access',{data:{linkToken:new URL(link.url).pathname.split('/').at(-1),code:link.code}})).status()).toBe(401);
  // Expiry boundaries are exercised by the exact-clock grant unit cases and
  // isolated native SQL fixtures; private link tables have no service REST ACL.
  expect(checked(await service.from('provider_tracking_recipients').select('id').eq('shipment_id',shipmentId))).toHaveLength(1);
 }finally{
  await viewerContext?.close();await ownerContext?.close();
  if(shipmentId){checked(await service.from('access_email_deliveries').delete().eq('entity_id',shipmentId));checked(await service.from('audit_logs').delete().eq('entity_id',shipmentId));checked(await service.from('provider_shipments').delete().eq('id',shipmentId));}
  if(vehicleId){checked(await service.from('audit_logs').delete().eq('entity_id',vehicleId));checked(await auditDeleteVehicles(service,'id',vehicleId));}
  if(actor){checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));}
 }
});

// Only newly created local SHIPPER fixtures are removed after shipment/proof cleanup.
test.afterEach(async()=>{await cleanupTrackingOwnerFixtures();});
