import {test,expect} from './browser-test';
import type {Page} from 'playwright-core';
import {auditProvider,auditProof,auditDeleteVehicles,checked,localAuditService} from './audit-helpers';
import {localMailpitNumericCode} from './mailpit-helper';
import {createProviderVehicle} from '../../src/lib/fleet.js';
import {createProviderShipment} from '../../src/lib/provider-tracking.js';

// Actual Expo browser UI + local API/Auth/Storage; not installed Android evidence.
// Keep email codes and tokens out of automatic traces and failure captures.
test.use({trace:'off',screenshot:'off'});
const preview='http://localhost:8084';
type PreviewInfo={project:{name:string};outputPath:(name:string)=>string};
async function fixture(prefix:string,mode='STATUS_ONLY'){
 const service=localAuditService(),actor=await auditProvider(service,prefix);
 let vehicle='',shipment='',proof:any;
 const email=`${prefix}-${actor.suffix}@example.test`;
 const cleanup=async()=>{
  if(proof)checked(await service.storage.from('shipment-proof').remove([proof.path.replace('supabase://shipment-proof/','')]));
  checked(await service.from('access_email_deliveries').delete().eq('recipient_email',email));
  if(shipment){checked(await service.from('access_email_deliveries').delete().eq('entity_id',shipment));checked(await service.from('audit_logs').delete().eq('entity_id',shipment));checked(await service.from('provider_shipments').delete().eq('id',shipment));}
  if(vehicle){checked(await service.from('audit_logs').delete().eq('entity_id',vehicle));checked(await auditDeleteVehicles(service,'id',vehicle));}
  checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));
 };
 try{
  checked(await service.from('company_pages').update({published:true,contact_phone:'+251900000000',show_contact_phone:true}).eq('provider_profile_id',actor.provider_profile_id));
  vehicle=(await createProviderVehicle(actor,{useBasis:'OWNED',make:'Native map',model:'Synthetic truck',plate:`NMAP-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false})).id;
  const city=async(name:string)=>checked(await service.from('place_catalog').select('id').eq('normalized_name',name).limit(1).single()).id;
  const routeRefs={originPlaceRef:await city('addis ababa'),passingPlaceRef:await city('adama'),destinationPlaceRef:await city('dire dawa')};
  shipment=(await createProviderShipment(actor,{vehicleId:vehicle,...routeRefs,expectedDeliveryDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),cargoSummary:'Synthetic native Tracking map',customerEmail:email,trackingMode:mode})).id;
  return{service,actor,email,vehicle,routeRefs,shipment,cleanup,async attachProof(){proof=await auditProof(service,shipment);return proof;}};
 }catch(error){await cleanup();throw error;}
}
async function providerLogin(page:Page,email:string){
 await page.goto(preview+'/account');await page.getByLabel('Email',{exact:true}).fill(email);
 const since=Date.now();await page.getByRole('button',{name:'Send code',exact:true}).click();
 await page.getByLabel('Sign-in code',{exact:true}).fill(await localMailpitNumericCode(email,since,'Your Loadgistic sign-in code'));
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('button',{name:'Update capacity',exact:true})).toBeVisible({timeout:30000});
}
async function visitorLogin(page:Page,email:string){
 await page.goto(preview+'/about');await page.getByRole('tab',{name:'Track',exact:true}).click();
 await page.getByLabel('Your email',{exact:true}).fill(email);const since=Date.now();
 await page.getByRole('button',{name:'Send email code',exact:true}).click();
 await page.getByLabel('Email verification code',{exact:true}).fill(await localMailpitNumericCode(email,since,'Your Loadgistic tracking sign-in code'));
 await page.getByRole('button',{name:'Open private access',exact:true}).click();
 await page.getByRole('link',{name:'View updates',exact:true}).click();
}
test('Expo phone Tracking uses a route-first map, existing progress and public contact modal that closes before profile navigation',async({page}:{page:Page},info:PreviewInfo)=>{
 test.skip(info.project.name!=='mobile-chromium','Phone Expo browser workflow');test.setTimeout(150000);
 const data=await fixture('native-map-provider');
 let authorization='';
 page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/mobile/')&&request.headers().authorization)authorization=request.headers().authorization;});
 try{
  await providerLogin(page,data.actor.email);
  const legacy={vehicleId:data.vehicle,originPlaceRef:data.routeRefs.originPlaceRef,destinationPlaceRef:data.routeRefs.destinationPlaceRef,cargoSummary:'Synthetic older client route',customerEmail:data.email,expectedDeliveryDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),trackingMode:'STATUS_ONLY'};
  const unauthorized=await page.request.post(preview+'/api/mobile/shipments',{data:legacy});expect(unauthorized.status()).toBe(401);
  expect(Boolean(authorization)).toBe(true);
  const oldCreate=await page.request.post(preview+'/api/mobile/shipments',{headers:{Authorization:authorization},data:legacy});expect(oldCreate.status()).toBe(409);
  const rejection=await oldCreate.json();expect(rejection.error.code).toBe('UPDATE_REQUIRED');expect(rejection.error.message).toContain('loadgistic.com');
  const invalidRoute=await page.request.post(preview+'/api/mobile/shipments',{headers:{Authorization:authorization},data:{...legacy,passingPlaceRef:legacy.originPlaceRef}});expect(invalidRoute.status()).toBe(400);expect((await invalidRoute.json()).error.code).toBe('INVALID_INPUT');
  expect(checked(await data.service.from('provider_shipments').select('id').eq('provider_profile_id',data.actor.provider_profile_id))).toHaveLength(1);
  await page.goto(`${preview}/shipment-detail?id=${data.shipment}`);
  const open=page.getByRole('button',{name:'Open shipment progress',exact:true});await expect(open).toBeVisible();
  await expect(page.locator('[data-marker-id^="tracking-city-"]')).toHaveCount(3);
  await expect(page.locator('[data-marker-id="tracking-reported-truck"]')).toHaveCount(0);
  const frame=await page.getByTestId('tracking-native-map-workspace').locator('.maplibregl-map').boundingBox();expect(frame?.height).toBeGreaterThan(page.viewportSize()!.height*.55);
  await open.click();await expect(page.getByRole('radio')).toHaveCount(5);await expect(page.getByText('Synthetic native Tracking map',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close shipment progress',exact:true}).click();
  await page.getByRole('button',{name:'Vehicle details',exact:true}).last().click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog).toContainText('Native map');
  await expect(dialog).not.toContainText(`NMAP-${data.actor.suffix}`);await expect(dialog).not.toContainText(`Audit Driver ${data.actor.suffix}`);
  await expect(dialog.getByRole('link',{name:/Call driver/})).toHaveAttribute('href','tel:+251900000000');
  await page.screenshot({path:info.outputPath('native-tracking-public-truck.png')});
  await dialog.getByRole('link',{name:'Profile',exact:true}).click();await expect(page).toHaveURL(/\/transporter\?/);await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goBack();await expect(page.getByRole('button',{name:'Open shipment progress',exact:true})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({path:info.outputPath('native-tracking-route-only.png')});
 }finally{await data.cleanup();}
});
test('Expo phone verified Tracking shows only reported radius and opens private photo proof with revocation denial',async({page}:{page:Page},info:PreviewInfo)=>{
 test.skip(info.project.name!=='mobile-chromium','Phone Expo browser workflow');test.setTimeout(150000);
 const data=await fixture('native-map-viewer','LOCATION_AND_STATUS');
 try{
  const proof=await data.attachProof();
  checked(await data.service.from('provider_shipments').update({operational_status:'LOADING'}).eq('id',data.shipment));
  checked(await data.service.from('provider_shipment_events').insert([{shipment_id:data.shipment,status:'LOADING',event_type:'STATUS',note:'Synthetic private loading photo',proof_storage_path:proof.path,proof_original_name:proof.originalName,proof_mime_type:proof.mimeType,created_by:data.actor.id},{shipment_id:data.shipment,status:'LOADING',event_type:'LOCATION',note:'Synthetic obscured center',location_area:'Synthetic reported area',location_lat:9.02,location_lng:38.76,location_precision_km:3,location_source:'DEVICE_OBSCURED',created_by:data.actor.id}]));
  await visitorLogin(page,data.email);
  await expect(page.locator('[data-marker-id^="tracking-city-"]')).toHaveCount(3);await expect(page.locator('[data-marker-id="tracking-reported-truck"]')).toBeVisible();
  await expect(page.getByText('Approximate location · Within 3 km',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Open shipment progress',exact:true}).click();
  const proofAction=page.getByRole('button',{name:'View photo proof',exact:true});await proofAction.click();
  await expect(page.getByRole('img',{name:'Submitted document',exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('native-tracking-private-proof.png')});
  await page.getByRole('button',{name:'Close document',exact:true}).click();
  checked(await data.service.from('provider_tracking_recipients').update({revoked_at:new Date().toISOString()}).eq('shipment_id',data.shipment));
  await proofAction.click();await expect(page.getByText('This file is not available.',{exact:true})).toBeVisible();await expect(page.getByRole('img',{name:'Submitted document',exact:true})).toHaveCount(0);
  await page.screenshot({path:info.outputPath('native-tracking-proof-denied.png')});
 }finally{await data.cleanup();}
});

test('Expo phone Tracking fits the first reported area and preserves the camera on later refreshes',async({page}:{page:Page},info:PreviewInfo)=>{
 test.skip(info.project.name!=='mobile-chromium','Phone Expo browser workflow');test.setTimeout(150000);
 const data=await fixture('native-map-first-area','LOCATION_AND_STATUS');
 try{
  await visitorLogin(page,data.email);
  const map=page.getByTestId('tracking-native-map-workspace').locator('.maplibregl-map');
  await expect(page.locator('[data-marker-id^="tracking-city-"]')).toHaveCount(3);
  await expect(page.locator('[data-marker-id="tracking-reported-truck"]')).toHaveCount(0);
  const canvas=await map.locator('canvas').elementHandle();expect(canvas).not.toBeNull();
  // An authorized synthetic obscured area, deliberately outside the original city frame.
  const reported=async(latitude:number,longitude:number)=>checked(await data.service.from('provider_shipment_events').insert({shipment_id:data.shipment,status:'CREATED',event_type:'LOCATION',location_area:'Synthetic reported area',location_lat:latitude,location_lng:longitude,location_precision_km:3,location_source:'DEVICE_OBSCURED',created_by:data.actor.id}));
  await reported(30,31);
  await page.getByRole('button',{name:'Open shipment progress',exact:true}).click();
  await page.getByRole('button',{name:'Refresh updates',exact:true}).click();
  await expect(page.getByText('Approximate location · Within 3 km',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close shipment progress',exact:true}).click();
  const truck=page.locator('[data-marker-id="tracking-reported-truck"]');
  await expect.poll(async()=>{
   const [frame,marker]=await Promise.all([map.boundingBox(),truck.boundingBox()]);
   if(!frame||!marker)return false;
   const x=marker.x+marker.width/2,y=marker.y+marker.height/2;
   return x>frame.x&&x<frame.x+frame.width&&y>frame.y&&y<frame.y+frame.height;
  },{timeout:30000}).toBe(true);
  expect(await canvas!.evaluate(element=>element.isConnected)).toBe(true);
  const city=page.locator('[data-marker-id="tracking-city-0"]'),before=await city.boundingBox();expect(before).not.toBeNull();
  await reported(30.1,31.1);
  await page.getByRole('button',{name:'Open shipment progress',exact:true}).click();
  const refreshed=page.waitForResponse(response=>new URL(response.url()).pathname===`/api/mobile/visitor/tracking/shipments/${data.shipment}`&&response.status()===200);
  await page.getByRole('button',{name:'Refresh updates',exact:true}).click();await refreshed;
  await page.getByRole('button',{name:'Close shipment progress',exact:true}).click();
  const after=await city.boundingBox();expect(after).not.toBeNull();
  expect(Math.abs(after!.x-before!.x)).toBeLessThan(1);expect(Math.abs(after!.y-before!.y)).toBeLessThan(1);
  expect(await canvas!.evaluate(element=>element.isConnected)).toBe(true);
 }finally{await data.cleanup();}
});
