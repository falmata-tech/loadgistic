import { test, expect } from '@playwright/test';

async function login(page: any, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Loadgistic123!');
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
  await page.goto('/login');
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toContain('/');
});

test('anonymous users cannot browse Business or transporter profiles', async ({ page }: { page: any }) => {
  await page.goto('/companies');
  await expect(page).toHaveURL(/\/login\?error=Please\+log\+in/);
  await expect(page.getByText('BlueLine Transport')).toHaveCount(0);
  await page.goto('/companies/blueline-transport');
  await expect(page).toHaveURL(/\/login\?error=Please\+log\+in/);
  await expect(page.getByText('Truck 01')).toHaveCount(0);
});

test('authenticated directory browsing preserves the session and selected participants', async ({ page }: { page: any }) => {
  await login(page, 'shipper@loadgistic.local');
  await page.goto('/app/providers?type=TRANSPORT');
  await page.getByRole('link', { name: 'View Profile' }).first().click();
  await expect(page.getByTestId('public-session-action')).toHaveText('Workspace');
  await expect(page.getByRole('link', { name: 'Login' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Send request' }).click();
  await expect(page).toHaveURL(/\/app\/shipments\/new\?provider=/);
  await expect(page.getByRole('combobox', { name: 'Selected transporter' })).not.toHaveValue('');
  await page.goto('/app/providers?type=DRIVER');
  await page.getByRole('link', { name: 'View Profile' }).click();
  await page.getByRole('link', { name: 'Send request' }).click();
  await expect(page.getByRole('combobox', { name: 'Selected transporter' })).toHaveValue('profile:provider-driver');
  await page.goto('/app/providers?type=BUSINESS');
  await page.getByRole('link', { name: 'View Profile' }).first().click();
  await expect(page.getByText('Account login contacts are private')).toBeVisible();
  await page.goto('/login');
  await expect(page).toHaveURL(/\/app\/home/);
});

test('shipper can open rich load posting workflow', async ({ page }: { page: any }) => {
  await login(page, 'shipper@loadgistic.local');
  await page.getByRole('link', { name: /Post a load/i }).click();
  await expect(page.getByRole('heading', { name: 'Post a load' })).toBeVisible();
  await expect(page.getByText('Best cargo configuration (optional)', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: /FTL/i })).toBeVisible();
  await expect(page.getByRole('radio', { name: /PTL/i })).toBeVisible();
  await expect(page.getByLabel('Tracking after assignment')).toHaveValue('STATUS_ONLY');
  await expect(page.getByLabel('Pick up before')).toBeVisible();
  await expect(page.getByLabel('Drop off before (optional)')).toBeVisible();
  await expect(page.getByText('Road Freight', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Package count')).toHaveCount(0);
});

test('mobile workspace menu exposes secondary business pages', async ({ page }: { page: any }) => {
  test.skip((page.viewportSize()?.width || 1000) >= 980, 'Mobile navigation audit');
  await login(page, 'shipper@loadgistic.local');
  await page.getByText('Menu', { exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'All workspace navigation' }).getByRole('link', { name: 'Public Profile' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'All workspace navigation' }).getByRole('link', { name: 'Tracking', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'All workspace navigation' }).getByRole('link', { name: 'Verification' })).toBeVisible();
});

test('application presents one business category and two transporter categories', async ({ page }: { page: any }) => {
  await page.goto('/apply');
  const accountType = page.getByLabel('Account type');
  await expect(accountType.locator('option')).toHaveText([
    'Business',
    'Self-managed Driver / Owner-Operator',
    'Fleet Transporter'
  ]);
  await expect(page.getByText('Business receiving shipments')).toHaveCount(0);
  await expect(page.getByLabel('Private account phone')).toBeVisible();
});

test('homepage centers Ethiopian producers and gives each market side a direct path', async ({ page }: { page: any }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Road freight for the businesses that make Ethiopia.' })).toBeVisible();
  await expect(page.getByText('Manufacturers', { exact: true })).toBeVisible();
  await expect(page.getByText('Artisans', { exact: true })).toBeVisible();
  await expect(page.getByText('Growers', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Find transport capacity/ }).first()).toHaveAttribute('href','/apply?type=ENTERPRISE_SHIPPER');
  await expect(page.getByRole('link', { name: /Bring my fleet to demand/ })).toHaveAttribute('href','/apply?type=TRANSPORT_COMPANY');
  await expect(page.getByRole('link', { name: /Join as owner-operator/ })).toHaveAttribute('href','/apply?type=INDEPENDENT_PROVIDER');
});

test('fleet transporter lands on a management dashboard and updates capacity in My Fleet', async ({ page }: { page: any }) => {
  await login(page, 'transporter@loadgistic.local');
  await expect(page.getByRole('heading', { name: /Welcome, BlueLine Transport/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Network corridor coverage' })).toBeVisible();
  await expect(page.getByText(/location.*recorded corridors/i)).toBeVisible();
  await expect(page.getByTestId('capacity-form')).toHaveCount(0);
  await page.goto('/app/fleet');
  await expect(page.getByRole('heading', { name: 'My Fleet' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Driver access' })).toBeVisible();
  await expect(page.getByText('Yonas Alemu')).toBeVisible();
  await expect(page.getByText(/Isuzu FSR/)).toBeVisible();
  await expect(page.getByTestId('capacity-form')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'On Duty' })).toBeChecked();
  await expect(page.getByRole('heading', { name: 'Loads you will accept' })).toBeVisible();
  await page.goto('/app/loads');
  await expect(page.getByRole('heading', { name: 'Load Board' })).toBeVisible();
  await expect(page.getByLabel('Match one truck route')).toBeVisible();
  await expect(page.getByText('Beverage load to Dire Dawa')).toBeVisible();
  await page.goto('/app/shipments');
  await expect(page.getByRole('heading', { name: 'Tracking' })).toBeVisible();
  await expect(page.getByText('Beverage load to Dire Dawa')).toHaveCount(0);
  await expect(page.getByText('Industrial supplies to Dire Dawa')).toBeVisible();
  await page.goto('/app/capacity');
  await expect(page.getByRole('heading', { name: 'Capacity Board' })).toBeVisible();
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
  await driverForm.getByRole('checkbox',{name:'Business contact'}).uncheck();
  await driverForm.getByRole('checkbox',{name:'Load agreements'}).uncheck();
  await driverForm.getByRole('checkbox',{name:'Rich capacity'}).uncheck();
  await driverForm.getByRole('button',{name:'Save access'}).click();
  await expect(page.getByText('Driver permissions updated.')).toBeVisible();

  await page.context().clearCookies();
  await login(page,'company-driver@loadgistic.local');
  await expect(page.getByRole('heading',{name:'My duty status'})).toBeVisible();
  await expect(page.getByRole('button',{name:/Go Off Duty|Go On Duty/})).toBeVisible();
  await expect(page.getByTestId('capacity-form')).toHaveCount(0);
  await page.goto('/app/loads');
  await expect(page.getByText(/Load Board access is managed by your fleet owner/)).toBeVisible();
  await expect(page.getByText('Beverage load to Dire Dawa')).toHaveCount(0);

  await page.context().clearCookies();
  await login(page,'transporter@loadgistic.local');
  await page.goto('/app/fleet');
  const restoreForm=page.locator('form').filter({hasText:'Yonas Alemu'});
  for(const name of ['Load Board','Business contact','Load agreements','Rich capacity'])await restoreForm.getByRole('checkbox',{name}).check();
  await restoreForm.getByRole('button',{name:'Save access'}).click();
  await expect(page.getByText('Driver permissions updated.')).toBeVisible();
});

test('self-managed driver keeps the rich capacity control panel as Home', async ({ page }: { page: any }) => {
  await login(page, 'driver@loadgistic.local');
  await expect(page.getByRole('heading', { name: 'My capacity' })).toBeVisible();
  await expect(page.getByTestId('capacity-form')).toBeVisible();
  await expect(page.getByLabel('Current general area')).toBeVisible();
  await expect(page.getByRole('button', { name: /Use device location|Refresh area/ })).toBeVisible();
});

test('Business sees truck-first capacity detail and the full fleet roster', async ({ page }: { page: any }) => {
  await login(page, 'shipper@loadgistic.local');
  await page.goto('/app/capacity');
  await expect(page.getByLabel('Match a posted load')).toBeVisible();
  await page.getByLabel('Match a posted load').selectOption('shp-freight-fixed');
  await page.getByRole('button', { name: 'Show matching trucks' }).click();
  await expect(page.getByText('Full route match').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'View truck details' })).toHaveCount(3);
  await page.getByRole('link', { name: 'View truck details' }).first().click();
  await expect(page.getByText(/40 km privacy zone/).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'View Profile' })).toBeVisible();
  await page.goto('/companies/blueline-transport');
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.getByText('Tracked activity').first()).toBeVisible();
  await page.getByRole('link',{name:'Compare routes'}).click();
  await expect(page.getByText('How this comparison works')).toBeVisible();
  await expect(page.getByText(/full corridor match/).first()).toBeVisible();
  await expect(page.getByText(/2 active trucks registered/)).toBeVisible();
  await expect(page.getByText('Isuzu · FSR').first()).toBeVisible();
  await expect(page.getByText('Sinotruk · HOWO TX')).toBeVisible();
  await expect(page.getByTitle('Vehicle authority: Verified')).toBeVisible();
});

test('Business profile editor uses paired coverage route inputs', async ({ page }: { page: any }) => {
  await login(page,'shipper@loadgistic.local');
  await page.goto('/app/company-page');
  await expect(page.getByRole('heading',{name:'Coverage routes'})).toBeVisible();
  await expect(page.getByLabel('City 1').first()).toHaveValue('Addis Ababa');
  await expect(page.getByLabel('City 2').first()).toHaveValue('Dire Dawa');
  await page.getByRole('button',{name:'Add route'}).click();
  await expect(page.getByLabel('City 1')).toHaveCount(3);
});

test('member verification center and admin review queue are available', async ({ page }: { page: any }) => {
  await login(page,'receiver@loadgistic.local');
  await page.goto('/app/verification');
  await expect(page.getByRole('heading',{name:'Verification Center'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Submit verification'})).toBeVisible();
  await expect(page.getByText('Business license').first()).toBeVisible();
  await page.context().clearCookies();
  await login(page,'admin@loadgistic.local');
  await page.goto('/admin/verifications');
  await expect(page.getByRole('heading',{name:'Verification requests'})).toBeVisible();
  await expect(page.getByText('Vehicle ownership').first()).toBeVisible();
});

test('assigned load shows enforced approximate tracking and a real authenticated timeline', async ({ page }: { page: any }) => {
  await login(page, 'transporter@loadgistic.local');
  await page.goto('/app/shipments/shp-freight-active');
  await expect(page.getByText('Location + status', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Current general area')).toBeVisible();
  await expect(page.getByRole('button', { name: /Use device location/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record tracking update' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Interested in this load?' })).toHaveCount(0);
  const trackingHref = await page.getByRole('link', { name: 'Open tracking view' }).getAttribute('href');
  expect(trackingHref).toBeTruthy();
  await page.goto(trackingHref!);
  await expect(page).toHaveURL(/\/track\//);
  await expect(page.getByText('Approximate location + status', { exact: true })).toBeVisible();
  await expect(page.getByText(/40 km privacy zone/).first()).toBeVisible();
  await expect(page.getByText('Around Addis Ababa').first()).toBeVisible();
  await expect(page.locator('.timeline li')).toHaveCount(4);
});

test('browse-only provider cannot see party controls or unrelated saved loads', async ({ page }: { page: any }) => {
  await login(page, 'driver@loadgistic.local');
  await page.goto('/app/loads');
  await expect(page.getByText('Packaged food to Hawassa')).toHaveCount(0);
  await page.goto('/app/shipments/shp-freight-fixed');
  await expect(page.getByRole('heading', { name: 'Interested in this load?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Internal note' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Next status' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Upload proof' })).toHaveCount(0);
});
