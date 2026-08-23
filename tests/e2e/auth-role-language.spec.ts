import { expect, test } from '@playwright/test';

async function login(page:any,email:string){
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Loadgistic123!');
  await page.getByRole('button',{name:'Log in'}).click();
  await expect(page).toHaveURL(/\/app\/home/);
}

test('public account navigation and transporter signup follow session state',async({page}:{page:any})=>{
  await page.goto('/');
  const desktop=(page.viewportSize()?.width||0)>760;
  const publicNavigation=desktop
    ?page.getByRole('navigation',{name:'Public workspace navigation'})
    :page.locator('.public-session-compact');
  await expect(publicNavigation.getByRole('link',{name:/Log in|Transporter login/,exact:true})).toBeVisible();
  await expect(publicNavigation.getByRole('link',{name:'Dashboard',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Join',exact:true})).toHaveCount(0);

  await page.goto('/login');
  await expect(page.getByRole('heading',{name:'Transporter login'})).toBeVisible();
  await page.getByRole('link',{name:'Create a transporter account'}).click();
  await expect(page).toHaveURL(/\/apply$/);
  for(const label of ['Fleet transporter','Owner-operator','Self-managed driver']){
    await expect(page.getByRole('radio',{name:new RegExp(`^${label}`)})).toBeVisible();
  }

  await login(page,'driver@loadgistic.local');
  await page.goto('/');
  const signedInNavigation=desktop
    ?page.getByRole('navigation',{name:'Public workspace navigation'})
    :page.locator('.public-session-compact');
  await expect(signedInNavigation.getByRole('link',{name:'Dashboard',exact:true})).toBeVisible();
  await expect(signedInNavigation.getByRole('link',{name:/Log in|Transporter login/,exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Join',exact:true})).toHaveCount(0);
});

test('company Driver identity names the role and employing fleet',async({page}:{page:any})=>{
  await login(page,'company-driver@loadgistic.local');
  await expect(page.locator('.workspace-title')).toContainText('BlueLine Transport PLC');
  await expect(page.locator('.workspace-title')).toContainText('Company driver');
  await page.goto('/app/more');
  await expect(page.locator('.account-private-card')).toContainText('Company driver · BlueLine Transport PLC');
  await page.goto('/app/verification');
  await expect(page.getByText('Company driver · BlueLine Transport PLC',{exact:true}).first()).toBeVisible();
});
