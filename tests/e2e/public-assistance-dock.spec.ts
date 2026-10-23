import {test,expect} from './browser-test';
import type {Page} from 'playwright-core';
import {openCapacityFilters,closeCapacityFilters} from './capacity-drawer-helper';

// FEAT-ENT-001: public discovery remains usable without a platform brokerage
// launcher. Private Capacity and Tracking keep their own separate entry points.
test('public map keeps its controls usable without retired transport chat',async({page}: {page:Page},info)=>{
 test.setTimeout(90000);
 await page.goto('/');
 await expect(page.locator('.leaflet-container')).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Switch view'}).getByRole('link',{name:'My workspace'})).toHaveAttribute('href','/login');
 await expect(page.locator('.public-assistance-dock,.public-assistance-request,.transport-request-form')).toHaveCount(0);
 for(const open of [true,false]){
  if(open)await openCapacityFilters(page);else await closeCapacityFilters(page);
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await page.screenshot({path:info.outputPath(open?'retired-chat-filters-open.png':'retired-chat-map.png')});
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('old public chat state cannot restore a launcher, dialog or background polling',async({page}: {page:Page})=>{
 const requests:string[]=[];
 page.on('request',request=>{if(/\/api\/(?:guest-support|transport-requests|brokerage)(?:\/|\?|$)/.test(new URL(request.url()).pathname))requests.push(request.url());});
 await page.addInitScript(()=>{sessionStorage.setItem('loadgistic-public-chat-open','1');sessionStorage.setItem('loadgistic-assistance-mode','help');});
 for(const path of ['/about','/featured']){
  await page.goto(path,{waitUntil:'domcontentloaded'});
  await expect(page.locator('.public-assistance-dock,.public-chat-dialog,.transport-request-form')).toHaveCount(0);
 }
 expect(requests).toEqual([]);
});

test('retired chat stays absent after language changes on a narrow phone',async({page}: {page:Page})=>{
 test.setTimeout(90000);
 await page.setViewportSize({width:320,height:568});
 await page.goto('/about',{waitUntil:'domcontentloaded'});
 for(const locale of ['en','am','om']){
  await page.locator('.language-picker select:visible').selectOption(locale);
  await expect(page.locator('html')).toHaveAttribute('lang',locale);
  await expect(page.locator('.public-assistance-dock,.public-chat-dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
