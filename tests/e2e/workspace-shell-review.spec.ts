import {expect,test} from './browser-test';
import fs from 'node:fs';
import path from 'node:path';
import {localMailpitNumericCode} from './mailpit-helper';
import {auditDeleteVehicles,auditIdentity,auditLogin,auditOpenTrackingProgress,auditProvider,checked,localAuditService} from './audit-helpers';
import {getProviderCapacityWorkspace} from '../../src/lib/provider-capacity.js';
import {createProviderVehicle,updateFleetDriverAccess} from '../../src/lib/fleet.js';
import {chooseDate} from './date-picker-helper';

async function login(page:any,email:string){
  await auditLogin(page,email);
}

async function choosePlace(page:any,label:string,query:string,option:RegExp){
  const lookup=page.waitForResponse((response:any)=>{
    const url=new URL(response.url());return url.pathname==='/api/places'&&url.searchParams.get('q')===query;
  });
  await page.getByLabel(label).fill(query);
  const response=await lookup;expect(response.status()).toBe(200);expect(await response.finished()).toBeNull();
  await expect(page.getByRole('option',{name:option}).first()).toBeVisible();
  await page.getByRole('option',{name:option}).first().click();
}

async function settleDevelopmentOverlay(page:any){
  const issueCount=page.locator('nextjs-portal [data-issues-count]');
  if(await issueCount.count()){
    await expect(issueCount).toHaveText('0',{timeout:5_000});
    await page.locator('nextjs-portal').evaluate((portal:HTMLElement)=>{portal.style.display='none';});
  }
}

async function capture(page:any,file:string){
  await page.screenshot({path:file,fullPage:false,style:'nextjs-portal{display:none!important}'});
}

async function waitForMapTiles(page:any,root:string){
  await expect.poll(async()=>page.locator(`${root} .leaflet-tile-pane img`).evaluateAll((tiles:HTMLImageElement[])=>
    tiles.length>0&&tiles.every(tile=>tile.complete&&tile.naturalWidth>0)
  ),{timeout:20_000,message:`Expected every map tile to render in ${root}`}).toBe(true);
}

test('capture focused responsive shell and Tracking review',async({page,context}:{page:any;context:any})=>{
  test.setTimeout(90_000);
  test.skip(process.env.CAPTURE_VISUAL_REVIEW!=='1','Focused visual capture only');
  const output=path.resolve(process.cwd(),'artifacts/responsive-shell-v1');
  fs.mkdirSync(output,{recursive:true});
  const project=test.info().project.name;
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:9.03,longitude:38.76});

  for(const route of [
    {path:'/about',name:'about'},
    {path:'/privacy',name:'privacy'},
    {path:'/terms',name:'terms'},
    {path:'/track',name:'track'},
    {path:'/login',name:'login'},
    {path:'/apply',name:'apply'},
    {path:'/@blueline-transport',name:'provider'}
  ]){
    await page.goto(route.path);
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
    await settleDevelopmentOverlay(page);
    await capture(page,path.join(output,`${project}-${route.name}.png`));
  }

  const service=localAuditService();let actor:Awaited<ReturnType<typeof auditProvider>>|undefined,vehicleId='',shipmentId='',ownerEmail='';
  try{
  await login(page,'driver@loadgistic.local');
  await expect(page.getByTestId('capacity-summary')).toBeVisible();
  await expect(page.getByTestId('capacity-summary').locator('.leaflet-container')).toBeVisible();
  await expect(page.getByTestId('capacity-summary').locator('.capacity-setting-truck-marker')).toBeVisible();
  await waitForMapTiles(page,'[data-testid="capacity-summary"]');
  await settleDevelopmentOverlay(page);
  await capture(page,path.join(output,`${project}-driver-home.png`));
  const currentWorkspace=await getProviderCapacityWorkspace(await auditIdentity(localAuditService(),'driver@loadgistic.local'));
  const currentTruck=currentWorkspace.vehicles[0];expect(currentTruck.assigned_driver?.id).toBeTruthy();
  await page.getByRole('button',{name:/^Edit preferred corridor:/}).click();
  await expect(page.getByTestId('capacity-planning-editor')).toBeVisible();
  await expect(page.getByTestId('capacity-planning-editor').locator('#regular-service-form input[name="vehicleId"]')).toHaveValue(currentTruck.id);
  await expect(page.getByTestId('capacity-planning-editor').locator('#regular-service-form input[name="expectedDriverId"]')).toHaveValue(currentTruck.assigned_driver.id);
  await capture(page,path.join(output,`${project}-driver-regular-service.png`));
  await page.getByRole('button',{name:'Close editor'}).click();
  await page.getByRole('button',{name:/^Edit current capacity:/}).click();
  await expect(page.getByTestId('capacity-form')).toBeVisible();
  await capture(page,path.join(output,`${project}-driver-capacity-editor.png`));
  await page.getByRole('button',{name:'Close editor'}).click();
  await page.goto('/app/menu');
  await settleDevelopmentOverlay(page);
  await capture(page,path.join(output,`${project}-more.png`));
  await page.goto('/app/more');
  await settleDevelopmentOverlay(page);
  await capture(page,path.join(output,`${project}-account.png`));

  // This capture creates its own pair and Tracking record; shared demo history stays unchanged.
  actor=await auditProvider(service,'shell-review');
  const vehicle=await createProviderVehicle(actor,{useBasis:'OWNED',make:'Synthetic',model:'Shell review',plate:`SHELL-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false});vehicleId=vehicle.id;
  expect(checked(await service.rpc('set_provider_driving_mode',{actor_user_id:actor.id,requested_drives_truck:true}))).toBe(true);
  await updateFleetDriverAccess(actor,actor.id,{vehicleId,canManageCapacity:true,canManageTracking:true});
  await login(page,actor.email);
  await page.goto('/app/provider-shipments/new');
  await page.getByLabel('Vehicle',{exact:true}).selectOption(vehicleId);
  await page.getByLabel('Cargo summary').fill('Workshop steel inputs');
  await choosePlace(page,'Origin','Addis',/Addis Ababa, Ethiopia/i);
  await choosePlace(page,'Passing through city','Adama',/Adama, Ethiopia/i);
  await choosePlace(page,'Destination','Dire Dawa',/Dire Dawa, Ethiopia/i);
  await chooseDate(page,'Expected delivery',new Date(Date.now()+2*86400000).toISOString().slice(0,10));
  ownerEmail=`shell-review-${actor.suffix}@example.test`;
  await page.getByLabel('Shipment owner email',{exact:true}).fill(ownerEmail);
  await page.getByLabel('Status and approximate location').check();
  await page.getByRole('button',{name:'Start Tracking'}).click();
  await expect(page.getByRole('button',{name:'Copy link',exact:true})).toBeVisible();
  const tracking=page.getByRole('link',{name:'Open Tracking'}),trackingPath=await tracking.getAttribute('href');
  expect(trackingPath).toMatch(/^\/app\/provider-shipments\/[a-f0-9-]{36}$/);
  shipmentId=trackingPath!.split('/').at(-1)!;
  await tracking.click();await page.waitForURL((url:URL)=>url.pathname===trackingPath);
  await auditOpenTrackingProgress(page);
  await page.locator('input[name=nextStatus][value=TO_PICKUP]').check();
  const savedNavigation=page.waitForResponse((response:any)=>{
    const url=new URL(response.url());return response.request().isNavigationRequest()&&url.pathname===trackingPath&&url.searchParams.has('success');
  });
  await page.getByRole('button',{name:'Save Going to pickup'}).click();
  const saved=await savedNavigation;expect(saved.status()).toBe(200);expect(await saved.finished()).toBeNull();
  await expect(page.getByText('Tracking status updated.')).toBeVisible();
  expect(checked(await service.from('provider_shipments').select('operational_status').eq('id',shipmentId).eq('provider_profile_id',actor.provider_profile_id).single()).operational_status).toBe('TO_PICKUP');
  await page.goto('/track');
  await page.getByLabel('Email',{exact:true}).fill(ownerEmail);

  const requestedAt=Date.now();
  await page.getByRole('button',{name:'Email me a code'}).click();
  await page.getByLabel('6-digit email code').fill(await localMailpitNumericCode(ownerEmail,requestedAt,'Your Loadgistic tracking sign-in code'));
  await page.getByRole('button',{name:'Open tracking'}).click();
  await expect(page.locator('.tracking-location-map .leaflet-container')).toBeVisible({timeout:15_000});
  await waitForMapTiles(page,'.tracking-location-map');
  await settleDevelopmentOverlay(page);
  await capture(page,path.join(output,`${project}-tracking-map.png`));
  }finally{
    if(actor){
      const shipments=checked(await service.from('provider_shipments').select('id,cargo_summary').eq('provider_profile_id',actor.provider_profile_id));
      expect(shipments.every((row:{cargo_summary:string})=>row.cargo_summary==='Workshop steel inputs')).toBe(true);
      for(const row of shipments){checked(await service.from('access_email_deliveries').delete().eq('entity_id',row.id));checked(await service.from('audit_logs').delete().eq('entity_id',row.id));checked(await service.from('provider_shipments').delete().eq('id',row.id).eq('provider_profile_id',actor.provider_profile_id));}
      if(ownerEmail)checked(await service.from('access_email_deliveries').delete().eq('recipient_email',ownerEmail).eq('delivery_kind','TRACKING_OTP'));
      if(vehicleId){checked(await service.from('audit_logs').delete().eq('entity_id',vehicleId));checked(await auditDeleteVehicles(service,'id',vehicleId));}
      checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));
    }
  }
});
