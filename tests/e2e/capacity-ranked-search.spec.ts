import {test,expect as baseExpect} from './browser-test';
import type {Page} from 'playwright-core';
import {readFileSync} from 'node:fs';
const expect=baseExpect.configure({timeout:30000});
test.use({actionTimeout:20000});
async function drawer(page:Page){const d=page.locator('#capacity-filter-drawer');await expect(page.locator('.capacity-drawer-handle button[aria-controls="capacity-filter-drawer"]')).toBeEnabled();if(await d.getAttribute('aria-hidden')==='true')await page.locator('.capacity-drawer-handle button[aria-controls="capacity-filter-drawer"]').click();return d;}

test('ranked profile results, company map scope and detailed modal filters work together',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(180000);
 await page.goto('/');const panel=await drawer(page);await expect(panel.locator('.capacity-result-card')).toHaveCount(0);
 await expect(panel.getByLabel("Vehicle's current load",{exact:true})).toHaveCount(0);
 const companies=await (await page.request.get('/api/capacity-search')).json();const company=companies.items.find((item:{kind:string})=>item.kind==='COMPANY');expect(company).toBeTruthy();expect(companies.items.every((item:{kind:string})=>item.kind!=='TRUCK')).toBe(true);
 expect(company.city).toBeTruthy();await panel.getByRole('searchbox',{name:'Search transporters'}).fill(company.city);await panel.getByRole('button',{name:'Search',exact:true}).click();
 await expect(page).toHaveURL((url:URL)=>!url.searchParams.has('q'));await drawer(page);await expect(panel.locator('.capacity-result-card').first()).toBeVisible();
 const cityMap=await (await page.request.get(`/api/public/capacity?q=${encodeURIComponent(company.city)}&provider=${encodeURIComponent(company.handle)}`)).json();expect(cityMap.items.length).toBeGreaterThan(0);
 await panel.getByRole('searchbox',{name:'Search transporters'}).fill(company.title);await panel.getByRole('button',{name:'Search',exact:true}).click();
 await expect(page).toHaveURL((url:URL)=>!url.searchParams.has('q'));await drawer(page);await expect(panel.locator('[data-result-kind="COMPANY"]').first()).toBeVisible();
 await expect(page.locator('.leaflet-container')).toBeVisible();
 const response=await (await page.request.get(`/api/public/capacity?q=${encodeURIComponent(company.title)}`)).json();expect(response.items.length).toBeGreaterThan(0);expect(response.items.every((item:{provider_handle:string})=>item.provider_handle===company.handle)).toBe(true);
 const card=panel.locator('[data-result-kind="COMPANY"]').filter({hasText:company.title}).first();await card.getByRole('link',{name:'Show vehicles on map',exact:true}).click();
 await expect(page).toHaveURL((url:URL)=>url.searchParams.get('provider')===company.handle);await drawer(page);await panel.getByRole('searchbox',{name:'Search transporters'}).fill(company.title);
 await panel.getByRole('button',{name:'Search',exact:true}).click();await expect(panel.locator('.capacity-result-card').first()).toBeVisible();await page.screenshot({path:info.outputPath('company-results.png'),scale:'css'});
 await page.locator('.capacity-map-controls .capacity-filter-trigger').click();const dialog=page.getByRole('dialog',{name:'Vehicle filters',exact:true});await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('group',{name:'Load status',exact:true})).toBeVisible();await expect(dialog.getByRole('group',{name:'Vehicle type',exact:true})).toBeVisible();await expect(dialog.locator('[name="officeCity"]')).toHaveCount(0);
 await expect(dialog.locator('[name="resultKind"]')).toHaveCount(0);await dialog.locator('[data-filter-section="more"] summary').click();await dialog.getByLabel('Business License',{exact:true}).check();
 await dialog.getByLabel('Permission to use vehicle',{exact:true}).check();await page.screenshot({path:info.outputPath('document-filters.png'),scale:'css'});
 const backdrop=await dialog.evaluate(el=>getComputedStyle(el,'::backdrop').backgroundColor);expect(backdrop).toBe('rgba(11, 29, 58, 0.24)');
 await dialog.getByRole('button',{name:'Show vehicles',exact:true}).click();await expect(dialog).not.toBeVisible();
 await expect(page).toHaveURL((url:URL)=>url.searchParams.get('ownerDocs')==='BUSINESS_LICENSE'&&url.searchParams.get('truckDocs')==='VEHICLE_AUTHORIZATION');
 const applied=await (await page.request.get(`/api/capacity-search${new URL(page.url()).search}`)).json();expect(applied.items.every((item:{kind:string})=>item.kind!=='TRUCK')).toBe(true);
 await page.locator('.capacity-map-controls .capacity-filter-trigger').click();await dialog.getByRole('link',{name:'Clear',exact:true}).click();await expect(page).toHaveURL('http://127.0.0.1:3100/');await drawer(page);await panel.getByRole('searchbox',{name:'Search transporters'}).fill('transport');await panel.getByRole('button',{name:'Search',exact:true}).click();await expect(panel.locator('.capacity-result-card').first()).toBeVisible();
 const first=await panel.locator('.capacity-result-card h3').allTextContents();await panel.getByRole('button',{name:'Next',exact:true}).click();await expect(panel.locator('.capacity-result-pagination')).toContainText('2 /');expect(await panel.locator('.capacity-result-card h3').allTextContents()).not.toEqual(first);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('search retry and all language filter layouts remain usable',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(150000);await page.route('**/api/capacity-search?*',route=>route.fulfill({status:503,json:{error:'Unavailable'}}));await page.goto('/');const panel=await drawer(page);await panel.getByRole('searchbox',{name:'Search transporters'}).fill('transport');await panel.getByRole('button',{name:'Search',exact:true}).click();
 await expect(panel.getByRole('alert')).toContainText('Search is temporarily unavailable. Please try again.');await page.unrouteAll({behavior:'wait'});await panel.getByRole('button',{name:'Try again',exact:true}).click();await expect(panel.locator('.capacity-result-card').first()).toBeVisible();
 for(const locale of ['am','om']){
  const messages=JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));await page.locator('.language-picker select:visible').selectOption(locale);await page.locator('.capacity-map-controls .capacity-filter-trigger').click();const dialog=page.locator('.capacity-filter-dialog');
  await expect(dialog.locator('#capacity-filter-title')).toHaveText(messages['Vehicle filters']);await expect(dialog.locator('[name="officeCity"]')).toHaveCount(0);
  await dialog.locator('.capacity-filter-actions button').scrollIntoViewIfNeeded();await dialog.locator('.capacity-filter-actions button').click({trial:true});await page.screenshot({path:info.outputPath(`filters-${locale}.png`),scale:'css'});await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});

test('private search requires a signed-in account and rejects retired email access',async({page}:{page:Page})=>{
 await page.goto('/shared-capacity');
 await expect(page).toHaveURL(/\/login\?from=shared-capacity/);
 expect((await page.request.get('/api/capacity-search?view=private')).status()).toBe(410);
 expect((await page.request.get('/api/shared-capacity')).status()).toBe(410);
 expect((await page.request.post('/api/shared-capacity/otp',{data:{email:'unused@example.test'}})).status()).toBe(410);
});
