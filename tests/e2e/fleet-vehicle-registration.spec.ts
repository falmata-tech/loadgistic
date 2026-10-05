import {auditLogin} from './audit-helpers';
import {expect,test} from '@playwright/test';

async function login(page:any,email='driver@loadgistic.local'){await auditLogin(page,email);}

test('independent driver reaches truck registration from My trucks',async({page}:{page:any})=>{
  test.setTimeout(60000);
  await login(page,'driver@loadgistic.local');
  await page.goto('/app/fleet');
  await expect(page.getByRole('heading',{name:'My trucks'})).toBeVisible();
  const add=page.getByRole('link',{name:'Add truck'}).first();
  await expect(add).toHaveAttribute('href','/app/fleet/new');
  await add.click();
  await expect(page).toHaveURL(/\/app\/fleet\/new$/);
  await expect(page.getByRole('heading',{name:'Add truck'})).toBeVisible();
  await expect(page.getByLabel('Make')).toBeVisible();
  await expect(page.getByLabel('Model')).toBeVisible();
  await expect(page.getByLabel('Vehicle configuration')).toBeVisible();
  await expect(page.getByLabel('Plate number')).toBeVisible();
  await expect(page.getByRole('button',{name:'Add truck'})).toBeVisible();
});

test('fleet transporter reaches truck registration while company driver cannot create trucks',async({page}:{page:any})=>{
  test.setTimeout(60000);
  await login(page,'transporter@loadgistic.local');
  await page.goto('/app/fleet');
  await expect(page.getByRole('heading',{name:'My Fleet'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Add truck'}).first()).toHaveAttribute('href','/app/fleet/new');

  await page.context().clearCookies();
  await login(page,'company-driver@loadgistic.local');
  await page.goto('/app/fleet/new',{waitUntil:'domcontentloaded'});
  await expect(page).toHaveURL(/\/app\/home$/);
  await page.goto('/app/menu');
  await expect(page.getByRole('link',{name:/^My (Fleet|trucks)/})).toHaveCount(0);
});
