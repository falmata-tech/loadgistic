import {test,expect as baseExpect} from '@playwright/test';
import type {Page} from 'playwright-core';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {localAuditService,checked} from './audit-helpers';
import {localMailpitNumericCode} from './mailpit-helper';
import {grantPrivateCapacityAccess,revokePrivateCapacityAccess} from '../../src/lib/private-capacity.js';
const expect=baseExpect.configure({timeout:30000});
test.use({actionTimeout:20000});
async function drawer(page:Page){const d=page.locator('#capacity-filter-drawer');await expect(page.locator('.capacity-drawer-handle button')).toBeEnabled();if(await d.getAttribute('aria-hidden')==='true')await page.locator('.capacity-drawer-handle button').click();return d;}

test('ranked profile results, company map scope and detailed modal filters work together',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(180000);
 await page.goto('/');const panel=await drawer(page);await expect(panel.locator('.capacity-result-card').first()).toBeVisible();
 await expect(panel.getByLabel('Availability',{exact:true})).toHaveCount(0);
 const companies=await (await page.request.get('/api/capacity-search')).json();const company=companies.items.find((item:{kind:string})=>item.kind==='COMPANY');expect(company).toBeTruthy();expect(companies.items.every((item:{kind:string})=>item.kind!=='TRUCK')).toBe(true);
 expect(company.city).toBeTruthy();await panel.getByRole('searchbox',{name:'Search transporters'}).fill(company.city);await panel.getByRole('button',{name:'Search',exact:true}).click();
 await expect(page).toHaveURL((url:URL)=>url.searchParams.get('q')===company.city);await drawer(page);await expect(panel.locator('.capacity-result-card').first()).toBeVisible();
 const cityMap=await (await page.request.get(`/api/public/capacity?q=${encodeURIComponent(company.city)}&provider=${encodeURIComponent(company.handle)}`)).json();expect(cityMap.items.length).toBeGreaterThan(0);
 await panel.getByRole('searchbox',{name:'Search transporters'}).fill(company.title);await panel.getByRole('button',{name:'Search',exact:true}).click();
 await expect(page).toHaveURL((url:URL)=>url.searchParams.get('q')===company.title);await drawer(page);await expect(panel.locator('[data-result-kind="COMPANY"]').first()).toBeVisible();
 await expect(page.locator('.leaflet-container')).toBeVisible();
 const response=await (await page.request.get(`/api/public/capacity?q=${encodeURIComponent(company.title)}`)).json();expect(response.items.length).toBeGreaterThan(0);expect(response.items.every((item:{provider_handle:string})=>item.provider_handle===company.handle)).toBe(true);
 const card=panel.locator('[data-result-kind="COMPANY"]').filter({hasText:company.title}).first();await card.getByRole('link',{name:'Show trucks on map',exact:true}).click();
 await expect(page).toHaveURL((url:URL)=>url.searchParams.get('provider')===company.handle);await drawer(page);
 await expect(panel.locator('.capacity-result-card').first()).toBeVisible();await page.screenshot({path:info.outputPath('company-results.png'),scale:'css'});
 await panel.getByRole('button',{name:/^Filters/}).click();const dialog=page.getByRole('dialog',{name:'Filters',exact:true});await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('combobox',{name:'Availability',exact:true})).toBeVisible();await expect(dialog.getByRole('group',{name:'Truck configuration',exact:true})).toBeVisible();await expect(dialog.locator('[name="officeCity"]')).toHaveCount(0);
 await expect(dialog.locator('[name="resultKind"]')).toHaveCount(0);await dialog.getByLabel('Business License',{exact:true}).check();
 await dialog.getByLabel('Permission to use truck',{exact:true}).check();await page.screenshot({path:info.outputPath('document-filters.png'),scale:'css'});
 const backdrop=await dialog.evaluate(el=>getComputedStyle(el,'::backdrop').backgroundColor);expect(backdrop).toBe('rgba(25, 106, 113, 0.13)');
 await dialog.getByRole('button',{name:'Show matching trucks',exact:true}).click();await expect(dialog).not.toBeVisible();
 await expect(page).toHaveURL((url:URL)=>url.searchParams.get('ownerDocs')==='BUSINESS_LICENSE'&&url.searchParams.get('truckDocs')==='VEHICLE_AUTHORIZATION');
 const applied=await (await page.request.get(`/api/capacity-search${new URL(page.url()).search}`)).json();expect(applied.items.every((item:{kind:string})=>item.kind!=='TRUCK')).toBe(true);
 await drawer(page);await panel.getByRole('link',{name:'Clear all',exact:true}).click();await expect(page).toHaveURL('http://127.0.0.1:3100/');await drawer(page);await expect(panel.locator('.capacity-result-card').first()).toBeVisible();
 const first=await panel.locator('.capacity-result-card h3').allTextContents();await panel.getByRole('button',{name:'Next',exact:true}).click();await expect(panel.locator('.capacity-result-pagination')).toContainText('2 /');expect(await panel.locator('.capacity-result-card h3').allTextContents()).not.toEqual(first);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('search retry and all language filter layouts remain usable',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(150000);await page.route('**/api/capacity-search?*',route=>route.fulfill({status:503,json:{error:'Unavailable'}}));await page.goto('/');const panel=await drawer(page);
 await expect(panel.getByRole('alert')).toContainText('Search is temporarily unavailable. Please try again.');await page.unrouteAll({behavior:'wait'});await panel.getByRole('button',{name:'Try again',exact:true}).click();await expect(panel.locator('.capacity-result-card').first()).toBeVisible();
 for(const locale of ['am','om','so','ti']){
  const messages=JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));await page.locator('.language-picker select:visible').selectOption(locale);await panel.locator('.capacity-filter-trigger').click();const dialog=page.locator('.capacity-filter-dialog');
  await expect(dialog.locator('#capacity-filter-title')).toHaveText(messages.Filters);await expect(dialog.locator('[name="officeCity"]')).toHaveCount(0);
  await dialog.locator('.capacity-filter-actions button').scrollIntoViewIfNeeded();await dialog.locator('.capacity-filter-actions button').click({trial:true});await page.screenshot({path:info.outputPath(`filters-${locale}.png`),scale:'css'});await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});

test('private search uses verified recipient grants and loses access after revocation',async({page}:{page:Page})=>{
 test.setTimeout(180000);const db=localAuditService(),email=`search-${randomUUID()}@example.test`;
 const cap=checked(await db.from('capacities').select('id,vehicle_id,provider_organization_id').eq('visibility','PRIVATE').not('provider_organization_id','is',null).limit(1).single());
 const member=checked(await db.from('organization_members').select('user_id').eq('organization_id',cap.provider_organization_id).eq('membership_role','OWNER').single());const actor=checked(await db.from('profiles').select('id,role').eq('id',member.user_id).single());
 const grant=await grantPrivateCapacityAccess(actor,{vehicleId:cap.vehicle_id,email});let revoked=false;
 try{
  expect((await page.request.get('/api/capacity-search?view=private')).status()).toBe(401);
  await page.goto('/?view=private');await page.getByLabel('Email',{exact:true}).fill(email);const since=Date.now();await page.getByRole('button',{name:'Continue with email',exact:true}).click();await expect(page.getByLabel('6-digit email code')).toBeVisible();
  const code=await localMailpitNumericCode(email,since,'Your Private capacity code');await page.getByLabel('6-digit email code').fill(code);await page.getByRole('button',{name:'View shared signals',exact:true}).click();await expect(page.locator('.shared-capacity-session-workspace')).toBeVisible();
  const r=await page.request.get('/api/capacity-search?view=private');expect(r.status()).toBe(200);expect(r.headers()['cache-control']).toContain('no-store');const body=await r.json();expect(body.items.length).toBeGreaterThan(0);expect(body.items.every((i:{kind:string;matching_trucks:number})=>i.kind!=='TRUCK'&&i.matching_trucks===1)).toBe(true);const map=await (await page.request.get('/api/shared-capacity')).json();expect(map.items.map((i:{id:string})=>i.id)).toEqual([cap.id]);
  const panel=await drawer(page);await expect(panel.locator('[data-result-kind="COMPANY"]')).toHaveCount(1);await expect(panel.locator('[data-result-kind="TRUCK"]')).toHaveCount(0);await panel.getByRole('button',{name:/^Filters/}).click();await expect(page.locator('[name="resultKind"]')).toHaveCount(0);await page.getByRole('button',{name:'Show matching trucks',exact:true}).click();await expect(page).toHaveURL((url:URL)=>url.searchParams.get('view')==='private'&&!url.searchParams.has('resultKind'));
  await revokePrivateCapacityAccess(actor,grant.id);revoked=true;expect((await (await page.request.get('/api/capacity-search?view=private')).json()).total).toBe(0);
 }finally{if(!revoked)await revokePrivateCapacityAccess(actor,grant.id);}
});
