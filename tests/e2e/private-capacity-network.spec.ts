import {expect,test} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

async function findPublicRegularServiceFallback(request:any){
  let cursor='';
  for(let pageNumber=0;pageNumber<20;pageNumber+=1){
    const response=await request.get(`/api/public/capacity${cursor?`?cursor=${encodeURIComponent(cursor)}`:''}`);
    expect(response.ok()).toBe(true);
    const result=await response.json();
    const match=result.items.find((item:any)=>item.current_signal_geometry_visible===false);
    if(match)return match;
    if(!result.nextCursor)break;
    cursor=result.nextCursor;
  }
  throw new Error('Expected a public regular-service fallback fixture.');
}

async function login(page:any,email:string,expected=/\/app\/home/){
  await page.goto('/login');
  const fixtureLogin=page.locator('details.auth-fixture-login');
  if(await fixtureLogin.count()&&!(await fixtureLogin.getAttribute('open')))await fixtureLogin.locator('summary').click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Loadgistic123!');
  await page.getByRole('button',{name:'Log in'}).click();
  await expect(page).toHaveURL(expected);
}

test('Assisted matching behaves as an immediate private chat',async({page,browser}:{page:any;browser:any})=>{
  test.setTimeout(60_000);
  const email=`guest-${test.info().project.name}-${Date.now()}@example.test`;
  await page.goto('/');
  await page.getByRole('button',{name:'Ask Loadgistic'}).click();
  const dialog=page.getByRole('dialog',{name:'Ask Loadgistic'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Callback phone')).toBeVisible();
  await dialog.getByLabel('Email',{exact:true}).fill(email);
  await dialog.getByLabel('Callback phone').fill('+251 911 222 333');
  await dialog.getByLabel('What do you need?').fill('I need a local cargo van from Adama to Bishoftu tomorrow morning.');
  await dialog.getByRole('button',{name:'Start chat'}).click();
  await expect(dialog.getByText('I need a local cargo van from Adama to Bishoftu tomorrow morning.')).toBeVisible();
  await page.goto('/featured');
  await expect(page.getByRole('dialog',{name:'Ask Loadgistic'}).getByText('I need a local cargo van from Adama to Bishoftu tomorrow morning.')).toBeVisible();

  const teamContext=await browser.newContext({baseURL:new URL(page.url()).origin});
  const teamPage=await teamContext.newPage();
  await login(teamPage,'support@loadgistic.local',/\/support/);
  await teamPage.goto('/support/assisted?view=ASSIGNED');
  const conversationHref=await teamPage.getByText(email,{exact:true}).locator('xpath=ancestor::article[1]').getByRole('link',{name:'Open'}).getAttribute('href');
  await teamPage.goto(conversationHref!);
  await expect(teamPage).toHaveURL(/\/support\/assisted\/[0-9a-f-]{36}$/);
  await expect(teamPage.getByText('I need a local cargo van from Adama to Bishoftu tomorrow morning.')).toBeVisible();
  await teamPage.getByLabel('Message').fill('I am checking nearby vans now.');
  await teamPage.getByRole('button',{name:'Send'}).click();
  await expect(page.getByRole('dialog',{name:'Ask Loadgistic'}).getByText('I am checking nearby vans now.')).toBeVisible({timeout:7000});
  await page.getByRole('dialog',{name:'Ask Loadgistic'}).getByRole('button',{name:'End chat'}).click();
  await page.getByRole('dialog',{name:'Ask Loadgistic'}).getByRole('button',{name:'Confirm end'}).click();
  await expect(page.getByRole('dialog',{name:'Ask Loadgistic'}).getByText(/This chat has ended/)).toBeVisible({timeout:7000});
  await page.getByRole('dialog',{name:'Ask Loadgistic'}).getByRole('button',{name:'Start a new chat'}).click();
  await expect(page.getByRole('dialog',{name:'Ask Loadgistic'}).getByLabel('Callback phone')).toBeVisible();
  await teamContext.close();
});

test('provider Network and public Shared capacity remain distinct',async({page}:{page:any})=>{
  const sharedEmail=`shared-${test.info().project.name}@example.test`;
  await page.goto('/shared-capacity');
  await expect(page.getByRole('heading',{name:'Private capacity shared with you.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Email me a code'})).toBeVisible();

  await login(page,'transporter@loadgistic.local');
  await page.goto('/app/network');
  await expect(page.getByRole('heading',{name:'Network'})).toBeVisible();
  await expect(page.getByText('Share with Loadgistic').first()).toBeVisible();
  const shareEmail=page.getByLabel('Share with an email').first();
  await shareEmail.fill(sharedEmail);
  await shareEmail.locator('xpath=ancestor::form[1]').getByRole('button',{name:'Add access'}).click();
  await expect(page.getByText('Capacity access added.')).toBeVisible();

  await page.goto('/shared-capacity');
  await page.getByLabel('Email').fill(sharedEmail);
  await page.getByRole('button',{name:'Email me a code'}).click();
  await expect(page.getByText('Local test code',{exact:true})).toBeVisible();
  await expect(page.getByText(/Email delivery is not configured/)).toBeVisible();
  await expect(page.getByLabel('One-time code')).toHaveValue(/^\d{8}$/);
  await page.getByRole('button',{name:'Open shared capacity'}).click();
  await expect(page.getByRole('region',{name:'Privately shared truck capacity'})).toBeVisible();
  await expect(page.getByText(/access ends after 30 minutes without activity/i)).toBeVisible();
  if(process.env.CAPTURE_VISUAL_REVIEW==='1'){
    const output=path.resolve(process.cwd(),'artifacts/private-capacity-assisted-chat-v1');
    fs.mkdirSync(output,{recursive:true});
    await page.screenshot({path:path.join(output,`${test.info().project.name}-shared-capacity-active-session.png`),fullPage:true});
  }
  const sessionCookie=(await page.context().cookies()).find((cookie:any)=>cookie.name==='lg_shared_capacity');
  expect(sessionCookie).toBeTruthy();
  expect(sessionCookie!.expires-Math.floor(Date.now()/1000)).toBeGreaterThan(29*60);
  expect(sessionCookie!.expires-Math.floor(Date.now()/1000)).toBeLessThanOrEqual(30*60+5);
  const expiryBeforeRead=sessionCookie!.expires;
  const sharedRead=await page.request.get('/api/shared-capacity');
  expect(sharedRead.ok()).toBe(true);
  expect((await page.context().cookies()).find((cookie:any)=>cookie.name==='lg_shared_capacity')?.expires).toBe(expiryBeforeRead);
  const renewed=page.waitForResponse((response:any)=>response.url().endsWith('/api/shared-capacity/session')&&response.request().method()==='POST');
  await page.keyboard.press('Tab');
  expect((await renewed).ok()).toBe(true);
  await page.getByRole('button',{name:'Log out'}).click();
  await expect(page).toHaveURL(/\/shared-capacity\?session=logout/);
  await expect(page.getByText('You have logged out of Shared capacity.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Email me a code'})).toBeVisible();
  expect((await page.context().cookies()).some((cookie:any)=>cookie.name==='lg_shared_capacity')).toBe(false);
  expect((await page.request.post('/api/shared-capacity/session')).status()).toBe(401);
});

test('private current capacity keeps a callable public regular-service marker without implying location',async({page,request}:{page:any;request:any})=>{
  const fallback=await findPublicRegularServiceFallback(request);
  await page.goto(`/?truck=${encodeURIComponent(fallback.id)}`);
  const summary=page.getByRole('complementary',{name:new RegExp(`${fallback.provider_name} truck summary`,'i')});
  await expect(summary).toBeVisible();
  await expect(summary.getByText('Regular service—not current location')).toBeVisible();
  await expect(summary.getByText(/share private capacity with your email/i)).toBeVisible();
  await expect(summary.getByRole('link',{name:/Call/})).toBeVisible();
  await expect(page.locator('.capacity-signal-inspector')).toHaveCount(0);
});

test('capture public regular-service fallback review',async({page,request}:{page:any;request:any})=>{
  test.skip(process.env.CAPTURE_VISUAL_REVIEW!=='1','Focused visual capture only');
  const output=path.resolve(process.cwd(),'artifacts/private-capacity-assisted-chat-v1');
  fs.mkdirSync(output,{recursive:true});
  const fallback=await findPublicRegularServiceFallback(request);
  await page.goto(`/?truck=${encodeURIComponent(fallback.id)}`);
  await expect(page.getByText('Regular service—not current location')).toBeVisible();
  await page.screenshot({path:path.join(output,`${test.info().project.name}-public-regular-service-fallback.png`),fullPage:true});
});

test('capture focused Assisted matching and Network review',async({page}:{page:any})=>{
  test.setTimeout(60_000);
  test.skip(process.env.CAPTURE_VISUAL_REVIEW!=='1','Focused visual capture only');
  const output=path.resolve(process.cwd(),'artifacts/private-capacity-assisted-chat-v1');
  fs.mkdirSync(output,{recursive:true});
  const project=test.info().project.name;

  await page.goto('/');
  await page.getByRole('button',{name:'Ask Loadgistic'}).click();
  const dialog=page.getByRole('dialog',{name:'Ask Loadgistic'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Callback phone')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:path.join(output,`${project}-assisted-matching-widget.png`),fullPage:true});

  await dialog.getByLabel('Email',{exact:true}).fill(`visual-${project}@example.test`);
  await dialog.getByLabel('Callback phone').fill('+251 911 333 444');
  await dialog.getByLabel('What do you need?').fill('I need a local cargo van between Adama and Bishoftu tomorrow morning.');
  await dialog.getByRole('button',{name:'Start chat'}).click();
  await expect(dialog.getByText('I need a local cargo van between Adama and Bishoftu tomorrow morning.')).toBeVisible();
  await page.goto('/featured');
  await expect(page.getByRole('dialog',{name:'Ask Loadgistic'}).getByText('I need a local cargo van between Adama and Bishoftu tomorrow morning.')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:path.join(output,`${project}-persistent-live-chat.png`),fullPage:true});

  await page.getByRole('dialog',{name:'Ask Loadgistic'}).getByRole('button',{name:'Minimize chat'}).click();
  await page.goto('/shared-capacity');
  await expect(page.getByRole('button',{name:'Email me a code'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:path.join(output,`${project}-shared-capacity-email-otp.png`),fullPage:true});

  await login(page,'transporter@loadgistic.local');
  await page.goto('/app/network');
  await expect(page.getByRole('heading',{name:'Network'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:path.join(output,`${project}-network.png`),fullPage:true});
});
