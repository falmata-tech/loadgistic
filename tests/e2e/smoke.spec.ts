import { test, expect } from '@playwright/test';

async function login(page: any, email: string, expectedPath = '/app/home') {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Loadgistic123!');
  await expect(page.getByLabel('Email')).toHaveValue(email);
  await expect(page.getByLabel('Password')).toHaveValue('Loadgistic123!');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(new RegExp(expectedPath.replaceAll('/','\\/')));
}

test('login keeps local fixture credentials out of the public page', async ({ page }: { page: any }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Email')).toHaveValue('');
  await expect(page.getByLabel('Password')).toHaveValue('');
  await expect(page.getByText('@loadgistic.local')).toHaveCount(0);
  await expect(page.getByText('Loadgistic123!', { exact: false })).toHaveCount(0);
});

test('PWA manifest and service worker are active', async ({ page, request }: { page: any; request: any }) => {
  const manifestResponse = await request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/app/home');
  const workerSource = await (await request.get('/sw.js')).text();
  expect(workerSource).toContain("loadgistic-static-v3");
  expect(workerSource).not.toContain("startsWith('/_next/static/')");
  await page.goto('/login');
  await page.getByLabel('Email').fill('pwa-install-probe@example.test');
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toContain('/');
  await page.waitForTimeout(1_000);
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect(page.getByLabel('Email')).toHaveValue('pwa-install-probe@example.test');
  const executableChunkResult = await page.evaluate(async () => {
    const cache = await caches.open('loadgistic-runtime-regression');
    await cache.put('/_next/static/runtime-probe.js', new Response('stale-runtime'));
    const response = await fetch('/_next/static/runtime-probe.js');
    await caches.delete('loadgistic-runtime-regression');
    return { status: response.status, body: await response.text() };
  });
  expect(executableChunkResult.status).toBe(404);
  expect(executableChunkResult.body).not.toBe('stale-runtime');
  await page.getByRole('link', { name: 'Loadgistic home' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: "Ethiopia's road-freight marketplace." })).toBeVisible();
});

test('anonymous users cannot browse Business or transporter profiles', async ({ page, request }: { page: any; request: any }) => {
  await page.goto('/companies');
  await expect(page).toHaveURL(/\/login\?error=Please\+log\+in/);
  await expect(page.getByText('BlueLine Transport')).toHaveCount(0);
  const profileResponse = await request.get('/companies/blueline-transport', { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(profileResponse.status());
  expect(profileResponse.headers().location).toMatch(/\/login\?error=Please\+log\+in/);
});

test('authenticated directory browsing preserves the session and selected participants', async ({ page }: { page: any }) => {
  test.setTimeout(60_000);
  await login(page, 'shipper@loadgistic.local');
  await page.goto('/app/providers?type=TRANSPORT');
  await expect(page.locator('.directory-card')).toHaveCount(0);
  await expect(page.getByText('Find a Business or transporter')).toBeVisible();
  await page.goto('/app/providers?type=TRANSPORT&q=BlueLine');
  const fleetProfile=page.locator('.directory-grid').getByRole('link', { name: 'Profile' }).first();
  await Promise.all([
    page.waitForURL(/\/app\/providers\/blueline-transport/,{timeout:15_000}),
    fleetProfile.click()
  ]);
  await expect(page.getByText('B2B logistics workspace')).toBeVisible();
  await expect(page.getByTestId('public-session-action')).toHaveCount(0);
  await page.getByRole('link', { name: 'Request' }).click();
  await expect(page).toHaveURL(/\/app\/shipments\/new\?provider=/);
  await expect(page.getByRole('combobox', { name: 'Selected transporter' })).not.toHaveValue('');
  await page.goto('/app/providers?type=DRIVER&q=Abebe');
  await page.locator('.directory-grid').getByRole('link', { name: 'Profile' }).click();
  await page.getByRole('link', { name: 'Request' }).click();
  await expect(page.getByRole('combobox', { name: 'Selected transporter' })).toHaveValue('Abebe Owner-Operator');
  await expect(page.locator('input[name="providerRef"]')).toHaveValue('profile:provider-driver');
  await page.goto('/app/providers?type=BUSINESS&q=Blue');
  await page.locator('.directory-grid').getByRole('link', { name: 'Profile' }).first().click();
  await expect(page.getByText('Account login contacts are private')).toBeVisible();
  await page.goto('/login');
  await expect(page).toHaveURL(/\/app\/home/);
});

test('shipper can open rich shipment posting workflow', async ({ page }: { page: any }) => {
  await login(page, 'shipper@loadgistic.local');
  await expect(page.getByRole('link', { name: /^Post a shipment Request quotes/ })).toHaveAttribute('href','/app/shipments/new');
  await page.goto('/app/shipments/new');
  await expect(page.getByRole('heading', { name: 'Post a shipment' })).toBeVisible();
  await expect(page.getByText('Best cargo configuration (optional)', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: /FTL/i })).toBeVisible();
  await expect(page.getByRole('radio', { name: /PTL/i })).toBeVisible();
  await expect(page.getByLabel('Tracking after assignment')).toHaveValue('STATUS_ONLY');
  await expect(page.getByLabel('Pick up before')).toBeVisible();
  await expect(page.getByLabel('Drop off before (optional)')).toBeVisible();
  await expect(page.getByText('Road Freight', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Package count')).toHaveCount(0);
  await expect(page.getByLabel('Estimated kg')).toHaveCount(0);
  await expect(page.getByLabel('Shipment detail')).toBeVisible();
  const origin=page.getByLabel('From city');
  await origin.fill('Addis');
  await expect(page.getByRole('option', { name: /Addis Ababa, Ethiopia/i }).first()).toBeVisible();
  await page.getByRole('option', { name: /Addis Ababa, Ethiopia/i }).first().click();
  await expect(origin).toHaveValue('Addis Ababa, Ethiopia');
  await expect(page.getByText('Who ships it?')).toHaveCount(0);
  await expect(page.getByLabel('Receiver Business')).toHaveCount(0);
});

test('Business manages posting and active Tracking from one My Shipments workspace',async({page}:{page:any})=>{
  await login(page,'shipper@loadgistic.local');
  await page.goto('/app/shipments');
  await expect(page.getByRole('heading',{name:'My Shipments'})).toBeVisible();
  await expect(page.getByRole('link',{name:'My Shipments',exact:true})).toHaveCount(1);
  await expect(page.getByRole('link',{name:'Tracking',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Post shipment'})).toBeVisible();
  await expect(page.getByText('Beverage shipment to Dire Dawa')).toBeVisible();
  await page.getByRole('link',{name:'Active Tracking'}).click();
  await expect(page.getByText('Beverage shipment to Dire Dawa')).toHaveCount(0);
  await expect(page.getByText('Industrial supplies to Dire Dawa')).toBeVisible();
});

test('logout clears the session and immediately returns to login',async({page}:{page:any})=>{
  await login(page,'shipper@loadgistic.local');
  await page.goto('/app/more');
  await page.locator('.app-main').getByRole('button',{name:'Log out'}).click();
  await expect(page).toHaveURL(/\/login\?success=/);
  await page.goto('/app/home');
  await expect(page).toHaveURL(/\/login\?error=Please\+log\+in/);
});

test('native support carries one private conversation from customer to agent and admin',async({page}:{page:any})=>{
  test.skip((page.viewportSize()?.width||0)<980,'Stateful support workflow runs once; mobile support screens are covered by UI audit.');
  test.setTimeout(90_000);
  await login(page,'shipper@loadgistic.local');
  await page.goto('/app/support');
  await expect(page.getByRole('heading',{name:'Support',exact:true})).toBeVisible();
  await page.getByRole('radio',{name:'Payment'}).check();
  await page.getByLabel('What do you need?').fill('Please confirm the status of my latest payment.');
  await page.getByRole('button',{name:'Send to support'}).click();
  await expect(page.getByText('Please confirm the status of my latest payment.')).toBeVisible();
  await expect(page.getByText(/is helping|Waiting for the next available agent/)).toBeVisible();
  await page.context().clearCookies();

  await login(page,'support@loadgistic.local','/support');
  await expect(page.getByRole('heading',{name:'Support Inbox'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Operations'})).toHaveCount(0);
  await page.goto('/admin/operations');
  await expect(page).toHaveURL(/\/support$/);
  const customerRow=page.locator('.support-conversation-list article').filter({hasText:'Blue Nile Trading PLC'});
  await expect(customerRow).toBeVisible();
  await customerRow.getByRole('link',{name:'Open'}).click();
  await expect(page.getByText('Please confirm the status of my latest payment.')).toBeVisible();
  await page.getByLabel('Message').fill('Your payment is in the review queue.');
  await page.getByRole('button',{name:'Send'}).click();
  await expect(page.getByText('Your payment is in the review queue.')).toBeVisible();
  await page.getByRole('button',{name:'Close conversation'}).click();
  await expect(page).toHaveURL(/\/support/);
  await page.context().clearCookies();

  await login(page,'shipper@loadgistic.local');
  await page.goto('/app/support');
  await expect(page.getByText('Your payment is in the review queue.')).toHaveCount(0);
  await expect(page.getByText('Previous conversations')).toBeVisible();
  await page.context().clearCookies();

  await login(page,'admin@loadgistic.local');
  await page.goto('/admin/support');
  await expect(page.getByRole('heading',{name:'Customer Support'})).toBeVisible();
  await expect(page.getByText('Hana Support',{exact:true})).toBeVisible();
  await expect(page.getByText('support@loadgistic.local')).toBeVisible();
  await page.getByText('Hana Support',{exact:true}).click();
  const memberPermissions=page.locator('.support-agent-list details[open]');
  await expect(memberPermissions.getByLabel('Customers')).toBeVisible();
  await expect(memberPermissions.getByLabel('Operations')).toBeVisible();
  await expect(memberPermissions.getByLabel('Trust')).toBeVisible();
  await expect(memberPermissions.getByLabel('Billing')).toBeVisible();
  await expect(memberPermissions.getByLabel('Support')).toBeVisible();
});

test('expired workspace keeps a billing-focused Home and denies operating screens',async({page}:{page:any})=>{
  await login(page,'expired@loadgistic.local');
  await expect(page.getByRole('heading',{name:'Your plan has expired'})).toBeVisible();
  await expect(page.getByText('Home · Plan & billing · Log out')).toBeVisible();
  const navigation=(page.viewportSize()?.width||1000)>=980
    ? page.getByRole('navigation',{name:'Workspace navigation'})
    : page.getByRole('navigation',{name:'Mobile navigation'});
  await expect(navigation.getByRole('link')).toHaveCount(2);
  await expect(navigation.getByRole('link',{name:'Home'})).toBeVisible();
  await expect(navigation.getByRole('link',{name:'Plan & billing'})).toBeVisible();
  await expect(navigation.getByRole('link',{name:/Shipment Board|Truck Board|Directory/})).toHaveCount(0);

  await page.goto('/app/providers');
  await expect(page).toHaveURL(/\/app\/home\?billing=required/);
  await expect(page.getByRole('heading',{name:'Your plan has expired'})).toBeVisible();
  await page.goto('/app/more');
  await expect(page.getByText('Expired · unpaid')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Submit payment'})).toBeVisible();
  await expect(page.getByLabel('Amount paid (ETB)')).toBeVisible();
  await expect(page.getByText(/Never upload passwords, PINs, or OTP codes/)).toBeVisible();
});

test('mobile workspace keeps occasional account tools under More', async ({ page }: { page: any }) => {
  test.skip((page.viewportSize()?.width || 1000) >= 980, 'Mobile navigation audit');
  await login(page, 'shipper@loadgistic.local');
  await page.getByText('Menu', { exact: true }).click();
  const menu=page.getByRole('navigation', { name: 'All workspace navigation' });
  await expect(menu.getByRole('link', { name: 'My Shipments', exact: true })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Tracking', exact: true })).toHaveCount(0);
  await expect(menu.getByRole('link', { name: 'Public Profile' })).toHaveCount(0);
  await menu.getByRole('link', { name: 'More' }).click();
  await expect(page.getByRole('link', { name: 'Public Profile' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Verification' })).toBeVisible();
});

test('application presents one business category and two transporter categories', async ({ page }: { page: any }) => {
  await page.goto('/apply');
  await expect(page.getByRole('heading', { name: 'Sign up' })).toBeVisible();
  const accountType = page.getByRole('group', { name: 'Account type' });
  await expect(accountType.getByRole('radio')).toHaveCount(3);
  await expect(accountType.getByRole('radio', { name: /Business/ })).toBeChecked();
  await expect(accountType.getByRole('radio', { name: /Fleet transporter/ })).toBeVisible();
  await expect(accountType.getByRole('radio', { name: /Self-managed driver/ })).toBeVisible();
  await expect(accountType.locator('svg')).toHaveCount(3);
  const businessChoice = await accountType.getByRole('radio', { name: /Business/ }).locator('..').boundingBox();
  expect(businessChoice?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByText('Business receiving shipments')).toHaveCount(0);
  await expect(page.getByLabel('Account phone')).toBeVisible();
});

test('self-service signup creates an immediately usable seven-day trial', async ({ page }: { page:any }) => {
  const email=`new-business-${Date.now()}@loadgistic.local`;
  await page.goto('/apply');
  await page.getByLabel('Your name').fill('New Business Owner');
  await page.getByLabel('Workspace name').fill('New Workshop PLC');
  await page.getByLabel('Account email').fill(email);
  await page.getByLabel('Account phone').fill('+251 911 765 432');
  await page.getByLabel('Password').fill('StrongPass123!');
  await page.getByRole('button',{name:'Sign up'}).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText('Account ready. Log in to start your 7-day trial.')).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('StrongPass123!');
  await page.getByRole('button',{name:/Log in/i}).click();
  await expect(page).toHaveURL(/\/app\/home/);
  await page.goto('/app/more');
  await expect(page.getByText(/Trial/i).first()).toBeVisible();
});

test('homepage previews live structured Board facts without exposing member identity', async ({ page }: { page: any }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: "Ethiopia's road-freight marketplace." })).toBeVisible();
  await expect(page.getByText('Give every shipment one clear path to the right truck.')).toBeVisible();
  await expect(page.getByRole('tab',{name:'Shipment Board'})).toHaveAttribute('aria-selected','true');
  expect(await page.getByText('Shown after login').count()).toBeGreaterThan(0);
  expect(await page.getByText('Pick up before').count()).toBeGreaterThan(0);
  expect(await page.getByText('Price').count()).toBeGreaterThan(0);
  await expect(page.getByText('BlueLine Transport PLC')).toHaveCount(0);
  await expect(page.getByText('Beverage shipment to Dire Dawa')).toHaveCount(0);
  await page.getByRole('tab',{name:'Truck Board'}).click();
  await expect(page.getByRole('tab',{name:'Truck Board'})).toHaveAttribute('aria-selected','true');
  expect(await page.getByText('Cargo configuration').count()).toBeGreaterThan(0);
  expect(await page.getByText('Accepting').count()).toBeGreaterThan(0);
  await expect(page.getByText('BlueLine Transport PLC')).toHaveCount(0);
  await page.getByRole('link',{name:'Contact'}).first().click();
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('main').getByRole('link',{name:'Sign up'})).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Business sign up/ })).toHaveAttribute('href','/apply?type=ENTERPRISE_SHIPPER');
  await expect(page.getByRole('link', { name: /Transporter sign up/ })).toHaveAttribute('href','/apply?type=TRANSPORT_COMPANY');
  const signUp = page.locator('.public-header a[href="/apply"]:visible');
  const logIn = page.locator('.public-header a[href="/login"]:visible');
  await expect(signUp).toBeVisible();
  await expect(logIn).toBeVisible();
  await expect(signUp).toHaveClass(/button/);
  await expect(logIn).toHaveClass(/button/);
  await expect(signUp.locator('svg')).toHaveCount(1);
  await expect(logIn.locator('svg')).toHaveCount(1);
});

test('fleet transporter lands on a management dashboard and updates capacity in My Fleet', async ({ page }: { page: any }) => {
  await login(page, 'transporter@loadgistic.local');
  await expect(page.getByRole('heading', { name: 'BlueLine Transport PLC' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Network coverage' })).toBeVisible();
  await expect(page.getByText('Your routes and partner Business areas.')).toBeVisible();
  await expect(page.getByTestId('capacity-form')).toHaveCount(0);
  await page.goto('/app/fleet');
  await expect(page.getByRole('heading', { name: 'My Fleet' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Driver access' })).toBeVisible();
  await expect(page.getByText('Yonas Alemu')).toBeVisible();
  await expect(page.getByText(/Isuzu FSR/)).toBeVisible();
  await expect(page.getByTestId('capacity-form')).toHaveCount(0);
  await page.locator('.fleet-truck-row').first().getByRole('link',{name:'Truck'}).click();
  await expect(page).toHaveURL(/\/app\/fleet\/veh-trans-1/);
  await expect(page.getByTestId('capacity-form')).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Truck'})).toHaveCount(0);
  await expect(page.getByText(/Only the driver with the truck can use phone GPS/)).toBeVisible();
  await expect(page.locator('.automatic-location')).toHaveCount(0);
  await expect(page.getByRole('group',{name:'Truck availability'})).toBeVisible();
  await expect(page.getByRole('button',{name:/Empty|Partial|Busy/}).first()).toHaveAttribute('aria-pressed',/true|false/);
  await page.getByText('Optional details',{exact:true}).click();
  await expect(page.getByRole('heading', { name: 'Shipment preferences' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Future trip' })).toBeVisible();
  await expect(page.getByRole('heading',{name:'Who can see it?'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Cargo photo'})).toBeVisible();
  await expect(page.getByText(/LG-TRK-/).first()).toBeVisible();
  await page.goto('/app/loads');
  await expect(page.getByRole('heading', { name: 'Shipment Board' })).toBeVisible();
  await page.getByRole('button',{name:/Filters/}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Match truck routes')).toBeVisible();
  await expect(page.getByLabel('Match truck routes').locator('option').filter({hasText:'All active truck routes'})).toHaveCount(1);
  await expect(page.getByLabel('Price type')).toBeVisible();
  await expect(page.getByLabel('Minimum ETB')).toBeVisible();
  await expect(page.getByLabel('Posted within')).toBeVisible();
  await expect(page.getByText('Beverage shipment to Dire Dawa')).toBeVisible();
  await page.goto('/app/shipments');
  await expect(page.getByRole('heading', { name: 'Tracking' })).toBeVisible();
  await expect(page.getByText('Beverage shipment to Dire Dawa')).toHaveCount(0);
  await expect(page.getByText('Industrial supplies to Dire Dawa')).toBeVisible();
  await page.goto('/app/capacity');
  await expect(page.getByRole('heading', { name: 'Truck Board' })).toBeVisible();
  await page.getByRole('button',{name:/Filters/}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Availability')).toBeVisible();
  await expect(page.getByLabel('Truck area near')).toBeVisible();
  await expect(page.getByText(/Anonymous market view/i)).toBeVisible();
  await expect(page.getByText(/LG-TRK-/)).toHaveCount(0);
  await expect(page.locator('.provider-market-card')).not.toHaveCount(0);
  await expect(page.locator('.provider-market-card').first().locator('img')).toBeVisible();
  await expect(page.locator('.provider-market-card').getByText('BlueLine Transport PLC')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /view transporter/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /interest|contact/i })).toHaveCount(0);
});

test('fleet owner can reduce a company driver to duty-only Home and restore access', async ({ page }: { page: any }) => {
  test.skip((page.viewportSize()?.width || 0)<980,'Stateful owner permission mutation runs once; mobile layout is covered by UI audit.');
  await login(page,'transporter@loadgistic.local');
  await page.goto('/app/fleet');
  const driverForm=page.locator('form').filter({hasText:'Yonas Alemu'});
  await driverForm.getByRole('checkbox',{name:'Shipment Board'}).uncheck();
  await driverForm.getByRole('checkbox',{name:'Call Businesses'}).uncheck();
  await driverForm.getByRole('checkbox',{name:'Agree shipments'}).uncheck();
  await driverForm.getByRole('checkbox',{name:'Capacity'}).uncheck();
  await driverForm.getByRole('button',{name:'Save'}).click();
  await expect(page.getByText('Driver permissions updated.')).toBeVisible();

  await page.context().clearCookies();
  await login(page,'company-driver@loadgistic.local');
  await expect(page.getByRole('heading',{name:'Availability'})).toBeVisible();
  await expect(page.getByRole('button',{name:/Off Duty|Available/})).toBeVisible();
  await expect(page.getByTestId('capacity-form')).toHaveCount(0);
  await page.goto('/app/loads');
  await expect(page.getByText(/Shipment Board access is managed by your fleet owner/)).toBeVisible();
  await expect(page.getByText('Beverage shipment to Dire Dawa')).toHaveCount(0);

  await page.context().clearCookies();
  await login(page,'transporter@loadgistic.local');
  await page.goto('/app/fleet');
  const restoreForm=page.locator('form').filter({hasText:'Yonas Alemu'});
  for(const name of ['Shipment Board','Call Businesses','Agree shipments','Capacity'])await restoreForm.getByRole('checkbox',{name}).check();
  await restoreForm.getByRole('button',{name:'Save'}).click();
  await expect(page.getByText('Driver permissions updated.')).toBeVisible();
});

test('self-managed driver keeps the rich capacity control panel as Home', async ({ page }: { page: any }) => {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({latitude:9.03,longitude:38.74});
  await login(page, 'driver@loadgistic.local');
  await expect(page.getByRole('heading', { name: 'My capacity' })).toBeVisible();
  await expect(page.locator('.task-heading-icon')).toBeVisible();
  await expect(page.getByTestId('capacity-form')).toBeVisible();
  await expect(page.locator('.automatic-location')).toBeVisible();
  await expect(page.getByText('Approximate location ready')).toBeVisible();
  await expect(page.getByRole('button', { name: /Use phone|Refresh/ })).toHaveCount(0);
  await expect(page.getByLabel('City or town')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Live route'})).toBeVisible();
  await expect(page.locator('.capacity-linked-fields').getByLabel('Travel date')).toHaveCount(0);
  await expect(page.getByTestId('capacity-form')).toHaveAttribute('data-interactive','true',{timeout:15_000});
  await page.getByRole('group',{name:'Work area'}).getByRole('button',{name:'Local'}).click();
  await expect(page.getByRole('group',{name:'Work area'}).getByRole('button',{name:'Local'})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.capacity-status-choices').getByRole('button',{name:/Partial/})).toBeEnabled();
  await expect(page.locator('input[name="status"]')).toHaveValue('EMPTY');
  await page.getByRole('group',{name:'Truck availability'}).getByRole('button',{name:/Busy/}).click();
  await expect(page.getByLabel('Ready date')).toBeVisible();
  await expect(page.getByLabel('Ready near')).toBeVisible();
  await page.getByText('Optional details',{exact:true}).click();
  await expect(page.getByRole('heading',{name:'Shipment preferences'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Future trip'})).toHaveCount(0);
});

test('Business sees complete Truck Board cards and opens the owner profile directly', async ({ page }: { page: any }) => {
  await login(page, 'shipper@loadgistic.local');
  await page.goto('/app/capacity');
  await page.getByRole('button',{name:/Filters/}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Match a posted shipment')).toBeVisible();
  await page.getByLabel('Match a posted shipment').selectOption('shp-freight-fixed');
  await page.getByRole('button', { name: 'Show trucks' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('link',{name:/Remove Matched to posted shipment/})).toBeVisible();
  await expect(page.getByText(/Route match ·/).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Truck details' })).toHaveCount(0);
  await expect(page.getByText(/LG-TRK-/).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Company|Owner/ }).first()).toBeVisible();
  await page.getByRole('link', { name: /Company|Owner/ }).first().click();
  await expect(page).toHaveURL(/\/app\/providers\//);
  await page.goto('/app/providers/blueline-transport');
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.getByText('Tracked activity').first()).toBeVisible();
  await page.getByRole('link',{name:'Compare routes'}).click();
  await expect(page.getByText('How this comparison works')).toBeVisible();
  await expect(page.locator('.route-map-legend .viewer')).toBeVisible();
  await expect(page.locator('.route-map-legend')).toContainText('Profile coverage');
  await expect(page.locator('.route-map-legend')).toContainText('Your coverage');
  await expect(page.locator('.route-map-legend .current')).toHaveCount(0);
  await expect(page.locator('.route-map-legend .planned')).toHaveCount(0);
  await expect(page.locator('.leaflet-overlay-pane path[stroke="#c45116"]').first()).toHaveAttribute('stroke-dasharray',/12 8/);
  await expect(page.getByText(/full route match/).first()).toBeVisible();
  await expect(page.getByRole('heading',{name:'Fresh truck routes'})).toBeVisible();
  await expect(page.getByText('2 registered.')).toBeVisible();
  await expect(page.getByText('Isuzu · FSR').first()).toBeVisible();
  await expect(page.getByText('Sinotruk · HOWO TX')).toBeVisible();
  await expect(page.getByTitle('Truck authority: Verified')).toBeVisible();
});

test('Business profile editor uses paired Freight Route inputs', async ({ page }: { page: any }) => {
  await login(page,'shipper@loadgistic.local');
  await page.goto('/app/company-page');
  await expect(page.getByRole('heading',{name:'Freight Routes'})).toBeVisible();
  await expect(page.getByLabel('City 1').first()).toHaveValue('Addis Ababa, Ethiopia');
  await expect(page.getByLabel('City 2').first()).toHaveValue('Dire Dawa, Ethiopia');
  const placeResponse=await page.request.get('/api/places?q=Add');
  expect(placeResponse.ok()).toBeTruthy();
  expect((await placeResponse.json()).results.some((place:any)=>place.display_name==='Addis Ababa, Ethiopia')).toBeTruthy();
  await page.getByRole('button',{name:'Add Freight Route'}).click();
  await expect(page.getByLabel('City 1')).toHaveCount(3);
});

test('member verification center and admin review queue are available', async ({ page }: { page: any }) => {
  await login(page,'receiver@loadgistic.local');
  await page.goto('/app/verification');
  await expect(page.getByRole('heading',{name:'Verification',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Submit verification'})).toBeVisible();
  await expect(page.getByRole('option',{name:'Business license'})).toHaveCount(1);
  await page.context().clearCookies();
  await login(page,'admin@loadgistic.local');
  await page.goto('/admin/verifications');
  await expect(page).toHaveURL(/\/admin\/reviews\?tab=documents/);
  await expect(page.getByRole('heading',{name:'Review Center'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Applications'})).toHaveCount(0);
  await expect(page.getByText('Vehicle ownership').first()).toBeVisible();
  await page.goto('/admin/operations');
  await expect(page.getByRole('heading',{name:'Platform Operations'})).toBeVisible();
  await page.getByRole('link',{name:'Trucks'}).click();
  await expect(page).toHaveURL(/view=TRUCKS/);
  await expect(page.getByText(/LG-TRK-/).first()).toBeVisible();
  await page.goto('/admin/ratings');
  await expect(page).toHaveURL(/\/admin\/reviews\?tab=ratings/);
  await expect(page.getByRole('heading',{name:'Review Center'})).toBeVisible();
  await expect(page.getByText('2 of 5')).toBeVisible();
  await page.getByText('2 of 5').click();
  await expect(page.getByLabel('Investigation note')).toBeVisible();
  await expect(page.getByRole('link',{name:'Investigate client'})).toBeVisible();
});

test('assigned shipment shows enforced approximate tracking and a real authenticated timeline', async ({ page }: { page:any }) => {
  await login(page, 'transporter@loadgistic.local');
  await page.goto('/app/shipments/shp-freight-active');
  await expect(page.getByText('Area + one clear status', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Current area')).toBeVisible();
  await expect(page.getByRole('button', { name: /Use phone/ })).toHaveCount(0);
  await expect(page.getByText(/Enter the truck's general area/)).toBeVisible();
  await expect(page.getByText('Unloading',{exact:true})).toBeVisible();
  await expect(page.getByText('Problem',{exact:true})).toBeVisible();
  await expect(page.getByLabel(/Photo or document/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Interested in this shipment?' })).toHaveCount(0);
  await expect(page.getByText('Secret shipment code')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Customer tracking'})).toHaveCount(0);
  await page.goto('/track');
  await expect(page.getByRole('link',{name:'Open my Tracking'})).toBeVisible();

  await page.context().clearCookies();
  await login(page,'shipper@loadgistic.local');
  const renewalWithoutCode=await page.request.post('/api/tracking/session',{
    form:{shipmentId:'shp-freight-active'}
  });
  expect(renewalWithoutCode.status()).toBe(403);
  await page.goto('/app/shipments/shp-freight-active');
  const trackingCode=(await page.locator('.tracking-secret strong').textContent())!;
  expect(trackingCode).toMatch(/^LG-[A-F0-9]{4}-[A-F0-9]{4}$/);
  await page.getByRole('link',{name:'Customer tracking'}).click();
  await page.getByLabel('Secret shipment code').fill(trackingCode);
  await page.getByRole('button',{name:'Open tracking'}).click();
  await expect(page).toHaveURL(/\/track\/shp-freight-active/);
  await expect(page.getByText('Approximate location + status', { exact: true })).toBeVisible();
  await expect(page.getByText(/Locks after 5 minutes without activity/)).toBeVisible();
  await expect(page.getByText(/40 km privacy zone/).first()).toBeVisible();
  await expect(page.getByText('Around Addis Ababa').first()).toBeVisible();
  await expect(page.locator('.timeline li')).toHaveCount(4);
});

test('cross-market members can favorite, request, and accept a network connection',async({page}:{page:any})=>{
  test.skip((page.viewportSize()?.width||0)<980,'Stateful network mutation runs once; mobile layout is covered by UI audit.');
  await login(page,'receiver@loadgistic.local');
  await page.goto('/app/providers/abebe-owner-operator');
  await page.getByRole('button',{name:'Favorite'}).click();
  await expect(page.getByText('Network updated.')).toBeVisible();
  await page.getByRole('button',{name:'Connect'}).click();
  await expect(page.getByText('Request sent')).toBeVisible();
  await page.goto('/app/network?view=REQUESTS');
  await expect(page.getByText('Abebe Owner-Operator')).toBeVisible();

  await page.context().clearCookies();
  await login(page,'driver@loadgistic.local');
  await page.goto('/app/network?view=REQUESTS');
  await expect(page.getByText('Fresh Foods Distribution PLC')).toBeVisible();
  await page.getByRole('button',{name:'Accept'}).click();
  await page.goto('/app/network');
  await expect(page.getByText('Fresh Foods Distribution PLC')).toBeVisible();
  await expect(page.getByText('Connected',{exact:true}).last()).toBeVisible();
});

test('provider interest stays marked on the Shipment Board and outside Tracking',async({page}:{page:any})=>{
  test.skip((page.viewportSize()?.width||0)<980,'Stateful interest mutation runs once; mobile layout is covered by UI audit.');
  await login(page,'driver@loadgistic.local');
  await page.goto('/app/loads');
  const card=page.locator('.load-board-card').filter({hasText:'Beverage shipment to Dire Dawa'});
  await expect(card.getByText('Interest sent')).toBeVisible();
  await page.getByRole('button',{name:/Filters/}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Board view').selectOption('INTERESTED');
  await page.getByRole('button',{name:'Show shipments'}).click();
  await expect(page.getByText('Interest sent').first()).toBeVisible();
  await expect(page.getByText('Beverage shipment to Dire Dawa')).toBeVisible();
  await page.goto('/app/shipments');
  await expect(page.getByText('Beverage shipment to Dire Dawa')).toHaveCount(0);
});

test('connected provider sees Partners demand without receiving party controls', async ({ page }: { page: any }) => {
  await login(page, 'driver@loadgistic.local');
  await page.goto('/app/loads');
  await expect(page.getByText('Packaged food to Hawassa')).toBeVisible();
  await page.goto('/app/shipments/shp-freight-fixed');
  const interestButton=page.getByRole('button',{name:'Express interest'});
  if(await interestButton.count()){
    await interestButton.click();
    await page.goto('/app/shipments/shp-freight-fixed');
  }
  await expect(page.getByRole('heading', { name: 'Shipment proof' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Internal note' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Next status' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Upload proof' })).toHaveCount(0);
});

test('workspace Back returns through history without creating a navigation loop', async ({ page }: { page:any }) => {
  await login(page,'shipper@loadgistic.local');
  await page.goto('/app/providers?q=Blue');
  await page.getByRole('link',{name:'Profile'}).first().click();
  await expect(page).toHaveURL(/\/app\/providers\//);
  await page.getByRole('link',{name:'Back to previous workspace page'}).click();
  await expect(page).toHaveURL(/\/app\/providers\?q=Blue/);
  await page.goForward();
  await expect(page).toHaveURL(/\/app\/providers\//);
});
