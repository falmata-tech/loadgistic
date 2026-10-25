import {auditAssignAndPublishSelfDrivenVehicle,auditDeleteVehicles,auditFleetDriver,auditFleetProvider,auditProvider,checked,localAuditService} from './audit-helpers';
import {auditLogin} from './audit-helpers';
import {expect,test} from './browser-test';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {createProviderVehicle} from '../../src/lib/fleet.js';
import {publishProviderCapacity} from '../../src/lib/provider-capacity.js';

async function login(page:any,email='driver@loadgistic.local'){await auditLogin(page,email);}

async function save(page:any,dialog:any,button='Save',endpoint='/api/capacity'){
  const saved=page.waitForResponse((response:any)=>response.url().endsWith(endpoint)&&response.request().method()==='POST');
  await dialog.getByRole('button',{name:button,exact:true}).click();
  const response=await saved;
  expect(await response.json()).toMatchObject({ok:true});
  await expect(dialog).toHaveCount(0);
}

test('focused capacity dialogs keep map, discard drafts, save preferences and recover from errors',async({page,context}:{page:any;context:any},testInfo:any)=>{
  test.setTimeout(90_000);
  const service=localAuditService(),actor=await auditProvider(service,'capacity-dialogs');let vehicleId='';
  try{
  vehicleId=(await createProviderVehicle(actor,{useBasis:'OWNED',make:'Dialog editor',model:'Assigned truck',plate:`CDLG-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false})).id;
  await auditAssignAndPublishSelfDrivenVehicle(service,actor,vehicleId);
  const places=checked(await service.from('place_catalog').select('id,normalized_name').in('normalized_name',['addis ababa','adama']));
  const routePlaces=['addis ababa','adama'].map(name=>{const place=places.find((row:{normalized_name:string})=>row.normalized_name===name);expect(place).toBeTruthy();return {placeRef:place.id};});
  await publishProviderCapacity(actor,{vehicleId,status:'EMPTY',acceptedLoads:'BOTH',availabilityGeometry:'ROUTE',visibility:'PRIVATE',locationSource:'DEVICE_OBSCURED',approximateLat:9.03,approximateLng:38.76,locationPrecisionKm:20,currentRoutePlaces:routePlaces});
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:9.03,longitude:38.76});
  const automatic=page.waitForResponse((response:any)=>response.url().endsWith('/api/capacity/location'));
  await login(page,actor.email);
  expect((await automatic).ok()).toBe(true);
  const map=page.getByTestId('capacity-summary').locator('.leaflet-container');
  await expect(map).toBeVisible();
  await map.evaluate((element:HTMLElement)=>element.setAttribute('data-original-map','yes'));
  await expect(page.getByRole('button',{name:/Edit all/i})).toHaveCount(0);
  const capacity=page.getByRole('button',{name:/^Edit current capacity:/});
  const sharing=page.getByRole('button',{name:/^Edit capacity sharing:/});
  const rail=page.getByRole('navigation',{name:'Edit capacity signals',exact:true});
  await expect(rail.locator('button, a')).toHaveCount(4);
  await expect(rail.getByRole('button',{name:/^Edit current coverage:/})).toHaveCount(0);
  await expect(rail.getByRole('button',{name:/^Edit load preferences:/})).toHaveCount(0);
  const mapHeader=page.locator('.capacity-summary-map-header');
  await capacity.click();
  const previewDialog=page.getByRole('dialog',{name:'Capacity',exact:true});
  await expect(previewDialog).toBeVisible();
  const statusPrecedesLoad=await previewDialog.locator('.capacity-status-load-grid').evaluate((grid:HTMLElement)=>{
    const status=grid.querySelector('.capacity-status-choice-column'),load=grid.querySelector('.capacity-load-choice-column');
    return Boolean(status&&load&&(status.compareDocumentPosition(load)&Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(statusPrecedesLoad).toBe(true);
  const coveragePrecedesStops=await previewDialog.evaluate((dialog:HTMLElement)=>{
    const coverage=[...dialog.querySelectorAll('h3')].find(node=>node.textContent?.includes('Where is this vehicle available?'));
    const stops=[...dialog.querySelectorAll('h4')].find(node=>node.textContent?.trim()==='Stops');
    return Boolean(coverage&&stops&&(coverage.compareDocumentPosition(stops)&Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(coveragePrecedesStops).toBe(true);
  await page.screenshot({path:testInfo.outputPath(testInfo.project.name.includes('desktop')?'capacity-editor-desktop.png':'capacity-editor-default-phone.png')});
  await previewDialog.getByRole('button',{name:'Close editor',exact:true}).click();
  await expect(previewDialog).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:testInfo.outputPath('fleet-capacity-home-phone.png')});
  let headerBounds=await mapHeader.boundingBox(),railBounds=await rail.boundingBox();
  expect(railBounds!.y).toBeGreaterThanOrEqual(headerBounds!.y+headerBounds!.height);
  const locationDock=page.locator('.capacity-location-dock');
  const mobileNavigation=page.getByRole('navigation',{name:'Mobile navigation',exact:true});
  const dockBounds=await locationDock.boundingBox(),navigationBounds=await mobileNavigation.boundingBox();
  expect(dockBounds!.y+dockBounds!.height+8).toBeLessThanOrEqual(navigationBounds!.y);
  await page.setViewportSize({width:320,height:640});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  headerBounds=await mapHeader.boundingBox();railBounds=await rail.boundingBox();
  expect(railBounds!.y).toBeGreaterThanOrEqual(headerBounds!.y+headerBounds!.height);
  const narrowDockBounds=await locationDock.boundingBox(),narrowNavigationBounds=await mobileNavigation.boundingBox();
  expect(narrowDockBounds!.y+narrowDockBounds!.height+8).toBeLessThanOrEqual(narrowNavigationBounds!.y);
  await page.screenshot({path:testInfo.outputPath('fleet-capacity-home-narrow.png')});
  await page.setViewportSize({width:390,height:844});
  await capacity.click();
  let dialog=page.getByRole('dialog',{name:'Capacity',exact:true});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Choose where this vehicle is available.',{exact:true})).toHaveCount(0);
  await page.screenshot({path:testInfo.outputPath('capacity-editor-phone.png')});
  expect(await dialog.evaluate((element:HTMLDialogElement)=>element.matches(':modal'))).toBe(true);
  await expect(map).toHaveAttribute('data-original-map','yes');
  await expect(dialog.getByRole('combobox')).toHaveCount(2);
  await expect(dialog.getByRole('button',{name:'Open to the public',exact:true})).toHaveCount(0);
  await expect(dialog.getByRole('combobox',{name:'City 1',exact:true})).toHaveValue(/Addis Ababa/);
  await expect(dialog.getByRole('combobox',{name:'City 2',exact:true})).toHaveValue(/Adama/);
  const originalStatus=await dialog.locator('input[name="status"]').inputValue();
  await expect(dialog.getByRole('button',{name:'Empty',exact:true})).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Partial',exact:true})).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Off Duty',exact:true})).toBeVisible();
  const originalPick=await dialog.getByLabel('Multiple pickups').isChecked();
  const originalDrop=await dialog.getByLabel('Multiple drop-offs').isChecked();
  await expect(dialog.getByRole('radio',{name:'Full or shared',exact:true})).toBeVisible();
  const invalidRoute=await page.request.post('/api/capacity',{headers:{Accept:'application/json'},form:{vehicleId:await dialog.locator('input[name="vehicleId"]').inputValue(),status:'PARTIAL',availabilityGeometry:'RADIUS'}});
  expect(invalidRoute.status()).toBe(400);
  expect(await invalidRoute.json()).toEqual({error:'Partial capacity needs an availability route. Choose at least two cities.'});
  const nextStatus=originalStatus==='PARTIAL'?'Empty':'Partial';
  await dialog.getByRole('button',{name:nextStatus,exact:true}).click();
  await save(page,dialog);
  await expect(capacity).toBeEnabled({timeout:15000});
  await expect(capacity).toHaveAttribute('aria-label',`Edit current capacity: ${nextStatus}`);
  await sharing.click();
  dialog=page.getByRole('dialog',{name:'Capacity sharing',exact:true});
  await expect(dialog.getByRole('button',{name:'Empty',exact:true})).toHaveCount(0);
  await expect(dialog.getByRole('radio')).toHaveCount(0);
  const originalVisibility=await dialog.locator('button[aria-pressed=true]').innerText();
  const otherVisibility=originalVisibility==='Open to the public'?'Private network':'Open to the public';
  await dialog.getByRole('button',{name:otherVisibility,exact:true}).click();
  await page.screenshot({path:testInfo.outputPath('capacity-dialog.png')});
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(sharing).toBeFocused();
  await sharing.click();
  await expect(dialog.getByRole('button',{name:originalVisibility,exact:true})).toHaveAttribute('aria-pressed','true');
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();

  await capacity.click();
  dialog=page.getByRole('dialog',{name:'Capacity',exact:true});
  await expect(dialog.getByRole('combobox',{name:'City 1',exact:true})).toHaveValue(/Addis Ababa/);
  await expect(dialog.getByRole('combobox',{name:'City 2',exact:true})).toHaveValue(/Adama/);
  const pickups=dialog.getByLabel('Multiple pickups'),dropoffs=dialog.getByLabel('Multiple drop-offs');
  await pickups.check();await dropoffs.check();
  await save(page,dialog);
  await sharing.click();
  dialog=page.getByRole('dialog',{name:'Capacity sharing',exact:true});
  await dialog.getByRole('button',{name:otherVisibility,exact:true}).click();
  await page.route('**/api/capacity',(route:any)=>route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Please retry this save.'})}),{times:1});
  await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await expect(dialog.getByRole('alert')).toHaveText('Please retry this save.');
  await expect(dialog.getByRole('button',{name:otherVisibility,exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(map).toHaveAttribute('data-original-map','yes');
  await save(page,dialog);
  await expect(page).toHaveURL(/\/app\/home$/);
  await expect(map).toHaveAttribute('data-original-map','yes');
  await capacity.click();
  dialog=page.getByRole('dialog',{name:'Capacity',exact:true});
  await expect(dialog.getByLabel('Multiple pickups')).toBeChecked();
  await expect(dialog.getByLabel('Multiple drop-offs')).toBeChecked();
  await dialog.getByLabel('Multiple pickups').setChecked(originalPick);
  await dialog.getByLabel('Multiple drop-offs').setChecked(originalDrop);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await sharing.click();
  dialog=page.getByRole('dialog',{name:'Capacity sharing',exact:true});
  await dialog.getByRole('button',{name:originalVisibility,exact:true}).click();
  await save(page,dialog);
  await capacity.click();
  dialog=page.getByRole('dialog',{name:'Capacity',exact:true});
  await dialog.getByRole('button',{name:originalStatus==='PARTIAL'?'Partial':'Empty',exact:true}).click();
  if(originalStatus==='EMPTY')await dialog.getByRole('radio',{name:'Full or shared',exact:true}).check();
  await save(page,dialog);
  await expect(capacity).toBeEnabled({timeout:15000});
  await expect(capacity).toHaveAttribute('aria-label',`Edit current capacity: ${originalStatus==='PARTIAL'?'Partial':'Empty'}`);
  }finally{
    const capacityIds=vehicleId?checked(await service.from('capacities').select('id').eq('vehicle_id',vehicleId)):[];
    const ids=[vehicleId,...capacityIds.map((row:{id:string})=>row.id)].filter(Boolean);
    if(ids.length)checked(await service.from('audit_logs').delete().in('entity_id',ids));
    if(vehicleId){checked(await service.from('capacities').delete().eq('vehicle_id',vehicleId));checked(await auditDeleteVehicles(service,'id',vehicleId));}
    checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));
  }
});

test('regular service and location edit in bounded dialogs with real saves',async({page,context}:{page:any;context:any},testInfo:any)=>{
  test.setTimeout(120_000);page.setDefaultTimeout(30000);
  const service=localAuditService(),actor=await auditProvider(service,'regular-location');let vehicleId='';
  try{
  vehicleId=(await createProviderVehicle(actor,{useBasis:'OWNED',make:'Route editor',model:'Assigned truck',plate:`RLOC-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false})).id;
  await auditAssignAndPublishSelfDrivenVehicle(service,actor,vehicleId);
  const places=checked(await service.from('place_catalog').select('id,name').in('normalized_name',['addis ababa','adama']));
  const from=places.find((place:{name:string})=>place.name==='Addis Ababa'),to=places.find((place:{name:string})=>place.name==='Adama');expect(from&&to).toBeTruthy();
  await publishProviderCapacity(actor,{vehicleId,status:'EMPTY',acceptedLoads:'BOTH',availabilityGeometry:'ROUTE',visibility:'PRIVATE',locationSource:'DEVICE_OBSCURED',approximateLat:9.03,approximateLng:38.76,locationPrecisionKm:20,currentRoutePlaces:[{placeRef:from.id},{placeRef:to.id}]});
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:9.03,longitude:38.76});
  await login(page,actor.email);
  const map=page.getByTestId('capacity-summary').locator('.leaflet-container');
  await expect(map).toBeVisible();
  await map.evaluate((element:HTMLElement)=>element.setAttribute('data-original-map','yes'));
  await page.getByRole('button',{name:/^Edit regular service:/}).click();
  const regular=page.getByRole('dialog',{name:'Regular service',exact:true});
  await expect(regular.locator('input[name="vehicleId"]')).toHaveValue(vehicleId);
  await expect(regular.locator('input[name="expectedDriverId"]')).toHaveValue(actor.id);
  await expect(regular.getByRole('combobox').first()).toHaveValue('');
  for(const [index,city] of [[1,'Addis Ababa'],[2,'Adama']]){
    await regular.getByRole('combobox',{name:`Route city ${index}`,exact:true}).fill(city);
    await regular.getByRole('option',{name:new RegExp(`^${city},`)}).first().click();
  }
  await expect(regular.getByRole('button',{name:'Empty',exact:true})).toHaveCount(0);
  if(testInfo.project.name.includes('mobile'))await page.setViewportSize({width:320,height:640});
  await expect(regular.getByRole('button',{name:'Save',exact:true})).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const dialogBounds=await regular.boundingBox();
  expect(dialogBounds!.height).toBeLessThan(page.viewportSize()!.height);
  await page.screenshot({path:testInfo.outputPath('regular-service-dialog.png')});
  await save(page,regular,'Save','/api/capacity/corridors');
  const savedRoute=checked(await service.from('profile_routes').select('assigned_vehicle_id,assigned_driver_user_id,route_points_json').eq('assigned_vehicle_id',vehicleId).single());
  expect(savedRoute.assigned_driver_user_id).toBe(actor.id);expect(savedRoute.route_points_json).toHaveLength(2);
  await expect(map).toHaveAttribute('data-original-map','yes');
  const currentLane=map.locator('.capacity-setting-current-route'),corridorLane=map.locator('.capacity-setting-corridor-route');
  await expect(currentLane).toBeVisible();await expect(corridorLane).toBeVisible();
  const lanes=await map.evaluate((element:HTMLElement)=>{
    const current=element.querySelector<SVGPathElement>('.capacity-setting-current-route')!;
    const corridor=element.querySelector<SVGPathElement>('.capacity-setting-corridor-route')!;
    const a=current.getPointAtLength(current.getTotalLength()/2),b=corridor.getPointAtLength(corridor.getTotalLength()/2);
    return {gap:Math.hypot(a.x-b.x,a.y-b.y),halfStroke:(Number(current.getAttribute('stroke-width'))+Number(corridor.getAttribute('stroke-width')))/2};
  });
  expect(lanes.gap,'current and Corridor routes need separately visible strokes').toBeGreaterThan(lanes.halfStroke);
  const locationAction=page.getByRole('navigation',{name:'Edit capacity signals'}).getByRole('button',{name:'Edit approximate location',exact:true});
  await expect(locationAction).toBeEnabled({timeout:20000});
  await locationAction.click();
  const location=page.getByRole('dialog',{name:'Approximate location',exact:true});
  // The source read may take several seconds on a freshly started local API.
  await expect(location.getByRole('combobox')).toHaveCount(1,{timeout:20000});
  const originalRadius=await location.getByLabel('Shared location accuracy').inputValue();
  const nextRadius=originalRadius==='10'?'5':'10';
  await location.getByLabel('Shared location accuracy').selectOption(nextRadius);
  await location.getByRole('button',{name:'Cancel'}).click();
  await locationAction.click();
  await expect(location.getByLabel('Shared location accuracy')).toHaveValue(originalRadius);
  await location.getByLabel('Shared location accuracy').selectOption(nextRadius);
  const response=page.waitForResponse((response:any)=>response.url().endsWith('/api/capacity/location'));
  await location.getByRole('button',{name:'Save location'}).click();
  expect((await response).ok()).toBe(true);
  await expect(location).toHaveCount(0);
  await expect(page.getByRole('region',{name:'Approximate vehicle location controls'}).getByRole('button',{name:'Edit approximate location',exact:true})).toHaveText(`${nextRadius} km`);
  await expect(map).toHaveAttribute('data-original-map','yes');
  await expect(locationAction).toBeEnabled();
  const rail=await page.getByRole('navigation',{name:'Edit capacity signals'}).boundingBox();
  const dock=await page.getByRole('region',{name:'Approximate vehicle location controls'}).boundingBox();
  expect(rail!.y+rail!.height+4).toBeLessThanOrEqual(dock!.y);
  await page.screenshot({path:testInfo.outputPath('saved-map.png')});
  }finally{
    const routeIds=checked(await service.from('profile_routes').select('id').eq('provider_profile_id',actor.provider_profile_id));
    const capacityIds=vehicleId?checked(await service.from('capacities').select('id').eq('vehicle_id',vehicleId)):[];
    const ids=[vehicleId,...routeIds.map((row:{id:string})=>row.id),...capacityIds.map((row:{id:string})=>row.id)].filter(Boolean);
    if(ids.length)checked(await service.from('audit_logs').delete().in('entity_id',ids));
    checked(await service.from('profile_routes').delete().eq('provider_profile_id',actor.provider_profile_id));
    if(vehicleId){checked(await service.from('capacities').delete().eq('vehicle_id',vehicleId));checked(await auditDeleteVehicles(service,'id',vehicleId));}
    checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));
  }
});

test('fleet owners edit capacity but cannot substitute their device location',async({page}:{page:any})=>{
  test.setTimeout(90_000);
  const service=localAuditService(),owner=await auditFleetProvider(service,'capacity-owner-location');
  let vehicleId='',driver:Awaited<ReturnType<typeof auditFleetDriver>>|null=null;
  try{
  vehicleId=(await createProviderVehicle(owner,{useBasis:'OWNED',make:'Audit fleet',model:'Location owner',plate:`COL-${owner.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false})).id;
  driver=await auditFleetDriver(service,owner,vehicleId);
  checked(await service.rpc('set_provider_vehicle_publication',{actor_user_id:owner.id,target_vehicle_id:vehicleId,requested_state:'LIVE'}));
  checked(await service.rpc('refresh_provider_capacity_location',{actor_user_id:driver.id,command:{vehicle_id:vehicleId,approximate_lat:9.03,approximate_lng:38.76,location_precision_km:20}}));
  const places=checked(await service.from('place_catalog').select('id,normalized_name').in('normalized_name',['addis ababa','adama']));
  const routePlaces=['addis ababa','adama'].map(name=>{const place=places.find((row:{normalized_name:string})=>row.normalized_name===name);expect(place).toBeTruthy();return {placeRef:place.id};});
  await publishProviderCapacity(owner,{vehicleId,status:'EMPTY',acceptedLoads:'BOTH',availabilityGeometry:'ROUTE',visibility:'PRIVATE',locationSource:'PRESERVE_DRIVER',currentRoutePlaces:routePlaces});
  await login(page,owner.email);
  await page.goto(`/app/fleet/${vehicleId}`);
  await expect(page.getByRole('button',{name:'Refresh vehicle location'})).toHaveCount(0);
  await page.getByRole('navigation',{name:'Edit capacity signals'}).getByRole('link',{name:'Manage location source'}).click();
  await expect(page).toHaveURL(/\?view=location$/);
  await expect(page.getByRole('heading',{name:'Location source'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Refresh vehicle location'})).toHaveCount(0);
  const editSource=page.getByRole('button',{name:'Edit location source'});
  if(await editSource.isVisible()){
    await editSource.click();
    const source=page.getByRole('dialog',{name:'Location source'});
    await expect(source.getByRole('radio',{name:'Manually entered'})).toBeVisible();
    await expect(source.getByRole('radio',{name:'Driver’s phone'})).toBeVisible();
    await source.getByRole('button',{name:'Cancel'}).click();
  }
  await page.getByRole('navigation',{name:'Vehicle'}).getByRole('link',{name:'Capacity signals'}).click();
  await page.getByRole('button',{name:/^Edit current capacity:/}).click();
  await expect(page.getByRole('dialog',{name:'Capacity',exact:true})).toBeVisible();
  await expect(page.getByTestId('capacity-summary')).toBeVisible();
  }finally{
    if(vehicleId){checked(await service.from('capacities').delete().eq('vehicle_id',vehicleId));checked(await service.from('telematics_location_sources').delete().eq('vehicle_id',vehicleId));checked(await service.from('driver_vehicle_assignments').delete().eq('vehicle_id',vehicleId));}
    if(driver){checked(await service.from('drivers').delete().eq('user_id',driver.id));checked(await service.from('organization_members').delete().eq('user_id',driver.id));checked(await service.from('audit_logs').delete().eq('actor_user_id',driver.id));checked(await service.auth.admin.deleteUser(driver.id));}
    checked(await auditDeleteVehicles(service,'organization_id',owner.organization_id));checked(await service.from('company_pages').delete().eq('organization_id',owner.organization_id));checked(await service.from('organization_members').delete().eq('user_id',owner.id));checked(await service.from('audit_logs').delete().eq('actor_user_id',owner.id));checked(await service.from('audit_logs').delete().eq('organization_id',owner.organization_id));checked(await service.from('organizations').delete().eq('id',owner.organization_id));checked(await service.auth.admin.deleteUser(owner.id));
  }
});

test('anonymous JSON capacity mutations stay denied',async({request}:{request:any})=>{
  for(const endpoint of ['/api/capacity','/api/capacity/corridors']){
    const response=await request.post(endpoint,{headers:{Accept:'application/json'},form:{action:'REMOVE'}});
    expect(response.status()).toBe(401);
    expect(await response.json()).toHaveProperty('error');
  }
});

test('first capacity publishes from its modal and Empty area changes to Partial route',async({page,context}:{page:any;context:any},testInfo:any)=>{
  test.setTimeout(90_000);
  nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
  if(!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw new Error('This fixture-writing test requires isolated local Supabase.');
  const service=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:9.03,longitude:38.76});
  const actor=await auditProvider(service,'modal-capacity');
  await auditLogin(page,actor.email);
  const created=await page.request.post('/api/fleet/vehicles',{form:{useBasis:'OWNED',make:'Modal test',model:'Mini truck',cargoConfiguration:'Mini Box Truck',plate:`MODAL-${Date.now()}`},maxRedirects:0});
  expect(created.status()).toBe(303);
  const destination=new URL(created.headers().location);
  const vehicleId=destination.pathname.split('/').pop()!;
  expect(vehicleId).toMatch(/^[a-f0-9-]{36}$/);
  try{
    await auditAssignAndPublishSelfDrivenVehicle(service,actor,vehicleId);
    await page.goto(destination.pathname);
    // Assigning a driver creates an Off Duty snapshot; publishing begins by
    // explicitly choosing Empty, just as it does for a newly assigned truck.
    await page.screenshot({path:testInfo.outputPath('first-capacity-before-update.png')});
    await page.getByRole('button',{name:'Edit current capacity: Off Duty',exact:true}).click();
    let dialog=page.getByRole('dialog',{name:'Capacity',exact:true});
    await dialog.getByRole('button',{name:'Empty',exact:true}).click();
    await expect(dialog.getByRole('button',{name:'Save',exact:true})).toBeDisabled();
    async function choose(label:string,query:string){
      await dialog.getByRole('combobox',{name:label,exact:true}).fill(query);
      await dialog.getByRole('option',{name:new RegExp(`^${query}, Ethiopia`)}).first().click();
    }
    await choose('Area center','Sebeta');
    await choose('Boundary city 1','Alem Gena');
    await choose('Boundary city 2','Teji');
    await choose('Boundary city 3','Boneya');
    await dialog.getByRole('button',{name:'Use my location'}).click();
    await expect(dialog.getByRole('status')).toContainText('Location ready');
    await save(page,dialog);
    await expect(page.getByRole('button',{name:'Edit current capacity: Empty',exact:true})).toBeVisible();
    await expect(page.getByTestId('capacity-summary').locator('.leaflet-container')).toBeVisible();
    await page.getByRole('button',{name:'Edit current capacity: Empty',exact:true}).click();
    dialog=page.getByRole('dialog',{name:'Capacity',exact:true});
    await dialog.getByRole('button',{name:'Partial',exact:true}).click();
    await expect(dialog).toContainText('Partial capacity needs a route');
    await expect(dialog.getByRole('button',{name:'Save',exact:true})).toBeDisabled();
    await dialog.getByRole('button',{name:'Empty',exact:true}).click();
    await expect(dialog.locator('input[name="availabilityGeometry"]')).toHaveValue('RADIUS');
    await expect(dialog.getByRole('button',{name:'Save',exact:true})).toBeEnabled();
    await dialog.getByRole('button',{name:'Partial',exact:true}).click();
    await choose('City 1','Sebeta');
    await choose('City 2','Alem Gena');
    await save(page,dialog);
    await expect(page.getByRole('button',{name:'Edit current capacity: Partial',exact:true})).toBeVisible();
    const {data,error}=await service.from('capacities').select('market_status,availability_geometry,visibility').eq('vehicle_id',vehicleId).order('updated_at',{ascending:false}).limit(1);
    expect(error).toBeNull();
    expect(data?.[0]).toMatchObject({market_status:'PARTIAL',availability_geometry:'ROUTE',visibility:'PRIVATE'});
    await page.getByRole('button',{name:'Edit current capacity: Partial',exact:true}).click();
    dialog=page.getByRole('dialog',{name:'Capacity',exact:true});
    await dialog.getByRole('button',{name:'Off Duty',exact:true}).click();
    await save(page,dialog);
    await expect(page.getByRole('button',{name:'Edit current capacity: Off Duty',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:/^Edit current coverage:/})).toHaveCount(0);
    const {data:offDuty}=await service.from('capacities').select('market_status').eq('vehicle_id',vehicleId).order('updated_at',{ascending:false}).limit(1);
    expect(offDuty?.[0]?.market_status).toBe('OFF_DUTY');
  }finally{
    const {data}=await service.from('capacities').select('id').eq('vehicle_id',vehicleId);
    const ids=[vehicleId,...(data||[]).map((row:{id:string})=>row.id)];
    await service.from('audit_logs').delete().in('entity_id',ids).throwOnError();
    await service.from('capacities').delete().eq('vehicle_id',vehicleId).throwOnError();
    await auditDeleteVehicles(service,'id',vehicleId).then(checked);
    await service.auth.admin.deleteUser(actor.id);
  }
});
