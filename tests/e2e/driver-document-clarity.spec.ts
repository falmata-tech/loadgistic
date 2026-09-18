import {expect,test} from '@playwright/test';

async function login(page:any,email:string){
  await page.goto('/login');
  await page.locator('details.auth-fixture-login>summary').click();
  const form=page.getByTestId('login-form');
  await form.getByLabel('Email',{exact:true}).fill(email);
  await form.getByLabel('Password').fill('Loadgistic123!');
  await form.getByRole('button',{name:'Log in'}).click();
  await expect(page).toHaveURL(/\/app\/home/);
}

test('truck management names its Driver and verification stays optional',async({page}:{page:any},testInfo:any)=>{
  await login(page,'transporter@loadgistic.local');
  await page.goto('/app/fleet');
  const row=page.locator('.fleet-truck-row').filter({has:page.locator('.fleet-driver-assignment', {hasText:'Driver:'})}).first();
  const expectedDriver=(await row.locator('.fleet-driver-assignment').innerText()).replace(/^Driver: /,'');
  await row.getByRole('link',{name:'View truck'}).click();
  await expect(page.getByRole('region',{name:'Truck driver'})).toContainText(expectedDriver);
  await expect(page.getByRole('link',{name:'Manage driver'})).toHaveAttribute('href',/^\/app\/fleet\?vehicle=[a-f0-9-]{36}#driver-access$/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('truck-driver-link.png')});
  await page.goto('/app/verification');
  await expect(page.getByText('Documents are optional. Add them when you’re ready for review.')).toBeVisible();
  await expect(page.locator('.verification-subject-list')).toBeVisible();
});

test('selected public truck separates Driver and truck review categories',async({page,request}:{page:any;request:any},testInfo:any)=>{
  const response=await request.get('/api/public/capacity');
  expect(response.ok()).toBe(true);
  const truck=(await response.json()).items[0];
  expect(truck.assigned_driver_first_name).toBeTruthy();
  await page.goto(`/?truck=${encodeURIComponent(truck.id)}`);
  const sheet=page.locator('.map-capacity-sheet');
  await expect(sheet.locator('.public-truck-driver')).toContainText(truck.assigned_driver_first_name);
  for(const [label,key] of [['Driver documents','driver_verification_badges'],['Truck documents','truck_verification_badges']]){
    const badges=truck[key]||[];
    const reviewed=badges.filter((badge:any)=>badge.verified&&!badge.expired).length;
    const details=sheet.locator('.truck-document-summary').filter({hasText:label});
    await expect(details.locator('summary').first()).toContainText(`${reviewed} of ${badges.length} reviewed`);
    await details.locator('summary').first().click();
    await expect(details.locator('.verification-badge')).toHaveCount(badges.length);
    await expect(details.locator('a[href*="/api/files"]')).toHaveCount(0);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('truck-review-categories.png')});
});

test('Fleet keeps invite, contact and remove actions distinct and responsive',async({page}:{page:any},info:any)=>{
  await login(page,'transporter@loadgistic.local');
  await page.goto('/app/fleet');
  await expect(page.locator('.page>.page-header').getByRole('link',{name:'Invite driver'})).toBeVisible();
  const driver=page.locator('.fleet-driver-manager').first();
  await driver.locator('summary').first().click();
  await driver.getByText('Edit contact',{exact:true}).click();
  await expect(driver.getByLabel('Driver name',{exact:true})).toBeVisible();
  await expect(driver.getByLabel('Contact phone',{exact:true})).toBeVisible();
  await expect(driver.getByText('Remove from fleet',{exact:true})).toBeVisible();
  const checkbox=await driver.getByLabel('Capacity updates',{exact:true}).boundingBox();
  expect(checkbox!.width).toBeLessThanOrEqual(24);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await driver.scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('fleet-contact-tools.png'),fullPage:true});
});
