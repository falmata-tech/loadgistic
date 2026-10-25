import {auditIdentity,localAuditService} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {expect as baseExpect,test} from './browser-test';
// Wait for the redirected, streamed detail view, not the initial loading shell.
const expect=baseExpect.configure({timeout:30000});

async function login(page:any,email='driver@loadgistic.local'){
  const identity=await auditIdentity(localAuditService(),email);
  await localSupportLogin(page,identity.id);await page.goto('/app/home',{waitUntil:'domcontentloaded'});
  await expect(page).toHaveURL(/\/app\/home(?:\?.*)?$/);await expect(page.locator('.app-main')).toBeVisible();
}

test('personal Transport Provider owner can add trucks and drivers while new registration stays separate from assignment',async({page}:{page:any})=>{
  test.setTimeout(60000);
  await login(page,'driver@loadgistic.local');
  await page.goto('/app/fleet');
  await expect(page).toHaveURL(/\/app\/home\/vehicles/);
  await expect(page.getByRole('navigation',{name:'Manage vehicles',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Add vehicle',exact:true}).first()).toHaveAttribute('href','/app/fleet/new');
  const fleetNavigation=page.getByRole('navigation',{name:'Manage vehicles',exact:true});
  await fleetNavigation.getByRole('link',{name:/^Drivers/}).click();
  await expect(page.getByRole('link',{name:'Add driver',exact:true})).toHaveAttribute('href',/^\/app\/fleet\/drivers\/new(?:\?|$)/);
  await fleetNavigation.getByRole('link',{name:/^Vehicles/}).click();
  await page.getByRole('link',{name:'Add vehicle',exact:true}).first().click();
  await expect(page).toHaveURL(/\/app\/fleet\/new$/);
  await expect(page.getByRole('heading',{name:'Add vehicle',exact:true})).toBeVisible();
  await expect(page.getByRole('radio',{name:'I own this vehicle',exact:true})).toBeVisible();
  await expect(page.getByRole('radio',{name:'I am buying this vehicle through financing',exact:true})).toBeVisible();
  await expect(page.getByRole('radio',{name:'I rent it or have permission to use it',exact:true})).toBeVisible();
  await expect(page.getByRole('checkbox',{name:'Keep my previous truck in history and use this truck instead.',exact:true})).toHaveCount(0);
  await expect(page.getByLabel('Make')).toBeVisible();
  await expect(page.getByLabel('Model')).toBeVisible();
  await expect(page.getByLabel('Vehicle configuration')).toBeVisible();
  await expect(page.getByLabel('Plate number')).toBeVisible();
  await expect(page.getByRole('button',{name:'Add vehicle',exact:true})).toBeVisible();
});

test('fleet transporter reaches truck registration while company driver cannot create trucks',async({page}:{page:any})=>{
  test.setTimeout(60000);
  await login(page,'transporter@loadgistic.local');
  await page.goto('/app/fleet');
  await expect(page).toHaveURL(/\/app\/home\/vehicles/);
  await expect(page.getByRole('navigation',{name:'Manage vehicles',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Add vehicle'}).first()).toHaveAttribute('href','/app/fleet/new');

  await page.context().clearCookies();
  await login(page,'company-driver@loadgistic.local');
  await page.goto('/app/fleet/new',{waitUntil:'domcontentloaded'});
  await expect(page).toHaveURL(/\/app\/home$/);
  await page.goto('/app/menu');
  await expect(page.locator('a[href^="/app/fleet"]')).toHaveCount(0);
});
