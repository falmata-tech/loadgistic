import {test,expect} from '@playwright/test';
import type {Page} from 'playwright-core';
import {readFileSync} from 'node:fs';
import {openCapacityFilterDialog} from './capacity-drawer-helper';

test('load space replaces signal geometry and filters profiles and trucks',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(150000);
 await page.goto('/?geometry=RADIUS');const dialog=await openCapacityFilterDialog(page);
 await expect(dialog.locator('[name="geometry"]')).toHaveCount(0);await expect(dialog.locator('[name="currentArea"]')).toHaveCount(0);
 const load=dialog.getByRole('combobox',{name:'Space needed',exact:true}),status=dialog.getByRole('combobox',{name:'Availability',exact:true});
 await status.selectOption('PARTIAL');await load.selectOption('FTL');await expect(status).toHaveValue('');await expect(status.locator('option[value="PARTIAL"]')).toBeDisabled();
 await page.screenshot({path:info.outputPath('shipment-load-filter.png'),scale:'css'});
 await dialog.getByRole('button',{name:'Show matching trucks',exact:true}).click();await expect(page).toHaveURL((url:URL)=>url.searchParams.get('loadType')==='FTL'&&!url.searchParams.has('geometry'));
 const full=await (await page.request.get('/api/public/capacity?loadType=FTL')).json();expect(full.items.length).toBeGreaterThan(0);expect(full.items.every((item:{accepts_full_load:boolean;status:string})=>item.accepts_full_load&&item.status==='EMPTY')).toBe(true);
 const profiles=await (await page.request.get('/api/capacity-search?loadType=FTL')).json();expect(profiles.items.length).toBeGreaterThan(0);expect(profiles.items.every((item:{matching_trucks:number})=>item.matching_trucks>0)).toBe(true);
 await openCapacityFilterDialog(page);await load.selectOption('PTL');await expect(status.locator('option[value="PARTIAL"]')).toBeEnabled();await dialog.getByRole('button',{name:'Show matching trucks',exact:true}).click();await expect(page).toHaveURL((url:URL)=>url.searchParams.get('loadType')==='PTL');
 const shared=await (await page.request.get('/api/public/capacity?loadType=PTL')).json();expect(shared.items.length).toBeGreaterThan(0);expect(shared.items.every((item:{accepts_partial_load:boolean})=>item.accepts_partial_load)).toBe(true);
 await openCapacityFilterDialog(page);await dialog.getByRole('link',{name:'Clear',exact:true}).click();await expect(page).toHaveURL('http://127.0.0.1:3100/');await openCapacityFilterDialog(page);await expect(load).toHaveValue('');await page.keyboard.press('Escape');
 for(const locale of ['am','om','so','ti']){
  const messages=JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));await page.locator('.language-picker select:visible').selectOption(locale);
  await page.locator('.capacity-filter-trigger').click();await expect(dialog.locator('label[for="capacity-load-filter"]')).toContainText(messages['Space needed']);
  await expect(dialog.locator('#capacity-load-filter option[value="FTL"]')).toHaveText(messages['Full truck']);await expect(dialog.locator('#capacity-load-filter option[value="PTL"]')).toHaveText(messages['Shared truck space']);await page.keyboard.press('Escape');
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
