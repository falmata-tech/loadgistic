import {test,expect} from './browser-test';
import type {Page} from 'playwright-core';
import {readFileSync} from 'node:fs';
import {openCapacityFilterDialog,chooseCapacityOptions} from './capacity-drawer-helper';
import {capacityLoadPreference,capacityLoadLabel} from '../../src/lib/capacity-load-preferences.js';

test('current load filters vehicles without retaining the removed space filter',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(150000);
 // Previously shared links must not silently retain a control removed by the owner.
 await page.goto('/?geometry=RADIUS&loadType=FTL');
 const dialog=await openCapacityFilterDialog(page);
 for(const name of ['geometry','currentArea','loadType'])await expect(dialog.locator(`[name="${name}"]`)).toHaveCount(0);
 await expect(dialog.getByRole('group',{name:'Space needed',exact:true})).toHaveCount(0);
 await chooseCapacityOptions(dialog,'status',['EMPTY','PARTIAL']);
 await expect(dialog.getByRole('checkbox',{name:'Empty vehicle',exact:true})).toBeChecked();
 await expect(dialog.getByRole('checkbox',{name:'Partly loaded',exact:true})).toBeChecked();
 await chooseCapacityOptions(dialog,'status',['PARTIAL']);
 await page.screenshot({path:info.outputPath('vehicle-load-filter.png'),scale:'css'});
 await dialog.getByRole('button',{name:'Show matching vehicles',exact:true}).click();
 await expect(page).toHaveURL((url:URL)=>url.searchParams.get('status')==='PARTIAL'&&!url.searchParams.has('geometry')&&!url.searchParams.has('loadType'));
 const partialResponse=await page.request.get('/api/public/capacity?status=PARTIAL');expect(partialResponse.ok()).toBe(true);
 const partial=await partialResponse.json();expect(partial.items.length).toBeGreaterThan(0);
 expect(partial.items.every((item:{status:string})=>item.status==='PARTIAL')).toBe(true);

 // Saved driver preferences and bounded API clients still work; only the visitor control was retired.
 const full=await (await page.request.get('/api/public/capacity?loadType=FTL')).json();
 expect(full.items.length).toBeGreaterThan(0);
 expect(full.items.every((item:{accepts_full_load:boolean;status:string})=>item.accepts_full_load&&item.status==='EMPTY')).toBe(true);
 const shared=await (await page.request.get('/api/public/capacity?loadType=PTL')).json();
 expect(shared.items.length).toBeGreaterThan(0);
 expect(shared.items.every((item:{accepts_partial_load:boolean})=>item.accepts_partial_load)).toBe(true);
 await openCapacityFilterDialog(page);await dialog.getByRole('link',{name:'Clear',exact:true}).click();
 await expect(page).toHaveURL((url:URL)=>url.pathname==='/'&&!url.search);
 await openCapacityFilterDialog(page);await expect(dialog.locator('input[type="hidden"][name="status"]')).toHaveValue('');await page.keyboard.press('Escape');
 const selected=full.items[0];
 await page.goto(`/?truck=${encodeURIComponent(selected.id)}`);
 await page.locator('.map-info-bubble.truck').click();
 await expect(page.locator('.map-capacity-sheet .truck-load-preference')).toHaveText(capacityLoadLabel(capacityLoadPreference(selected.status,selected.accepts_full_load,selected.accepts_partial_load)));
 await page.keyboard.press('Escape');
 for(const locale of ['am','om']){
  const messages=JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
  await page.locator('.language-picker select:visible').selectOption(locale);
  await openCapacityFilterDialog(page);
  await expect(dialog.locator('[data-filter-group="status"] legend')).toHaveText(messages["Vehicle's current load"]);
  await expect(dialog.getByRole('checkbox',{name:messages['Empty vehicle'],exact:true})).toBeVisible();
  await expect(dialog.getByRole('checkbox',{name:messages['Partly loaded'],exact:true})).toBeVisible();
  await expect(dialog.locator('[name="loadType"]')).toHaveCount(0);await page.keyboard.press('Escape');
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
