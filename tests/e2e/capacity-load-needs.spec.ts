import {test,expect} from './browser-test';
import type {Page} from 'playwright-core';
import {readFileSync} from 'node:fs';
import {openCapacityFilterDialog,chooseCapacityOptions} from './capacity-drawer-helper';

test('load space replaces signal geometry and filters profiles and trucks',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(150000);
 await page.goto('/?geometry=RADIUS');const dialog=await openCapacityFilterDialog(page);
 await expect(dialog.locator('[name="geometry"]')).toHaveCount(0);await expect(dialog.locator('[name="currentArea"]')).toHaveCount(0);
 const load=dialog.locator('input[type="hidden"][name="loadType"]'),status=dialog.locator('input[type="hidden"][name="status"]');
 await chooseCapacityOptions(dialog,'status',['PARTIAL']);await chooseCapacityOptions(dialog,'loadType',['FTL','PTL']);await expect(status).toHaveValue('PARTIAL');await expect(dialog.getByRole('checkbox',{name:'Partly loaded',exact:true})).toBeChecked();
 await chooseCapacityOptions(dialog,'status',[]);await chooseCapacityOptions(dialog,'loadType',['FTL']);
 await page.screenshot({path:info.outputPath('shipment-load-filter.png'),scale:'css'});
 await dialog.getByRole('button',{name:'Show matching trucks',exact:true}).click();await expect(page).toHaveURL((url:URL)=>url.searchParams.get('loadType')==='FTL'&&!url.searchParams.has('geometry'));
 const full=await (await page.request.get('/api/public/capacity?loadType=FTL')).json();expect(full.items.length).toBeGreaterThan(0);expect(full.items.every((item:{accepts_full_load:boolean;status:string})=>item.accepts_full_load&&item.status==='EMPTY')).toBe(true);
 const profiles=await (await page.request.get('/api/capacity-search?loadType=FTL')).json();expect(profiles.items.length).toBeGreaterThan(0);expect(profiles.items.every((item:{matching_trucks:number})=>item.matching_trucks>0)).toBe(true);
 await openCapacityFilterDialog(page);await chooseCapacityOptions(dialog,'loadType',['PTL']);await expect(dialog.getByRole('checkbox',{name:'Partly loaded',exact:true})).toBeEnabled();await dialog.getByRole('button',{name:'Show matching trucks',exact:true}).click();await expect(page).toHaveURL((url:URL)=>url.searchParams.get('loadType')==='PTL');
 const shared=await (await page.request.get('/api/public/capacity?loadType=PTL')).json();expect(shared.items.length).toBeGreaterThan(0);expect(shared.items.every((item:{accepts_partial_load:boolean})=>item.accepts_partial_load)).toBe(true);
 await openCapacityFilterDialog(page);await dialog.getByRole('link',{name:'Clear',exact:true}).click();await expect(page).toHaveURL('http://127.0.0.1:3100/');await openCapacityFilterDialog(page);await expect(load).toHaveValue('');await page.keyboard.press('Escape');
 for(const locale of ['am','om']){
  const messages=JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));await page.locator('.language-picker select:visible').selectOption(locale);
  await page.locator('.capacity-filter-trigger').click();await expect(dialog.locator('[data-filter-group="loadType"] legend')).toContainText(messages['Space needed']);
  await expect(dialog.getByRole('checkbox',{name:messages['Full truck'],exact:true})).toBeVisible();await expect(dialog.getByRole('checkbox',{name:messages['Shared truck space'],exact:true})).toBeVisible();await page.keyboard.press('Escape');
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
