import {expect,test} from './browser-test';

import {auditLogin as login} from './audit-helpers';

test('truck management names its Driver and verification stays optional',async({page}:{page:any},testInfo:any)=>{
  test.setTimeout(90_000);
  await login(page,'transporter@loadgistic.local');
  await page.goto('/app/fleet?view=drivers');
  const row=page.locator('#driver-access article').filter({hasNotText:'No vehicle assigned'}).first();
  await expect(row.getByRole('link',{name:'Manage',exact:true})).toBeVisible();
  await row.getByRole('link',{name:'Manage',exact:true}).click();
  await expect(page).toHaveURL(/\/app\/fleet\?view=drivers&driver=[a-f0-9-]+/,{timeout:20000});
  const expectedDriver=(await page.locator('#driver-access h2').innerText()).replace(/\s*·\s*You$/,'');
  await page.locator('#driver-access').getByRole('link',{name:'View vehicle',exact:true}).click();
  await page.getByRole('navigation',{name:'Vehicle'}).getByRole('link',{name:'Vehicle details'}).click();
  await expect(page.getByRole('region',{name:'Vehicle driver'})).toContainText(expectedDriver);
  await expect(page.getByRole('link',{name:'Manage driver'})).toHaveAttribute('href',/^\/app\/fleet\?view=drivers&vehicle=[a-f0-9-]{36}&driver=[a-f0-9-]{36}$/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('truck-driver-link.png')});
  await page.goto('/app/verification',{waitUntil:'domcontentloaded'});
  await expect(page.getByText('Build confidence in your transport service with optional document review.')).toBeVisible();
  await expect(page.locator('.verification-subject-list')).toBeVisible();
});

test('selected public truck separates Driver and truck review categories',async({page,request}:{page:any;request:any},testInfo:any)=>{
  const response=await request.get('/api/public/capacity');
  expect(response.ok()).toBe(true);
  const truck=(await response.json()).items[0];
  expect(truck.assigned_driver_first_name).toBeTruthy();
  await page.goto(`/?truck=${encodeURIComponent(truck.id)}`);
  await page.locator('.map-info-bubble.truck').click();
  const sheet=page.locator('.map-capacity-sheet');
  await expect(sheet.locator('.truck-inspection-person.driver')).toContainText(truck.assigned_driver_first_name);
  for(const [label,key] of [['Driver documents','driver_verification_badges'],['Vehicle documents','truck_verification_badges']]){
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

test('Fleet keeps add, contact and remove actions distinct and responsive',async({page}:{page:any},info:any)=>{
  await login(page,'transporter@loadgistic.local');
  await page.goto('/app/fleet?view=drivers');
  await expect(page.locator('.page>.page-header').getByRole('link',{name:'Add driver'})).toBeVisible();
  await page.locator('#driver-access article').filter({hasNotText:'· You'}).first().getByRole('link',{name:'Manage',exact:true}).click();const driver=page.locator('#driver-access');
  await driver.getByRole('button',{name:'Edit assignment',exact:true}).click();const assignment=page.getByRole('dialog',{name:'Assigned vehicle',exact:true});
  const checkbox=await assignment.getByLabel('Capacity updates',{exact:true}).boundingBox();
  expect(checkbox!.width).toBeLessThanOrEqual(24);
  await assignment.getByRole('button',{name:'Cancel',exact:true}).click();await driver.getByRole('link',{name:'Contact',exact:true}).click();await driver.getByRole('button',{name:'Edit contact',exact:true}).click();const contact=page.getByRole('dialog',{name:'Edit contact',exact:true});
  await expect(contact.getByLabel('Driver name',{exact:true})).toBeVisible();await expect(contact.getByLabel('Contact phone',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await contact.scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('fleet-contact-tools.png'),fullPage:true});
  await contact.getByRole('button',{name:'Cancel',exact:true}).click();await expect(driver.getByRole('button',{name:'Remove from fleet',exact:true})).toBeVisible();
});
