import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {localAuditService,auditProvider,checked} from './audit-helpers';
import {grantPrivateCapacityAccess} from '../../src/lib/private-capacity.js';
import {publishProviderCapacity} from '../../src/lib/provider-capacity.js';
import {openCapacityFilters as openDrawer,closeCapacityFilters} from './capacity-drawer-helper';

test.use({extraHTTPHeaders:{'x-forwarded-for':'127.0.0.247'}});
async function submitPrivateAction(page:any,button:any,path:string,method:string){
  const action=page.waitForResponse((response:any)=>response.request().method()===method
    &&new URL(response.url()).pathname===path,{timeout:30000});
  await button.click();
  const response=await action;expect(response.status()).toBe(200);
  // Logout navigates immediately after a keepalive DELETE. Its response body
  // can outlive the old document; verify the status, locked UI and API denial.
  if(method==='POST')expect(await response.json()).toEqual({ok:true});
}

async function drag(page:any,mobile:boolean,x:number,y:number,dx:number){
  if(mobile){
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let step=1;step<=8;step++){
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*step/8,y}]});
      await page.evaluate(()=>new Promise(requestAnimationFrame));
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  }else{
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y,{steps:8});await page.mouse.up();
  }
}
async function exercise(page:any,info:any,path:string,api:string){
  page.setDefaultTimeout(15000);
  const windows:string[]=[];
  page.on('request',(r:any)=>{const u=new URL(r.url());if(u.pathname===api&&u.searchParams.has('viewport'))windows.push(u.searchParams.get('viewport')!);});
  await page.goto(path);await expect(page.locator('.leaflet-container')).toBeVisible();
  const mobile=info.project.name.includes('mobile');
  if(mobile)await expect(page.getByRole('button',{name:/^Filters/})).toBeVisible();
  else await expect(page.getByRole('complementary',{name:'Capacity filters'})).toBeVisible();
  await page.locator('.leaflet-container').evaluate((el:any)=>{el.__drawerMapIdentity=true;});
  const drawer=await openDrawer(page);
  await expect(drawer.getByLabel('Availability',{exact:true})).toBeVisible();
  await drawer.getByLabel('Availability',{exact:true}).selectOption('EMPTY');
  await drawer.getByLabel('Truck configuration',{exact:true}).selectOption('Mini Box Truck');
  await drawer.getByLabel('In or near a city',{exact:true}).fill('Addis Ababa');
  await drawer.locator('#capacity-truck-city-results .place-result').first().click();
  const city=await drawer.locator('input[name="truckCityPlaceRef"]').inputValue();expect(city).toBeTruthy();
  await drawer.getByLabel('Distance from city',{exact:true}).selectOption('25');
  await drawer.getByLabel('Origin (optional)',{exact:true}).fill('Addis Ababa');
  await drawer.locator('#capacity-route-origin-results .place-result').first().click();
  await drawer.getByRole('button',{name:'More filters'}).click();
  const dialog=page.getByRole('dialog',{name:'More filters'});await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Availability',{exact:true})).toHaveCount(0);
  await dialog.getByRole('combobox',{name:'Load type',exact:true}).selectOption('PTL');
  await dialog.getByRole('combobox',{name:'Direction',exact:true}).selectOption('EITHER');
  await page.screenshot({path:info.outputPath(`${path==='/'?'open':'private'}-more-filters.png`),scale:'css'});
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
  await expect(drawer.getByRole('button',{name:'More filters'})).toBeFocused();
  await closeCapacityFilters(page);
  if(!mobile){
    const label=page.locator('.ethiopia-map-label');
    await expect(label).toBeVisible();
    const labelBox=await label.boundingBox(),filterBox=await page.getByRole('button',{name:/^Filters/}).boundingBox();
    expect(labelBox!.y).toBeGreaterThanOrEqual(filterBox!.y+filterBox!.height);
  }
  await expect(page.getByRole('button',{name:/^Filters/})).toBeFocused();
  await expect(page.locator('#capacity-filter-drawer')).toHaveAttribute('inert','');
  await expect.poll(()=>windows.length).toBeGreaterThan(0);
  await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:15000});
  const before=windows.at(-1);
  const map=await page.locator('.leaflet-container').boundingBox();
  await drag(page,mobile,map.x+map.width*.65,map.y+map.height*.4,-75);
  await expect.poll(()=>windows.at(-1)).not.toBe(before);
  await page.screenshot({path:info.outputPath(`${path==='/'?'open':'private'}-map.png`),scale:'css'});
  await openDrawer(page);await expect(drawer.getByLabel('Availability',{exact:true})).toHaveValue('EMPTY');
  await expect(drawer.getByLabel('In or near a city',{exact:true})).not.toHaveValue('');
  await drawer.evaluate(async(element:HTMLElement)=>{await Promise.all(element.getAnimations().map(animation=>animation.finished));});
  await drawer.locator('.capacity-drawer-heading').scrollIntoViewIfNeeded();
  const heading=await drawer.locator('.capacity-drawer-heading').boundingBox();
  await drag(page,mobile,heading.x+heading.width*.6,heading.y+heading.height/2,-90);
  await expect(page.getByRole('button',{name:/^Filters/})).toBeVisible();
  await drawer.evaluate(async(element:HTMLElement)=>{await Promise.all(element.getAnimations().map(animation=>animation.finished));});
  await page.getByRole('button',{name:/^Filters/}).scrollIntoViewIfNeeded();
  const handle=await page.getByRole('button',{name:/^Filters/}).boundingBox();
  await drag(page,mobile,handle.x+10,handle.y+20,90);
  await expect(drawer).toBeVisible();
  expect(await page.locator('.leaflet-container').evaluate((el:any)=>el.__drawerMapIdentity)).toBe(true);
  await page.emulateMedia({reducedMotion:'reduce'});expect(await drawer.evaluate((el:any)=>getComputedStyle(el).transitionDuration)).toBe('0s');
  await drawer.locator('.capacity-drawer-scroll').evaluate((el:any)=>{el.scrollTop=0;});
  const submit=await drawer.getByRole('button',{name:'Show matching trucks'}).boundingBox();
  expect(await page.evaluate(({x,y}:any)=>Boolean(document.elementFromPoint(x,y)?.closest('.capacity-drawer-actions')),{x:submit.x+submit.width-8,y:submit.y+submit.height/2})).toBe(true);
  await page.screenshot({path:info.outputPath(`${path==='/'?'open':'private'}-drawer.png`),scale:'css'});
  await drawer.getByRole('button',{name:'Show matching trucks'}).click();
  await expect(page).toHaveURL(/truckCityPlaceRef=/);
  const url=new URL(page.url());expect(url.pathname).toBe(path);expect(url.searchParams.getAll('q')).toHaveLength(1);
  for(const [name,value] of [['status','EMPTY'],['vehicleCategory','Mini Box Truck'],['loadType','PTL'],['directionMode','EITHER'],['truckLocationRadiusKm','25'],['truckCityPlaceRef',city]])expect(url.searchParams.get(name)).toBe(value);
  expect(url.searchParams.get('originPlaceRef')).toBeTruthy();expect(url.searchParams.has('nearLat')).toBe(false);
  const result=await page.request.get(`${api}?${url.searchParams}`);expect(result.status()).toBe(200);const body=await result.json();expect(body.filterError).toBeFalsy();if(api==='/api/shared-capacity')expect(body.items).toHaveLength(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await openDrawer(page);await drawer.getByRole('button',{name:/More filters/}).click();
  await expect(dialog.getByRole('combobox',{name:'Load type',exact:true})).toHaveValue('PTL');
  await dialog.getByRole('link',{name:'Clear',exact:true}).click();await expect(page).toHaveURL(new RegExp(`${path==='/'?'/$':'/shared-capacity$'}`));
  await openDrawer(page);
  await expect(drawer.getByLabel('Availability',{exact:true})).toHaveValue('');
  await expect(drawer.getByLabel('Truck configuration',{exact:true})).toHaveValue('');
  await expect(drawer.getByLabel('In or near a city',{exact:true})).toHaveValue('');
  await expect(drawer.locator('input[name="truckCityPlaceRef"]')).toHaveValue('');
  await expect(page.getByRole('dialog',{name:'More filters'})).not.toBeVisible();
  await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:20000});
}

test('Open capacity drawer keeps drafts, map gestures and combined filters',async({page}:{page:any},info:any)=>{
  test.setTimeout(120000);await exercise(page,info,'/','/api/public/capacity');
  expect((await page.request.get('/api/shared-capacity')).status()).toBe(401);
});

async function mailboxCode(email:string,since:number){
  for(let attempt=0;attempt<40;attempt++){
    const inbox=await (await fetch('http://127.0.0.1:55324/api/v1/messages')).json();
    const message=(inbox.messages||[]).find((m:any)=>new Date(m.Created).getTime()>=since-2000&&(m.To||[]).some((r:any)=>r.Address===email));
    if(message){const body=await (await fetch(`http://127.0.0.1:55324/api/v1/message/${message.ID}`)).json();const match=String(body.Text||body.HTML||'').match(/(?:^|\D)(\d{6})(?:\D|$)/);if(match)return match[1];}
    await new Promise(resolve=>setTimeout(resolve,250));
  }throw new Error('Local shared-capacity message was not delivered.');
}

test('Private capacity uses the same drawer with real local OTP and scoped results',async({page}:{page:any},info:any)=>{
  test.setTimeout(180000);const db=localAuditService();const actor=await auditProvider(db,'drawer');const email=`drawer-${randomUUID()}@example.test`;const ids:string[]=[];
  try{
    checked(await db.from('company_pages').insert({provider_profile_id:actor.provider_profile_id,published:true}));
    const vehicle=checked(await db.rpc('create_provider_vehicle',{actor_user_id:actor.id,command:{make:'Audit',model:'Drawer',plate:`TEST-${actor.suffix}`,cargo_configuration:'Mini Box Truck'}}));ids.push(vehicle.id);
    const places=checked(await db.from('place_catalog').select('id,name').in('normalized_name',['addis ababa','adama']));
    const from=places.find((p:any)=>p.name==='Addis Ababa'),to=places.find((p:any)=>p.name==='Adama');expect(from&&to).toBeTruthy();
    const signal=await publishProviderCapacity(actor,{vehicleId:vehicle.id,status:'EMPTY',acceptedLoads:'BOTH',availabilityGeometry:'ROUTE',visibility:'PRIVATE',locationSource:'DEVICE_OBSCURED',approximateLat:9.03,approximateLng:38.74,locationPrecisionKm:20,currentRoutePlaces:[{placeRef:from.id,label:from.name},{placeRef:to.id,label:to.name}]});
    if(typeof signal==='string')ids.push(signal);
    const grant=await grantPrivateCapacityAccess(actor,{vehicleId:vehicle.id,email});if(typeof grant==='string')ids.push(grant);
    await page.goto('/shared-capacity');await page.getByLabel('Email',{exact:true}).fill(email);const since=Date.now();
    await page.getByRole('button',{name:'Continue with email'}).click();await expect(page.getByLabel('One-time code')).toBeVisible({timeout:30000});
    await page.getByLabel('One-time code').fill(await mailboxCode(email,since));await submitPrivateAction(page,page.getByRole('button',{name:'Open private capacity'}),'/api/shared-capacity/access','POST');
    await expect(page.getByRole('region',{name:'Privately shared truck capacity'})).toBeVisible({timeout:30000});
    const before=await (await page.request.get('/api/shared-capacity')).json();expect(before.items).toHaveLength(1);expect(before.items[0].provider_handle).toBe(`drawer-${actor.suffix}`);
    await exercise(page,info,'/shared-capacity','/api/shared-capacity');
    await exerciseUnfilteredReset(page,info,'/shared-capacity','/api/shared-capacity');
    const logout=page.getByRole('button',{name:'Log out'});await expect(logout).toBeVisible();await submitPrivateAction(page,logout,'/api/shared-capacity/session','DELETE');
    await expect(page.getByRole('button',{name:'Continue with email'})).toBeVisible({timeout:30000});expect((await page.request.get('/api/shared-capacity')).status()).toBe(401);
  }finally{
    const challenges=checked(await db.from('shared_capacity_email_otps').select('id').eq('recipient_email',email));ids.push(...challenges.map((r:any)=>r.id));
    const grants=checked(await db.from('capacity_access_grants').select('id').eq('recipient_email',email));ids.push(...grants.map((r:any)=>r.id));
    checked(await db.from('access_email_deliveries').delete().eq('recipient_email',email));checked(await db.from('shared_capacity_email_otps').delete().eq('recipient_email',email));
    checked(await db.from('audit_logs').delete().in('entity_id',[actor.id,actor.provider_profile_id,...ids]));checked(await db.from('audit_logs').delete().eq('actor_user_id',actor.id));
    checked(await db.from('vehicles').delete().eq('provider_profile_id',actor.provider_profile_id));checked(await db.auth.admin.deleteUser(actor.id));
  }
});

test('editing a transporter search drops only the previous transporter scope',async({page}:{page:any})=>{
  test.setTimeout(60000);
  const sample=(await (await page.request.get('/api/public/capacity')).json()).items[0];expect(sample).toBeTruthy();
  const params=new URLSearchParams({provider:sample.provider_handle,q:sample.provider_name,status:'EMPTY'});
  await page.goto(`/?${params}`);await expect(page.locator('.leaflet-container')).toBeVisible();const drawer=await openDrawer(page);
  await drawer.getByRole('combobox',{name:'Search published truck capacity'}).fill('Addis');
  await expect(page.locator('.capacity-discovery-form input[name="provider"]')).toHaveCount(0);
  await drawer.getByRole('button',{name:'Search published truck capacity',exact:true}).click();
  await expect(page).toHaveURL(/q=Addis/);const url=new URL(page.url());expect(url.searchParams.has('provider')).toBe(false);expect(url.searchParams.get('status')).toBe('EMPTY');
});


async function exerciseUnfilteredReset(page:any,info:any,path:string,api:string){
  const requests:URL[]=[];
  page.on('request',(r:any)=>{const u=new URL(r.url());if(u.pathname===api&&u.searchParams.has('viewport'))requests.push(u);});
  await page.goto(path);await openDrawer(page);
  await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:30000});
  await expect.poll(()=>requests.length).toBeGreaterThan(0);
  const baseline=requests.at(-1)!.searchParams.get('viewport')!;
  const drawer=page.locator('#capacity-filter-drawer');
  await drawer.getByLabel('Availability',{exact:true}).selectOption('PARTIAL');
  await drawer.getByLabel('In or near a city',{exact:true}).fill('Adama');
  await drawer.locator('#capacity-truck-city-results .place-result').first().click();
  await closeCapacityFilters(page);
  const previousCount=requests.length;
  await page.locator('.leaflet-control-zoom-in').click();
  await expect.poll(()=>requests.length).toBeGreaterThan(previousCount);
  // Pagination/loading may produce another request for the old window first.
  await expect.poll(()=>requests.at(-1)!.searchParams.get('viewport')).not.toBe(baseline);
  await openDrawer(page);const beforeClear=requests.length;
  await drawer.getByRole('link',{name:'Clear all',exact:true}).click();
  await openDrawer(page);
  await expect(drawer.getByLabel('Availability',{exact:true})).toHaveValue('');
  await expect(drawer.getByLabel('In or near a city',{exact:true})).toHaveValue('');
  await expect(drawer.locator('input[name="truckCityPlaceRef"]')).toHaveValue('');
  await expect(page.locator('.map-capacity-sheet')).toHaveCount(0);
  await expect.poll(()=>requests.length).toBeGreaterThan(beforeClear);
  await expect.poll(()=>requests.at(-1)!.searchParams.get('viewport')).toBe(baseline);
  expect(requests.at(-1)!.searchParams.get('status')).toBeFalsy();
  expect(requests.at(-1)!.searchParams.get('truckCityPlaceRef')).toBeFalsy();
  await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:20000});
  await page.screenshot({path:info.outputPath(`${path==='/'?'open':'private'}-clear-all-unfiltered.png`),scale:'css'});
}

test('Clear all discards unsubmitted filters and resets a zoomed map on an unfiltered URL',async({page}:{page:any},info:any)=>{
  test.setTimeout(90000);await exerciseUnfilteredReset(page,info,'/','/api/public/capacity');
});


test('Clear all removes applied filters and the selected truck before loading the wider map',async({page}:{page:any},info:any)=>{
  test.setTimeout(60000);
  const sample=(await (await page.request.get('/api/public/capacity')).json()).items[0];
  expect(sample).toBeTruthy();
  const filtered=new URLSearchParams({q:sample.provider_name,provider:sample.provider_handle,truck:sample.id,status:sample.status});
  await page.goto(`/?${filtered}`);
  await expect(page.locator('.map-capacity-sheet')).toBeVisible();
  const drawer=await openDrawer(page);
  const unfiltered=page.waitForResponse((r:any)=>{
    const url=new URL(r.url());
    return url.pathname==='/api/public/capacity'&&url.searchParams.has('viewport')&&!['q','provider','truck','status'].some(key=>url.searchParams.get(key));
  });
  await drawer.getByRole('link',{name:'Clear all',exact:true}).click();
  await expect(page).toHaveURL(/\/$/);
  const response=await unfiltered;expect(response.status()).toBe(200);
  expect((await response.json()).items.length).toBeGreaterThan(0);
  await expect(page.locator('.map-capacity-sheet')).toHaveCount(0);
  await openDrawer(page);
  await expect(drawer.getByLabel('Availability',{exact:true})).toHaveValue('');
  await expect(drawer.getByRole('combobox',{name:'Search published truck capacity'})).toHaveValue('');
  // The modal's Clear action must also discard edits on this same unfiltered URL.
  await drawer.getByLabel('Availability',{exact:true}).selectOption('PARTIAL');
  await drawer.getByRole('button',{name:'More filters',exact:true}).click();
  await page.getByRole('dialog',{name:'More filters'}).getByRole('link',{name:'Clear',exact:true}).click();
  await openDrawer(page);await expect(drawer.getByLabel('Availability',{exact:true})).toHaveValue('');
  await expect(page.getByRole('dialog',{name:'More filters'})).not.toBeVisible();
  await page.screenshot({path:info.outputPath('clear-all-selected-truck.png'),scale:'css'});
});
