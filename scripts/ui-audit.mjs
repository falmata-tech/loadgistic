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
    routes: ['/app/home', '/app/shipments/new', '/app/shipments?view=MY_LOADS', '/app/shipments', '/app/shipments/shp-freight-active', '/track', '/app/providers', '/app/providers?type=BUSINESS', '/app/network', '/app/network?view=FAVORITES', '/app/capacity', '/app/company-page', '/app/verification', '/app/more']
  },
  {
    name: 'business-receiver',
    email: 'receiver@loadgistic.local',
    routes: ['/app/home', '/app/shipments/new', '/app/shipments?view=MY_LOADS', '/app/shipments', '/app/shipments/shp-freight-active', '/track', '/app/providers', '/app/providers?type=BUSINESS', '/app/network', '/app/network?view=REQUESTS', '/app/capacity', '/app/company-page', '/app/verification', '/app/more']
  },
  {
    name: 'fleet-transporter',
    email: 'transporter@loadgistic.local',
    routes: ['/app/home', '/app/fleet', '/app/fleet/veh-trans-1', '/app/loads', '/app/loads?board=POOLED', '/app/loads?mode=INTERESTED', '/app/loads?mode=DIRECT', '/app/loads?mode=PARTNERS', '/app/capacity', '/app/shipments', '/app/providers', '/app/network', '/app/company-page', '/app/verification', '/app/more']
  },
  {
    name: 'self-managed-driver',
    email: 'driver@loadgistic.local',
    routes: ['/app/home', '/app/loads', '/app/loads?board=POOLED', '/app/loads?mode=INTERESTED', '/app/loads?mode=OPEN', '/app/capacity', '/app/shipments', '/app/providers', '/app/network', '/app/company-page', '/app/verification', '/app/more']
  },
  {
    name: 'company-driver',
    email: 'company-driver@loadgistic.local',
    routes: ['/app/home', '/app/loads', '/app/capacity', '/app/shipments', '/app/providers', '/app/verification', '/app/more']
  },
  {
    name: 'admin',
    email: 'admin@loadgistic.local',
    routes: ['/app/home', '/admin/operations', '/admin/applications', '/admin/verifications', '/admin/ratings', '/admin/billing', '/app/shipments', '/app/providers', '/app/more']
  }
];

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 412, height: 915, isMobile: true }
];

function fileName(value) {
  return value.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '') || 'home';
}

async function gotoReady(page, route) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(750);
      return response;
    } catch (error) {
      if (!String(error).includes('ERR_ABORTED') || attempt === 2) throw error;
      await page.waitForTimeout(500);
    }
  }
}

async function login(page, email) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await gotoReady(page, '/login');
    if (new URL(page.url()).pathname === '/app/home') return;
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();
    try {
      await page.waitForURL('**/app/home', { timeout: 12_000 });
      return;
    } catch (error) {
      if (attempt === 2) {
        const visibleError = await page.locator('.flash.error').textContent().catch(() => '');
        throw new Error(`Login failed for ${email}${visibleError ? `: ${visibleError.trim()}` : ''}`, { cause: error });
      }
    }
  }
}

async function inspectPage(page, route, screenshotPath) {
  const response = await gotoReady(page, route);
  return inspectCurrentPage(page,route,screenshotPath,response?.status() || null);
}

async function inspectCurrentPage(page, route, screenshotPath, status = 200) {
  if (await page.getByText('Loading route map...').count()) {
    await page.locator('.leaflet-container').first().waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  }
  let metrics;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      metrics = await page.evaluate(() => {
        const root = document.documentElement;
        if (!root) return null;
        return {
          title: document.title,
          heading: document.querySelector('h1')?.textContent?.trim() || '',
          scrollWidth: root.scrollWidth,
          clientWidth: root.clientWidth,
          emptyButtons: [...document.querySelectorAll('button, a.button')]
            .filter((element) => !element.textContent?.trim() && !element.getAttribute('aria-label')).length,
          unlabeledInputs: [...document.querySelectorAll('input:not([type="hidden"]), select, textarea')]
            .filter((element) => !element.getAttribute('aria-label') && !element.id && !element.closest('label')).length
        };
      });
      if (metrics) break;
      await page.waitForTimeout(500);
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed') || attempt === 2) throw error;
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
    }
  }
  // Avoid Playwright's temporary inline caret styles racing React hydration.
  await page.screenshot({ path: screenshotPath, fullPage: true, caret: 'initial' });
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
          await gotoReady(page, '/app/providers');
          const companyHref = await page.getByRole('link', { name: 'View Profile' }).first().getAttribute('href');
          if (companyHref) {
            const result = await inspectPage(
              page,
              companyHref,
              path.join(outputDir, `${viewport.name}-${persona.name}-company-detail.png`)
            );
            report.results.push({ viewport: viewport.name, persona: persona.name, ...result });
            const comparisonHref = persona.name === 'business-shipper' ? '/app/providers/blueline-transport?compare=routes' : '/app/providers/blue-nile-trading?compare=routes';
            const comparisonResult = await inspectPage(
              page,
              comparisonHref,
              path.join(outputDir, `${viewport.name}-${persona.name}-company-route-comparison.png`)
            );
            report.results.push({ viewport: viewport.name, persona: persona.name, ...comparisonResult });
          }
          await gotoReady(page, '/app/capacity');
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

        await gotoReady(page, '/app/shipments');
        const trackingRows = page.locator('a[href^="/app/shipments/"]:not([href="/app/shipments/new"])');
        const shipmentHref = ['business-shipper', 'business-receiver'].includes(persona.name)
          ? '/app/shipments/shp-freight-active'
          : await trackingRows.count() ? await trackingRows.first().getAttribute('href') : null;
        if (shipmentHref) {
          const result = await inspectPage(
            page,
            shipmentHref,
            path.join(outputDir, `${viewport.name}-${persona.name}-shipment-detail.png`)
          );
          report.results.push({ viewport: viewport.name, persona: persona.name, ...result });
          const trackingCode = await page.locator('.tracking-secret strong').textContent().catch(() => null);
          if (trackingCode) {
            await gotoReady(page,'/track');
            await page.getByLabel('Secret load code').fill(trackingCode.trim());
            await page.getByRole('button',{name:'Open tracking'}).click();
            await page.waitForLoadState('domcontentloaded');
            const trackingResult = await inspectCurrentPage(
              page,
              '/track/[unlocked]',
              path.join(outputDir, `${viewport.name}-${persona.name}-tracking-view.png`)
            );
            report.results.push({ viewport: viewport.name, persona: persona.name, ...trackingResult });
          }
        }

        if (persona.name === 'fleet-transporter') {
          await gotoReady(page, '/app/shipments/shp-freight-active');
          const activeResult = await inspectCurrentPage(
            page,
            '/app/shipments/shp-freight-active#assigned-tracking',
            path.join(outputDir, `${viewport.name}-${persona.name}-assigned-tracking-controls.png`)
          );
          report.results.push({ viewport: viewport.name, persona: persona.name, ...activeResult });
        }

        if (['fleet-transporter','self-managed-driver'].includes(persona.name)) {
          await gotoReady(page,'/app/loads?board=POOLED');
          const poolHref=await page.locator('a[href^="/app/loads/pstl/"]').first().getAttribute('href').catch(()=>null);
          if(poolHref){
            const poolResult=await inspectPage(
              page,
              poolHref,
              path.join(outputDir,`${viewport.name}-${persona.name}-pooled-load-detail.png`)
            );
            report.results.push({viewport:viewport.name,persona:persona.name,...poolResult});
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
