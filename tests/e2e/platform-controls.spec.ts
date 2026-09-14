import {expect,test} from '@playwright/test';

async function login(page:any,email:string){
  await page.goto('/login');await page.locator('details.auth-fixture-login>summary').click();
  const form=page.getByTestId('login-form');
  await form.getByLabel('Email',{exact:true}).fill(email);await form.getByLabel('Password').fill('Loadgistic123!');
  await form.getByRole('button',{name:'Log in',exact:true}).click();
  await expect(page).toHaveURL(email==='admin@loadgistic.local'?/\/admin$/:/\/app\/home/);
  // Wait for the redirected page, not just its URL while a streamed loading
  // boundary is still completing the authentication navigation.
  if(email==='admin@loadgistic.local')await expect(page.getByRole('heading',{name:'Administration',exact:true})).toBeVisible();
  else await expect(page.getByTestId('capacity-summary')).toBeVisible({timeout:20_000});
}

test('admin access controls are responsive and native saves retain submitted values',async({page}:{page:any},info:any)=>{
  await login(page,'admin@loadgistic.local');await page.goto('/admin/settings');
  const form=page.locator('form.platform-control-card');
  await form.getByLabel('Trial, then payment').check();
  await expect(form.getByRole('checkbox')).toHaveAttribute('required','');
  await expect(form).toContainText('fresh seven-day trial');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('activation-controls.png')});
  await form.getByLabel('Free access').check();
  let submitted='';let pending:any=null;
  await page.exposeFunction('recordPendingSubmit',(state:any)=>{pending=state;});
  await page.evaluate(()=>document.addEventListener('submit',event=>{
    // Observe after the app listener, before native navigation replaces the
    // document. Never freeze a mobile navigation to inspect its old context.
    queueMicrotask(()=>{const form=event.target as HTMLFormElement;const button=(event as SubmitEvent).submitter;
      (window as any).recordPendingSubmit({busy:form.getAttribute('aria-busy'),pending:button?.hasAttribute('data-pending-submit'),disabled:button?.hasAttribute('disabled')});});
  },{once:true}));
  await page.route('**/api/admin/settings',async(route:any)=>{submitted=route.request().postData()||'';await route.continue();});
  await form.getByRole('button',{name:'Save access mode'}).click();
  await expect(page.getByText('Workspace access updated.',{exact:true})).toBeVisible();
  expect(pending).toEqual({busy:'true',pending:true,disabled:false});
  expect(new URLSearchParams(submitted).get('section')).toBe('ACCESS');
  expect(new URLSearchParams(submitted).get('mode')).toBe('FREE');
  await expect(page.getByLabel('Free access')).toBeChecked();
});

test('Featured automatic selection can be switched off and prepared without losing manual controls',async({page}:{page:any},info:any)=>{
  test.setTimeout(60000);await login(page,'admin@loadgistic.local');await page.goto('/admin/featured');
  const controls=page.getByRole('region',{name:'Featured selection settings'});
  const originalCount=await controls.getByLabel('Drivers per day').inputValue();
  try{
    await controls.getByLabel('Selection',{exact:true}).selectOption('MANUAL');
    await controls.getByRole('button',{name:'Save selection settings'}).click();
    await expect(page.getByText('Daily selection settings saved.',{exact:true})).toBeVisible();
    await expect(controls.getByRole('button',{name:'Prepare upcoming days'})).toHaveCount(0);
  }finally{
    await controls.getByLabel('Selection',{exact:true}).selectOption('AUTO');
    await controls.getByLabel('Drivers per day').fill(originalCount);
    await controls.getByRole('button',{name:'Save selection settings'}).click();
  }
  await expect(controls.getByRole('button',{name:'Prepare upcoming days'})).toBeVisible();
  await controls.getByRole('button',{name:'Prepare upcoming days'}).click();
  await expect(page.getByText(/days prepared\./)).toBeVisible();
  await expect(page.getByRole('button',{name:'Save draft',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Publish this day',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await controls.screenshot({path:info.outputPath('featured-selection.png')});
  await page.goto('/featured');
  const trucks=page.locator('.featured-truck-tile');
  await expect(trucks.first()).toBeVisible();
  expect(await trucks.count()).toBeLessThanOrEqual(12);
  await expect(trucks.first()).toContainText(/Company driver|Owner-operator|Self-managed driver/);
  await trucks.first().click();
  await expect(page.locator('.featured-truck-dialog')).toBeVisible();
  await expect(page.locator('.featured-truck-dialog').getByRole('link',{name:'Transporter profile'})).toBeVisible();
});

test('provider free access has no payment form or countdown and cannot change platform settings',async({page,request}:{page:any;request:any})=>{
  await login(page,'driver@loadgistic.local');await page.goto('/app/more');
  await expect(page.getByText('Free access · no payment required')).toBeVisible();
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
