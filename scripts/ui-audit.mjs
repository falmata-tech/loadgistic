import { chromium } from '@playwright/test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = path.resolve('artifacts/ui-audit');
const password = 'Loadgistic123!';

const personas = [
  {
    name: 'business-shipper',
    email: 'shipper@loadgistic.local',
    routes: ['/app/home', '/app/shipments/new', '/app/shipments', '/app/shipments/shp-freight-active', '/app/providers', '/app/providers?type=BUSINESS', '/app/capacity', '/app/company-page', '/app/verification', '/app/more']
  },
  {
    name: 'business-receiver',
    email: 'receiver@loadgistic.local',
    routes: ['/app/home', '/app/shipments/new', '/app/shipments', '/app/shipments/shp-freight-active', '/app/providers', '/app/providers?type=BUSINESS', '/app/capacity', '/app/company-page', '/app/verification', '/app/more']
  },
  {
    name: 'fleet-transporter',
    email: 'transporter@loadgistic.local',
    routes: ['/app/home', '/app/fleet', '/app/loads', '/app/loads?mode=DIRECT', '/app/loads?mode=PARTNERS', '/app/capacity', '/app/shipments', '/app/providers', '/app/company-page', '/app/verification', '/app/more']
  },
  {
    name: 'self-managed-driver',
    email: 'driver@loadgistic.local',
    routes: ['/app/home', '/app/loads', '/app/loads?mode=OPEN', '/app/capacity', '/app/shipments', '/app/providers', '/app/company-page', '/app/verification', '/app/more']
  },
  {
    name: 'admin',
    email: 'admin@loadgistic.local',
    routes: ['/app/home', '/admin/applications', '/admin/verifications', '/admin/billing', '/app/shipments', '/companies', '/app/more']
  }
];

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 412, height: 915, isMobile: true }
];

function fileName(value) {
  return value.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '') || 'home';
}

async function login(page, email) {
  await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await Promise.all([
    page.waitForURL('**/app/home'),
    page.getByRole('button', { name: 'Log in' }).click()
  ]);
}

async function inspectPage(page, route, screenshotPath) {
  const response = await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
  return inspectCurrentPage(page,route,screenshotPath,response?.status() || null);
}

async function inspectCurrentPage(page, route, screenshotPath, status = 200) {
  const metrics = await page.evaluate(() => ({
    title: document.title,
    heading: document.querySelector('h1')?.textContent?.trim() || '',
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    emptyButtons: [...document.querySelectorAll('button, a.button')]
      .filter((element) => !element.textContent?.trim() && !element.getAttribute('aria-label')).length,
    unlabeledInputs: [...document.querySelectorAll('input:not([type="hidden"]), select, textarea')]
      .filter((element) => !element.getAttribute('aria-label') && !element.id && !element.closest('label')).length
  }));
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return {
    route,
    finalUrl: page.url(),
    status,
    ...metrics,
    horizontalOverflow: metrics.scrollWidth > metrics.clientWidth + 1
  };
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = { baseURL, generatedAt: new Date().toISOString(), results: [], errors: [] };

try {
  for (const viewport of viewports) {
    const publicContext = await browser.newContext({ viewport });
    const publicPage = await publicContext.newPage();
    for (const route of ['/', '/login', '/apply']) {
      const result = await inspectPage(
        publicPage,
        route,
        path.join(outputDir, `${viewport.name}-logged-out-${fileName(route)}.png`)
      );
      report.results.push({ viewport: viewport.name, persona: 'logged-out', ...result });
    }
    await publicContext.close();

    for (const persona of personas) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const browserErrors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
      });
      page.on('pageerror', (error) => browserErrors.push(`page: ${error.message}`));

      try {
        await login(page, persona.email);
        for (const route of persona.routes) {
          const result = await inspectPage(
            page,
            route,
            path.join(outputDir, `${viewport.name}-${persona.name}-${fileName(route)}.png`)
          );
          report.results.push({ viewport: viewport.name, persona: persona.name, ...result });
        }

        if (['business-shipper', 'business-receiver'].includes(persona.name)) {
          await page.goto(`${baseURL}/app/providers`, { waitUntil: 'networkidle' });
          const companyHref = await page.getByRole('link', { name: 'View Profile' }).first().getAttribute('href');
          if (companyHref) {
            const result = await inspectPage(
              page,
              companyHref,
              path.join(outputDir, `${viewport.name}-${persona.name}-company-detail.png`)
            );
            report.results.push({ viewport: viewport.name, persona: persona.name, ...result });
          }
          await page.goto(`${baseURL}/app/capacity`, { waitUntil: 'networkidle' });
          const capacityHref = await page.getByRole('link', { name: 'View truck details' }).first().getAttribute('href');
          if (capacityHref) {
            const result = await inspectPage(
              page,
              capacityHref,
              path.join(outputDir, `${viewport.name}-${persona.name}-capacity-detail.png`)
            );
            report.results.push({ viewport: viewport.name, persona: persona.name, ...result });
          }
        }

        await page.goto(`${baseURL}/app/shipments`, { waitUntil: 'networkidle' });
        const trackingRows = page.locator('a[href^="/app/shipments/"]');
        const shipmentHref = await trackingRows.count() ? await trackingRows.first().getAttribute('href') : null;
        if (shipmentHref) {
          const result = await inspectPage(
            page,
            shipmentHref,
            path.join(outputDir, `${viewport.name}-${persona.name}-shipment-detail.png`)
          );
          report.results.push({ viewport: viewport.name, persona: persona.name, ...result });
          const trackingHref = await page.getByRole('link', { name: 'Open tracking view' }).getAttribute('href').catch(() => null);
          if (trackingHref) {
            const trackingResult = await inspectPage(
              page,
              trackingHref,
              path.join(outputDir, `${viewport.name}-${persona.name}-tracking-view.png`)
            );
            report.results.push({ viewport: viewport.name, persona: persona.name, ...trackingResult });
          }
        }

        if (persona.name === 'fleet-transporter') {
          await page.goto(`${baseURL}/app/shipments/shp-freight-active`, { waitUntil: 'networkidle' });
          const activeResult = await inspectCurrentPage(
            page,
            '/app/shipments/shp-freight-active#assigned-tracking',
            path.join(outputDir, `${viewport.name}-${persona.name}-assigned-tracking-controls.png`)
          );
          report.results.push({ viewport: viewport.name, persona: persona.name, ...activeResult });
          const activeTrackingHref = await page.getByRole('link', { name: 'Open tracking view' }).getAttribute('href');
          if (activeTrackingHref) {
            const activeTrackingResult = await inspectPage(
              page,
              activeTrackingHref,
              path.join(outputDir, `${viewport.name}-${persona.name}-assigned-tracking-view.png`)
            );
            report.results.push({ viewport: viewport.name, persona: persona.name, ...activeTrackingResult });
          }
        }
      } catch (error) {
        report.errors.push({ viewport: viewport.name, persona: persona.name, error: error.message });
      }

      const actionableBrowserErrors = browserErrors.filter((message) => !message.includes('caret-color'));
      if (actionableBrowserErrors.length) {
        report.errors.push({ viewport: viewport.name, persona: persona.name, browserErrors: [...new Set(actionableBrowserErrors)] });
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}

await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

const failures = report.results.filter((result) =>
  result.status >= 400 || result.horizontalOverflow || result.emptyButtons || result.unlabeledInputs
);

console.log(`UI audit captured ${report.results.length} screens in ${outputDir}`);
console.log(`Detected ${failures.length} automated layout/accessibility flags and ${report.errors.length} browser-flow errors.`);
if (failures.length) console.log(JSON.stringify(failures, null, 2));
if (report.errors.length) console.log(JSON.stringify(report.errors, null, 2));
