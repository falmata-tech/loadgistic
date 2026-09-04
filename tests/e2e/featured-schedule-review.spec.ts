import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test('Sponsors stay separate, compact, and schedule-attributed',async({page}:{page:any})=>{
  test.setTimeout(45_000);
  await page.goto('/featured');
  const sponsors=page.locator('.expo-sponsored-rail');
  await expect(sponsors.getByRole('heading',{name:'Sponsors'})).toBeVisible();
  const phone=(page.viewportSize()?.width||1280)<=620;
  if(phone)await expect.poll(()=>sponsors.locator('.expo-sponsored-card').count()).toBe(2);
  else await expect.poll(()=>sponsors.locator('.expo-sponsored-card').count()).toBeGreaterThan(2);
  if(phone){
    const firstPair=await sponsors.locator('.expo-sponsored-card').allTextContents();
    await expect.poll(async()=>JSON.stringify(await sponsors.locator('.expo-sponsored-card').allTextContents()),{timeout:12_000}).not.toBe(JSON.stringify(firstPair));
  }else await expect(sponsors.getByText('Advertiser')).toBeVisible();
  await expect(sponsors.getByRole('button',{name:/next|previous|pause/i})).toHaveCount(0);

  await page.goto('/login');
  await page.locator('details.auth-fixture-login>summary').click();
  const localLogin=page.getByTestId('login-form');
  await localLogin.getByLabel('Email').fill('admin@loadgistic.local');
  await localLogin.getByLabel('Password').fill('Loadgistic123!');
  await Promise.all([page.waitForURL(/\/(?:admin|app\/home)/),localLogin.getByRole('button',{name:'Log in'}).click()]);
  await page.goto('/admin/featured');
  await expect(page.getByRole('heading',{name:'Sponsors'})).toBeVisible();
  await expect(page.getByLabel('Sponsor type')).toContainText('Outside advertiser');
});

test('capture focused featured schedule review',async({page}:{page:any})=>{
  test.skip(process.env.CAPTURE_VISUAL_REVIEW!=='1','Focused visual capture only');
  const output=path.resolve(process.cwd(),'artifacts/featured-schedule-v1');
  fs.mkdirSync(output,{recursive:true});
  const project=test.info().project.name;

  await page.goto('/featured');
  const featured=page.locator('.featured-provider-section');
  await featured.scrollIntoViewIfNeeded();
  await expect(featured.getByRole('heading',{name:'Sponsors'})).toBeVisible();
  await expect.poll(()=>featured.locator('.featured-truck-tile').count()).toBeGreaterThan(0);
  await expect(featured.locator('.featured-truck-tile').first()).toContainText(/Company driver|Owner-operator|Self-managed driver/);
  await featured.screenshot({path:path.join(output,`${project}-public.png`)});
  await featured.locator('.expo-schedule-panel>summary').click();
  await expect(featured.locator('.expo-programme-strip')).toBeVisible();
  await featured.locator('.featured-programme-command').screenshot({path:path.join(output,`${project}-schedule.png`)});

  await page.goto('/login');
  await page.locator('details.auth-fixture-login>summary').click();
  const localLogin=page.getByTestId('login-form');
  await localLogin.getByLabel('Email').fill('admin@loadgistic.local');
  await localLogin.getByLabel('Password').fill('Loadgistic123!');
  await Promise.all([page.waitForURL(/\/(?:admin|app\/home)/),localLogin.getByRole('button',{name:'Log in'}).click()]);
  await page.goto('/admin/featured');
  const scheduler=page.locator('.featured-roster-editor');
  await expect(scheduler.getByRole('button',{name:'Automatic'})).toBeVisible();
  await scheduler.screenshot({path:path.join(output,`${project}-admin.png`)});
  await page.getByLabel('Sponsor type').selectOption('ADVERTISER');
  await page.locator('.featured-sponsor-admin').screenshot({path:path.join(output,`${project}-admin-sponsors.png`)});
});
