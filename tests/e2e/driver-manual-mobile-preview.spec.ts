import {mkdirSync,writeFileSync} from 'node:fs';
import {test,expect} from './browser-test';
import {auditDeleteVehicles,auditFleetDriver,auditFleetProvider,checked,localAuditService} from './audit-helpers';
import {localMailpitNumericCode} from './mailpit-helper';
import {localSupportLogin} from './provider-support-helper';
import {publishProviderCapacity} from '../../src/lib/provider-capacity.js';

test.use({channel:'chrome',trace:'off',screenshot:'off',video:'off',actionTimeout:20_000,navigationTimeout:30_000});

test('assigned driver sees read-only legacy Manual in Expo and deliberately resumes phone updates',async({browser},info)=>{
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
  checked(await db.from('telematics_location_sources').insert({vehicle_id:vehicle.id,source:'MANUAL',manual_latitude:40.015,manual_longitude:-105.27,selected_by:driver.id,precision_km:5}));
  const identity=checked(await db.auth.admin.getUserById(driver.id)).user;
  await page.goto('/account');await page.getByLabel('Email',{exact:true}).fill(identity.email);
  const since=Date.now();await page.getByRole('button',{name:'Send code',exact:true}).click();
  await expect(page.getByLabel('Sign-in code',{exact:true})).toBeVisible({timeout:30_000});
  await page.getByLabel('Sign-in code',{exact:true}).fill(await localMailpitNumericCode(identity.email,since,'Your Loadgistic sign-in code'));
  const verified=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/auth/verify'&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Sign in',exact:true}).last().click();expect((await verified).status()).toBe(200);
  await expect(page).toHaveURL('http://localhost:8084/account?tab=capacity');
  await expect(page.getByRole('tab',{name:'Home',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('tab',{name:'My capacity',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByTestId('driver-home-map')).toBeVisible({timeout:30_000});
  await expect(page.getByText(new RegExp(`EXP-${owner.suffix}`))).toBeVisible({timeout:45_000});
  await expect(page.getByText('No driver location shared yet')).toBeVisible();

  await page.getByRole('button',{name:'Set vehicle location',exact:true}).click();
  await expect(page.getByText('Capacity map location')).toBeVisible();
  await expect(page.getByRole('radio',{name:'Manual capacity location'})).toHaveCount(0);
  await expect(page.getByRole('radio',{name:'Driver’s phone'})).toHaveAttribute('aria-checked','false');
  await expect(page.getByRole('button',{name:'Use phone location'})).toBeDisabled();
  await expect(page.getByText('Manual locations are read-only. Choose a location source to resume updates.')).toBeVisible();
  await page.screenshot({path:`${evidence}/expo-driver-legacy-read-only-phone.png`});
  const selected=checked(await db.from('telematics_location_sources').select('source,manual_latitude,manual_longitude,selected_by,precision_km,revision').eq('vehicle_id',vehicle.id).single());
  expect(selected).toMatchObject({source:'MANUAL',manual_latitude:40.015,manual_longitude:-105.27,selected_by:driver.id,precision_km:5});
  // Closing the saved legacy record must not grant phone consent or write a fix.
  await page.getByRole('button',{name:'Close',exact:true}).click();
  const places=await Promise.all(['addis ababa','adama'].map(async name=>checked(await db.from('place_catalog').select('id,name').eq('normalized_name',name).order('population',{ascending:false}).limit(1).single())));
  ownerContext=await browser.newContext({baseURL:'http://127.0.0.1:3100',viewport:{width:1280,height:900},extraHTTPHeaders:{'x-forwarded-for':'127.0.0.247'}});
  const ownerPage=await ownerContext.newPage();await localSupportLogin(ownerPage,owner.id);
  await ownerPage.goto(`/app/fleet/${vehicle.id}?view=details`,{waitUntil:'domcontentloaded'});
  await ownerPage.setViewportSize({width:390,height:844});
  const publishButton=ownerPage.getByRole('button',{name:'Go live',exact:true});
  // Check the reachable end of the page, below the fixed phone navigation.
  await expect(publishButton).toBeVisible();
  await ownerPage.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  await expect.poll(async()=>{
   const action=await publishButton.boundingBox(),nav=await ownerPage.locator('.public-mobile-nav').boundingBox();
   return action&&nav?action.y+action.height-nav.y:Number.POSITIVE_INFINITY;
  },{message:'Go live stays above the phone navigation after scrolling'}).toBeLessThanOrEqual(0);
  await ownerPage.screenshot({path:`${evidence}/owner-go-live-visible-phone.png`});
  const publicationSaved=ownerPage.waitForResponse(response=>new URL(response.url()).pathname===`/api/fleet/vehicles/${vehicle.id}/publication`&&response.request().method()==='POST');
  const publishedPage=ownerPage.waitForResponse(response=>new URL(response.url()).pathname===`/app/fleet/${vehicle.id}`&&response.request().isNavigationRequest()&&response.request().method()==='GET');
  await publishButton.click();expect((await publicationSaved).status()).toBe(303);
  const destination=await publishedPage;expect(destination.status()).toBe(200);await destination.finished();
  await expect(ownerPage.getByRole('button',{name:'Move to draft',exact:true})).toBeVisible();
  expect(checked(await db.from('vehicles').select('publication_status').eq('id',vehicle.id).single()).publication_status).toBe('LIVE');
  checked(await db.from('company_pages').update({published:true}).eq('organization_id',owner.organization_id));
  await page.getByRole('button',{name:'Set vehicle location',exact:true}).click();
  await page.getByRole('radio',{name:'Driver’s phone'}).click();
  const phoneSource=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/fleet/devices'&&response.request().method()==='POST');
  const phoneReport=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/capacity'&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Use phone location'}).click();
  expect((await phoneSource).status()).toBe(200);expect((await phoneReport).status()).toBe(200);
  await expect(page.getByText('Capacity map location')).toHaveCount(0);
  const after=checked(await db.from('telematics_location_sources').select('source,selected_by').eq('vehicle_id',vehicle.id).single());
  expect(after).toMatchObject({source:'MOBILE',selected_by:driver.id});
  await publishProviderCapacity(owner,{vehicleId:vehicle.id,status:'EMPTY',acceptedLoads:'BOTH',availabilityGeometry:'ROUTE',visibility:'OPEN',locationSource:'PRESERVE_DRIVER',currentRoutePlaces:places.map((place:{id:string;name:string})=>({placeRef:place.id,label:place.name}))});
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
