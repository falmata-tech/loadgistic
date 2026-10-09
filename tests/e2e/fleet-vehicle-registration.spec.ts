import {auditLogin} from './audit-helpers';
import {expect as baseExpect,test} from '@playwright/test';
// Wait for the redirected, streamed detail view, not the initial loading shell.
const expect=baseExpect.configure({timeout:30000});

async function login(page:any,email='driver@loadgistic.local'){await auditLogin(page,email);}

test('independent driver can deliberately change the current truck, without extra-truck or driver management',async({page}:{page:any})=>{
  test.setTimeout(60000);
  await login(page,'driver@loadgistic.local');
  await page.goto('/app/fleet');
  await expect(page.getByRole('heading',{name:'My truck'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Add truck',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Add driver',exact:true})).toHaveCount(0);
  const change=page.getByRole('link',{name:'Change truck',exact:true});
  await expect(change).toHaveAttribute('href',/\/app\/fleet\/new\?replace=[0-9a-f-]+$/);
  await change.click();
  await expect(page).toHaveURL(/\/app\/fleet\/new\?replace=[0-9a-f-]+$/);
  await expect(page.getByRole('heading',{name:'Change truck',exact:true})).toBeVisible();
  await expect(page.getByRole('radio',{name:'I own this truck',exact:true})).toBeVisible();
  await expect(page.getByRole('radio',{name:"I rent it or have the owner's permission",exact:true})).toBeVisible();
  await expect(page.getByRole('checkbox',{name:'Keep my previous truck in history and use this truck instead.',exact:true})).not.toBeChecked();
  await expect(page.getByLabel('Make')).toBeVisible();
  await expect(page.getByLabel('Model')).toBeVisible();
  await expect(page.getByLabel('Vehicle configuration')).toBeVisible();
  await expect(page.getByLabel('Plate number')).toBeVisible();
  await expect(page.getByRole('button',{name:'Change truck',exact:true})).toBeVisible();
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
  await expect(page.locator('a[href^="/app/fleet"]')).toHaveCount(0);
});
