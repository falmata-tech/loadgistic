import {test,expect} from './browser-test';
import type {Page} from 'playwright-core';
import {randomUUID} from 'node:crypto';
import {localAuditService,auditProvider,auditDeleteVehicles,checked} from './audit-helpers';
import {publishProviderCapacity} from '../../src/lib/provider-capacity.js';
import {grantPrivateCapacityAccess} from '../../src/lib/private-capacity.js';
import {localMailpitNumericCode} from './mailpit-helper';
import {VEHICLE_CONFIGURATIONS} from '../../src/lib/vehicle-configurations';
import sharp from 'sharp';

const csv='Cargo van,Mini Box Truck';
async function configs(page:Page,info?:{outputPath:(name:string)=>string}){
 await page.getByRole('button',{name:'Any configuration',exact:true}).click();
 await expect.poll(()=>page.locator('[role="checkbox"] img[src*="/vehicle-configurations/"]').evaluateAll((images,count)=>images.length===count&&images.every(image=>image instanceof HTMLImageElement&&image.complete&&image.naturalWidth>0),VEHICLE_CONFIGURATIONS.length),{timeout:30_000}).toBe(true);
 for(const name of ['Cargo van','Mini Box Truck']){const option=page.getByRole('checkbox',{name,exact:true});await option.check();await expect(option).toBeChecked();}
 if(info){
  for(const width of [390,320]){
   await page.setViewportSize({width,height:width===320?640:844});
   for(const name of ['Cargo van','Mini Box Truck']){
    const option=page.getByRole('checkbox',{name,exact:true});await option.scrollIntoViewIfNeeded();await expect(option).toBeChecked();
    const box=await option.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({path:info.outputPath(`native-multiple-configuration-gallery-${width}-${name==='Cargo van'?'cargo':'box'}.png`),scale:'css'});
   }
  }
  await page.setViewportSize({width:390,height:844});
 }
 await expect(page.getByRole('button',{name:'Close',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Close',exact:true}).click();await expect(page.getByRole('button',{name:'2 configurations selected',exact:true})).toBeVisible();
}
async function checkControls(page:Page){
 for(const label of ['Cancel','Show matching trucks']){
  const button=page.getByRole('button',{name:label,exact:true});await button.click({trial:true});
  const box=await button.boundingBox(),viewport=page.viewportSize()!;expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(viewport.width);expect(box!.y+box!.height).toBeLessThanOrEqual(viewport.height);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.getByRole('button',{name:'Cancel',exact:true}).evaluate(element=>{
  for(let node:Element|null=element;node;node=node.parentElement)if(getComputedStyle(node).backgroundColor==='rgba(12, 114, 117, 0.1)')return true;return false;
 })).toBe(true);
}

async function mapPainted(page:Page){
 await expect(page.getByRole('progressbar',{name:'Loading truck availability',exact:true})).toHaveCount(0,{timeout:30_000});
 await expect.poll(async()=>{
  const box=await page.locator('.maplibregl-canvas').first().boundingBox();if(!box||box.width<100||box.height<100)return false;
  const stats=await sharp(await page.screenshot({clip:{x:box.x+box.width*.2,y:box.y+box.height*.25,width:box.width*.6,height:box.height*.5}})).stats();
  return stats.channels.slice(0,3).some(channel=>channel.mean<248&&channel.stdev>4);
 },{timeout:30_000,message:'The map must paint before a review capture.'}).toBe(true);
}

test('Expo multi-option controls keep drafts and submit all five canonical groups on narrow phones',async({page},info)=>{
 test.setTimeout(120_000);const requests:URL[]=[];
 page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/public/capacity')requests.push(url);});
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:8084/?q=Preserved%20people%20draft');
 await expect(page.getByRole('button',{name:'Truck filters',exact:true})).toBeVisible({timeout:45_000});await expect(page.getByRole('progressbar',{name:'Loading truck availability',exact:true})).toHaveCount(0,{timeout:30_000});
 await page.getByRole('button',{name:'Truck filters',exact:true}).click();await configs(page,info);
 for(const label of ['Full truck','Shared space','Empty truck','Partly loaded','Multiple pickups','Multiple deliveries','Within 12 hours','Over 12 hours ago']){await page.getByRole('checkbox',{name:label,exact:true}).check();await expect(page.getByRole('checkbox',{name:label,exact:true})).toBeChecked();}
 const expected={vehicleCategory:csv,loadType:'FTL,PTL',status:'EMPTY,PARTIAL',stopOption:'MULTI_DROP,MULTI_PICK',freshness:'FRESH,UPDATE_NEEDED'};
 expect(requests.every(url=>!Object.keys(expected).some(key=>url.searchParams.get(key)))).toBe(true);
 for(const width of [390,320]){
  await page.setViewportSize({width,height:width===320?640:844});await checkControls(page);
  await page.screenshot({path:info.outputPath(`native-multiple-filter-draft-${width}.png`),scale:'css'});
  await page.getByText('Select one or more options.',{exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath(`native-multiple-filter-top-${width}.png`),scale:'css'});
  const summary=page.getByRole('button',{name:'2 configurations selected',exact:true});await summary.scrollIntoViewIfNeeded();await expect(summary.locator('..').locator('img')).toHaveCount(2);
  await page.screenshot({path:info.outputPath(`native-multiple-configurations-selected-${width}.png`),scale:'css'});
 }
 const applied=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/public/capacity'&&Object.entries(expected).every(([key,value])=>url.searchParams.get(key)===value&&url.searchParams.getAll(key).length===1);});
 await page.getByRole('button',{name:'Show matching trucks',exact:true}).click();expect((await applied).ok()).toBe(true);
 await expect(page.getByRole('progressbar',{name:'Loading truck availability',exact:true})).toHaveCount(0,{timeout:30_000});
 await page.getByRole('button',{name:'Transporter search',exact:true}).click();await expect(page.getByLabel('Search transporters')).toHaveValue('Preserved people draft');await page.getByRole('button',{name:'Close transporter search',exact:true}).click();
 await page.getByRole('button',{name:/Truck filters/}).click();await page.getByRole('button',{name:'Reset truck filters',exact:true}).click();
 const reset=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/public/capacity'&&!Object.keys(expected).some(key=>url.searchParams.get(key));});
 await page.getByRole('button',{name:'Show matching trucks',exact:true}).click();expect((await reset).ok()).toBe(true);
 await expect(page.locator('.maplibregl-canvas').first()).toBeVisible();
});

test('Expo multi configurations retain exact recipient pairs after real private email authorization',async({page,context},info)=>{
 test.setTimeout(180_000);await context.setExtraHTTPHeaders({'x-forwarded-for':info.project.name.includes('mobile')?'127.0.0.237':'127.0.0.236'});
 const db=localAuditService(),email=`native-multi-${randomUUID()}@example.test`,actors:Awaited<ReturnType<typeof auditProvider>>[]=[],vehicles:string[]=[],capacityIds:string[]=[];
 try{
  const places=checked(await db.from('place_catalog').select('id,name').in('normalized_name',['addis ababa','adama'])),origin=places.find((item:any)=>item.name==='Addis Ababa'),destination=places.find((item:any)=>item.name==='Adama');expect(origin&&destination).toBeTruthy();
  for(const configuration of ['Cargo van','Mini Box Truck']){
   const actor=await auditProvider(db,'native-multi');actors.push(actor);checked(await db.from('company_pages').update({published:true}).eq('provider_profile_id',actor.provider_profile_id));
   const vehicle=checked(await db.rpc('create_provider_vehicle',{actor_user_id:actor.id,command:{use_basis:'OWNED',make:'Audit',model:'Multi filters',plate:`MOPT-${actor.suffix}`,cargo_configuration:configuration}}));vehicles.push(vehicle.id);
   await publishProviderCapacity(actor,{vehicleId:vehicle.id,status:'EMPTY',acceptedLoads:'BOTH',availabilityGeometry:'ROUTE',visibility:'PRIVATE',locationSource:'DEVICE_OBSCURED',approximateLat:9.03,approximateLng:38.74,locationPrecisionKm:20,currentRoutePlaces:[{placeRef:origin.id,label:origin.name},{placeRef:destination.id,label:destination.name}]});
   capacityIds.push(checked(await db.from('capacities').select('id').eq('vehicle_id',vehicle.id).single()).id);
   await grantPrivateCapacityAccess(actor,{name:'Synthetic multi-filter recipient',vehicleId:vehicle.id,email});
  }
  expect((await page.request.get(`/api/mobile/visitor/capacity/signals?vehicleCategory=${encodeURIComponent(csv)}`)).status()).toBe(401);
  await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:8084/?view=private');await expect(page.getByLabel('Your email')).toBeVisible({timeout:45_000});await page.getByLabel('Your email').fill(email);const requestedAt=Date.now();await page.getByRole('button',{name:'Send email code',exact:true}).click();
  await page.getByLabel('Email verification code').fill(await localMailpitNumericCode(email,requestedAt,'Your Private capacity code'));await page.getByRole('button',{name:'Open private access',exact:true}).click();await expect(page.getByRole('button',{name:'Close private access',exact:true})).toBeVisible({timeout:30_000});
  await page.getByRole('button',{name:'Truck filters',exact:true}).click();await configs(page);for(const label of ['Empty truck','Partly loaded','Full truck','Shared space'])await page.getByRole('checkbox',{name:label,exact:true}).check();await checkControls(page);
  const signals=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/mobile/visitor/capacity/signals'&&url.searchParams.get('vehicleCategory')===csv&&url.searchParams.get('status')==='EMPTY,PARTIAL'&&url.searchParams.get('loadType')==='FTL,PTL';});
  await page.getByRole('button',{name:'Show matching trucks',exact:true}).click();const response=await signals;expect(response.status()).toBe(200);const result=await response.json();expect(result.items.map((item:any)=>item.id).sort()).toEqual(capacityIds.sort());expect(result.items.every((item:any)=>item.status==='EMPTY'&&['Cargo van','Mini Box Truck'].includes(item.cargo_configuration))).toBe(true);
 await mapPainted(page);await page.screenshot({path:info.outputPath('native-multiple-private-map.png'),scale:'css'});
  await page.getByRole('button',{name:'Close private access',exact:true}).click();await expect(page.getByLabel('Your email')).toBeVisible();
  expect((await page.request.get('/api/mobile/visitor/capacity/signals?vehicleCategory=unsupported')).status()).toBe(401);
 }finally{
  const grants=checked(await db.from('capacity_access_grants').select('id').eq('recipient_email',email));checked(await db.from('access_email_deliveries').delete().eq('recipient_email',email));checked(await db.from('shared_capacity_email_otps').delete().eq('recipient_email',email));
  checked(await db.from('audit_logs').delete().in('entity_id',[...vehicles,...capacityIds,...grants.map((item:any)=>item.id)]));
  for(const actor of actors){checked(await db.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await auditDeleteVehicles(db,'provider_profile_id',actor.provider_profile_id));checked(await db.auth.admin.deleteUser(actor.id));}
 }
});
