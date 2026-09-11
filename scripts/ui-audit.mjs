import { chromium } from '@playwright/test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3100';
const outputDir = path.resolve('artifacts/ui-audit');
const password = 'Loadgistic123!';

const personas = [
  {
    name: 'fleet-transporter',
    email: 'transporter@loadgistic.local',
    routes: ['/app/home', '/app/fleet', '/app/provider-shipments', '/app/provider-shipments/new', '/app/company-page', '/app/verification', '/app/support', '/app/more']
  },
  {
    name: 'self-managed-driver',
    email: 'driver@loadgistic.local',
    routes: ['/app/home', '/app/provider-shipments', '/app/provider-shipments/new', '/app/company-page', '/app/verification', '/app/support', '/app/more']
  },
  {
    name: 'company-driver',
    email: 'company-driver@loadgistic.local',
    routes: ['/app/home', '/app/provider-shipments', '/app/verification', '/app/support', '/app/more']
  },
  {
    name: 'admin',
    email: 'admin@loadgistic.local',
    routes: ['/app/home', '/admin/operations', '/admin/operations?view=TRUCKS', '/admin/operations?view=DRIVERS', '/admin/operations?view=TRACKING', '/admin/operations?view=CAPACITY', '/admin/reviews?tab=documents', '/admin/reviews?tab=ratings', '/admin/support', '/app/more']
  },
  {
    name:'support-agent',
    email:'support@loadgistic.local',
    routes:['/support','/support?view=WAITING','/support?view=CLOSED']
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
      await page.waitForLoadState('load',{timeout:10_000});
      await page.waitForTimeout(750);
      return response;
    } catch (error) {
      const transientNavigationError = [
        'ERR_ABORTED',
        'ERR_CONNECTION_RESET',
        'ERR_EMPTY_RESPONSE',
        'ERR_INCOMPLETE_CHUNKED_ENCODING',
        'ERR_NETWORK_IO_SUSPENDED',
        'Timeout'
      ].some((message) => String(error).includes(message));
      if (!transientNavigationError || attempt === 2) throw error;
      await page.waitForTimeout(1_000 * (attempt + 1));
    }
  }
}

async function login(page, email) {
  const expectedPath=email==='support@loadgistic.local'?'/support':email==='admin@loadgistic.local'?'/admin':'/app/home';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await gotoReady(page, '/login');
    if (new URL(page.url()).pathname === expectedPath) return;
    await page.locator('details.auth-fixture-login>summary').click();
    const fixtureForm=page.getByTestId('login-form');
    await fixtureForm.getByLabel('Email',{exact:true}).fill(email);
    await fixtureForm.getByLabel('Password').fill(password);
    await fixtureForm.getByRole('button', { name: 'Log in' }).click();
    try {
      await page.waitForURL(`**${expectedPath}`, { timeout: 12_000 });
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
  if (await page.getByText(/Loading (?:route|capacity|location) map/).count()) {
    await page.locator('.leaflet-container').first().waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  }
  const visibleMaps=await page.locator('.leaflet-container:visible').count();
  if(visibleMaps){
    await page.locator('.leaflet-container:visible .leaflet-tile-loaded').first().waitFor({state:'visible',timeout:12_000}).catch(()=>{});
  }
  await page.evaluate(async()=>{
    if(document.fonts?.ready)await document.fonts.ready;
    const images=[...document.images].filter(image=>image.getBoundingClientRect().width>0&&image.getBoundingClientRect().height>0);
    await Promise.race([
      Promise.all(images.map(image=>image.complete?Promise.resolve():new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});}))),
      new Promise(resolve=>setTimeout(resolve,5_000))
    ]);
  });
  await page.waitForTimeout(150);
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
            .filter((element) => !element.getAttribute('aria-label') && !element.id && !element.closest('label')).length,
          smallActionTargets: [...document.querySelectorAll('button, a.button, .workspace-back, .mobile-account-menu summary')]
            .filter((element) => {
              const box = element.getBoundingClientRect();
              return box.width > 0 && box.height > 0 && (box.width < 44 || box.height < 44);
            }).length,
          textActionsWithoutIcon: [...document.querySelectorAll('button.button, a.button')]
            .filter((element) => element.textContent?.trim() && !element.querySelector('svg,.auth-google-mark')).length,
          labelsWithoutIcon: [...document.querySelectorAll('label[for]:not(.sr-only)')]
            .filter((element) => !element.querySelector('svg')).length,
          visibleMapContainers:[...document.querySelectorAll('.leaflet-container')]
            .filter((element)=>{const box=element.getBoundingClientRect();return box.width>0&&box.height>0;}).length,
          loadedMapTiles:[...document.querySelectorAll('.leaflet-tile-loaded')]
            .filter((element)=>{const box=element.getBoundingClientRect();return box.width>0&&box.height>0;}).length
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
    for (const route of ['/', '/featured', '/about', '/providers', '/providers/blueline-transport', '/track', '/login', '/apply']) {
      const result = await inspectPage(
        publicPage,
        route,
        path.join(outputDir, `${viewport.name}-logged-out-${fileName(route)}.png`)
      );
      report.results.push({ viewport: viewport.name, persona: 'logged-out', ...result });
      if(route==='/'){
        await publicPage.locator('.leaflet-container').waitFor({state:'visible',timeout:10_000});
        await publicPage.locator('.capacity-truck-map-marker,.capacity-map-cluster').first().waitFor({state:'visible',timeout:10_000});
        const mapResult=await inspectCurrentPage(publicPage,'/#map',path.join(outputDir,`${viewport.name}-logged-out-capacity-map.png`));
        report.results.push({viewport:viewport.name,persona:'logged-out',...mapResult});
        const firstTruckId=await publicPage.evaluate(async()=>{
          const response=await fetch('/api/public/capacity?limit=1');
          const payload=await response.json();
          return payload.items?.[0]?.id||null;
        });
        if(!firstTruckId)throw new Error('The public capacity audit could not find a truck to inspect.');
        await gotoReady(publicPage,`/?truck=${encodeURIComponent(firstTruckId)}`);
        await publicPage.locator('.capacity-truck-map-marker.selected').waitFor({state:'visible',timeout:10_000});
        const selectedResult=await inspectCurrentPage(publicPage,'/#selected-truck',path.join(outputDir,`${viewport.name}-logged-out-capacity-selected.png`));
        report.results.push({viewport:viewport.name,persona:'logged-out',...selectedResult});
      }
    }
    await publicContext.close();

    for (const [personaIndex,persona] of personas.entries()) {
      const context = await browser.newContext({ viewport, extraHTTPHeaders:{'X-Forwarded-For':`127.0.${viewport.name==='desktop'?10:20}.${personaIndex+10}`} });
      const loginPage = await context.newPage();

      try {
        await login(loginPage, persona.email);
        await loginPage.close();
        for (const route of persona.routes) {
          const page=await context.newPage();const browserErrors=[];
          page.on('console',message=>{if(message.type()==='error')browserErrors.push(`console: ${message.text()}`);});
          page.on('pageerror',error=>browserErrors.push(`page: ${error.message}`));
          const result = await inspectPage(
            page,
            route,
            path.join(outputDir, `${viewport.name}-${persona.name}-${fileName(route)}.png`)
          );
          report.results.push({ viewport: viewport.name, persona: persona.name, ...result });
          const actionableBrowserErrors=browserErrors.filter(message=>!message.includes('caret-color'));
          if(actionableBrowserErrors.length)report.errors.push({viewport:viewport.name,persona:persona.name,route,browserErrors:[...new Set(actionableBrowserErrors)]});
          await page.close();
        }
        if(persona.name==='fleet-transporter'){
          const fleetPage=await context.newPage();
          await gotoReady(fleetPage,'/app/fleet');
          const truckDetailHref=await fleetPage.getByRole('link',{name:'View truck'}).first().getAttribute('href');
          await fleetPage.close();
          if(!truckDetailHref)throw new Error('The fleet audit could not find a truck detail link.');
          const detailPage=await context.newPage();const browserErrors=[];
          detailPage.on('console',message=>{if(message.type()==='error')browserErrors.push(`console: ${message.text()}`);});
          detailPage.on('pageerror',error=>browserErrors.push(`page: ${error.message}`));
          const result=await inspectPage(detailPage,truckDetailHref,path.join(outputDir,`${viewport.name}-${persona.name}-truck-detail.png`));
          report.results.push({viewport:viewport.name,persona:persona.name,...result});
          const actionableBrowserErrors=browserErrors.filter(message=>!message.includes('caret-color'));
          if(actionableBrowserErrors.length)report.errors.push({viewport:viewport.name,persona:persona.name,route:truckDetailHref,browserErrors:[...new Set(actionableBrowserErrors)]});
          await detailPage.close();
        }

      } catch (error) {
        report.errors.push({ viewport: viewport.name, persona: persona.name, error: error.message });
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}

await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

const failures = report.results.filter((result) =>
  result.status >= 400 || result.horizontalOverflow || result.emptyButtons || result.unlabeledInputs ||
  (result.visibleMapContainers > 0 && result.loadedMapTiles === 0) ||
  (result.persona !== 'admin' && (result.smallActionTargets || result.textActionsWithoutIcon))
);

console.log(`UI audit captured ${report.results.length} screens in ${outputDir}`);
console.log(`Detected ${failures.length} automated layout/accessibility flags and ${report.errors.length} browser-flow errors.`);
if (failures.length) console.log(JSON.stringify(failures, null, 2));
if (report.errors.length) console.log(JSON.stringify(report.errors, null, 2));
if(failures.length||report.errors.length)process.exitCode=1;
