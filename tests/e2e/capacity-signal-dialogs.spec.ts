import {expect,test} from '@playwright/test';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';

async function login(page:any,email='driver@loadgistic.local'){
  await page.goto('/login');
  await page.locator('details.auth-fixture-login>summary').click();
  const form=page.getByTestId('login-form');
  await form.getByLabel('Email',{exact:true}).fill(email);
  await form.getByLabel('Password').fill('Loadgistic123!');
  await form.getByRole('button',{name:'Log in'}).click();
  await expect(page).toHaveURL(/\/app\/home/);
}

async function save(page:any,dialog:any,button='Save',endpoint='/api/capacity'){
  const saved=page.waitForResponse((response:any)=>response.url().endsWith(endpoint)&&response.request().method()==='POST');
  await dialog.getByRole('button',{name:button,exact:true}).click();
  const response=await saved;
  expect(await response.json()).toMatchObject({ok:true});
  await expect(dialog).toHaveCount(0);
}

test('focused capacity dialogs keep map, discard drafts, save preferences and recover from errors',async({page,context}:{page:any;context:any},testInfo:any)=>{
  test.setTimeout(90_000);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:9.03,longitude:38.76});
  const automatic=page.waitForResponse((response:any)=>response.url().endsWith('/api/capacity/location'));
  await login(page);
  expect((await automatic).ok()).toBe(true);
  const map=page.getByTestId('capacity-summary').locator('.leaflet-container');
  await expect(map).toBeVisible();
  await map.evaluate((element:HTMLElement)=>element.setAttribute('data-original-map','yes'));
  await expect(page.getByRole('button',{name:/Edit all/i})).toHaveCount(0);
  const capacity=page.getByRole('button',{name:/^Edit current capacity:/});
  const coverage=page.getByRole('button',{name:/^Edit current coverage:/});
  const sharing=page.getByRole('button',{name:/^Edit capacity sharing:/});
  const loads=page.getByRole('button',{name:/^Edit load preferences:/});
  await capacity.click();
  let dialog=page.getByRole('dialog',{name:'Current capacity',exact:true});
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element:HTMLDialogElement)=>element.matches(':modal'))).toBe(true);
  await expect(map).toHaveAttribute('data-original-map','yes');
  await expect(dialog.getByRole('combobox')).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:/Open capacity Anyone/})).toHaveCount(0);
  await expect(dialog.getByRole('radio')).toHaveCount(0);
  await expect(dialog.getByRole('checkbox')).toHaveCount(0);
  const originalStatus=await dialog.locator('input[name="status"]').inputValue();
  const invalidRoute=await page.request.post('/api/capacity',{headers:{Accept:'application/json'},form:{vehicleId:await dialog.locator('input[name="vehicleId"]').inputValue(),status:'PARTIAL',availabilityGeometry:'RADIUS'}});
  expect(invalidRoute.status()).toBe(400);
  expect(await invalidRoute.json()).toEqual({error:'Partial capacity needs an availability route. Choose at least two cities.'});
  const nextStatus=originalStatus==='PARTIAL'?'Empty':'Partial';
  await dialog.getByRole('button',{name:nextStatus,exact:true}).click();
  await save(page,dialog);
  await expect(capacity).toHaveAttribute('aria-label',`Edit current capacity: ${nextStatus}`);
  await sharing.click();
  dialog=page.getByRole('dialog',{name:'Capacity sharing',exact:true});
  await expect(dialog.getByRole('button',{name:'Empty',exact:true})).toHaveCount(0);
  await expect(dialog.getByRole('radio')).toHaveCount(0);
  const originalVisibility=await dialog.getByRole('button',{name:/Open capacity Anyone/}).getAttribute('aria-pressed')==='true'?'OPEN':'PRIVATE';
  const otherVisibility=originalVisibility==='OPEN'?/Private capacity Your/:/Open capacity Anyone/;
  await dialog.getByRole('button',{name:otherVisibility}).click();
  await page.screenshot({path:testInfo.outputPath('capacity-dialog.png')});
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(sharing).toBeFocused();
  await sharing.click();
  await expect(dialog.getByRole('button',{name:originalVisibility==='OPEN'?/Open capacity Anyone/:/Private capacity Your/})).toHaveAttribute('aria-pressed','true');
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();

  await coverage.click();
  dialog=page.getByRole('dialog',{name:'Current coverage',exact:true});
  await expect(dialog.getByRole('button',{name:'Empty',exact:true})).toHaveCount(0);
  await expect(dialog.getByRole('checkbox')).toHaveCount(0);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await loads.click();
  dialog=page.getByRole('dialog',{name:'Load preferences',exact:true});
  await expect(dialog.getByRole('combobox')).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:/Open capacity Anyone/})).toHaveCount(0);
  const pickups=dialog.getByLabel('Multiple pickups');
  const dropoffs=dialog.getByLabel('Multiple drop-offs');
  const originalPick=await pickups.isChecked(),originalDrop=await dropoffs.isChecked();
  await pickups.check();await dropoffs.check();
  await save(page,dialog);
  await sharing.click();
  dialog=page.getByRole('dialog',{name:'Capacity sharing',exact:true});
  await dialog.getByRole('button',{name:otherVisibility}).click();
  await page.route('**/api/capacity',(route:any)=>route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Please retry this save.'})}),{times:1});
  await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await expect(dialog.getByRole('alert')).toHaveText('Please retry this save.');
  await expect(dialog.getByRole('button',{name:otherVisibility})).toHaveAttribute('aria-pressed','true');
  await expect(map).toHaveAttribute('data-original-map','yes');
  await save(page,dialog);
  await expect(page).toHaveURL(/\/app\/home$/);
  await expect(map).toHaveAttribute('data-original-map','yes');
  await coverage.click();
  dialog=page.getByRole('dialog',{name:'Current coverage',exact:true});
  await save(page,dialog);
  await loads.click();
  dialog=page.getByRole('dialog',{name:'Load preferences',exact:true});
  await expect(dialog.getByLabel('Multiple pickups')).toBeChecked();
  await expect(dialog.getByLabel('Multiple drop-offs')).toBeChecked();
  await dialog.getByLabel('Multiple pickups').setChecked(originalPick);
  await dialog.getByLabel('Multiple drop-offs').setChecked(originalDrop);
  await save(page,dialog);
  await sharing.click();
  dialog=page.getByRole('dialog',{name:'Capacity sharing',exact:true});
  await dialog.getByRole('button',{name:originalVisibility==='OPEN'?/Open capacity Anyone/:/Private capacity Your/}).click();
  await save(page,dialog);
  await capacity.click();
  dialog=page.getByRole('dialog',{name:'Current capacity',exact:true});
  await dialog.getByRole('button',{name:originalStatus==='PARTIAL'?'Partial':'Empty',exact:true}).click();
  await save(page,dialog);
  await expect(capacity).toHaveAttribute('aria-label',`Edit current capacity: ${originalStatus==='PARTIAL'?'Partial':'Empty'}`);
});

test('regular service and location edit in bounded dialogs with real saves',async({page,context}:{page:any;context:any},testInfo:any)=>{
  test.setTimeout(90_000);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:9.03,longitude:38.76});
  const automatic=page.waitForResponse((response:any)=>response.url().endsWith('/api/capacity/location'));
  await login(page);expect((await automatic).ok()).toBe(true);
  const map=page.getByTestId('capacity-summary').locator('.leaflet-container');
  await expect(map).toBeVisible();
  await map.evaluate((element:HTMLElement)=>element.setAttribute('data-original-map','yes'));
  await page.getByRole('button',{name:/^Edit regular service:/}).click();
  const regular=page.getByRole('dialog',{name:'Regular service',exact:true});
  await expect(regular.getByRole('combobox').first()).not.toHaveValue('');
  await expect(regular.getByRole('button',{name:'Empty',exact:true})).toHaveCount(0);
  if(testInfo.project.name.includes('mobile'))await page.setViewportSize({width:320,height:640});
  await expect(regular.getByRole('button',{name:'Save',exact:true})).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const dialogBounds=await regular.boundingBox();
  expect(dialogBounds!.height).toBeLessThan(page.viewportSize()!.height);
  await page.screenshot({path:testInfo.outputPath('regular-service-dialog.png')});
  await save(page,regular,'Save','/api/capacity/corridors');
  await expect(map).toHaveAttribute('data-original-map','yes');
  await page.getByRole('button',{name:'Edit approximate location',exact:true}).click();
  const location=page.getByRole('dialog',{name:'Approximate location',exact:true});
  await expect(location.getByRole('combobox')).toHaveCount(1);
  const originalRadius=await location.getByLabel('Approximate location radius').inputValue();
  const nextRadius=originalRadius==='10'?'5':'10';
  await location.getByLabel('Approximate location radius').selectOption(nextRadius);
  await location.getByRole('button',{name:'Cancel'}).click();
  await page.getByRole('button',{name:'Edit approximate location',exact:true}).click();
  await expect(location.getByLabel('Approximate location radius')).toHaveValue(originalRadius);
  await location.getByLabel('Approximate location radius').selectOption(nextRadius);
  const response=page.waitForResponse((response:any)=>response.url().endsWith('/api/capacity/location'));
  await location.getByRole('button',{name:'Save location'}).click();
  expect((await response).ok()).toBe(true);
  await expect(location).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Edit approximate location radius',exact:true})).toHaveText(`${nextRadius} km`);
  await expect(map).toHaveAttribute('data-original-map','yes');
  await expect(page.getByRole('button',{name:'Edit approximate location',exact:true})).toBeEnabled();
  const rail=await page.getByRole('navigation',{name:'Edit capacity signals'}).boundingBox();
  const dock=await page.getByRole('region',{name:'Approximate truck location controls'}).boundingBox();
  expect(rail!.y+rail!.height).toBeLessThanOrEqual(dock!.y);
  await page.screenshot({path:testInfo.outputPath('saved-map.png')});
});

test('fleet owners edit capacity but cannot substitute their device location',async({page}:{page:any})=>{
  await login(page,'transporter@loadgistic.local');
  await page.goto('/app/fleet');
  await page.getByRole('link',{name:'View truck',exact:true}).first().click();
  await page.getByRole('button',{name:'Edit approximate location',exact:true}).click();
  const location=page.getByRole('dialog',{name:'Approximate location',exact:true});
  await expect(location).toContainText('The assigned Driver updates this location');
  await expect(location.getByRole('button',{name:'Save location'})).toHaveCount(0);
  await location.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:/^Edit current capacity:/}).click();
  await expect(page.getByRole('dialog',{name:'Current capacity',exact:true})).toBeVisible();
  await expect(page.getByTestId('capacity-summary')).toBeVisible();
});

test('anonymous JSON capacity mutations stay denied',async({request}:{request:any})=>{
  for(const endpoint of ['/api/capacity','/api/capacity/corridors']){
    const response=await request.post(endpoint,{headers:{Accept:'application/json'},form:{action:'REMOVE'}});
    expect(response.status()).toBe(401);
    expect(await response.json()).toHaveProperty('error');
  }
});

test('first capacity publishes from its modal and Empty area changes to Partial route',async({page,context}:{page:any;context:any})=>{
  test.setTimeout(90_000);
  nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
  if(!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw new Error('This fixture-writing test requires isolated local Supabase.');
  const service=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:9.03,longitude:38.76});
  await login(page);
  const created=await page.request.post('/api/fleet/vehicles',{form:{make:'Modal test',model:'Mini truck',cargoConfiguration:'Mini Box Truck',plate:`MODAL-${Date.now()}`},maxRedirects:0});
  expect(created.status()).toBe(303);
  const destination=new URL(created.headers().location);
  const vehicleId=destination.pathname.split('/').pop()!;
  expect(vehicleId).toMatch(/^[a-f0-9-]{36}$/);
  try{
    await page.goto(destination.pathname);
    await page.getByRole('button',{name:'Edit current capacity: Not set',exact:true}).click();
    let dialog=page.getByRole('dialog',{name:'Current capacity',exact:true});
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
    dialog=page.getByRole('dialog',{name:'Current capacity',exact:true});
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
    dialog=page.getByRole('dialog',{name:'Current capacity',exact:true});
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
    await service.from('vehicles').delete().eq('id',vehicleId).throwOnError();
  }
});
