import {expect,test} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

async function login(page:any,email:string,expected=/\/app\/home/){
  await page.goto('/login');
  const fixtureLogin=page.locator('details.auth-fixture-login');
  if(await fixtureLogin.count()&&!(await fixtureLogin.getAttribute('open')))await fixtureLogin.locator('summary').click();
  const fixtureForm=page.getByTestId('login-form');
  await fixtureForm.getByLabel('Email',{exact:true}).fill(email);
  await fixtureForm.getByLabel('Password').fill('Loadgistic123!');
  await fixtureForm.getByRole('button',{name:'Log in'}).click();
  await expect(page).toHaveURL(expected);
}

async function localMailpitCode(email:string,requestedAt:number){
  for(let attempt=0;attempt<40;attempt+=1){
    const response=await fetch('http://127.0.0.1:55324/api/v1/messages');
    if(response.ok){
      const result=await response.json();
      const message=(result.messages||[]).find((candidate:any)=>
        new Date(candidate.Created).getTime()>=requestedAt-2000
        &&(candidate.To||[]).some((recipient:any)=>String(recipient.Address||'').toLowerCase()===email.toLowerCase())
      );
      if(message){
        const detailResponse=await fetch(`http://127.0.0.1:55324/api/v1/message/${encodeURIComponent(message.ID)}`);
        if(detailResponse.ok){
          const detail=await detailResponse.json();
          const match=String(detail.Text||detail.HTML||'').match(/(?:^|\D)(\d{6})(?:\D|$)/);
          if(match)return match[1];
        }
      }
    }
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error('Expected a recent Shared capacity message in the isolated local inbox.');
}

test('public route changes keep only the asynchronous transport request',async({page}:{page:any})=>{
 await page.goto('/');await page.getByRole('button',{name:'Arrange transport',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Let us arrange your transport'})).toBeVisible();
 await page.goto('/featured');await expect(page.getByRole('dialog',{name:'Let us arrange your transport'})).toBeVisible();
 await expect(page.locator('.public-chat-start,.public-chat-composer')).toHaveCount(0);
 await page.getByRole('button',{name:'Close',exact:true}).click();await expect(page.locator('.public-assistance-dock button')).toHaveCount(1);
});

test('provider Network and public Shared capacity remain distinct',async({page}:{page:any})=>{
  test.setTimeout(60_000);
  const sharedEmail=`shared-${Date.now()}-${test.info().project.name}@example.test`;
  await page.goto('/shared-capacity');
  await expect(page.getByRole('heading',{name:'Find truck capacity in Ethiopia',level:1})).toHaveCount(1);
  await expect(page.locator('.map-workspace-heading')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Continue with email'})).toBeVisible();
  await page.getByLabel('Email').fill(sharedEmail);
  await page.getByRole('button',{name:'Continue with email'}).click();
  await expect(page.locator('.shared-capacity-access-card .form-notice')).toBeVisible();
  await expect(page.getByLabel('6-digit email code')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Continue with email'})).toBeVisible();
  if(process.env.CAPTURE_VISUAL_REVIEW==='1'){
    const output=path.resolve(process.cwd(),'artifacts/private-capacity-assisted-chat-v1');
    fs.mkdirSync(output,{recursive:true});
    await page.screenshot({path:path.join(output,`${test.info().project.name}-shared-capacity-no-share.png`),fullPage:true});
  }

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
  const requestedAt=Date.now();
  await page.getByRole('button',{name:'Continue with email'}).click();
  await expect(page.getByText('Local test code',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Check your email for a one-time code.')).toBeVisible();
  await expect(page.getByRole('link',{name:'Open the local inbox in a new tab'})).toBeVisible();
  await page.getByLabel('6-digit email code').fill(await localMailpitCode(sharedEmail,requestedAt));
  await page.getByRole('button',{name:'View shared signals'}).click();
  await expect(page.getByRole('region',{name:'Privately shared truck capacity'})).toBeVisible();
  await expect(page.getByLabel(/access ends after 30 minutes without activity/i)).toBeVisible();
  const initialViewport=page.viewportSize();
  await page.setViewportSize({width:320,height:640});
  await expect.poll(()=>page.locator('.public-capacity-map').evaluate((element:any)=>element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(300);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  if(initialViewport)await page.setViewportSize(initialViewport);
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
  const logout=page.getByRole('button',{name:'Log out'});
  const [logoutBox,mapBox]=await Promise.all([logout.boundingBox(),page.locator('.public-capacity-map').boundingBox()]);
  expect(logoutBox).toBeTruthy();
  expect(mapBox).toBeTruthy();
  expect(mapBox!.y).toBeGreaterThanOrEqual(logoutBox!.y+logoutBox!.height);
  await logout.click();
  await expect(page).toHaveURL(/\/shared-capacity\?session=logout/);
  await expect(page.getByText('You have logged out of Private capacity.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Continue with email'})).toBeVisible();
  expect((await page.context().cookies()).some((cookie:any)=>cookie.name==='lg_shared_capacity')).toBe(false);
  expect((await page.request.post('/api/shared-capacity/session')).status()).toBe(401);
});

test('public Market returns only trucks that expose their current signal',async({request}:{request:any})=>{
  let cursor='';
  let count=0;
  for(let pageNumber=0;pageNumber<20;pageNumber+=1){
    const response=await request.get(`/api/public/capacity${cursor?`?cursor=${encodeURIComponent(cursor)}`:''}`);
    expect(response.ok()).toBe(true);
    const result=await response.json();
    expect(result.items.every((item:any)=>item.current_signal_geometry_visible!==false&&item.current_signal_visibility==='PUBLIC_MARKET')).toBe(true);
    count+=result.items.length;
    if(!result.nextCursor)break;
    cursor=result.nextCursor;
  }
  expect(count).toBeGreaterThan(0);
});

test('capture focused transport request and Network review',async({page}:{page:any})=>{
  test.setTimeout(60_000);
  test.skip(process.env.CAPTURE_VISUAL_REVIEW!=='1','Focused visual capture only');
  const output=path.resolve(process.cwd(),'artifacts/private-capacity-assisted-chat-v1');
  fs.mkdirSync(output,{recursive:true});
  const project=test.info().project.name;

  await page.goto('/');
  await page.getByRole('button',{name:'Arrange transport',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Let us arrange your transport'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:path.join(output,`${project}-transport-request.png`),fullPage:true});
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.goto('/shared-capacity');
  await expect(page.getByRole('button',{name:'Continue with email'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:path.join(output,`${project}-shared-capacity-email-otp.png`),fullPage:true});

  await login(page,'transporter@loadgistic.local');
  await page.goto('/app/network');
  await expect(page.getByRole('heading',{name:'Network'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:path.join(output,`${project}-network.png`),fullPage:true});
});
