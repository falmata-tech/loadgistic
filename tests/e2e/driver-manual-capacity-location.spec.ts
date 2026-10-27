import {test,expect} from './browser-test';
import {auditDeleteVehicles,auditFleetDriver,auditFleetProvider,checked,localAuditService} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {publishProviderCapacity} from '../../src/lib/provider-capacity.js';
import {mkdirSync} from 'node:fs';

test.use({trace:'off',video:'off',screenshot:'off',actionTimeout:20_000,navigationTimeout:30_000});

test('assigned driver chooses a manual Capacity point, sees its source, and can return to phone',async({browser},info)=>{
 test.skip(info.project.name!=='desktop-chromium','One local browser checks the full save and read-back.');
 test.setTimeout(180_000);
 const screenshots='.local/driver-manual-capacity-20261018';mkdirSync(screenshots,{recursive:true});
 const db=localAuditService(),owner=await auditFleetProvider(db,'driver-manual-web');
 const vehicles:string[]=[];let driver:Awaited<ReturnType<typeof auditFleetDriver>>|null=null,logout:(()=>Promise<unknown>)|null=null,ownerContext:Awaited<ReturnType<typeof browser.newContext>>|null=null;
 const context=await browser.newContext({baseURL:'http://127.0.0.1:3100',viewport:{width:390,height:844},extraHTTPHeaders:{'x-forwarded-for':'127.0.0.248'}});
 await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:9.03,longitude:38.76});
 const page=await context.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  for(const model of ['Current','Other'])vehicles.push(checked(await db.rpc('create_provider_vehicle',{actor_user_id:owner.id,command:{make:'Isuzu',model,plate:`MAN-${owner.suffix}-${model[0]}`,cargo_configuration:'Mini Box Truck',use_basis:'OWNED'}})).id);
  driver=await auditFleetDriver(db,owner,vehicles[0]);
  // Start with a new driver who can publish capacity but has no saved Capacity row.
  logout=await localSupportLogin(page,driver.id);await page.goto('/app/home',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('button',{name:'Edit approximate location'}).first()).toBeVisible();
  await page.getByRole('button',{name:'Edit approximate location'}).click();
  const dialog=page.getByRole('dialog',{name:'Approximate location'});await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Choose on map'})).toBeVisible({timeout:20_000});
  await expect(dialog.getByText('Selected source:')).toContainText('Driver’s phone');
  await dialog.getByRole('button',{name:'Choose on map'}).click();
  await dialog.locator('.leaflet-container').waitFor({state:'visible',timeout:20_000});
  await dialog.locator('.leaflet-container').click({position:{x:130,y:130}});
  await expect(dialog.getByLabel('Latitude')).not.toHaveValue('');
  await dialog.getByText('Enter coordinates').click();
  await dialog.getByLabel('Latitude').fill('40.015');await dialog.getByLabel('Longitude').fill('-105.27');
  await dialog.getByLabel('Shared location accuracy').selectOption('5');
  await expect(dialog).toContainText('Active shipment Tracking and the provider’s GPS can continue separately.');
  await dialog.locator('.leaflet-tile-loaded').first().waitFor({state:'visible',timeout:8000}).catch(()=>{});
  await page.screenshot({path:`${screenshots}/driver-manual-editor-phone.png`});
  await page.setViewportSize({width:1440,height:900});await page.screenshot({path:`${screenshots}/driver-manual-editor-desktop.png`});await page.setViewportSize({width:390,height:844});
  const manualPost=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/fleet/devices'&&response.request().method()==='POST');
  await dialog.getByRole('button',{name:'Save location'}).click();expect((await manualPost).status()).toBe(200);await expect(dialog).toHaveCount(0);
  let selected=checked(await db.from('telematics_location_sources').select('source,manual_latitude,manual_longitude,selected_by,precision_km').eq('vehicle_id',vehicles[0]).single());
  expect(selected).toMatchObject({source:'MANUAL',manual_latitude:40.015,manual_longitude:-105.27,selected_by:driver.id,precision_km:5});

  await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('.capacity-location-dock')).toContainText('Manually entered');
  await expect(page.getByRole('button',{name:'Edit planned capacity: Off Duty'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Edit approximate location'}).first()).toBeVisible();
  checked(await db.rpc('update_fleet_driver_access',{actor_user_id:owner.id,command:{driver_user_id:driver.id,vehicle_id:vehicles[0],can_manage_capacity:false,can_manage_tracking:true}}));
  await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByTestId('restricted-driver-map')).toContainText('Manually entered');

  const unassigned=await page.request.get(`/api/capacity/manual-location?vehicleId=${vehicles[1]}`);expect(unassigned.status()).toBe(404);
  const forbidden=await page.request.post('/api/fleet/devices',{data:{action:'SOURCE',input:{vehicleId:vehicles[1],source:'MANUAL',precisionKm:5,expectedRevision:'1970-01-01T00:00:00Z',manualLatitude:40,manualLongitude:-105}}});expect(forbidden.status()).toBe(404);
  expect(checked(await db.from('telematics_location_sources').select('vehicle_id').eq('vehicle_id',vehicles[1]))).toHaveLength(0);

  ownerContext=await browser.newContext({baseURL:'http://127.0.0.1:3100',viewport:{width:390,height:844},extraHTTPHeaders:{'x-forwarded-for':'127.0.0.249'}});
  const ownerPage=await ownerContext.newPage();await localSupportLogin(ownerPage,owner.id);await ownerPage.goto(`/app/fleet/${vehicles[0]}?view=location`,{waitUntil:'domcontentloaded'});
  await expect(ownerPage.getByText('The assigned driver chose a manual Capacity location.')).toBeVisible();
  await expect(ownerPage.getByRole('button',{name:'Edit location source'})).toHaveCount(0);
  await ownerPage.screenshot({path:`${screenshots}/provider-location-read-only-phone.png`});
  const ownerSelection=await ownerPage.request.get(`/api/capacity/manual-location?vehicleId=${vehicles[0]}`);expect(ownerSelection.status()).toBe(200);
  const ownerRevision=(await ownerSelection.json()).revision;
  const locked=await ownerPage.request.post('/api/fleet/devices',{data:{action:'SOURCE',input:{vehicleId:vehicles[0],source:'MOBILE',precisionKm:5,expectedRevision:ownerRevision}}});expect(locked.status()).toBe(409);
  expect((await locked.json()).error.code).toBe('DRIVER_LOCATION_CHOICE_LOCKED');

  const places=await Promise.all(['addis ababa','adama'].map(async name=>checked(await db.from('place_catalog').select('id,name').eq('normalized_name',name).order('population',{ascending:false}).limit(1).single())));
  await ownerPage.goto(`/app/fleet/${vehicles[0]}?view=details`,{waitUntil:'domcontentloaded'});
  await ownerPage.getByRole('button',{name:'Go live',exact:true}).click();
  expect(checked(await db.from('vehicles').select('publication_status').eq('id',vehicles[0]).single()).publication_status).toBe('LIVE');
  checked(await db.from('company_pages').update({published:true}).eq('organization_id',owner.organization_id));
  await publishProviderCapacity(owner,{vehicleId:vehicles[0],status:'EMPTY',acceptedLoads:'BOTH',availabilityGeometry:'ROUTE',visibility:'OPEN',locationSource:'PRESERVE_DRIVER',currentRoutePlaces:places.map((place:{id:string;name:string})=>({placeRef:place.id,label:place.name}))});
  await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByTestId('restricted-driver-map')).toContainText('Manually entered');
  await expect(page.getByTestId('restricted-driver-map')).not.toContainText('40.015');
  await page.screenshot({path:`${screenshots}/driver-manual-map-phone.png`});
  const filterQuery='viewport=-106,39,-104,41';
  const manualResults=await page.request.get(`/api/public/capacity?locationSource=MANUAL&${filterQuery}`);expect(manualResults.status()).toBe(200);
  const manualItem=(await manualResults.json()).items.find((item:{vehicle_id:string})=>item.vehicle_id===vehicles[0]);
  expect(manualItem).toBeTruthy();expect(manualItem.location_source).toBe('MANUAL_ADMIN');expect(manualItem.location_updated_label).toBeTruthy();
  expect(manualItem.location_lat).not.toBe(40.015);expect(manualItem.location_lng).not.toBe(-105.27);
  const phoneBefore=await page.request.get(`/api/public/capacity?locationSource=MOBILE&${filterQuery}`);expect(phoneBefore.status()).toBe(200);
  expect((await phoneBefore.json()).items.some((item:{vehicle_id:string})=>item.vehicle_id===vehicles[0])).toBe(false);
  await page.goto('/app/home/market',{waitUntil:'domcontentloaded'});await page.locator('.capacity-map-controls .capacity-filter-trigger').click();
  const filters=page.getByRole('dialog',{name:'Vehicle filters'});
  await filters.locator('[data-filter-section="location"] > summary').click();
  await filters.getByRole('checkbox',{name:'Manually entered',exact:true}).check();
  await page.screenshot({path:`${screenshots}/public-manual-source-filter-phone.png`});
  await filters.getByRole('button',{name:'Show vehicles'}).click();
  await expect(page).toHaveURL(url=>url.searchParams.get('locationSource')==='MANUAL',{timeout:20_000});
  await page.goto('/app/home',{waitUntil:'domcontentloaded'});
  await Promise.all([page.waitForURL(url=>url.pathname==='/app/home'&&(url.searchParams.has('success')||url.searchParams.has('error')),{waitUntil:'domcontentloaded',timeout:30_000}),page.getByRole('button',{name:'Off Duty',exact:true}).click()]);
  expect(new URL(page.url()).searchParams.get('success')).toBe('Vehicle is Off Duty.');
  await expect(page.getByRole('button',{name:'Available',exact:true})).toBeVisible({timeout:15_000});
  await page.getByRole('button',{name:'Edit capacity location'}).click();
  const restrictedDialog=page.getByRole('dialog',{name:'Capacity map location'});await expect(restrictedDialog.getByText('Selected source:')).toContainText('Manually entered');
  await restrictedDialog.getByText('Enter coordinates').click();await expect(restrictedDialog.getByLabel('Latitude')).toHaveValue('40.015');await expect(restrictedDialog.getByLabel('Longitude')).toHaveValue('-105.27');
  await restrictedDialog.getByLabel('Latitude').fill('40.02');await expect(restrictedDialog.getByLabel('Longitude')).toHaveValue('-105.27');
  await restrictedDialog.getByRole('button',{name:'Use my phone'}).click();
  const phoneSource=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/fleet/devices'&&response.request().method()==='POST');
  const phoneReport=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/capacity/location'&&response.request().method()==='POST');
  await restrictedDialog.getByRole('button',{name:'Save location'}).click();expect((await phoneSource).status()).toBe(200);expect((await phoneReport).status()).toBe(200);await expect(restrictedDialog).toHaveCount(0);
  selected=checked(await db.from('telematics_location_sources').select('source,manual_latitude,manual_longitude,selected_by,precision_km').eq('vehicle_id',vehicles[0]).single());expect(selected.source).toBe('MOBILE');
  await expect(page.getByRole('button',{name:'Available',exact:true})).toBeEnabled();
  await Promise.all([page.waitForURL(url=>url.pathname==='/app/home'&&(url.searchParams.has('success')||url.searchParams.has('error')),{waitUntil:'domcontentloaded',timeout:30_000}),page.getByRole('button',{name:'Available',exact:true}).click()]);
  expect(new URL(page.url()).searchParams.get('success')).toBe('Vehicle is On Duty.');
  await expect(page.getByRole('button',{name:'Off Duty',exact:true})).toBeVisible({timeout:15_000});
  const capacity=checked(await db.from('capacities').select('location_source,location_updated_at').eq('vehicle_id',vehicles[0]).order('updated_at',{ascending:false}).limit(1).single());expect(capacity.location_source).toBe('DEVICE_OBSCURED');expect(Number.isFinite(Date.parse(capacity.location_updated_at))).toBe(true);
  const manualAfter=await page.request.get(`/api/public/capacity?locationSource=MANUAL&${filterQuery}`);expect(manualAfter.status()).toBe(200);
  expect((await manualAfter.json()).items.some((item:{vehicle_id:string})=>item.vehicle_id===vehicles[0])).toBe(false);
  const phoneAfter=await page.request.get('/api/public/capacity?locationSource=MOBILE&viewport=38,8,40,10');expect(phoneAfter.status()).toBe(200);
  expect((await phoneAfter.json()).items.some((item:{vehicle_id:string})=>item.vehicle_id===vehicles[0])).toBe(true);
  await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByTestId('restricted-driver-map')).toContainText('Driver’s phone');expect(errors).toEqual([]);
 }finally{
  await logout?.();await context.close();await ownerContext?.close();
  if(vehicles.length){checked(await db.from('capacities').delete().in('vehicle_id',vehicles));checked(await db.from('telematics_location_sources').delete().in('vehicle_id',vehicles));checked(await db.from('driver_vehicle_assignments').delete().in('vehicle_id',vehicles));}
  if(driver){checked(await db.from('drivers').delete().eq('user_id',driver.id));checked(await db.from('organization_members').delete().eq('user_id',driver.id).eq('organization_id',owner.organization_id));checked(await db.from('audit_logs').delete().eq('actor_user_id',driver.id));checked(await db.auth.admin.deleteUser(driver.id));}
  checked(await auditDeleteVehicles(db,'organization_id',owner.organization_id));checked(await db.from('company_pages').delete().eq('organization_id',owner.organization_id));checked(await db.from('organization_members').delete().eq('user_id',owner.id).eq('organization_id',owner.organization_id));checked(await db.from('audit_logs').delete().eq('actor_user_id',owner.id));checked(await db.from('audit_logs').delete().eq('organization_id',owner.organization_id));checked(await db.from('organizations').delete().eq('id',owner.organization_id));checked(await db.auth.admin.deleteUser(owner.id));
 }
});
