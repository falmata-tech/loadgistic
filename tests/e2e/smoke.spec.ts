import { test, expect } from '@playwright/test';

async function login(page: any, email: string) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Loadgistic123!');
  await expect(page.getByLabel('Email')).toHaveValue(email);
  await expect(page.getByLabel('Password')).toHaveValue('Loadgistic123!');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/app\/home/);
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
  await expect(page.getByRole('heading', { name: 'Road freight for every Ethiopian business.' })).toBeVisible();
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
  await page.locator('.directory-grid').getByRole('link', { name: 'Profile' }).first().click();
  await expect(page).toHaveURL(/\/app\/providers\/blueline-transport/);
  await expect(page.getByText('B2B logistics workspace')).toBeVisible();
  await expect(page.getByTestId('public-session-action')).toHaveCount(0);
  await page.getByRole('link', { name: 'Request' }).click();
  await expect(page).toHaveURL(/\/app\/shipments\/new\?provider=/);
  await expect(page.getByRole('combobox', { name: 'Selected transporter' })).not.toHaveValue('');
  await page.goto('/app/providers?type=DRIVER');
  await page.locator('.directory-grid').getByRole('link', { name: 'Profile' }).click();
  await page.getByRole('link', { name: 'Request' }).click();
  await expect(page.getByRole('combobox', { name: 'Selected transporter' })).toHaveValue('Abebe Owner-Operator');
  await expect(page.locator('input[name="providerRef"]')).toHaveValue('profile:provider-driver');
  await page.goto('/app/providers?type=BUSINESS');
  await page.locator('.directory-grid').getByRole('link', { name: 'Profile' }).first().click();
  await expect(page.getByText('Account login contacts are private')).toBeVisible();
  await page.goto('/login');
  await expect(page).toHaveURL(/\/app\/home/);
});

test('shipper can open rich load posting workflow', async ({ page }: { page: any }) => {
  await login(page, 'shipper@loadgistic.local');
  await expect(page.getByRole('link', { name: /^Post a load Request quotes/ })).toHaveAttribute('href','/app/shipments/new');
  await page.goto('/app/shipments/new');
  await expect(page.getByRole('heading', { name: 'Post a load' })).toBeVisible();
  await expect(page.getByText('Best cargo configuration (optional)', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: /FTL/i })).toBeVisible();
  await expect(page.getByRole('radio', { name: /PTL/i })).toBeVisible();
  await expect(page.getByLabel('Tracking after assignment')).toHaveValue('STATUS_ONLY');
  await expect(page.getByLabel('Pick up before')).toBeVisible();
  await expect(page.getByLabel('Drop off before (optional)')).toBeVisible();
  await expect(page.getByText('Road Freight', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Package count')).toHaveCount(0);
  await expect(page.getByLabel('Estimated kg')).toHaveCount(0);
  await expect(page.getByLabel('Load detail')).toBeVisible();
  const origin=page.getByLabel('From city');
  await origin.fill('Addis');
  await expect(page.getByRole('option', { name: /Addis Ababa, Ethiopia/i }).first()).toBeVisible();
  await page.getByRole('option', { name: /Addis Ababa, Ethiopia/i }).first().click();
  await expect(origin).toHaveValue('Addis Ababa, Ethiopia');
  await page.locator('.segmented-control label').filter({hasText:'Receiver'}).click();
  await expect(page.getByText('Who ships it?')).toBeVisible();
  await page.locator('.segmented-control label').filter({hasText:'External Business'}).click();
  await expect(page.getByLabel('Shipper name')).toBeVisible();
});

test('Business manages posting and active Tracking from one My Loads workspace',async({page}:{page:any})=>{
  await login(page,'shipper@loadgistic.local');
  await page.goto('/app/shipments');
  await expect(page.getByRole('heading',{name:'My Loads'})).toBeVisible();
  await expect(page.getByRole('link',{name:'My Loads',exact:true})).toHaveCount(1);
  await expect(page.getByRole('link',{name:'Post Load',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Tracking',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Post load'})).toBeVisible();
  await expect(page.getByText('Beverage load to Dire Dawa')).toBeVisible();
  await page.getByRole('link',{name:'Active Tracking'}).click();
  await expect(page.getByText('Beverage load to Dire Dawa')).toHaveCount(0);
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
  await expect(navigation.getByRole('link',{name:/Load Board|Capacity Board|Directory/})).toHaveCount(0);

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
  await expect(menu.getByRole('link', { name: 'My Loads', exact: true })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Tracking', exact: true })).toHaveCount(0);
  await expect(menu.getByRole('link', { name: 'Post Load', exact: true })).toHaveCount(0);
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

test('homepage centers Ethiopian producers and gives each market side a direct path', async ({ page }: { page: any }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Road freight for every Ethiopian business.' })).toBeVisible();
  await expect(page.getByText('Manufacturers', { exact: true })).toBeVisible();
  await expect(page.getByText('Artisans', { exact: true })).toBeVisible();
  await expect(page.getByText('Growers', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'I need a truck' })).toHaveAttribute('href','/apply?type=ENTERPRISE_SHIPPER');
  await expect(page.getByRole('link', { name: 'I have a fleet' })).toHaveAttribute('href','/apply?type=TRANSPORT_COMPANY');
  await expect(page.getByRole('link', { name: 'I drive a truck' })).toHaveAttribute('href','/apply?type=INDEPENDENT_PROVIDER');
  await expect(page.getByAltText('Loadgistic Capacity Board showing route, truck, and cargo-space filters')).toBeVisible();
  await expect(page.getByAltText('Loadgistic mobile driver capacity controls')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Built for the workshop. Ready for the enterprise.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'You keep Ethiopia moving.' })).toBeVisible();
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
  await page.getByRole('link',{name:'Truck'}).first().click();
  await expect(page).toHaveURL(/\/app\/fleet\/veh-trans-1/);
  await expect(page.getByTestId('capacity-form')).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Truck'})).toHaveCount(0);
  await expect(page.getByText(/Only the driver with the truck can use phone GPS/)).toBeVisible();
  await expect(page.getByRole('button',{name:/Use phone|Refresh/})).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'On Duty' })).toBeChecked();
  await page.getByText('Load preferences',{exact:true}).click();
  await expect(page.getByRole('heading', { name: 'Loads accepted' })).toBeVisible();
  await page.getByText('Planned trip',{exact:true}).click();
  await expect(page.getByLabel('Planned travel date')).toBeVisible();
  await expect(page.getByText('Planned cargo space')).toBeVisible();
  await page.getByText('Sharing & proof',{exact:true}).click();
  await expect(page.getByRole('heading',{name:'Visibility'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Photo proof'})).toBeVisible();
  await expect(page.getByText(/LG-TRK-/).first()).toBeVisible();
  await page.goto('/app/loads');
  await expect(page.getByRole('heading', { name: 'Load Board' })).toBeVisible();
  await page.getByRole('button',{name:/Filters/}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Match truck routes')).toBeVisible();
  await expect(page.getByLabel('Match truck routes').locator('option').filter({hasText:'All active truck routes'})).toHaveCount(1);
  await expect(page.getByLabel('Price type')).toBeVisible();
  await expect(page.getByLabel('Minimum ETB')).toBeVisible();
  await expect(page.getByLabel('Posted within')).toBeVisible();
  await expect(page.getByText('Beverage load to Dire Dawa')).toBeVisible();
  await page.goto('/app/shipments');
  await expect(page.getByRole('heading', { name: 'Tracking' })).toBeVisible();
  await expect(page.getByText('Beverage load to Dire Dawa')).toHaveCount(0);
  await expect(page.getByText('Industrial supplies to Dire Dawa')).toBeVisible();
  await page.goto('/app/capacity');
  await expect(page.getByRole('heading', { name: 'Capacity Board' })).toBeVisible();
  await page.getByRole('button',{name:/Filters/}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('At least this much space')).toBeVisible();
  await expect(page.getByLabel('Route flexibility')).toBeVisible();
  await expect(page.getByLabel('Cargo-space proof')).toBeVisible();
  await expect(page.getByText(/read only for transporters and drivers/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /view transporter/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /interest|contact/i })).toHaveCount(0);
});

test('fleet owner can reduce a company driver to duty-only Home and restore access', async ({ page }: { page: any }) => {
  test.skip((page.viewportSize()?.width || 0)<980,'Stateful owner permission mutation runs once; mobile layout is covered by UI audit.');
  await login(page,'transporter@loadgistic.local');
  await page.goto('/app/fleet');
  const driverForm=page.locator('form').filter({hasText:'Yonas Alemu'});
  await driverForm.getByRole('checkbox',{name:'Load Board'}).uncheck();
  await driverForm.getByRole('checkbox',{name:'Call Businesses'}).uncheck();
  await driverForm.getByRole('checkbox',{name:'Agree loads'}).uncheck();
  await driverForm.getByRole('checkbox',{name:'Capacity'}).uncheck();
  await driverForm.getByRole('button',{name:'Save'}).click();
  await expect(page.getByText('Driver permissions updated.')).toBeVisible();

  await page.context().clearCookies();
  await login(page,'company-driver@loadgistic.local');
  await expect(page.getByRole('heading',{name:'Duty'})).toBeVisible();
  await expect(page.getByRole('button',{name:/Go Off Duty|Go On Duty/})).toBeVisible();
  await expect(page.getByTestId('capacity-form')).toHaveCount(0);
  await page.goto('/app/loads');
  await expect(page.getByText(/Load Board access is managed by your fleet owner/)).toBeVisible();
  await expect(page.getByText('Beverage load to Dire Dawa')).toHaveCount(0);

  await page.context().clearCookies();
  await login(page,'transporter@loadgistic.local');
  await page.goto('/app/fleet');
  const restoreForm=page.locator('form').filter({hasText:'Yonas Alemu'});
  for(const name of ['Load Board','Call Businesses','Agree loads','Capacity'])await restoreForm.getByRole('checkbox',{name}).check();
  await restoreForm.getByRole('button',{name:'Save'}).click();
  await expect(page.getByText('Driver permissions updated.')).toBeVisible();
});

test('self-managed driver keeps the rich capacity control panel as Home', async ({ page }: { page: any }) => {
  await login(page, 'driver@loadgistic.local');
  await expect(page.getByRole('heading', { name: 'My capacity' })).toBeVisible();
  await expect(page.locator('.task-heading-icon')).toBeVisible();
  await expect(page.getByTestId('capacity-form')).toBeVisible();
  await expect(page.getByTestId('capacity-form')).toHaveAttribute('data-hydrated','true');
  await expect(page.getByLabel('Local city or town')).toBeVisible();
  await expect(page.getByText(/also this truck's current general area/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Use phone|Refresh/ })).toBeVisible();
  await expect(page.getByText('Current partial-capacity route',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Route date')).toBeVisible();
  await page.locator('input[name="movementScope"][value="LOCAL"]').check();
  await expect(page.locator('input[name="spaceChoice"]').nth(1)).toBeDisabled();
  await expect(page.locator('input[name="status"]')).toHaveValue('EMPTY');
  await expect(page.getByText(/Local-only availability is published as Empty/)).toBeVisible();
  await page.getByRole('radio',{name:/Busy Open to future calls/}).check();
  await expect(page.getByLabel('Available again')).toBeVisible();
  await expect(page.getByLabel('Expected city')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Load preferences'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Planned trip'})).toHaveCount(0);
});

test('Business sees truck-first capacity detail and the full fleet roster', async ({ page }: { page: any }) => {
  await login(page, 'shipper@loadgistic.local');
  await page.goto('/app/capacity');
  await page.getByRole('button',{name:/Filters/}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Match a posted load')).toBeVisible();
  await page.getByLabel('Match a posted load').selectOption('shp-freight-fixed');
  await page.getByRole('button', { name: 'Show trucks' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('link',{name:/Remove Matched to posted load/})).toBeVisible();
  await expect(page.getByText(/Route match ·/).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Truck details' })).toHaveCount(3);
  await page.getByRole('link', { name: 'Truck details' }).first().click();
  await expect(page.getByRole('link',{name:'Back to previous workspace page'})).toBeVisible();
  await expect(page.getByText(/LG-TRK-/).first()).toBeVisible();
  await page.getByRole('link',{name:'Back to previous workspace page'}).click();
  await expect(page).toHaveURL(/\/app\/capacity(?:\?.*)?$/);
  await page.getByRole('link', { name: 'Truck details' }).first().click();
  await expect(page.getByText(/40 km privacy zone/).first()).toBeVisible();
  await expect(page.getByRole('heading',{name:'Preferred Routes'})).toBeVisible();
  await expect(page.getByRole('link', { name: 'Profile', exact: true })).toBeVisible();
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
  await expect(page.getByTitle('Vehicle authority: Verified')).toBeVisible();
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
  await expect(page.getByText('Business license').first()).toBeVisible();
  await page.context().clearCookies();
  await login(page,'admin@loadgistic.local');
  await page.goto('/admin/verifications');
  await expect(page).toHaveURL(/\/admin\/reviews\?tab=documents/);
  await expect(page.getByRole('heading',{name:'Review Center'})).toBeVisible();
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

test('assigned load shows enforced approximate tracking and a real authenticated timeline', async ({ page }: { page: any }) => {
  await login(page, 'transporter@loadgistic.local');
  await page.goto('/app/shipments/shp-freight-active');
  await expect(page.getByText('Location + status', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Current area')).toBeVisible();
  await expect(page.getByRole('button', { name: /Use phone/ })).toHaveCount(0);
  await expect(page.getByText(/Device location is available only to the driver/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record tracking update' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Interested in this load?' })).toHaveCount(0);
  await expect(page.getByText('Secret load code')).toHaveCount(0);
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
  await page.getByLabel('Secret load code').fill(trackingCode);
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

test('provider interest stays marked on the Load Board and outside Tracking',async({page}:{page:any})=>{
  test.skip((page.viewportSize()?.width||0)<980,'Stateful interest mutation runs once; mobile layout is covered by UI audit.');
  await login(page,'driver@loadgistic.local');
  await page.goto('/app/loads');
  const card=page.locator('.load-board-card').filter({hasText:'Beverage load to Dire Dawa'});
  await card.getByRole('button',{name:'Express interest'}).click();
  await page.getByRole('button',{name:/Filters/}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Board view').selectOption('INTERESTED');
  await page.getByRole('button',{name:'Show loads'}).click();
  await expect(page.getByText('Interest sent').first()).toBeVisible();
  await expect(page.getByText('Beverage load to Dire Dawa')).toBeVisible();
  await page.goto('/app/shipments');
  await expect(page.getByText('Beverage load to Dire Dawa')).toHaveCount(0);
});

test('browse-only provider cannot see party controls or unrelated saved loads', async ({ page }: { page: any }) => {
  await login(page, 'driver@loadgistic.local');
  await page.goto('/app/loads');
  await expect(page.getByText('Packaged food to Hawassa')).toHaveCount(0);
  await page.goto('/app/shipments/shp-freight-fixed');
  const interestButton=page.getByRole('button',{name:'Express interest'});
  if(await interestButton.count()){
    await interestButton.click();
    await page.goto('/app/shipments/shp-freight-fixed');
  }
  await expect(page.getByRole('heading', { name: 'Load proof' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Internal note' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Next status' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Upload proof' })).toHaveCount(0);
});
