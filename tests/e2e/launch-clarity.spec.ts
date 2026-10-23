import {test,expect} from './browser-test';
import type {Page} from 'playwright-core';
import {readFileSync} from 'node:fs';
import {openCapacityFilters} from './capacity-drawer-helper';

test('public entry stays clear of retired transport chat and GPS needs an explicit action',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(60000);
 await page.addInitScript(()=>{(window as Window&{geoCalls?:number}).geoCalls=0;Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(_success:unknown,fail:(e:object)=>void)=>{const w=window as Window&{geoCalls?:number};w.geoCalls=(w.geoCalls||0)+1;fail({code:1,PERMISSION_DENIED:1});}}});});
 await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.locator('.leaflet-container')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Find space for your next load',exact:true})).toBeVisible();const accountEntry=page.getByRole('navigation',{name:'Switch view',exact:true}).getByRole('link',{name:'My workspace',exact:true});await expect(accountEntry).toBeVisible();await expect(accountEntry).toHaveAttribute('href','/login');
 expect(await page.evaluate(()=>(window as Window&{geoCalls?:number}).geoCalls)).toBe(0);
 await expect(page.locator('.public-assistance-dock,.transport-request-form')).toHaveCount(0);
 await openCapacityFilters(page);await page.getByRole('button',{name:'Use my location',exact:true}).click();
 await expect(page.getByTestId('visitor-location-state')).toContainText('Location permission is blocked');expect(await page.evaluate(()=>(window as Window&{geoCalls?:number}).geoCalls)).toBe(1);
 await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('.leaflet-container')).toBeVisible();expect(await page.evaluate(()=>(window as Window&{geoCalls?:number}).geoCalls)).toBe(0);
 await page.screenshot({path:info.outputPath('entry.png')});
});

test('priority language explains public capacity and Tracking without retired transport intake',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(120000);
 for(const locale of ['am','om']){
  const messages=JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
  await page.goto('/',{waitUntil:'domcontentloaded'});const picker=page.locator('.public-header-language select');await expect(picker).toHaveCount(1);await expect(picker).toBeEnabled({timeout:15000});await picker.selectOption(locale);
  await expect(page.locator('html')).toHaveAttribute('lang',locale);await expect(page.locator('.market-introduction h1')).toHaveText(messages['Find space for your next load']);
  await expect(page.locator('.public-assistance-dock,.transport-request-form')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`${locale}-public-capacity.png`)});
  await page.goto('/track',{waitUntil:'domcontentloaded'});await expect(page.locator('label[for=tracking-email]')).toHaveText(messages['Email']);
  await page.goto('/login',{waitUntil:'domcontentloaded'});await expect(page.locator('.auth-driver-hint')).toHaveText(messages['Added by your company? Use the email your fleet owner registered for you.']);
 }
});

test('stalled shipment email access ends its busy state and keeps the entered details',async({page}:{page:Page})=>{
 await page.goto('/track',{waitUntil:'domcontentloaded'});await expect(page.locator('.public-header-language select')).toHaveCount(1);await expect(page.locator('.public-header-language select')).toBeEnabled();await page.clock.install();
 let calls=0;await page.route('**/api/tracking/otp',async route=>{calls++;await new Promise<void>(resolve=>setTimeout(resolve,20000));await route.abort().catch(()=>{});});
 await page.getByLabel('Email',{exact:true}).fill('timeout@example.test');await page.getByRole('button',{name:'Email me a code'}).click();
 await expect.poll(()=>calls).toBe(1);await page.clock.runFor(16000);await expect(page.locator('.form-error[role=alert]')).toContainText('Try again');await expect(page.getByRole('button',{name:'Email me a code'})).toBeEnabled();await expect(page.getByLabel('Email',{exact:true})).toHaveValue('timeout@example.test');expect(calls).toBe(1);await page.unrouteAll({behavior:'ignoreErrors'});
});
