import {mkdirSync,writeFileSync} from 'node:fs';
import {test,expect} from './browser-test';
import {auditDeleteVehicles,auditFleetDriver,auditFleetProvider,checked,localAuditService} from './audit-helpers';
import {localMailpitNumericCode} from './mailpit-helper';
import {localSupportLogin} from './provider-support-helper';
import {publishProviderCapacity} from '../../src/lib/provider-capacity.js';

test.use({channel:'chrome',trace:'off',screenshot:'off',video:'off',actionTimeout:20_000,navigationTimeout:30_000});

test('assigned driver updates the Expo Capacity map manually, then switches back to phone',async({browser},info)=>{
 test.skip(info.project.name!=='desktop-chromium','One phone-size Chromium context exercises the Expo preview.');
 test.setTimeout(240_000);
 const db=localAuditService(),owner=await auditFleetProvider(db,'driver-manual-expo');
 const vehicles:string[]=[];
 let driver:Awaited<ReturnType<typeof auditFleetDriver>>|null=null;
 let ownerContext:Awaited<ReturnType<typeof browser.newContext>>|null=null;
 const evidence='.local/driver-manual-capacity-20261018';mkdirSync(evidence,{recursive:true});
 const context=await browser.newContext({baseURL:'http://localhost:8084',viewport:{width:390,height:844},isMobile:true,hasTouch:true,permissions:['geolocation'],geolocation:{latitude:9.03,longitude:38.76},extraHTTPHeaders:{'x-forwarded-for':'127.0.0.246'}});
 const page=await context.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const traffic:{method:string;path:string;status?:number;elapsedMs?:number}[]=[],started=new WeakMap<object,number>();
 page.on('request',request=>{const path=new URL(request.url()).pathname;if(path.startsWith('/api/mobile/')){started.set(request,Date.now());traffic.push({method:request.method(),path});}});
 page.on('response',response=>{const request=response.request(),path=new URL(response.url()).pathname;if(path.startsWith('/api/mobile/'))traffic.push({method:request.method(),path,status:response.status(),elapsedMs:Date.now()-(started.get(request)||Date.now())});});
 try{
  const vehicle=checked(await db.rpc('create_provider_vehicle',{actor_user_id:owner.id,command:{make:'Isuzu',model:'Expo preview',plate:`EXP-${owner.suffix}`,cargo_configuration:'Mini Box Truck',use_basis:'OWNED'}}));
  vehicles.push(vehicle.id);
  driver=await auditFleetDriver(db,owner,vehicle.id);
  const identity=checked(await db.auth.admin.getUserById(driver.id)).user;
  await page.goto('/account');await page.getByLabel('Email',{exact:true}).fill(identity.email);
  const since=Date.now();await page.getByRole('button',{name:'Send code',exact:true}).click();
  await expect(page.getByLabel('Sign-in code',{exact:true})).toBeVisible({timeout:30_000});
  await page.getByLabel('Sign-in code',{exact:true}).fill(await localMailpitNumericCode(identity.email,since,'Your Loadgistic sign-in code'));
  const verified=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/auth/verify'&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();expect((await verified).status()).toBe(200);
  await expect(page.getByTestId('driver-home-map')).toBeVisible({timeout:30_000});
  await expect(page.getByText('Isuzu Expo preview')).toBeVisible({timeout:45_000});
  await expect(page.getByText('No driver location shared yet')).toBeVisible();

  await page.getByRole('button',{name:'Vehicle location',exact:true}).click();
  await expect(page.getByText('Capacity map location')).toBeVisible();
  await page.getByRole('radio',{name:'Manual capacity location'}).click();
  await expect(page.getByText('A manual point stays until you update it. Update it when the vehicle moves.')).toBeVisible();
  const map=page.locator('canvas').last();await expect(map).toBeVisible({timeout:30_000});
  await map.click({position:{x:130,y:130}});
  await page.getByRole('radio',{name:'5 km'}).click();
  await expect(page.getByRole('button',{name:'Update location'})).toBeEnabled();
  await page.screenshot({path:`${evidence}/expo-driver-manual-editor-phone.png`});
  const manualSaved=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/fleet/devices'&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Update location'}).click();
  await page.screenshot({path:`${evidence}/expo-driver-after-save-click-phone.png`});
  expect((await manualSaved).status()).toBe(200);
  await expect(page.getByText('Capacity map location')).toHaveCount(0);
  const selected=checked(await db.from('telematics_location_sources').select('source,manual_latitude,manual_longitude,selected_by,precision_km').eq('vehicle_id',vehicle.id).single());
  expect(selected.source).toBe('MANUAL');expect(selected.selected_by).toBe(driver.id);expect(selected.precision_km).toBe(5);
  expect(Number.isFinite(selected.manual_latitude)).toBe(true);expect(Number.isFinite(selected.manual_longitude)).toBe(true);
  await page.screenshot({path:`${evidence}/expo-driver-manual-home-phone.png`});

  const places=await Promise.all(['addis ababa','adama'].map(async name=>checked(await db.from('place_catalog').select('id,name').eq('normalized_name',name).order('population',{ascending:false}).limit(1).single())));
  ownerContext=await browser.newContext({baseURL:'http://127.0.0.1:3100',viewport:{width:1280,height:900},extraHTTPHeaders:{'x-forwarded-for':'127.0.0.247'}});
  const ownerPage=await ownerContext.newPage();await localSupportLogin(ownerPage,owner.id);
  await ownerPage.goto(`/app/fleet/${vehicle.id}?view=details`,{waitUntil:'domcontentloaded'});
  await ownerPage.setViewportSize({width:390,height:844});
  await ownerPage.mouse.wheel(0,500);
  const publishButton=ownerPage.getByRole('button',{name:'Go live',exact:true});
  await expect(publishButton).toBeVisible();
  await expect.poll(async()=>{const action=await publishButton.boundingBox(),nav=await ownerPage.locator('.mobile-nav').boundingBox();return Boolean(action&&nav&&action.y+action.height<=nav.y);}).toBe(true);
  await ownerPage.screenshot({path:`${evidence}/owner-go-live-visible-phone.png`});
  const publicationSaved=ownerPage.waitForResponse(response=>new URL(response.url()).pathname===`/api/fleet/vehicles/${vehicle.id}/publication`&&response.request().method()==='POST');
  await ownerPage.getByRole('button',{name:'Go live',exact:true}).click();expect((await publicationSaved).status()).toBe(303);await expect(ownerPage.getByRole('button',{name:'Move to draft',exact:true})).toBeVisible();
  expect(checked(await db.from('vehicles').select('publication_status').eq('id',vehicle.id).single()).publication_status).toBe('LIVE');
  checked(await db.from('company_pages').update({published:true}).eq('organization_id',owner.organization_id));
  await publishProviderCapacity(owner,{vehicleId:vehicle.id,status:'EMPTY',acceptedLoads:'BOTH',availabilityGeometry:'ROUTE',visibility:'OPEN',locationSource:'PRESERVE_DRIVER',currentRoutePlaces:places.map((place:{id:string;name:string})=>({placeRef:place.id,label:place.name}))});
  await page.reload();await expect(page.getByText('Manually entered')).toBeVisible({timeout:30_000});
  await page.screenshot({path:`${evidence}/expo-driver-manual-published-phone.png`});
  const viewport=[selected.manual_longitude-2,selected.manual_latitude-2,selected.manual_longitude+2,selected.manual_latitude+2].join(',');
  const publicReply=await page.request.get(`/api/public/capacity?locationSource=MANUAL&viewport=${viewport}`);
  expect(publicReply.status()).toBe(200);
  const publicItem=(await publicReply.json()).items.find((item:{vehicle_id:string})=>item.vehicle_id===vehicle.id);
  expect(publicItem).toBeTruthy();expect(publicItem.location_source).toBe('MANUAL_ADMIN');expect(publicItem.location_updated_label).toBeTruthy();
  expect(publicItem.location_lat).not.toBe(selected.manual_latitude);expect(publicItem.location_lng).not.toBe(selected.manual_longitude);
  const phoneBefore=await page.request.get(`/api/public/capacity?locationSource=MOBILE&viewport=${viewport}`);
  expect(phoneBefore.status()).toBe(200);
  expect((await phoneBefore.json()).items.some((item:{vehicle_id:string})=>item.vehicle_id===vehicle.id)).toBe(false);

  await page.getByRole('button',{name:'Vehicle location',exact:true}).click();
  await page.getByRole('radio',{name:'Driver’s phone'}).click();
  const phoneSource=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/fleet/devices'&&response.request().method()==='POST');
  const phoneReport=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/capacity'&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Use phone location'}).click();
  expect((await phoneSource).status()).toBe(200);expect((await phoneReport).status()).toBe(200);
  await expect(page.getByText('Capacity map location')).toHaveCount(0);
  const after=checked(await db.from('telematics_location_sources').select('source,selected_by').eq('vehicle_id',vehicle.id).single());
  expect(after).toMatchObject({source:'MOBILE',selected_by:driver.id});
  const capacity=checked(await db.from('capacities').select('location_source,location_updated_at').eq('vehicle_id',vehicle.id).order('updated_at',{ascending:false}).limit(1).single());
  expect(capacity.location_source).toBe('DEVICE_OBSCURED');expect(Number.isFinite(Date.parse(capacity.location_updated_at))).toBe(true);
  await page.reload();await expect(page.getByText('Driver’s phone')).toBeVisible({timeout:30_000});
  await page.screenshot({path:`${evidence}/expo-driver-phone-restored-phone.png`});
  expect(errors).toEqual([]);
 }finally{
  writeFileSync(`${evidence}/expo-driver-api-timing.json`,JSON.stringify(traffic,null,2),{mode:0o600});
  await context.close();await ownerContext?.close();
  if(vehicles.length){checked(await db.from('capacities').delete().in('vehicle_id',vehicles));checked(await db.from('telematics_location_sources').delete().in('vehicle_id',vehicles));checked(await db.from('driver_vehicle_assignments').delete().in('vehicle_id',vehicles));}
  if(driver){checked(await db.from('drivers').delete().eq('user_id',driver.id));checked(await db.from('organization_members').delete().eq('user_id',driver.id).eq('organization_id',owner.organization_id));checked(await db.from('audit_logs').delete().eq('actor_user_id',driver.id));checked(await db.auth.admin.deleteUser(driver.id));}
  checked(await auditDeleteVehicles(db,'organization_id',owner.organization_id));checked(await db.from('company_pages').delete().eq('organization_id',owner.organization_id));checked(await db.from('organization_members').delete().eq('user_id',owner.id).eq('organization_id',owner.organization_id));checked(await db.from('audit_logs').delete().eq('actor_user_id',owner.id));checked(await db.from('audit_logs').delete().eq('organization_id',owner.organization_id));checked(await db.from('organizations').delete().eq('id',owner.organization_id));checked(await db.auth.admin.deleteUser(owner.id));
 }
});
