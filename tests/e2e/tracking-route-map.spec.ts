import {test,expect} from './browser-test';
import {auditDeleteVehicles,auditLogin,auditProof,auditProvider,auditTrackingOwnerLogin,checked,localAuditService} from './audit-helpers';
import {createProviderVehicle,updateFleetDriverAccess} from '../../src/lib/fleet.js';
import {createProviderShipment} from '../../src/lib/provider-tracking.js';
test.use({trace:'off',screenshot:'off'});

async function paintedBasemap(map:any){
  await expect.poll(()=>map.locator('.leaflet-container').evaluate((node:HTMLElement)=>{
    const bounds=node.getBoundingClientRect();
    const visible=Array.from(node.querySelectorAll<HTMLImageElement>('img.leaflet-tile')).filter(image=>{
      const tile=image.getBoundingClientRect();
      return tile.right>bounds.left&&tile.left<bounds.right&&tile.bottom>bounds.top&&tile.top<bounds.bottom;
    });
    return visible.length>0&&visible.every(image=>image.complete&&image.naturalWidth>0);
  }),{timeout:30000}).toBe(true);
}

test('Tracking keeps the saved route on its map without a location and hides terminal location',async({page}:{page:any},info:any)=>{
  test.setTimeout(120000);
  const service=localAuditService();let actor:any;let vehicleId='';let shipmentId='';
  try{
    actor=await auditProvider(service,'route-map');
    vehicleId=(await createProviderVehicle(actor,{useBasis:'OWNED',make:'Toyota',model:'Route test',plate:`TEST-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false})).id;
    expect(checked(await service.rpc('set_provider_driving_mode',{actor_user_id:actor.id,requested_drives_truck:true}))).toBe(true);
    await updateFleetDriverAccess(actor,actor.id,{vehicleId,canManageCapacity:true,canManageTracking:true});
    const city=async(name:string)=>checked(await service.from('place_catalog').select('id').eq('normalized_name',name).limit(1).single()).id;
    shipmentId=(await createProviderShipment(actor,{vehicleId,originPlaceRef:await city('addis ababa'),passingPlaceRef:await city('adama'),destinationPlaceRef:await city('dire dawa'),expectedDeliveryDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),cargoSummary:'Synthetic route map',customerEmail:`route-map-${actor.suffix}@example.test`,trackingMode:'LOCATION_AND_STATUS'})).id;
    await auditLogin(page,actor.email);await page.goto(`/app/provider-shipments/${shipmentId}`,{waitUntil:'domcontentloaded'});
    const map=page.getByTestId('tracking-map-workspace');
    await expect(map).toBeVisible();await expect(map.locator('[data-route-stop]')).toHaveCount(3);
    await expect(map.locator('.leaflet-container')).toBeVisible();await expect(map.locator('.tracking-truck-marker')).toHaveCount(0);
    await expect(map.getByRole('button',{name:/Shipment progress/})).toHaveAttribute('aria-expanded','false');
    await map.getByRole('button',{name:/Shipment progress/}).click();
    await expect(map.locator('.tracking-control-panel')).toBeVisible();
    await expect(map.locator('.tracking-journey li')).toHaveCount(5);
    await expect(map.locator('.tracking-progress-next')).toContainText('Going to pickup');
    await paintedBasemap(map);await page.screenshot({path:info.outputPath('tracking-route-only.png')});
    await map.getByRole('button',{name:/Shipment progress/}).click();
    checked(await service.from('provider_shipments').update({operational_status:'LOADING'}).eq('id',shipmentId));
    checked(await service.from('provider_shipment_events').insert({shipment_id:shipmentId,status:'LOADING',event_type:'LOCATION',location_area:'Synthetic reported area',location_lat:9.02,location_lng:38.76,location_precision_km:10,location_source:'DEVICE_OBSCURED',created_by:actor.id}));
    await page.reload({waitUntil:'domcontentloaded'});
    await expect(map.locator('.tracking-truck-marker')).toHaveCount(1);await expect(map.locator('[data-location-radius-km="10"]')).toBeVisible();
    await expect(map.locator('.tracking-approximate-circle')).toHaveAttribute('stroke','#7846a7');
    await map.getByRole('button',{name:'Open vehicle details'}).click();
    const truck=page.getByRole('dialog',{name:'Vehicle and driver'});await expect(truck).toBeVisible();
    await expect(truck).toContainText('Toyota');await expect(truck).not.toContainText(`TEST-${actor.suffix}`);
    await page.keyboard.press('Escape');await expect(truck).toHaveCount(0);
    await expect(map.getByRole('button',{name:'Open vehicle details'})).toBeFocused();
    await paintedBasemap(map);await page.screenshot({path:info.outputPath('tracking-route-location.png')});
    checked(await service.from('provider_shipments').update({operational_status:'COMPLETED',completed_at:new Date().toISOString()}).eq('id',shipmentId));
    await page.reload({waitUntil:'domcontentloaded'});await expect(map.locator('.leaflet-container')).toBeVisible();await expect(map.locator('.tracking-truck-marker')).toHaveCount(0);await expect(map.locator('[data-route-stop]')).toHaveCount(3);
    checked(await service.from('provider_shipments').update({passing:null,passing_place_ref:null,passing_lat:null,passing_lng:null}).eq('id',shipmentId));
    await page.reload({waitUntil:'domcontentloaded'});await expect(map.locator('[data-route-stop]')).toHaveCount(2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await paintedBasemap(map);await page.screenshot({path:info.outputPath('tracking-legacy-completed.png')});
  }finally{
    if(shipmentId){checked(await service.from('access_email_deliveries').delete().eq('entity_id',shipmentId));checked(await service.from('audit_logs').delete().eq('entity_id',shipmentId));checked(await service.from('provider_shipments').delete().eq('id',shipmentId));}
    if(vehicleId){checked(await service.from('audit_logs').delete().eq('entity_id',vehicleId));checked(await auditDeleteVehicles(service,'id',vehicleId));}
    if(actor){checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));}
  }
});

test('Tracking proof modal fetches authorized images and rechecks revoked access when reopened',async({page,browser}:{page:any;browser:any},info:any)=>{
  test.setTimeout(150000);
  const service=localAuditService();let actor:any;let vehicleId='';let shipmentId='';let proof:any;let guest:any;
  try{
    actor=await auditProvider(service,'proof-modal');
    vehicleId=(await createProviderVehicle(actor,{useBasis:'OWNED',make:'Toyota',model:'Proof modal',plate:`TEST-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false})).id;
    expect(checked(await service.rpc('set_provider_driving_mode',{actor_user_id:actor.id,requested_drives_truck:true}))).toBe(true);
    await updateFleetDriverAccess(actor,actor.id,{vehicleId,canManageCapacity:true,canManageTracking:true});
    const city=async(name:string)=>checked(await service.from('place_catalog').select('id').eq('normalized_name',name).limit(1).single()).id;
    const email=`proof-modal-${actor.suffix}@example.test`;
    shipmentId=(await createProviderShipment(actor,{vehicleId,originPlaceRef:await city('addis ababa'),passingPlaceRef:await city('adama'),destinationPlaceRef:await city('dire dawa'),expectedDeliveryDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),cargoSummary:'Synthetic proof modal',customerEmail:email,trackingMode:'STATUS_ONLY'})).id;
    proof=await auditProof(service,shipmentId);
    const event=checked(await service.from('provider_shipment_events').insert({shipment_id:shipmentId,status:'LOADING',event_type:'STATUS',note:'Synthetic loading photo',proof_storage_path:proof.path,proof_original_name:proof.originalName,proof_mime_type:proof.mimeType,created_by:actor.id}).select('id').single());
    await auditLogin(page,actor.email);await page.goto(`/app/provider-shipments/${shipmentId}`,{waitUntil:'domcontentloaded'});
    const open=page.getByRole('button',{name:'Open proof',exact:true});await expect(open).toBeEnabled();
    await open.click();const modal=page.getByRole('dialog',{name:'Shipment proof'});
    await expect(modal).toBeVisible();await expect(modal.getByRole('img',{name:'Shipment proof photo'})).toBeVisible();
    expect(await modal.getByRole('img').getAttribute('src')).toMatch(/^blob:/);
    await page.keyboard.press('Escape');await expect(modal).toHaveCount(0);await expect(open).toBeFocused();
    guest=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize(),extraHTTPHeaders:{'x-forwarded-for':'127.0.0.249'}});
    const owner=await guest.newPage();await auditTrackingOwnerLogin(owner,email);
    await owner.getByRole('button',{name:'Open proof',exact:true}).click();
    await expect(owner.getByRole('dialog').getByRole('img',{name:'Shipment proof photo'})).toBeVisible();
    await owner.getByRole('button',{name:'Close proof'}).click();
    checked(await service.from('provider_tracking_recipients').update({revoked_at:new Date().toISOString()}).eq('shipment_id',shipmentId).eq('recipient_email',email));
    expect((await guest.request.get(`/api/provider-shipments/${shipmentId}/proofs/${event.id}`)).status()).toBe(404);
    await owner.getByRole('button',{name:'Open proof',exact:true}).click();
    await expect(owner.getByRole('dialog').getByRole('alert')).toContainText('Proof is unavailable or access has expired.');
    await expect(owner.getByRole('dialog').getByRole('img')).toHaveCount(0);
    await owner.screenshot({path:info.outputPath('tracking-proof-denied.png')});
    await owner.getByRole('button',{name:'Close proof'}).click();
  }finally{
    // Playwright may already have closed the browser after a timeout. Keep the
    // original workflow failure; database and file cleanup below still fail hard.
    await guest?.close().catch(()=>{});
    if(proof){const path=proof.path.replace('supabase://shipment-proof/','');checked(await service.storage.from('shipment-proof').remove([path]));}
    if(shipmentId){checked(await service.from('access_email_deliveries').delete().eq('entity_id',shipmentId));checked(await service.from('audit_logs').delete().eq('entity_id',shipmentId));checked(await service.from('provider_shipments').delete().eq('id',shipmentId));}
    if(vehicleId){checked(await service.from('audit_logs').delete().eq('entity_id',vehicleId));checked(await auditDeleteVehicles(service,'id',vehicleId));}
    if(actor){checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));}
  }
});
