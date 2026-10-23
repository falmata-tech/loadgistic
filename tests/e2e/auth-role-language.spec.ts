import { expect, test } from './browser-test';

import {auditLogin as login,auditIdentity,checked,localAuditService} from './audit-helpers';

test('public account access stays unified and follows session state',async({page}:{page:any})=>{
  test.setTimeout(90000);
  await page.goto('/',{waitUntil:'domcontentloaded'});
  const desktop=(page.viewportSize()?.width||0)>760;
  const publicNavigation=desktop
    ?page.getByRole('navigation',{name:'Public workspace navigation'})
    :page.locator('.public-session-compact');
  const signedOutSwitch=page.getByRole('navigation',{name:'Switch view',exact:true});
  const signIn=signedOutSwitch.getByRole('link',{name:'My workspace',exact:true});await expect(signIn).toBeVisible();await expect(signIn).toHaveAttribute('href','/login');
  await expect(signedOutSwitch.getByText('Marketplace',{exact:true})).toHaveAttribute('aria-current','page');
  await expect(publicNavigation.getByRole('link',{name:'My workspace',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Join',exact:true})).toHaveCount(0);

  await page.goto('/login',{waitUntil:'domcontentloaded'});
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveText('Log in');
  const emailForm=page.getByTestId('email-code-request-form');
  const google=page.getByRole('button',{name:'Continue with Google'});
  await expect(emailForm).toBeVisible();
  await expect(google).toHaveCount(0);
  await expect(page.getByText(/Existing account email|only if this address has a transporter account/i)).toHaveCount(0);
  await expect(page.locator('.auth-context-panel')).toHaveCount(0);
  await expect(page.getByRole('link',{name:/Create a transporter account|Join/i})).toHaveCount(0);
  await expect(page.getByText(/New to Loadgistic\?|Already have an account\?/i)).toHaveCount(0);

  await page.goto('/apply',{waitUntil:'domcontentloaded'});
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/,{timeout:20000});
  await expect(page.getByRole('radio')).toHaveCount(0);

  await login(page,'driver@loadgistic.local');
  await page.goto('/',{waitUntil:'domcontentloaded'});
  const signedInNavigation=page.getByRole('navigation',{name:'Switch view'});
  await expect(signedInNavigation.getByRole('link',{name:'My workspace',exact:true})).toBeVisible();
  await expect(signedInNavigation.getByRole('link',{name:'My workspace',exact:true})).toHaveAttribute('href','/app/home');
  await expect(page.locator('.public-session-compact').getByRole('link',{name:'Sign in',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Join',exact:true})).toHaveCount(0);
});

test('company Driver identity names the role and employing fleet',async({page}:{page:any})=>{
  const service=localAuditService(),actor=await auditIdentity(service,'company-driver@loadgistic.local');
  const saved=checked(await service.from('profiles').select('first_name,last_name,full_name,email,phone').eq('id',actor.id).single());
  await login(page,'company-driver@loadgistic.local');
  await expect(page.locator('.workspace-title')).toContainText('BlueLine Transport PLC');
  await expect(page.locator('.workspace-title')).toContainText('Company driver');
  await page.goto('/app/more',{waitUntil:'domcontentloaded'});
  const account=page.locator('.app-main .page');await expect(account.getByRole('heading',{name:'Account',exact:true})).toBeVisible();await expect(account.getByText('Company driver',{exact:true})).toBeVisible();
  const fact=(name:string)=>account.locator('dl > div').filter({has:page.getByText(name,{exact:true})}).getByRole('definition');
  await expect(fact('First name')).toHaveText(saved.first_name||saved.full_name.split(/\s+/)[0]);await expect(fact('Last / father name')).toHaveText(saved.last_name||'Not set');await expect(fact('Account email')).toHaveText(saved.email);await expect(fact('Account phone')).toHaveText(saved.phone||'Not set');
  await expect(account.getByText('Your login email stays private.',{exact:true})).toBeVisible();await expect(page.locator('.workspace-title')).toContainText('BlueLine Transport PLC');
  await page.goto('/app/verification',{waitUntil:'domcontentloaded'});
  await expect(page.getByText('Company driver · BlueLine Transport PLC',{exact:true}).first()).toBeVisible();
});
