import {auditDeleteVehicles} from './audit-helpers';
import {expect as baseExpect,test} from './browser-test';
// Dev-server navigation includes server rendering; await the complete state.
const expect=baseExpect.configure({timeout:15000});
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {localMailpitNumericCode} from './mailpit-helper';
import {openFleetDriver} from './fleet-task-helpers';

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

async function acceptContentRules(page:any){
  const heading=page.getByRole('heading',{name:'Before you share',exact:true});
  await expect(heading).toBeVisible();
  await page.getByLabel('I agree to the Terms and content rules.',{exact:true}).check();
  await page.getByRole('button',{name:'Accept and continue',exact:true}).click();
  await expect(heading).toHaveCount(0);
}

test('fleet assigns an unverified driver, then email-code login unlocks the same assignment',async({page,browser}:{page:any;browser:any},info:any)=>{
  test.setTimeout(420_000);
  nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
  const endpoint=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
  if(!['localhost','127.0.0.1'].includes(new URL(endpoint).hostname)||new URL(endpoint).port!=='55321')throw new Error('REMOTE_FLEET_TEST_REFUSED');
  const service=createClient(endpoint,process.env.SUPABASE_SERVICE_ROLE_KEY||'',{auth:{persistSession:false,autoRefreshToken:false}});
  const suffix=randomUUID().slice(0,8);
  const ownerEmail=`fleet-owner-${suffix}@loadgistic.local`,driverEmail=`fleet-driver-${suffix}@loadgistic.local`;
  const ownerName=`Fleet Owner ${suffix}`,driverName=`Added Driver ${suffix}`;
  const driverContext=await browser.newContext({baseURL:info.project.use.baseURL,
    viewport:page.viewportSize()||undefined,isMobile:Boolean(info.project.use.isMobile),hasTouch:Boolean(info.project.use.hasTouch),
    permissions:['geolocation'],geolocation:{latitude:9.03,longitude:38.76},
    extraHTTPHeaders:{'x-forwarded-for':'127.0.0.241'}});
  const driverPage=await driverContext.newPage();
  // Keep the onboarding gate independent of public tile-provider availability.
  // Actual tile delivery is checked separately; this fixture exercises map rendering.
  await driverContext.route('https://tile.openstreetmap.org/**',async(route:any)=>route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eef3f1"/></svg>'}));
  let providerId='',stage='SIGNUP',cleanupStage='NOT_STARTED',complete=false,cleaned=false,cleanupFailed=false;
  let primaryFailure:unknown=null;
  const owned={ownerId:'',employeeId:'',providerId:'',vehicleIds:[] as string[]};
  let absence:Record<string,number>|null=null;
  const evidence=()=>{writeFileSync(info.outputPath('fleet-onboarding-owned.json'),JSON.stringify(owned,null,2),{mode:0o600});writeFileSync(info.outputPath('fleet-onboarding-checks.json'),JSON.stringify({target:'loadgistic-local',stage,cleanupStage,complete,cleaned,cleanupFailed,absence},null,2),{mode:0o600});};
  const checkpoint=(next:string)=>{stage=next;evidence();};evidence();
  try{
    // No seeded owner, driver, membership or assignment: both identities use the public flow.
    await verifyNewEmail(page,ownerEmail);
    const signupIdentity=await service.from('profiles').select('id').eq('email',ownerEmail).single();expect(signupIdentity.error).toBeNull();owned.ownerId=signupIdentity.data!.id;evidence();
    await acceptContentRules(page);
    await page.getByRole('button',{name:/Transport Provider.*Set up your vehicles/}).click();
    await expect(page.getByTestId('provider-details-form')).toBeVisible();
    await expect(page.getByLabel('Account name',{exact:true})).toBeEmpty();
    await expect(page.getByLabel('Handle',{exact:true})).toBeEmpty();
    await page.getByLabel('First name',{exact:true}).fill(ownerName);
    await page.getByLabel('Last / father name',{exact:true}).fill('');
    await page.getByLabel('Account name',{exact:true}).fill(`Workflow Fleet ${suffix}`);
    await page.getByLabel('Handle',{exact:true}).fill(`workflow-fleet-${suffix}`);
    await expect(page.locator('input[name="applicationType"]')).toHaveValue('TRANSPORT_PROVIDER');
    await expect(page.getByRole('radio')).toHaveCount(0);
    await expect(page.getByRole('checkbox',{name:/^I drive a vehicle/})).not.toBeChecked();
    await page.getByLabel('Account phone',{exact:true}).fill('+251900000011');
    await page.getByRole('button',{name:'Create transporter workspace'}).click();
    await expect(page).toHaveURL(/\/app\/home$/);
    await expect(page.getByRole('heading',{name:'No vehicles added yet.',exact:true})).toBeVisible({timeout:15000});
    const createdProvider=await service.from('provider_profiles').select('id').eq('user_id',owned.ownerId).single();expect(createdProvider.error).toBeNull();providerId=createdProvider.data!.id;owned.providerId=providerId;checkpoint('FIRST_TRUCK');
    await page.screenshot({path:info.outputPath('first-truck-guidance.png'),fullPage:true});
    await page.getByRole('link',{name:'Add vehicle',exact:true}).first().click();
    await expect(page.getByRole('heading',{name:'Add vehicle',exact:true})).toBeVisible();
    await page.goto('/app/fleet');
    await expect(page.getByText('No vehicles added yet.',{exact:true})).toBeVisible();
    const owner=await service.from('profiles').select('id').eq('email',ownerEmail).single();
    expect(owner.error).toBeNull();
    const companySubscriptions=await service.from('subscriptions').select('id',{count:'exact',head:true}).eq('provider_profile_id',providerId);
    expect(companySubscriptions.error).toBeNull();expect(companySubscriptions.count).toBe(0);
    await page.goto('/app/provider-shipments/new');
    await expect(page.getByRole('link',{name:'Add vehicle'})).toBeVisible();
    await expect(page.locator('form.provider-shipment-form')).toHaveCount(0);
    await page.goto('/app/network');
    await expect(page.getByRole('link',{name:'Manage drivers'})).toBeVisible();
    await page.getByRole('link',{name:'Add vehicle'}).click();
    await page.getByLabel('Make',{exact:true}).fill('Isuzu');
    await page.getByLabel('Model',{exact:true}).fill('Workflow mini');
    await page.getByLabel('Vehicle configuration',{exact:true}).selectOption('Mini Box Truck');
    await page.getByLabel('Plate number',{exact:true}).fill(`TEST-${suffix}`);
    await page.getByRole('radio',{name:'I own this vehicle',exact:true}).check();
    await page.getByRole('button',{name:'Add vehicle',exact:true}).click();
    await expect(page).toHaveURL(/\/app\/fleet\/[0-9a-f-]+(?:\?.*)?$/);
    const truckPath=new URL(page.url()).pathname;
    const truckId=truckPath.split('/').at(-1)!;owned.vehicleIds.push(truckId);evidence();
    await expect(page.getByRole('region',{name:'Vehicle driver'})).toContainText('No driver assigned');
    await expect(page.getByRole('button',{name:'Go live',exact:true})).toBeEnabled();
    await page.getByRole('button',{name:'Go live',exact:true}).click();
    await page.getByRole('link',{name:'Assign driver',exact:true}).click();
    await expect(page.getByText('Assign a driver to Isuzu Workflow mini. Choose a driver below and save.',{exact:true})).toBeVisible();
    await page.getByRole('link',{name:'Add driver',exact:true}).first().click();
    await page.getByLabel('Driver name',{exact:true}).fill(driverName);
    await page.getByLabel('Email',{exact:true}).fill(driverEmail);
    await page.getByLabel('Contact phone',{exact:true}).fill('+251900000022');
    await page.screenshot({path:info.outputPath('add-driver-form.png')});
    await page.getByRole('button',{name:'Add driver',exact:true}).click();
    await expect(page.getByText('Driver added. You can assign a vehicle now; email verification happens when they log in.')).toBeVisible();
    await expect(page.locator('.fleet-invitation-row')).toHaveCount(0);
    const identity=await service.from('profiles').select('id').eq('email',driverEmail).single();
    expect(identity.error).toBeNull();owned.employeeId=identity.data!.id;checkpoint('EMPLOYEE_ASSIGNMENT');
    const beforeLogin=await service.auth.admin.getUserById(identity.data!.id);
    expect(beforeLogin.data.user?.email_confirmed_at).toBeFalsy();
    const inbox=await (await fetch('http://127.0.0.1:55324/api/v1/messages')).json();
    expect(inbox.messages.some((message:{To:{Address:string}[]})=>message.To.some(to=>to.Address===driverEmail))).toBe(false);
    await driverPage.goto('/app/home');
    await expect(driverPage).toHaveURL(/\/login/);
    const driver=await openFleetDriver(page,{name:driverName},true);
    await expect(driver.getByRole('combobox',{name:'Vehicle',exact:true})).toHaveValue(truckId);
    await driver.getByLabel('Capacity updates',{exact:true}).check();
    await driver.getByLabel('Tracking updates',{exact:true}).check();
    await driver.getByRole('button',{name:'Save driver',exact:true}).click();
    await expect(page).toHaveURL(new RegExp(`${truckPath}\\?success=`));
    await expect(page.getByRole('region',{name:'Vehicle driver'})).toContainText(driverName);
    const assignment=await service.from('driver_vehicle_assignments').select('driver_user_id').eq('vehicle_id',truckId).eq('active',true).single();
    expect(assignment.data?.driver_user_id).toBe(identity.data!.id);
    expect((await service.auth.admin.getUserById(identity.data!.id)).data.user?.email_confirmed_at).toBeFalsy();
    await page.screenshot({path:info.outputPath('assigned-before-verification.png')});
    await verifyNewEmail(driverPage,driverEmail,true);
    await expect(driverPage).toHaveURL(/\/app\/home$/);
    await acceptContentRules(driverPage);
    expect((await service.auth.admin.getUserById(identity.data!.id)).data.user?.email_confirmed_at).toBeTruthy();
    await page.getByRole('link',{name:'Vehicle details',exact:true}).click();await page.getByRole('button',{name:'Edit vehicle details',exact:true}).click();
    await page.getByLabel('Model',{exact:true}).fill('Corrected mini');
    const updatedPage=page.waitForResponse((response:any)=>new URL(response.url()).pathname===truckPath&&response.request().method()==='GET');
    await page.getByRole('button',{name:'Save vehicle details'}).click();
    const rendered=await updatedPage;expect(rendered.status()).toBe(200);await rendered.finished();
    await expect(page.getByRole('heading',{name:'Isuzu Corrected mini'})).toBeVisible();
    const denialRoute=await Promise.all(['addis ababa','adama','dire dawa'].map(async city=>{
      const place=await service.from('place_catalog').select('id').eq('normalized_name',city).limit(1).single();expect(place.error).toBeNull();return place.data!.id;
    }));

    async function permissions(capacityAllowed:boolean,trackingAllowed:boolean){
      await page.goto('/app/fleet');
      const row=await openFleetDriver(page,{name:driverName},true);
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
      await expect(driverPage.getByText('Ask your fleet owner to set up capacity before marking this vehicle Available.')).toBeVisible();
      await expect(driverPage.getByRole('button',{name:'Available',exact:true})).toBeDisabled();
      const denied=await driverPage.request.post('/api/capacity',{headers:{Accept:'application/json'},form:{vehicleId:truckId,status:'OFF_DUTY'}});
      expect(denied.status()).toBe(400);expect(await denied.json()).toEqual({error:'You do not have permission to perform that action.'});
      await driverPage.goto('/app/provider-shipments/new');
      if(trackingAllowed)await expect(driverPage.locator('input[name=vehicleId]')).toHaveValue(truckId);
      else{
        await expect(driverPage).toHaveURL(/\/app\/provider-shipments\?error=/);
        const rejected=await driverPage.request.post('/api/provider-shipments',{form:{vehicleId:truckId,cargoSummary:'Denied test',customerEmail:driverEmail,originPlaceRef:denialRoute[0],passingPlaceRef:denialRoute[1],destinationPlaceRef:denialRoute[2],expectedDeliveryDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),trackingMode:'STATUS_ONLY'}});
        expect(rejected.status()).toBe(400);expect(await rejected.json()).toEqual({error:'You do not have permission to perform that action.'});
        const deniedShipments=await service.from('provider_shipments').select('id',{count:'exact',head:true}).eq('assigned_vehicle_id',truckId);expect(deniedShipments.error).toBeNull();expect(deniedShipments.count).toBe(0);
      }
    }
    await permissions(true,false);
    await driverPage.goto('/app/provider-shipments/new');
    await expect(driverPage).toHaveURL(/\/app\/provider-shipments\?error=/);
    await driverPage.goto('/app/home');
    await expect(driverPage.getByText('No Driver location',{exact:true})).toBeVisible();
    await driverPage.screenshot({path:info.outputPath('new-driver-before-first-capacity.png')});
    const obstruction=await driverPage.evaluate(()=>{
      const banner=document.querySelector('.capacity-summary-map-header')!.getBoundingClientRect();
      const overlaps=(a:DOMRect,b:DOMRect)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
      return [...document.querySelectorAll('.capacity-map-empty>svg,.capacity-map-empty>strong,.capacity-map-empty>span')].some(el=>overlaps(banner,el.getBoundingClientRect()));
    });
    expect(obstruction,'vehicle banner must not cover first-publication content').toBe(false);
    await expect(driverPage.getByRole('button',{name:'Edit current capacity: Off Duty',exact:true})).toBeEnabled();
    await expect(driverPage.getByRole('button',{name:'Edit approximate location',exact:true})).toBeEnabled();
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
    checkpoint('FIRST_CAPACITY');const firstAction=driverPage.getByRole('button',{name:'Set capacity',exact:true});
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
    await expect(capacity.getByRole('button',{name:'Off Duty',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(capacity.getByRole('button',{name:'Save',exact:true})).toBeEnabled();
    await capacity.getByRole('button',{name:'Empty',exact:true}).click();
    await expect(capacity.getByRole('button',{name:'Save',exact:true})).toBeDisabled();
    await capacity.getByRole('button',{name:'Cancel',exact:true}).click();
    await expect(capacity).toHaveCount(0);
    const unpublished=await service.from('capacities').select('id',{count:'exact',head:true}).eq('vehicle_id',truckId).neq('market_status','OFF_DUTY');
    expect(unpublished.error).toBeNull();expect(unpublished.count).toBe(0);
    if(info.project.name.includes('mobile'))await firstAction.tap();else await firstAction.click();
    await expect(capacity).toBeVisible();
    await expect(capacity.getByRole('button',{name:'Off Duty',exact:true})).toHaveAttribute('aria-pressed','true');
    await capacity.getByRole('button',{name:'Empty',exact:true}).click();
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
    await expect(driverPage.locator('input[name=vehicleId]')).toHaveValue(truckId);
    await expect(driverPage.getByRole('combobox',{name:/Vehicle/})).toHaveCount(0);
    await driverPage.goto('/app/network');
    await expect(driverPage.getByRole('button',{name:'Add access',exact:true})).toBeVisible();

    checkpoint('REASSIGNMENT');
    // Reassignment creates only a new-pair Off Duty reset; the owner controls publication.
    await page.goto('/app/fleet/new');
    await page.getByLabel('Make',{exact:true}).fill('Isuzu');
    await page.getByLabel('Model',{exact:true}).fill('Owner managed');
    await page.getByLabel('Vehicle configuration',{exact:true}).selectOption('Mini Box Truck');
    await page.getByLabel('Plate number',{exact:true}).fill(`SECOND-${suffix}`);
    await page.getByRole('radio',{name:'I own this vehicle',exact:true}).check();
    await page.getByRole('button',{name:'Add vehicle',exact:true}).click();
    await expect(page).toHaveURL(/\/app\/fleet\/[0-9a-f-]+(?:\?.*)?$/);
    const secondPath=new URL(page.url()).pathname,secondId=secondPath.split('/').at(-1)!;owned.vehicleIds.push(secondId);evidence();
    await expect(page.getByRole('region',{name:'Vehicle driver'})).toContainText('No driver assigned');
    await page.getByRole('link',{name:'Assign driver',exact:true}).click();
    const reassigned=await openFleetDriver(page,{name:driverName},true);
    await expect(reassigned.getByLabel('Vehicle',{exact:true})).toHaveValue(secondId);
    await reassigned.getByLabel('Capacity updates',{exact:true}).uncheck();
    await reassigned.getByLabel('Tracking updates',{exact:true}).uncheck();
    await reassigned.getByRole('button',{name:'Save driver',exact:true}).click();
    await expect(page.getByRole('region',{name:'Vehicle driver'})).toContainText(driverName);
    // Reuse the one document-free Live slot without inventing qualification.
    // Retain the original truck, pair history and capacity records as Draft.
    await page.goto(truckPath);await page.getByRole('button',{name:'Move to draft',exact:true}).click();
    await page.goto(secondPath);await page.getByRole('button',{name:'Go live',exact:true}).click();
    await page.getByRole('button',{name:'Set capacity',exact:true}).click();
    const ownerCapacity=page.getByRole('dialog',{name:'Current capacity',exact:true});
    await expect(ownerCapacity.getByRole('button',{name:'Off Duty',exact:true})).toHaveAttribute('aria-pressed','true');
    await ownerCapacity.getByRole('button',{name:'Empty',exact:true}).click();
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
    await expect(driverPage.getByRole('button',{name:'Edit capacity location',exact:true})).toBeEnabled();
    expect(await driverPage.evaluate(()=>(window as any).locationReads)).toBe(0);
    await driverPage.screenshot({path:info.outputPath('owner-managed-first-location.png'),fullPage:true});
    await driverPage.getByRole('button',{name:'Edit capacity location',exact:true}).click();
    const firstLocation=driverPage.getByRole('dialog',{name:'Capacity map location',exact:true});
    await expect(firstLocation.getByRole('button',{name:'Use my phone',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(firstLocation.getByText('Phone location can be shared when this vehicle is Available.',{exact:true})).toBeVisible();
    await firstLocation.getByLabel('Shared location accuracy').selectOption('10');
    const firstLocationSave=driverPage.waitForResponse((response:any)=>new URL(response.url()).pathname==='/api/capacity/location'&&response.request().method()==='POST');
    await firstLocation.getByRole('button',{name:'Save location',exact:true}).click();
    expect((await firstLocationSave).status()).toBe(200);await expect(firstLocation).toHaveCount(0);
    expect(await driverPage.evaluate(()=>(window as any).locationReads)).toBe(1);
    expect((await service.from('capacities').select('id',{count:'exact',head:true}).eq('vehicle_id',secondId).neq('market_status','OFF_DUTY')).count).toBe(0);
    const firstFix=await service.from('vehicle_driver_locations').select('driver_user_id,precision_km,latitude,longitude').eq('vehicle_id',secondId).single();
    expect(firstFix.error).toBeNull();expect(firstFix.data).toMatchObject({driver_user_id:identity.data!.id,precision_km:10});
    expect(firstFix.data!.latitude).not.toBe(9.03);expect(firstFix.data!.longitude).not.toBe(38.76);
    await page.reload();
    await page.getByRole('button',{name:/^Edit current capacity:/}).click();
    await expect(ownerCapacity.getByRole('button',{name:'Off Duty',exact:true})).toHaveAttribute('aria-pressed','true');
    await ownerCapacity.getByRole('button',{name:'Empty',exact:true}).click();
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
    const offDuty=driverPage.getByRole('button',{name:'Off Duty',exact:true});
    await offDuty.scrollIntoViewIfNeeded();
    if(info.project.name.includes('mobile')){
      const action=await offDuty.boundingBox(),navigation=await driverPage.getByRole('navigation',{name:'Mobile navigation'}).boundingBox();
      expect(action).not.toBeNull();expect(navigation).not.toBeNull();
      expect(action!.y+action!.height).toBeLessThanOrEqual(navigation!.y);
      expect(action!.height).toBeGreaterThanOrEqual(44);
    }
    await offDuty.click();
    await expect(driverPage.getByRole('button',{name:'Available',exact:true})).toBeDisabled();
    await expect(driverPage.getByText('Refresh your vehicle location before marking it Available.')).toBeVisible();
    await driverPage.getByRole('button',{name:'Edit capacity location',exact:true}).click();
    const renewedLocation=driverPage.getByRole('dialog',{name:'Capacity map location',exact:true});
    const renewedSave=driverPage.waitForResponse((response:any)=>new URL(response.url()).pathname==='/api/capacity/location'&&response.request().method()==='POST');
    await renewedLocation.getByRole('button',{name:'Save location',exact:true}).click();
    expect((await renewedSave).status()).toBe(200);await expect(renewedLocation).toHaveCount(0);
    await expect(driverPage.getByRole('button',{name:'Available',exact:true})).toBeEnabled();
    await driverPage.getByRole('button',{name:'Available',exact:true}).click();
    await expect(driverPage.getByRole('button',{name:'Off Duty',exact:true})).toBeEnabled();
    await driverPage.screenshot({path:info.outputPath('owner-managed-duty-restored.png'),fullPage:true});

    checkpoint('DRIVER_OFFBOARD');await page.goto('/app/fleet');
    const managed=await openFleetDriver(page,{name:driverName});await managed.getByRole('link',{name:'Contact',exact:true}).click();
    await page.getByRole('button',{name:'Edit contact',exact:true}).click();
    await managed.getByLabel('Driver name',{exact:true}).fill(`Updated Driver ${suffix}`);
    await managed.getByLabel('Contact phone',{exact:true}).fill('+251900000033');
    await managed.getByRole('button',{name:'Save contact'}).click();
    const updated=page.locator('#driver-access');await expect(updated).toContainText(`Updated Driver ${suffix}`);
    await expect(updated).toContainText('+251900000033');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await updated.screenshot({path:info.outputPath('driver-management.png')});
    await updated.getByRole('button',{name:'Remove from fleet',exact:true}).click();const removal=page.getByRole('dialog',{name:'Remove from fleet',exact:true});
    await removal.getByLabel('I confirm removal from this fleet.').check();
    await removal.getByRole('button',{name:'Remove driver',exact:true}).click();
    await expect(page.getByText(`Updated Driver ${suffix}`,{exact:true})).toHaveCount(0);
    await page.goto(truckPath);
    await expect(page.getByRole('region',{name:'Vehicle driver'})).toContainText('No driver assigned');
    await driverPage.goto('/app/home');
    await expect(driverPage).toHaveURL(/\/login\?error=/);
    complete=true;checkpoint('COMPLETE');
  }catch(error){primaryFailure=error;throw error;}finally{
    await driverContext.close().catch(()=>{});
    try{
    cleanupStage='VERIFY_SYNTHETIC_SCOPE';evidence();
    // Exact local test identities only; never reset shared demo fixtures.
    const profiles=await service.from('profiles').select('id,email').in('email',[ownerEmail,driverEmail]);expect(profiles.error).toBeNull();
    const ids=(profiles.data||[]).map((profile:{id:string;email:string})=>{if(profile.email===ownerEmail)owned.ownerId=profile.id;else if(profile.email===driverEmail)owned.employeeId=profile.id;else throw Error('FIXTURE_IDENTITY_NOT_PROVEN');return profile.id;});
    for(const profile of profiles.data||[]){const identity=await service.auth.admin.getUserById(profile.id);expect(identity.error).toBeNull();expect(identity.data.user?.email).toBe(profile.email);}
    if(!providerId&&owned.ownerId){const provider=await service.from('provider_profiles').select('id').eq('user_id',owned.ownerId).maybeSingle();expect(provider.error).toBeNull();providerId=provider.data?.id||'';}
    owned.providerId=providerId;evidence();
    if(providerId){
      const provider=await service.from('provider_profiles').select('user_id,business_name').eq('id',providerId).single();expect(provider.error).toBeNull();expect(provider.data?.user_id).toBe(owned.ownerId);expect(provider.data?.business_name).toBe(`Workflow Fleet ${suffix}`);
      const trucks=await service.from('vehicles').select('id,plate').eq('provider_profile_id',providerId);expect(trucks.error).toBeNull();expect((trucks.data||[]).every((truck:{id:string;plate:string})=>[`TEST-${suffix}`,`SECOND-${suffix}`].includes(truck.plate))).toBe(true);owned.vehicleIds=[...new Set([...owned.vehicleIds,...(trucks.data||[]).map((truck:{id:string;plate:string})=>truck.id)])];evidence();
      const shipments=await service.from('provider_shipments').select('id').eq('provider_profile_id',providerId);expect(shipments.error).toBeNull();expect(shipments.data).toHaveLength(0);
      const children=await service.from('drivers').select('user_id').eq('provider_profile_id',providerId);expect(children.error).toBeNull();expect((children.data||[]).every((driver:{user_id:string})=>driver.user_id===owned.employeeId)).toBe(true);
      cleanupStage='REMOVE_OWNED_PROVIDER';evidence();
      const invitations=await service.from('fleet_driver_invitations').delete().eq('provider_profile_id',providerId);expect(invitations.error).toBeNull();
      const capacities=await service.from('capacities').delete().eq('provider_profile_id',providerId);expect(capacities.error).toBeNull();
      const vehicles=await auditDeleteVehicles(service,'provider_profile_id',providerId);expect(vehicles.error).toBeNull();
    }
    if(ids.length){
      cleanupStage='REMOVE_OWNED_IDENTITIES';evidence();
      const intents=await service.from('provider_signup_intents').delete().in('auth_user_id',ids);expect(intents.error).toBeNull();
      const audit=await service.from('audit_logs').delete().in('actor_user_id',ids);expect(audit.error).toBeNull();
      const permissions=await service.from('driver_permissions').delete().in('user_id',ids);expect(permissions.error).toBeNull();
      for(const id of ids){const deleted=await service.auth.admin.deleteUser(id);expect(deleted.error).toBeNull();}
    }
    cleanupStage='VERIFY_ABSENCE';evidence();const actors=[owned.ownerId,owned.employeeId].filter(Boolean);
    const remainingProfiles=actors.length?await service.from('profiles').select('id').in('id',actors):{data:[],error:null};expect(remainingProfiles.error).toBeNull();expect(remainingProfiles.data).toHaveLength(0);
    const remainingTrucks=owned.vehicleIds.length?await service.from('vehicles').select('id').in('id',owned.vehicleIds):{data:[],error:null};expect(remainingTrucks.error).toBeNull();expect(remainingTrucks.data).toHaveLength(0);
    const remainingProvider=providerId?await service.from('provider_profiles').select('id').eq('id',providerId):{data:[],error:null};expect(remainingProvider.error).toBeNull();expect(remainingProvider.data).toHaveLength(0);
    const remainingDrivers=actors.length?await service.from('drivers').select('id').in('user_id',actors):{data:[],error:null};expect(remainingDrivers.error).toBeNull();expect(remainingDrivers.data).toHaveLength(0);
    const remainingCapacities=owned.vehicleIds.length?await service.from('capacities').select('id').in('vehicle_id',owned.vehicleIds):{data:[],error:null};expect(remainingCapacities.error).toBeNull();expect(remainingCapacities.data).toHaveLength(0);
    const remainingAssignments=owned.vehicleIds.length?await service.from('driver_vehicle_assignments').select('id').in('vehicle_id',owned.vehicleIds):{data:[],error:null};expect(remainingAssignments.error).toBeNull();expect(remainingAssignments.data).toHaveLength(0);
    const remainingIntents=actors.length?await service.from('provider_signup_intents').select('auth_user_id').in('auth_user_id',actors):{data:[],error:null};expect(remainingIntents.error).toBeNull();expect(remainingIntents.data).toHaveLength(0);
    let remainingAuth=0;for(const id of actors){const result=await service.auth.admin.getUserById(id);if(result.data.user)remainingAuth++;else expect(result.error?.status).toBe(404);}expect(remainingAuth).toBe(0);
    absence={profiles:0,vehicles:0,providers:0,drivers:0,capacities:0,assignments:0,signupIntents:0,authActors:remainingAuth};cleaned=true;cleanupStage='COMPLETE';
    }catch(error){cleanupFailed=true;info.annotations.push({type:'cleanup-failure',description:cleanupStage});if(!primaryFailure)throw error;}finally{evidence();}
  }
});

for(const useBasis of ['OWNED','PERMISSION']){
 test(`driving Transport Provider ${useBasis} signs up, explicitly assigns a truck and publishes after location permission`,async({page,context}:{page:any;context:any},info:any)=>{
  test.setTimeout(150000);
  nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
  const endpoint=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL||'');
  if(!['localhost','127.0.0.1'].includes(endpoint.hostname)||endpoint.port!=='55321')throw new Error('LOCAL_LOADGISTIC_REQUIRED');
  const service=createClient(endpoint.href,process.env.SUPABASE_SERVICE_ROLE_KEY||'',{auth:{persistSession:false,autoRefreshToken:false}});
  const suffix=randomUUID().slice(0,8),email=`independent-${suffix}@loadgistic.local`;
  let userId='',providerId='',vehicleId='';
  try{
   await verifyNewEmail(page,email);
   await acceptContentRules(page);
   await page.getByRole('button',{name:/Transport Provider.*Set up your vehicles/}).click();
   await expect(page.locator('input[name="applicationType"]')).toHaveValue('TRANSPORT_PROVIDER');
   await expect(page.getByLabel('Account name',{exact:true})).toBeEmpty();
   await expect(page.getByLabel('Handle',{exact:true})).toBeEmpty();
   await page.getByLabel('Account name',{exact:true}).fill(`Independent ${suffix}`);
   await page.getByLabel('Handle',{exact:true}).fill(`independent-${suffix}`);
   await page.getByLabel('First name',{exact:true}).fill(`Independent ${suffix}`);
   await page.getByLabel('Last / father name',{exact:true}).fill('PrivateSurname');
   await page.locator('label.rich-toggle').click();await expect(page.getByRole('checkbox',{name:/^I drive a vehicle/})).toBeChecked();
   await page.getByLabel('Account phone',{exact:true}).fill('+251900000044');
   await page.getByRole('button',{name:'Create transporter workspace'}).click();
   await expect(page).toHaveURL(/\/app\/home$/);
   await expect(page.getByText('Choose the vehicle you drive in Fleet.',{exact:true})).toBeVisible();
   const identity=await service.from('profiles').select('id,role').eq('email',email).single();
   expect(identity.error).toBeNull();userId=identity.data!.id;expect(identity.data!.role).toBe('DRIVER');
   const provider=await service.from('provider_profiles').select('id').eq('user_id',userId).single();expect(provider.error).toBeNull();providerId=provider.data!.id;
   const independentSubscriptions=await service.from('subscriptions').select('id',{count:'exact',head:true}).eq('provider_profile_id',providerId);
   expect(independentSubscriptions.error).toBeNull();expect(independentSubscriptions.count).toBe(0);
   await page.locator('.driver-empty-fleet').getByRole('link',{name:'Fleet',exact:true}).click();
   await page.getByRole('navigation',{name:'My Fleet',exact:true}).getByRole('link',{name:/^Vehicles/}).click();
   await page.getByRole('link',{name:'Add vehicle',exact:true}).first().click();
   await page.getByRole('radio',{name:useBasis==='OWNED'?'I own this vehicle':'I rent it or have permission to use it',exact:true}).check();
   await page.getByLabel('Make',{exact:true}).fill('Isuzu');await page.getByLabel('Model',{exact:true}).fill('Independent mini');
   await page.getByLabel('Vehicle configuration',{exact:true}).selectOption('Mini Box Truck');await page.getByLabel('Plate number',{exact:true}).fill(`IND-${suffix}`);
   await page.getByRole('button',{name:'Add vehicle',exact:true}).click();
   await expect(page.getByRole('region',{name:'Vehicle driver'})).toContainText('No driver assigned');vehicleId=new URL(page.url()).pathname.split('/').at(-1)!;
   expect((await service.from('vehicles').select('use_basis').eq('id',vehicleId).single()).data?.use_basis).toBe(useBasis);
   const truckPath=new URL(page.url()).pathname;await page.getByRole('link',{name:'Assign driver',exact:true}).click();
   const self=await openFleetDriver(page,{id:userId},true);await self.getByRole('combobox',{name:'Vehicle',exact:true}).selectOption(vehicleId);await self.getByRole('button',{name:'Save driver',exact:true}).click();await expect(page).toHaveURL(new RegExp(truckPath));
   expect((await service.from('driver_vehicle_assignments').select('driver_user_id').eq('vehicle_id',vehicleId).eq('active',true).single()).data?.driver_user_id).toBe(userId);await page.getByRole('button',{name:'Go live',exact:true}).click();
   await page.goto('/app/home');await page.getByRole('button',{name:'Set capacity',exact:true}).click();
   const dialog=page.getByRole('dialog',{name:'Current capacity',exact:true});
   await expect(dialog.getByRole('button',{name:'Off Duty',exact:true})).toHaveAttribute('aria-pressed','true');
   await dialog.getByRole('button',{name:'Empty',exact:true}).click();
   await dialog.getByRole('button',{name:'Capacity route',exact:true}).click();
   await selectPlace(page,'City 1','Addis Ababa');await selectPlace(page,'City 2','Sebeta');
   // A denied sensor is a recoverable draft error; it must never publish.
   await context.clearPermissions();
   await page.evaluate(()=>{const original=navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);(window as any).restoreGps=()=>{navigator.geolocation.getCurrentPosition=original;};navigator.geolocation.getCurrentPosition=(_success,error)=>error?.({code:1,PERMISSION_DENIED:1} as GeolocationPositionError);});
   await dialog.getByRole('button',{name:'Use my location',exact:true}).click();
   await expect(dialog.getByRole('alert')).toContainText('Allow location');await expect(dialog.getByRole('button',{name:'Save',exact:true})).toBeDisabled();
   expect((await service.from('capacities').select('id',{count:'exact',head:true}).eq('vehicle_id',vehicleId).neq('market_status','OFF_DUTY')).count).toBe(0);
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
    expect((await service.from('provider_signup_intents').delete().eq('auth_user_id',userId)).error).toBeNull();
    expect((await service.from('audit_logs').delete().eq('actor_user_id',userId)).error).toBeNull();
    if(!providerId)providerId=(await service.from('provider_profiles').select('id').eq('user_id',userId).maybeSingle()).data?.id||'';
    if(providerId){expect((await service.from('capacities').delete().eq('provider_profile_id',providerId)).error).toBeNull();expect((await auditDeleteVehicles(service,'provider_profile_id',providerId)).error).toBeNull();}
    expect((await service.auth.admin.deleteUser(userId)).error).toBeNull();
   }
  }
 });
}
