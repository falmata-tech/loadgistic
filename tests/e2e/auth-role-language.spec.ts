import { expect, test } from '@playwright/test';

async function login(page:any,email:string){
  await page.goto('/login');
  const fixtureLogin=page.locator('details.auth-fixture-login');
  await fixtureLogin.locator('summary').click();
  await fixtureLogin.getByLabel('Email').fill(email);
  await fixtureLogin.getByLabel('Password').fill('Loadgistic123!');
  await fixtureLogin.getByRole('button',{name:'Log in'}).click();
  await expect(page).toHaveURL(/\/app\/home/);
}

test('public account access stays unified and follows session state',async({page}:{page:any})=>{
  await page.goto('/');
  const desktop=(page.viewportSize()?.width||0)>760;
  const publicNavigation=desktop
    ?page.getByRole('navigation',{name:'Public workspace navigation'})
    :page.locator('.public-session-compact');
  await expect(publicNavigation.getByRole('link',{name:/Account access|Log in|Transporter login/,exact:true})).toBeVisible();
  await expect(publicNavigation.getByRole('link',{name:'Dashboard',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Join',exact:true})).toHaveCount(0);

  await page.goto('/login');
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveText('Log in');
  const emailForm=page.getByTestId('email-code-request-form');
  const google=page.getByRole('button',{name:'Continue with Google'});
  await expect(emailForm).toBeVisible();
  await expect(google).toBeVisible();
  await expect(page.getByText(/Existing account email|only if this address has a transporter account/i)).toHaveCount(0);
  const [emailBox,googleBox]=await Promise.all([emailForm.boundingBox(),google.boundingBox()]);
  expect(emailBox).not.toBeNull();
  expect(googleBox).not.toBeNull();
  expect(emailBox!.y).toBeLessThan(googleBox!.y);
  await expect(page.getByRole('link',{name:/Create a transporter account|Join/i})).toHaveCount(0);
  await expect(page.getByText(/New to Loadgistic\?|Already have an account\?/i)).toHaveCount(0);

  await page.goto('/apply');
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  await expect(page.getByRole('radio')).toHaveCount(0);

  await login(page,'driver@loadgistic.local');
  await page.goto('/');
  const signedInNavigation=desktop
    ?page.getByRole('navigation',{name:'Public workspace navigation'})
    :page.locator('.public-session-compact');
  await expect(signedInNavigation.getByRole('link',{name:'Dashboard',exact:true})).toBeVisible();
  await expect(signedInNavigation.getByRole('link',{name:/Account access|Log in|Transporter login/,exact:true})).toHaveCount(0);
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
