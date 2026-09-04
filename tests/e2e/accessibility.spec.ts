import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

type Page = any;

const password = 'Loadgistic123!';

test.setTimeout(120_000);

async function login(page: Page, email: string, destination = '/app/home') {
  await page.goto('/login');
  const fixtureLogin=page.locator('details.auth-fixture-login');
  await fixtureLogin.locator('summary').click();
  await fixtureLogin.getByLabel('Email').fill(email);
  await fixtureLogin.getByLabel('Password').fill(password);
  await fixtureLogin.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(new RegExp(destination.replaceAll('/', '\\/')));
}

async function waitForPage(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('.loading-map').waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(250);
}

async function expectNoHorizontalOverflow(page:Page,label:string){
  const metrics=await page.evaluate(()=>({
    client:document.documentElement.clientWidth,
    scroll:document.documentElement.scrollWidth
  }));
  expect(metrics.scroll,`${label} has horizontal document overflow`).toBeLessThanOrEqual(metrics.client+1);
}

async function expectMinimumTarget(locator:any,label:string){
  await expect(locator).toBeVisible();
  const box=await locator.boundingBox();
  expect(box,`${label} has no measurable target`).not.toBeNull();
  expect(box!.width,`${label} is narrower than 44 CSS pixels`).toBeGreaterThanOrEqual(44);
  expect(box!.height,`${label} is shorter than 44 CSS pixels`).toBeGreaterThanOrEqual(44);
}

async function expectAccessible(page: Page, label: string) {
  await waitForPage(page);
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .disableRules(['target-size'])
    .analyze();
  const targetSizeResult = await new AxeBuilder({ page })
    .withRules(['target-size'])
    // Leaflet markers are large spatial controls, but may straddle the current
    // viewport or overlap while a cluster separates during zoom. Their own
    // marker and cluster treatments retain large pointer targets.
    .exclude('.leaflet-marker-pane')
    .analyze();
  const blocking = [...result.violations, ...targetSizeResult.violations].filter(violation =>
    violation.impact === 'serious' || violation.impact === 'critical'
  );
  expect(blocking, `${label} serious/critical accessibility violations:\n${blocking.map(violation =>
    `${violation.id}: ${violation.help}\n${violation.nodes.map(node => `  ${node.target.join(' ')} — ${node.failureSummary}`).join('\n')}`
  ).join('\n')}`).toEqual([]);
}

test('public release routes have no serious accessibility violations', async ({ page }: { page: Page }) => {
  for (const route of ['/', '/shared-capacity', '/featured', '/about', '/privacy', '/terms', '/track', '/login', '/apply', '/@blueline-transport']) {
    await page.goto(route);
    await expectAccessible(page, route);
  }
});

test('unified account access keeps one responsive and touch-sized task',async({page}:{page:Page})=>{
  for(const viewport of [
    {width:1440,height:900,label:'desktop'},
    {width:640,height:800,label:'reflow'},
    {width:320,height:720,label:'phone'}
  ]){
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await page.goto('/login');
    await waitForPage(page);

    await expect(page.locator('main h1')).toHaveCount(1);
    const emailForm=page.getByTestId('email-code-request-form');
    const email=emailForm.locator('input[type="email"]');
    const emailAction=emailForm.getByRole('button',{name:/email.*code|continue.*email/i});
    const google=page.getByRole('button',{name:'Continue with Google'});
    const back=page.getByRole('link',{name:/Back to Open capacity/i});
    await expect(emailForm).toBeVisible();
    await expect(google).toBeVisible();
    const [emailBox,googleBox]=await Promise.all([emailForm.boundingBox(),google.boundingBox()]);
    expect(emailBox,`${viewport.label} email form has no box`).not.toBeNull();
    expect(googleBox,`${viewport.label} Google action has no box`).not.toBeNull();
    expect(emailBox!.y,`${viewport.label} email access should precede Google`).toBeLessThan(googleBox!.y);

    const descriptionIds=(await email.getAttribute('aria-describedby'))?.trim().split(/\s+/).filter(Boolean)||[];
    expect(descriptionIds,`${viewport.label} email guidance is not associated with its field`).not.toHaveLength(0);
    for(const id of descriptionIds)await expect(page.locator(`[id=${JSON.stringify(id)}]`)).toBeVisible();

    await expectMinimumTarget(email,`${viewport.label} email field`);
    await expectMinimumTarget(emailAction,`${viewport.label} email action`);
    await expectMinimumTarget(google,`${viewport.label} Google action`);
    await expectMinimumTarget(back,`${viewport.label} Market return`);
    await google.focus();
    await expect(google).toBeFocused();

    const localInbox=page.getByRole('link',{name:/email inbox/i}).first();
    if(await localInbox.isVisible())await expectMinimumTarget(localInbox,`${viewport.label} local inbox link`);
    const fixtureDisclosure=page.locator('details.auth-fixture-login>summary');
    if(await fixtureDisclosure.isVisible())await expectMinimumTarget(fixtureDisclosure,`${viewport.label} fixture disclosure`);

    await expect(page.getByRole('link',{name:/Create a transporter account|Join/i})).toHaveCount(0);
    await expectNoHorizontalOverflow(page,`${viewport.label} account access`);

    if(viewport.width<=760){
      await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
      const mobileNavigation=page.getByRole('navigation',{name:'Mobile navigation'});
      await expect(mobileNavigation).toBeVisible();
      const [backBox,navigationBox]=await Promise.all([back.boundingBox(),mobileNavigation.boundingBox()]);
      expect(backBox).not.toBeNull();
      expect(navigationBox).not.toBeNull();
      expect(backBox!.y+backBox!.height,`${viewport.label} Market return is covered by fixed navigation`).toBeLessThanOrEqual(navigationBox!.y+1);
    }

    await page.goto('/apply');
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
    await expectNoHorizontalOverflow(page,`${viewport.label} direct provider setup`);
  }
});

test('transporter and Driver workspaces have no serious accessibility violations', async ({ page }: { page: Page }) => {
  await login(page, 'transporter@loadgistic.local');
  for (const route of ['/app/home', '/app/fleet', '/app/provider-shipments', '/app/company-page', '/app/verification', '/app/support', '/app/more', '/app/menu']) {
    await page.goto(route);
    await expectAccessible(page, `fleet transporter ${route}`);
  }

  await page.context().clearCookies();
  await login(page, 'driver@loadgistic.local');
  for (const route of ['/app/home', '/app/provider-shipments', '/app/verification', '/app/support', '/app/more', '/app/menu']) {
    await page.goto(route);
    await expectAccessible(page, `self-managed Driver ${route}`);
  }
});

test('administration and support workspaces have no serious accessibility violations', async ({ page }: { page: Page }) => {
  await login(page, 'admin@loadgistic.local', '/admin');
  for (const route of ['/admin/operations', '/admin/featured', '/admin/reviews?tab=documents', '/admin/reviews?tab=ratings', '/admin/support']) {
    await page.goto(route);
    await expectAccessible(page, `administrator ${route}`);
  }

  await page.context().clearCookies();
  await login(page, 'support@loadgistic.local', '/support');
  for (const route of ['/support', '/support?view=WAITING', '/support?view=CLOSED']) {
    await page.goto(route);
    await expectAccessible(page, `support agent ${route}`);
  }
});

test('public filters support keyboard entry, Escape, and trigger focus restoration', async ({ page }: { page: Page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: /^Filters/ });
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Truck filters' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close filters' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('featured truck details support keyboard entry, Escape, and focus restoration', async ({ page }: { page: Page }) => {
  await page.goto('/featured');
  const featured = page.locator('.featured-truck-tile').first();
  await featured.focus();
  await expect(featured).toBeFocused();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close featured truck details' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(featured).toBeFocused();
});

test('public and Driver mobile shells reflow without page-level horizontal scrolling', async ({ page }: { page: Page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await waitForPage(page);
  await expect(page.locator('.public-session-compact').getByRole('link', { name: 'Log in' })).toBeVisible();
  const publicMetrics = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(publicMetrics.scroll).toBeLessThanOrEqual(publicMetrics.client + 1);
  const marketGutters=await page.locator('.home-market-shell').evaluate((section:any)=>{const box=section.getBoundingClientRect();return {left:box.left,right:document.documentElement.clientWidth-box.right};});
  expect(Math.abs(marketGutters.left-marketGutters.right)).toBeLessThanOrEqual(1);
  await page.goto('/featured');
  await waitForPage(page);
  const featuredGutters=await page.locator('.regional-expo-shell').evaluate((section:any)=>{const box=section.getBoundingClientRect();return {left:box.left,right:document.documentElement.clientWidth-box.right};});
  expect(Math.abs(featuredGutters.left-featuredGutters.right)).toBeLessThanOrEqual(1);

  await login(page, 'driver@loadgistic.local');
  await waitForPage(page);
  const driverMetrics = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(driverMetrics.scroll).toBeLessThanOrEqual(driverMetrics.client + 1);
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
});

test('supporting public pages and provider essentials reflow without clipping',async({page}:{page:Page})=>{
  await page.setViewportSize({width:320,height:720});
  for(const route of ['/about','/privacy','/terms','/track','/login','/apply','/@blueline-transport']){
    await page.goto(route);
    await waitForPage(page);
    const metrics=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    expect(metrics.scroll,`${route} has horizontal document overflow`).toBeLessThanOrEqual(metrics.client+1);
  }
  const providerText=await page.locator('.provider-handle,.provider-site-hero h1,.provider-public-contacts strong').evaluateAll((elements:any[])=>elements.map(element=>{const box=element.getBoundingClientRect();return {text:element.textContent,right:box.right,left:box.left,whiteSpace:getComputedStyle(element).whiteSpace};}));
  expect(providerText.length).toBeGreaterThan(1);
  for(const item of providerText){
    expect(item.left,`${item.text} starts outside the viewport`).toBeGreaterThanOrEqual(0);
    expect(item.right,`${item.text} ends outside the viewport`).toBeLessThanOrEqual(321);
    expect(item.whiteSpace,`${item.text} must be allowed to wrap`).not.toBe('nowrap');
  }
});
