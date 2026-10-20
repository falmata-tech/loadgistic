import {expect,test} from './browser-test';

import {auditLogin} from './audit-helpers';
async function login(page:any,email:string){await auditLogin(page,email);}

test('retired account billing controls cannot be enabled by an administrator',async({page}:{page:any},info:any)=>{
  await login(page,'admin@loadgistic.local');await page.goto('/admin/settings');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator('form.platform-control-card')).toHaveCount(0);
  await expect(page.getByText('Trial, then payment',{exact:true})).toHaveCount(0);
  const response=await page.request.post('/api/admin/settings',{form:{section:'ACCESS',mode:'TRIAL_PAYMENT',confirm:'ENABLE'}});
  expect(response.status()).toBe(410);expect((await response.json()).error).toBe('Platform payment plans are not offered.');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('billing-controls-retired.png')});
});

test('Featured automatic selection can be switched off and prepared without losing manual controls @featured-prepare',async({page}:{page:any},info:any)=>{
  test.setTimeout(60000);await login(page,'admin@loadgistic.local');await page.goto('/admin/featured');
  await page.getByRole('button',{name:'Selection settings',exact:true}).click();
  const controls=page.getByRole('region',{name:'Featured selection settings'});
  const originalMode=await controls.getByLabel('Selection',{exact:true}).inputValue();
  const originalCount=await controls.getByLabel('Maximum Drivers per day').inputValue();
  try{
    await controls.getByLabel('Selection',{exact:true}).selectOption('MANUAL');
    await controls.getByRole('button',{name:'Save selection settings'}).click();
    await expect(page.getByText('Daily selection settings saved.',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Prepare upcoming days'})).toHaveCount(0);
    if(!await page.getByRole('dialog',{name:'Selection settings',exact:true}).count())await page.getByRole('button',{name:'Selection settings',exact:true}).click();
    await controls.getByLabel('Selection',{exact:true}).selectOption('AUTO');
    await controls.getByLabel('Maximum Drivers per day').fill(originalCount);
    await controls.getByRole('button',{name:'Save selection settings'}).click();
    await expect(page.getByRole('button',{name:'Prepare upcoming days'})).toBeVisible();
    await page.getByRole('button',{name:'Prepare upcoming days'}).click();
    await expect(page.getByText(/days prepared\./)).toBeVisible();
    await page.getByRole('link',{name:'Edit programme',exact:true}).click();
    await expect(page.getByRole('button',{name:'Save draft',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Publish this day',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('link',{name:'Cancel editing',exact:true}).click();
    if(!await page.getByRole('dialog',{name:'Selection settings',exact:true}).count())await page.getByRole('button',{name:'Selection settings',exact:true}).click();
    await controls.screenshot({path:info.outputPath('featured-selection.png')});
    await page.goto('/featured');
    const trucks=page.locator('.featured-truck-tile');
    await expect(trucks.first()).toBeVisible();
    expect(await trucks.count()).toBeLessThanOrEqual(8);
    await expect(trucks.first().locator('.featured-card-details > small').first()).toHaveText('Driver');
    await trucks.first().click();
    await expect(page.locator('.featured-truck-dialog')).toBeVisible();
    await expect(page.locator('.featured-truck-dialog').getByRole('link',{name:'Transporter profile'})).toBeVisible();
  }finally{
    await page.goto('/admin/featured');
    await page.getByRole('button',{name:'Selection settings',exact:true}).click();
    const restore=page.getByRole('region',{name:'Featured selection settings'});
    await restore.getByLabel('Selection',{exact:true}).selectOption(originalMode);
    await restore.getByLabel('Maximum Drivers per day').fill(originalCount);
    await restore.getByRole('button',{name:'Save selection settings'}).click();
    await expect(page.getByText('Daily selection settings saved.',{exact:true})).toBeVisible();
  }
});

test('provider free access has no payment form or countdown and cannot change platform settings',async({page,request}:{page:any;request:any})=>{
  await login(page,'driver@loadgistic.local');await page.goto('/app/more');
  await expect(page.getByRole('heading',{name:'Account',exact:true})).toBeVisible();
  await expect(page.getByText('Free access · no payment required',{exact:true})).toHaveCount(0);
  await expect(page.locator('.account-payment-card,.plan-deadline')).toHaveCount(0);
  const denied=await page.request.post('/api/admin/settings',{form:{section:'ACCESS',mode:'TRIAL_PAYMENT',confirm:'ENABLE'}});
  expect(denied.status()).toBe(403);
  const anonymous=await request.post('/api/admin/settings',{form:{section:'FEATURED',mode:'AUTO',targetCount:'12'}});
  expect(anonymous.status()).toBe(403);
});

test('map-module loading uses a bounded reduced-motion skeleton',async({page}:{page:any},info:any)=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/_next/static/**',async(route:any)=>{
    if(route.request().resourceType()==='script'&&/leaflet/i.test(route.request().url()))await gate;
    await route.continue();
  });
  try{
    await page.goto('/',{waitUntil:'domcontentloaded'});
    const skeleton=page.locator('.public-capacity-map.surface-skeleton');
    await expect(skeleton).toBeVisible();await expect(skeleton).toHaveAttribute('aria-busy','true');
    await expect(skeleton.locator('.skeleton-decoration')).toHaveAttribute('aria-hidden','true');
    expect(await skeleton.locator('i').first().evaluate((element:HTMLElement)=>getComputedStyle(element).animationName)).toBe('none');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath('map-loading.png')});
  }finally{release();}
  await expect(page.locator('.public-capacity-map .leaflet-container')).toBeVisible();
});
