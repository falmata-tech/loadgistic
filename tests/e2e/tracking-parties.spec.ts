import {auditDeleteVehicles,auditProvider,auditTrackingOwnerLogin,checked,localAuditService} from './audit-helpers';
import {test,expect} from './browser-test';
import {localMailpitNumericCode} from './mailpit-helper';
import {createProviderVehicle,updateFleetDriverAccess} from '../../src/lib/fleet.js';
import {createProviderShipment} from '../../src/lib/provider-tracking.js';

async function invitationArrived(email:string,since:number){
 for(let attempt=0;attempt<60;attempt++){
  const inbox=await (await fetch('http://127.0.0.1:55324/api/v1/messages')).json();
  const message=(inbox.messages||[]).find((item:any)=>item.Subject==='Your Loadgistic tracking access'&&Date.parse(item.Created)>=since-2000&&item.To?.some((to:any)=>to.Address===email));
  if(message){
   const detail=await (await fetch(`http://127.0.0.1:55324/api/v1/message/${encodeURIComponent(message.ID)}`)).json();
   expect(String(detail.Text||'')).toContain('verify this email');return;
  }
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 throw new Error('The invited synthetic viewer did not receive a Tracking invitation.');
}

test('verified shipment owner invites a status-only viewer and can revoke access; provider cannot share',async({page,browser},info)=>{
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

  // A provider keeps the shipment workspace, but the retired add-party route
  // must not grant a second recipient or send an invitation.
  await page.goto('/login');const login=page.getByTestId('email-code-request-form');await login.getByLabel('Email',{exact:true}).fill(actor.email);
  const loginAt=Date.now();await login.getByRole('button',{name:'Email me a code'}).click();
  await page.getByLabel('Six-digit code',{exact:true}).fill(await localMailpitNumericCode(actor.email,loginAt,'Your Loadgistic sign-in code'));
  await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForURL(/\/app\/home/);
  const providerPage=await page.request.get(`/app/provider-shipments/${shipmentId}`);
  expect(providerPage.status()).toBe(200);
  expect(await providerPage.text()).not.toContain('Add tracking party');
  const retired=await page.request.post(`/api/provider-shipments/${shipmentId}/recipients`,{headers:{origin:baseURL,accept:'application/json'},
   form:{action:'ADD',email:viewerEmail}});
  expect(retired.status()).toBe(400);
  expect((await retired.json()).error).toContain('one shipment owner email');
  expect(checked(await service.from('provider_tracking_recipients').select('id').eq('shipment_id',shipmentId))).toHaveLength(1);

  const browserOptions={baseURL,viewport:page.viewportSize()!,isMobile:Boolean(info.project.use.isMobile),hasTouch:Boolean(info.project.use.hasTouch)};
  ownerContext=await browser.newContext({...browserOptions,extraHTTPHeaders:{'x-forwarded-for':'127.0.0.246'}});
  const owner=await ownerContext.newPage();await auditTrackingOwnerLogin(owner,ownerEmail);
  expect(new URL(owner.url()).pathname).toBe(`/track/${shipmentId}`);
  await expect(owner.locator('.tracking-truck-marker')).toHaveCount(1);
  await owner.getByRole('button',{name:'Share tracking'}).click();
  const sharing=owner.getByRole('dialog',{name:'Share tracking'});await expect(sharing).toBeVisible();
  await sharing.getByLabel('Viewer name').fill('Receiver desk');await sharing.getByLabel('Viewer email').fill(viewerEmail);
  const invitedAt=Date.now();const saved=owner.waitForResponse((response:any)=>response.url().endsWith(`/api/tracking/${shipmentId}/sharing`)&&response.request().method()==='POST');
  await sharing.getByRole('button',{name:'Send invitation'}).click();expect((await saved).status()).toBe(200);
  await expect(sharing.getByRole('status')).toContainText('Invitation sent');
  await expect(sharing.getByText('Receiver desk')).toBeVisible();
  await expect(sharing.getByLabel('Viewer email')).toHaveValue('');
  const recipient=checked(await service.from('provider_tracking_recipients').select('id,revoked_at,shared_by_recipient_id,created_by')
   .eq('shipment_id',shipmentId).eq('recipient_email',viewerEmail).single());
  const ownerRecipient=checked(await service.from('provider_tracking_recipients').select('id').eq('shipment_id',shipmentId).eq('recipient_email',ownerEmail).single());
  expect(recipient).toMatchObject({revoked_at:null,shared_by_recipient_id:ownerRecipient.id,created_by:null});
  expect(checked(await service.from('provider_tracking_recipients').select('id').eq('shipment_id',shipmentId))).toHaveLength(2);

  // A duplicate remains a recoverable inline error and does not queue a new recipient.
  await sharing.getByLabel('Viewer name').fill('Receiver desk');await sharing.getByLabel('Viewer email').fill(viewerEmail);
  await sharing.getByRole('button',{name:'Send invitation'}).click();
  await expect(sharing.getByRole('alert')).toContainText('already has access');
  await expect(sharing.getByRole('button',{name:'Send invitation'})).toBeEnabled();
  expect(checked(await service.from('provider_tracking_recipients').select('id').eq('shipment_id',shipmentId))).toHaveLength(2);
  await invitationArrived(viewerEmail,invitedAt);

  viewerContext=await browser.newContext({...browserOptions,extraHTTPHeaders:{'x-forwarded-for':'127.0.0.247'}});
  const viewer=await viewerContext.newPage();await auditTrackingOwnerLogin(viewer,viewerEmail);
  expect(new URL(viewer.url()).pathname).toBe(`/track/${shipmentId}`);
  await expect(viewer.locator('[data-route-stop]')).toHaveCount(3);
  await expect(viewer.locator('.tracking-truck-marker')).toHaveCount(0);
  await expect(viewer.getByRole('button',{name:'Share tracking'})).toHaveCount(0);
  await expect(viewer.getByRole('button',{name:'Approve unloading'})).toHaveCount(0);
  const viewerHtml=await viewerContext.request.get(`/track/${shipmentId}`);
  expect(viewerHtml.status()).toBe(200);
  const html=await viewerHtml.text();
  expect(html).not.toContain('Synthetic owner-only area');
  expect(html).not.toContain('location_precision_km');
  expect((await viewerContext.request.get(`/api/tracking/${shipmentId}/sharing`)).status()).toBe(403);
  expect(checked(await service.from('profiles').select('id').eq('email',viewerEmail))).toHaveLength(0);

  const strangerEmail=`unapproved-${actor.suffix}@example.test`;
  const stranger=await viewerContext.request.post('/api/tracking/otp',{headers:{origin:baseURL},form:{email:strangerEmail}});
  expect(stranger.status()).toBe(200);
  expect(checked(await service.from('access_email_deliveries').select('id').eq('recipient_email',strangerEmail))).toHaveLength(0);
  await sharing.getByRole('button',{name:'Remove viewer: Receiver desk'}).click();
  await expect(sharing.getByRole('status')).toContainText('Sharing updated');
  await expect(sharing.getByText('Receiver desk')).toHaveCount(0);
  expect(checked(await service.from('provider_tracking_recipients').select('revoked_at').eq('id',recipient.id).single()).revoked_at).not.toBeNull();
  await viewer.reload();await expect(viewer).toHaveURL(/\/track\?error=/,{timeout:15000});
  await expect(viewer.getByText('No shipments are currently shared with this email.',{exact:true})).toBeVisible({timeout:15000});
 }finally{
  await viewerContext?.close();await ownerContext?.close();
  if(shipmentId){checked(await service.from('access_email_deliveries').delete().eq('entity_id',shipmentId));checked(await service.from('audit_logs').delete().eq('entity_id',shipmentId));checked(await service.from('provider_shipments').delete().eq('id',shipmentId));}
  if(vehicleId){checked(await service.from('audit_logs').delete().eq('entity_id',vehicleId));checked(await auditDeleteVehicles(service,'id',vehicleId));}
  if(actor){checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));}
 }
});
