import {expect as baseExpect,test} from '@playwright/test';
// Dev-server navigation includes server rendering; await the complete state.
const expect=baseExpect.configure({timeout:15000});
import {randomUUID} from 'node:crypto';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {localMailpitNumericCode} from './mailpit-helper';

async function verifyNewEmail(page:any,email:string,wrongFirst=false){
  await page.goto('/login');
  const requested=Date.now();
  await page.getByTestId('email-code-request-form').getByLabel('Email',{exact:true}).fill(email);
  await page.getByRole('button',{name:'Email me a code'}).click();
  await expect(page.getByTestId('email-code-form')).toBeVisible();
  const code=await localMailpitNumericCode(email,requested,['Your Loadgistic signup code','Your Loadgistic sign-in code']);
  if(wrongFirst){
    await page.getByLabel('Six-digit code',{exact:true}).fill(code==='000000'?'111111':'000000');
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await expect(page.getByTestId('email-code-form')).toBeVisible();
    await expect(page).not.toHaveURL(/\/app\/home/);
  }
  await page.getByLabel('Six-digit code',{exact:true}).fill(code);
  await page.getByRole('button',{name:'Continue',exact:true}).click();
}

async function selectPlace(page:any,label:string,value:string){
  const input=page.getByRole('combobox',{name:label,exact:true});
  await input.fill(value);
  await page.getByRole('option',{name:new RegExp(value,'i')}).first().click();
}

test('fleet assigns an unverified driver, then email-code login unlocks the same assignment',async({page,browser}:{page:any;browser:any},info:any)=>{
  test.setTimeout(420_000);
  nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
  const endpoint=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
  if(!['localhost','127.0.0.1'].includes(new URL(endpoint).hostname))throw new Error('REMOTE_FLEET_TEST_REFUSED');
  const service=createClient(endpoint,process.env.SUPABASE_SERVICE_ROLE_KEY||'',{auth:{persistSession:false,autoRefreshToken:false}});
  const suffix=randomUUID().slice(0,8);
  const ownerEmail=`fleet-owner-${suffix}@loadgistic.local`,driverEmail=`fleet-driver-${suffix}@loadgistic.local`;
  const ownerName=`Fleet Owner ${suffix}`,driverName=`Added Driver ${suffix}`;
  const driverContext=await browser.newContext({baseURL:info.project.use.baseURL,
    viewport:page.viewportSize()||undefined,isMobile:Boolean(info.project.use.isMobile),hasTouch:Boolean(info.project.use.hasTouch),
    permissions:['geolocation'],geolocation:{latitude:9.03,longitude:38.76},
    extraHTTPHeaders:{'x-forwarded-for':'127.0.0.241'}});
  const driverPage=await driverContext.newPage();
  let orgId='';
  try{
    // No seeded owner, driver, membership or assignment: both identities use the public flow.
    await verifyNewEmail(page,ownerEmail);
    await expect(page.getByTestId('provider-details-form')).toBeVisible();
    await page.getByLabel('Your name',{exact:true}).fill(ownerName);
    await page.getByLabel('Transporter name',{exact:true}).fill(`Workflow Fleet ${suffix}`);
    await page.getByLabel('Account phone',{exact:true}).fill('+251900000011');
    await page.getByRole('button',{name:'Create transporter workspace'}).click();
    await expect(page).toHaveURL(/\/app\/home$/);
    await expect(page.locator('.launch-first-truck')).toBeVisible({timeout:15000});
    await expect(page.locator('.launch-first-truck')).toContainText('Add your first truck');
    await page.screenshot({path:info.outputPath('first-truck-guidance.png'),fullPage:true});
    await page.locator('.launch-first-truck').getByRole('link',{name:'Add truck',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Add truck',exact:true})).toBeVisible();
    await page.goto('/app/fleet');
    await expect(page.getByText('No trucks added yet.',{exact:true})).toBeVisible();
    const owner=await service.from('profiles').select('id').eq('email',ownerEmail).single();
    expect(owner.error).toBeNull();
    const membership=await service.from('organization_members').select('organization_id').eq('user_id',owner.data!.id).single();
    orgId=membership.data!.organization_id;
    await page.goto('/app/provider-shipments/new');
    await expect(page.getByRole('link',{name:'Add truck'})).toBeVisible();
    await expect(page.locator('form.provider-shipment-form')).toHaveCount(0);
    await page.goto('/app/network');
    await expect(page.getByRole('link',{name:'Manage drivers'})).toBeVisible();
    await page.getByRole('link',{name:'Add truck'}).click();
    await page.getByLabel('Make',{exact:true}).fill('Isuzu');
    await page.getByLabel('Model',{exact:true}).fill('Workflow mini');
    await page.getByLabel('Vehicle configuration',{exact:true}).selectOption('Mini Box Truck');
    await page.getByLabel('Plate number',{exact:true}).fill(`TEST-${suffix}`);
    await page.getByRole('button',{name:'Add truck',exact:true}).click();
    await expect(page.getByRole('region',{name:'Truck driver'})).toContainText('No driver assigned');
    const truckPath=new URL(page.url()).pathname;
    const truckId=truckPath.split('/').at(-1)!;
    await page.getByRole('link',{name:'Assign driver',exact:true}).click();
    await expect(page.locator('.fleet-assignment-context')).toContainText('Workflow mini');
    await page.getByRole('link',{name:'Add driver',exact:true}).first().click();
    await page.getByLabel('Driver name',{exact:true}).fill(driverName);
    await page.getByLabel('Email',{exact:true}).fill(driverEmail);
    await page.getByLabel('Contact phone',{exact:true}).fill('+251900000022');
    await page.screenshot({path:info.outputPath('add-driver-form.png')});
    await page.getByRole('button',{name:'Add driver',exact:true}).click();
    await expect(page.getByText('Driver added. You can assign a truck now; email verification happens when they log in.')).toBeVisible();
    await expect(page.locator('.fleet-invitation-row')).toHaveCount(0);
    const identity=await service.from('profiles').select('id').eq('email',driverEmail).single();
    expect(identity.error).toBeNull();
    const beforeLogin=await service.auth.admin.getUserById(identity.data!.id);
    expect(beforeLogin.data.user?.email_confirmed_at).toBeFalsy();
    const inbox=await (await fetch('http://127.0.0.1:55324/api/v1/messages')).json();
    expect(inbox.messages.some((message:{To:{Address:string}[]})=>message.To.some(to=>to.Address===driverEmail))).toBe(false);
    await driverPage.goto('/app/home');
    await expect(driverPage).toHaveURL(/\/login/);
    const driver=page.locator('.fleet-driver-manager').filter({hasText:driverName});
    await driver.locator('summary').first().click();
    await expect(driver.getByRole('combobox',{name:'Truck',exact:true})).toHaveValue(truckId);
    await driver.getByLabel('Capacity updates',{exact:true}).check();
    await driver.getByLabel('Tracking updates',{exact:true}).check();
    await driver.getByRole('button',{name:'Save driver',exact:true}).click();
    await expect(page).toHaveURL(new RegExp(`${truckPath}\\?success=`));
    await expect(page.getByRole('region',{name:'Truck driver'})).toContainText(driverName);
    const assignment=await service.from('driver_vehicle_assignments').select('driver_user_id').eq('vehicle_id',truckId).eq('active',true).single();
    expect(assignment.data?.driver_user_id).toBe(identity.data!.id);
    expect((await service.auth.admin.getUserById(identity.data!.id)).data.user?.email_confirmed_at).toBeFalsy();
    await page.screenshot({path:info.outputPath('assigned-before-verification.png')});
    await verifyNewEmail(driverPage,driverEmail,true);
    await expect(driverPage).toHaveURL(/\/app\/home$/);
    expect((await service.auth.admin.getUserById(identity.data!.id)).data.user?.email_confirmed_at).toBeTruthy();
    await page.locator('.fleet-truck-details-editor>summary').click();
    await page.getByLabel('Model',{exact:true}).fill('Corrected mini');
    await page.getByRole('button',{name:'Save truck details'}).click();
    await expect(page.getByRole('heading',{name:'Isuzu · Corrected mini'})).toBeVisible();

    async function permissions(capacityAllowed:boolean,trackingAllowed:boolean){
      await page.goto('/app/fleet');
      const row=page.locator('.fleet-driver-manager').filter({hasText:driverName});
      await row.locator('summary').first().click();
      await row.getByLabel('Capacity updates',{exact:true}).setChecked(capacityAllowed);
      await row.getByLabel('Tracking updates',{exact:true}).setChecked(trackingAllowed);
      await row.getByRole('button',{name:'Save driver',exact:true}).click();
      const storedPermissions=await service.from('driver_permissions').select('can_manage_capacity,can_manage_tracking').eq('user_id',identity.data!.id).single();
      expect(storedPermissions.data).toMatchObject({can_manage_capacity:capacityAllowed,can_manage_tracking:trackingAllowed});
    }
    // Reuse the Driver's existing session so revocation must take effect immediately.
    for(const trackingAllowed of [true,false]){
      await permissions(false,trackingAllowed);await driverPage.goto('/app/home');
      await expect(driverPage.getByText('Fleet-managed capacity',{exact:true})).toBeVisible();
      await expect(driverPage.getByText('Ask your fleet owner to set up capacity before marking this truck Available.')).toBeVisible();
      await expect(driverPage.getByRole('button',{name:'Available',exact:true})).toBeDisabled();
      const denied=await driverPage.request.post('/api/capacity',{headers:{Accept:'application/json'},form:{vehicleId:truckId,status:'OFF_DUTY'}});
      expect(denied.status()).toBe(400);expect(await denied.json()).toEqual({error:'You do not have permission to perform that action.'});
      await driverPage.goto('/app/provider-shipments/new');
      if(trackingAllowed)await expect(driverPage.getByRole('combobox',{name:/Truck/})).toBeVisible();
      else{
        await expect(driverPage).toHaveURL(/\/app\/provider-shipments\?error=/);
        const rejected=await driverPage.request.post('/api/provider-shipments',{form:{vehicleId:truckId,cargoSummary:'Denied test',customerEmail:driverEmail}});
        expect(rejected.status()).toBe(400);expect(await rejected.json()).toEqual({error:'You do not have permission to perform that action.'});
      }
    }
    await permissions(true,false);
    await driverPage.goto('/app/provider-shipments/new');
    await expect(driverPage).toHaveURL(/\/app\/provider-shipments\?error=/);
    await driverPage.goto('/app/home');
    await expect(driverPage.getByText('No capacity published yet',{exact:true})).toBeVisible();
    await driverPage.screenshot({path:info.outputPath('new-driver-before-first-capacity.png')});
    const obstruction=await driverPage.evaluate(()=>{
      const banner=document.querySelector('.capacity-summary-map-header')!.getBoundingClientRect();
      const overlaps=(a:DOMRect,b:DOMRect)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
      return [...document.querySelectorAll('.capacity-map-empty>svg,.capacity-map-empty>strong,.capacity-map-empty>span')].some(el=>overlaps(banner,el.getBoundingClientRect()));
    });
    expect(obstruction,'truck banner must not cover first-publication content').toBe(false);
    await expect(driverPage.locator('.capacity-truck-copy')).toContainText('Not published');
    await expect(driverPage.getByRole('button',{name:'Edit approximate location',exact:true})).toHaveCount(0);
    // Hold hydration on a fresh load: the first enabled action must work.
    let releaseScripts=()=>{};
    const scriptsReady=new Promise<void>(resolve=>{releaseScripts=resolve;});
    const scriptPattern='**/_next/static/**/*.js';
    await driverPage.route(scriptPattern,async(route:any)=>{await scriptsReady;await route.continue();});
    try{
      await driverPage.goto('/app/home',{waitUntil:'commit'});
      await expect(driverPage.getByRole('button',{name:'Set capacity',exact:true})).toBeDisabled();
      await expect(driverPage.getByRole('button',{name:/^Edit current capacity:/})).toBeDisabled();
    }finally{releaseScripts();}
    const firstAction=driverPage.getByRole('button',{name:'Set capacity',exact:true});
    await expect(firstAction).toBeEnabled();
    await driverPage.unroute(scriptPattern);
    if(info.project.name.includes('mobile'))await driverPage.setViewportSize({width:320,height:640});
    await firstAction.scrollIntoViewIfNeeded();
    expect(await driverPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const box=await firstAction.boundingBox();
    expect(await driverPage.evaluate(({x,y}:any)=>Boolean(document.elementFromPoint(x,y)?.closest('.capacity-map-empty button')),{x:box.x+box.width/2,y:box.y+box.height/2})).toBe(true);
    await driverPage.screenshot({path:info.outputPath('new-driver-ready-to-set-capacity.png')});
    if(info.project.name.includes('mobile'))await firstAction.tap();else await firstAction.click();
    const capacity=driverPage.getByRole('dialog',{name:'Current capacity',exact:true});
    await expect(capacity).toBeVisible();
    await expect(capacity.getByRole('button',{name:'Save',exact:true})).toBeDisabled();
    await capacity.getByRole('button',{name:'Cancel',exact:true}).click();
    await expect(capacity).toHaveCount(0);
    const unpublished=await service.from('capacities').select('id',{count:'exact',head:true}).eq('vehicle_id',truckId);
    expect(unpublished.error).toBeNull();expect(unpublished.count).toBe(0);
    if(info.project.name.includes('mobile'))await firstAction.tap();else await firstAction.click();
    await expect(capacity).toBeVisible();
    await capacity.getByRole('button',{name:'Capacity route',exact:true}).click();
    await selectPlace(driverPage,'City 1','Addis Ababa');
    await selectPlace(driverPage,'City 2','Sebeta');
    await capacity.getByRole('button',{name:'Use my location',exact:true}).click();
    await expect(capacity.getByText(/Location ready/)).toBeVisible();
    const saveResponse=driverPage.waitForResponse((response:any)=>response.url().endsWith('/api/capacity')&&response.request().method()==='POST');
    await capacity.getByRole('button',{name:'Save',exact:true}).click();
    expect(await (await saveResponse).json()).toMatchObject({ok:true});
    await expect(capacity).toHaveCount(0);
    const stored=await service.from('capacities').select('market_status,visibility,vehicle_id,updated_by').eq('vehicle_id',truckId).order('updated_at',{ascending:false}).limit(1).single();
    expect(stored.error).toBeNull();
    expect(stored.data).toMatchObject({market_status:'EMPTY',visibility:'PRIVATE',vehicle_id:truckId,updated_by:identity.data!.id});
    await expect(driverPage.getByRole('button',{name:'Edit current capacity: Empty'})).toBeVisible();
    await expect(driverPage.getByTestId('capacity-summary').locator('.leaflet-container')).toBeVisible();
    await expect(driverPage.getByRole('button',{name:'Edit current capacity: Empty'})).toBeEnabled();
    if(info.project.name.includes('mobile'))await driverPage.setViewportSize(page.viewportSize()!);
    await expect(driverPage.locator('.capacity-location-map img.leaflet-tile-loaded').first()).toBeVisible({timeout:15000});
    await driverPage.screenshot({path:info.outputPath('new-driver-published-capacity.png')});
    await permissions(true,true);
    await driverPage.goto('/app/provider-shipments/new');
    await expect(driverPage.getByRole('combobox',{name:/Truck/})).toBeVisible();
    await driverPage.goto('/app/network');
    await expect(driverPage.getByRole('button',{name:'Add access',exact:true})).toBeVisible();

    // A second truck starts with no capacity; its owner retains publication control.
    await page.goto('/app/fleet/new');
    await page.getByLabel('Make',{exact:true}).fill('Isuzu');
    await page.getByLabel('Model',{exact:true}).fill('Owner managed');
    await page.getByLabel('Vehicle configuration',{exact:true}).selectOption('Mini Box Truck');
    await page.getByLabel('Plate number',{exact:true}).fill(`SECOND-${suffix}`);
    await page.getByRole('button',{name:'Add truck',exact:true}).click();
    await expect(page.getByRole('region',{name:'Truck driver'})).toContainText('No driver assigned');
    const secondPath=new URL(page.url()).pathname,secondId=secondPath.split('/').at(-1)!;
    await page.getByRole('link',{name:'Assign driver',exact:true}).click();
    const reassigned=page.locator('.fleet-driver-manager').filter({hasText:driverName});
    await reassigned.locator('summary').first().click();
    await expect(reassigned.getByLabel('Truck',{exact:true})).toHaveValue(secondId);
    await reassigned.getByLabel('Capacity updates',{exact:true}).uncheck();
    await reassigned.getByLabel('Tracking updates',{exact:true}).uncheck();
    await reassigned.getByRole('button',{name:'Save driver',exact:true}).click();
    await expect(page.getByRole('region',{name:'Truck driver'})).toContainText(driverName);
    await page.getByRole('button',{name:'Set capacity',exact:true}).click();
    const ownerCapacity=page.getByRole('dialog',{name:'Current capacity',exact:true});
    await expect(ownerCapacity).toContainText('Ask the assigned driver to open Home');
    await expect(ownerCapacity.getByRole('button',{name:'Save',exact:true})).toBeDisabled();
    await expect(ownerCapacity.getByRole('button',{name:'Use my location',exact:true})).toHaveCount(0);
    await ownerCapacity.getByRole('button',{name:'Cancel',exact:true}).click();
    await driverPage.addInitScript(()=>{
      (window as any).locationReads=0;
      const original=navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition=(...args)=>{(window as any).locationReads++;return original(...args);};
    });
    await driverPage.goto('/app/home');
    await expect(driverPage.getByRole('button',{name:'Share truck location',exact:true})).toBeEnabled();
    expect(await driverPage.evaluate(()=>(window as any).locationReads)).toBe(0);
    await driverPage.screenshot({path:info.outputPath('owner-managed-first-location.png'),fullPage:true});
    await driverPage.getByRole('button',{name:'Share truck location',exact:true}).click();
    await expect(driverPage.getByRole('button',{name:'Refresh truck location',exact:true})).toBeEnabled();
    expect(await driverPage.evaluate(()=>(window as any).locationReads)).toBe(1);
    expect((await service.from('capacities').select('id',{count:'exact',head:true}).eq('vehicle_id',secondId)).count).toBe(0);
    const firstFix=await service.from('vehicle_driver_locations').select('driver_user_id,precision_km,latitude,longitude').eq('vehicle_id',secondId).single();
    expect(firstFix.error).toBeNull();expect(firstFix.data).toMatchObject({driver_user_id:identity.data!.id,precision_km:40});
    expect(firstFix.data!.latitude).not.toBe(9.03);expect(firstFix.data!.longitude).not.toBe(38.76);
    await page.reload();
    await page.getByRole('button',{name:/^Edit current capacity:/}).click();
    await ownerCapacity.getByRole('button',{name:'Capacity route',exact:true}).click();
    await selectPlace(page,'City 1','Addis Ababa');await selectPlace(page,'City 2','Sebeta');
    await ownerCapacity.getByRole('button',{name:'Save',exact:true}).click();
    await expect(ownerCapacity).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Edit current capacity: Empty'})).toBeEnabled();
    const ownerSignal=await service.from('capacities').select('updated_by,market_status,visibility,location_lat,location_lng').eq('vehicle_id',secondId).order('updated_at',{ascending:false}).limit(1).single();
    expect(ownerSignal.error).toBeNull();expect(ownerSignal.data).toMatchObject({updated_by:owner.data!.id,market_status:'EMPTY',visibility:'PRIVATE',location_lat:firstFix.data!.latitude,location_lng:firstFix.data!.longitude});
    await expect.poll(async()=>{
      const host=await page.getByTestId('capacity-summary').locator('.leaflet-container').boundingBox();
      const marker=await page.locator('.capacity-setting-truck-marker').boundingBox();
      return Boolean(host&&marker&&marker.x>=host.x&&marker.x+marker.width<=host.x+host.width&&marker.y>=host.y&&marker.y+marker.height<=host.y+host.height);
    }).toBe(true);
    await page.screenshot({path:info.outputPath('owner-published-driver-location.png'),fullPage:true});
    await driverPage.reload();
    await driverPage.getByRole('button',{name:'Off Duty',exact:true}).click();
    await expect(driverPage.getByRole('button',{name:'Available',exact:true})).toBeDisabled();
    await expect(driverPage.getByText('Refresh your truck location before marking it Available.')).toBeVisible();
    await driverPage.getByRole('button',{name:'Refresh truck location',exact:true}).click();
    await expect(driverPage.getByRole('button',{name:'Available',exact:true})).toBeEnabled();
    await driverPage.getByRole('button',{name:'Available',exact:true}).click();
    await expect(driverPage.getByRole('button',{name:'Off Duty',exact:true})).toBeEnabled();
    await driverPage.screenshot({path:info.outputPath('owner-managed-duty-restored.png'),fullPage:true});

    await page.goto('/app/fleet');
    const managed=page.locator('.fleet-driver-manager').filter({hasText:driverName});
    await managed.locator('summary').first().click();
    await managed.getByText('Edit contact',{exact:true}).click();
    await managed.getByLabel('Driver name',{exact:true}).fill(`Updated Driver ${suffix}`);
    await managed.getByLabel('Contact phone',{exact:true}).fill('+251900000033');
    await managed.getByRole('button',{name:'Save contact'}).click();
    const updated=page.locator('.fleet-driver-manager').filter({hasText:`Updated Driver ${suffix}`});
    await expect(updated).toContainText('+251900000033');
    await updated.locator('summary').first().click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await updated.screenshot({path:info.outputPath('driver-management.png')});
    await updated.getByText('Remove from fleet',{exact:true}).click();
    await updated.getByLabel('I confirm removal from this fleet.').check();
    await updated.getByRole('button',{name:'Remove driver',exact:true}).click();
    await expect(page.locator('.fleet-driver-manager')).toHaveCount(0);
    await page.goto(truckPath);
    await expect(page.getByRole('region',{name:'Truck driver'})).toContainText('No driver assigned');
    await driverPage.goto('/app/home');
    await expect(driverPage).toHaveURL(/\/login\?error=/);
  }finally{
    await driverContext.close().catch(()=>{});
    // Exact local test identities only; never reset shared demo fixtures.
    const profiles=await service.from('profiles').select('id').in('email',[ownerEmail,driverEmail]);
    const ids=(profiles.data||[]).map((profile:{id:string})=>profile.id);
    if(orgId){
      for(const table of ['fleet_driver_invitations','audit_logs']){
        const deleted=await service.from(table).delete().eq('organization_id',orgId);expect(deleted.error).toBeNull();
      }
      const capacities=await service.from('capacities').delete().eq('provider_organization_id',orgId);expect(capacities.error).toBeNull();
      const vehicles=await service.from('vehicles').delete().eq('organization_id',orgId);expect(vehicles.error).toBeNull();
      const deleted=await service.from('organizations').delete().eq('id',orgId);expect(deleted.error).toBeNull();
    }
    if(ids.length){
      await service.from('audit_logs').delete().in('actor_user_id',ids);
      await service.from('driver_permissions').delete().in('user_id',ids);
      for(const id of ids){const deleted=await service.auth.admin.deleteUser(id);expect(deleted.error).toBeNull();}
    }
  }
});

for(const useBasis of ['OWNED','PERMISSION']){
 test(`independent driver ${useBasis} signs up, adds a truck and publishes after location permission`,async({page,context}:{page:any;context:any},info:any)=>{
  test.setTimeout(150000);
  nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
  const endpoint=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL||'');
  if(!['localhost','127.0.0.1'].includes(endpoint.hostname)||endpoint.port!=='55321')throw new Error('LOCAL_LOADGISTIC_REQUIRED');
  const service=createClient(endpoint.href,process.env.SUPABASE_SERVICE_ROLE_KEY||'',{auth:{persistSession:false,autoRefreshToken:false}});
  const suffix=randomUUID().slice(0,8),email=`independent-${suffix}@loadgistic.local`;
  let userId='',providerId='',vehicleId='';
  try{
   await verifyNewEmail(page,email);
   await page.locator('input[name="applicationType"][value="SELF_MANAGED_DRIVER"]').check();
   await page.getByLabel('Your name',{exact:true}).fill(`Independent ${suffix}`);
   await page.getByLabel('Transporter name',{exact:true}).fill(`Independent Transport ${suffix}`);
   await page.getByLabel('Account phone',{exact:true}).fill('+251900000044');
   await page.getByRole('button',{name:'Create transporter workspace'}).click();
   await expect(page.getByRole('heading',{name:'Add your first truck',exact:true})).toBeVisible();
   const identity=await service.from('profiles').select('id,role').eq('email',email).single();
   expect(identity.error).toBeNull();userId=identity.data!.id;expect(identity.data!.role).toBe('DRIVER');
   const provider=await service.from('provider_profiles').select('id').eq('user_id',userId).single();expect(provider.error).toBeNull();providerId=provider.data!.id;
   await page.getByRole('link',{name:'Add truck',exact:true}).click();
   await page.getByRole('radio',{name:useBasis==='OWNED'?'I own this truck':"I rent it or have the owner's permission",exact:true}).check();
   await page.getByLabel('Make',{exact:true}).fill('Isuzu');await page.getByLabel('Model',{exact:true}).fill('Independent mini');
   await page.getByLabel('Vehicle configuration',{exact:true}).selectOption('Mini Box Truck');await page.getByLabel('Plate number',{exact:true}).fill(`IND-${suffix}`);
   await page.getByRole('button',{name:'Add your truck',exact:true}).click();
   await expect(page.getByRole('heading',{name:'My truck',exact:true})).toBeVisible();vehicleId=new URL(page.url()).pathname.split('/').at(-1)!;
   expect((await service.from('vehicles').select('use_basis').eq('id',vehicleId).single()).data?.use_basis).toBe(useBasis);
   await page.goto('/app/home');await page.getByRole('button',{name:'Set capacity',exact:true}).click();
   const dialog=page.getByRole('dialog',{name:'Current capacity',exact:true});
   await dialog.getByRole('button',{name:'Capacity route',exact:true}).click();
   await selectPlace(page,'City 1','Addis Ababa');await selectPlace(page,'City 2','Sebeta');
   // A denied sensor is a recoverable draft error; it must never publish.
   await context.clearPermissions();
   await page.evaluate(()=>{const original=navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);(window as any).restoreGps=()=>{navigator.geolocation.getCurrentPosition=original;};navigator.geolocation.getCurrentPosition=(_success,error)=>error?.({code:1,PERMISSION_DENIED:1} as GeolocationPositionError);});
   await dialog.getByRole('button',{name:'Use my location',exact:true}).click();
   await expect(dialog.getByRole('alert')).toContainText('Allow location');await expect(dialog.getByRole('button',{name:'Save',exact:true})).toBeDisabled();
   expect((await service.from('capacities').select('id',{count:'exact',head:true}).eq('vehicle_id',vehicleId)).count).toBe(0);
   await page.evaluate(()=>(window as any).restoreGps());await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:9.03,longitude:38.76});
   await dialog.getByRole('button',{name:'Use my location',exact:true}).click();await expect(dialog.getByText(/Location ready/)).toBeVisible();
   await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toHaveCount(0);
   await expect(page.getByRole('button',{name:'Edit current capacity: Empty'})).toBeEnabled();
   const published=await service.from('capacities').select('updated_by,visibility,location_lat,location_precision_km').eq('vehicle_id',vehicleId).order('updated_at',{ascending:false}).limit(1).single();
   expect(published.error).toBeNull();expect(published.data).toMatchObject({updated_by:userId,visibility:'PRIVATE',location_precision_km:20});expect(published.data!.location_lat).not.toBe(9.03);
   await expect(page.getByTestId('capacity-summary').locator('.leaflet-container')).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:info.outputPath(`${useBasis.toLowerCase()}-first-capacity.png`),fullPage:true});
  }finally{
   // Exact synthetic identities only, including a partially completed signup.
   if(!userId)userId=(await service.from('profiles').select('id').eq('email',email).maybeSingle()).data?.id||'';
   if(userId){
    expect((await service.from('audit_logs').delete().eq('actor_user_id',userId)).error).toBeNull();
    if(!providerId)providerId=(await service.from('provider_profiles').select('id').eq('user_id',userId).maybeSingle()).data?.id||'';
    if(providerId){expect((await service.from('capacities').delete().eq('provider_profile_id',providerId)).error).toBeNull();expect((await service.from('vehicles').delete().eq('provider_profile_id',providerId)).error).toBeNull();}
    expect((await service.auth.admin.deleteUser(userId)).error).toBeNull();
   }
  }
 });
}
