import {test,expect} from './browser-test';
import {auditAssignAndPublishSelfDrivenVehicle,auditDeleteVehicles,auditProvider,checked,localAuditService} from './audit-helpers';
import {createProviderVehicle} from '../../src/lib/fleet.js';
import {publishProviderCapacity} from '../../src/lib/provider-capacity.js';
import {writeFileSync} from 'node:fs';

test.use({channel:process.env.CI?undefined:'chrome',trace:'off',video:'off'});

// FEAT-CAP/SIM-001 / NR-81: use actual publications and discovery permissions.
// No route interception, shortened poll interval or manual page refresh.
test('selected Capacity follows a new publication and disappears when sharing becomes private',async({page},info)=>{
 test.setTimeout(process.env.CI?120_000:240_000);
 const db=localAuditService(),actor=await auditProvider(db,'live-refresh');
 let vehicleId='';
 const started=Date.now(),traffic:unknown[]=[];
 page.on('response',response=>{
  if(new URL(response.url()).pathname!=='/api/public/capacity')return;
  void response.json().then(body=>traffic.push({ms:Date.now()-started,status:response.status(),count:body.items?.length,percent:body.items?.find((item:any)=>item.vehicle_id===vehicleId)?.available_percent})).catch(()=>traffic.push({ms:Date.now()-started,status:response.status(),unreadable:true}));
 });
 try{
  vehicleId=(await createProviderVehicle(actor,{useBasis:'OWNED',make:'Synthetic',model:'Live refresh',plate:`LIVE-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false})).id;
  await auditAssignAndPublishSelfDrivenVehicle(db,actor,vehicleId);
  checked(await db.from('company_pages').update({published:true}).eq('provider_profile_id',actor.provider_profile_id));
  const places=checked(await db.from('place_catalog').select('id,normalized_name').in('normalized_name',['addis ababa','adama']));
  const currentRoutePlaces=['addis ababa','adama'].map(name=>({placeRef:places.find((row:any)=>row.normalized_name===name)!.id}));
  const input={vehicleId,status:'PARTIAL',acceptedLoads:'PTL',availabilityGeometry:'ROUTE',visibility:'OPEN',locationSource:'DEVICE_OBSCURED',approximateLat:9.03,approximateLng:38.76,locationPrecisionKm:10,currentRoutePlaces};
  await publishProviderCapacity(actor,{...input,availablePercent:80});
  const current=async()=>{
   const response=await page.request.get(`/api/public/capacity?provider=live-refresh-${actor.suffix}`);
   expect(response.status()).toBe(200);
   return (await response.json()).items.filter((item:any)=>item.vehicle_id===vehicleId);
  };
  const [original]=await current();expect(original).toBeTruthy();
  await page.goto(`/?provider=live-refresh-${actor.suffix}`,{waitUntil:'domcontentloaded'});
  const standardMarker=page.locator('.capacity-truck-map-marker').filter({has:page.locator('.vehicle-marker-space',{hasText:/^80%$/})});
  await expect(standardMarker).toBeVisible({timeout:30_000});
  await expect(standardMarker).toHaveAccessibleName(/Available space: 80%/);
  await page.screenshot({path:info.outputPath('market-percent-marker.png')});
  await standardMarker.click();
  const marker=page.locator('.capacity-truck-map-marker.selected'),card=page.locator('.capacity-info-card');
  await expect(marker).toBeVisible({timeout:30_000});
  await page.locator('.map-info-bubble.truck').click();
  await expect(card).toContainText('Available space: 80%');
  await expect(card).not.toContainText('Demo account');
  await page.screenshot({path:info.outputPath('selected-before-publication.png')});
  const camera=await page.locator('.leaflet-proxy').getAttribute('style');
  await publishProviderCapacity(actor,{...input,availablePercent:60});
  const [replacement]=await current();expect(replacement.id).not.toBe(original.id);
  expect(replacement.available_percent).toBe(60);
  await expect(card).toContainText('Available space: 60%',{timeout:35_000});
  await expect(marker.locator('.vehicle-marker-space')).toHaveText('60%');
  await expect(marker).toHaveCount(1);
  expect(await page.locator('.leaflet-proxy').getAttribute('style')).toBe(camera);
  await page.screenshot({path:info.outputPath('selected-after-publication.png')});
  await page.goto(`/?provider=live-refresh-${actor.suffix}&truck=${encodeURIComponent(original.id)}`,{waitUntil:'domcontentloaded'});
  await expect(marker).toBeVisible({timeout:30_000});
  await page.locator('.map-info-bubble.truck').click();
  await expect(card).toContainText('Available space: 60%');
  await publishProviderCapacity(actor,{...input,availablePercent:60,visibility:'PRIVATE',sharingMode:'PRIVATE'});
  expect(await current()).toHaveLength(0);
  await expect(marker).toHaveCount(0,{timeout:35_000});
  await expect(card).toHaveCount(0);
  await page.screenshot({path:info.outputPath('private-signal-removed.png')});
 }catch(error){
  await page.screenshot({path:info.outputPath('failure-before-cleanup.png')}).catch(()=>{});
  const visibility=await page.evaluate(()=>document.visibilityState).catch(()=>null);
  writeFileSync(info.outputPath('refresh-traffic.json'),JSON.stringify({visibility,traffic},null,2));
  throw error;
 }finally{
  await page.goto('about:blank').catch(()=>{});
  if(vehicleId){
   checked(await db.from('capacities').delete().eq('vehicle_id',vehicleId));
   checked(await auditDeleteVehicles(db,'id',vehicleId));
  }
  checked(await db.from('audit_logs').delete().eq('actor_user_id',actor.id));
  checked(await db.auth.admin.deleteUser(actor.id));
 }
});
