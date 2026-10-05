import {test,expect} from '@playwright/test';
import type {Page} from 'playwright-core';
import {openCapacityFilterDialog,chooseTruckConfiguration} from './capacity-drawer-helper';
import {VEHICLE_CONFIGURATIONS} from '../../src/lib/vehicle-configurations';

test('configuration pictures support selection, keyboard navigation, apply and clear',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(150000);
 await page.goto('/');const dialog=await openCapacityFilterDialog(page),picker=dialog.locator('.capacity-configuration-picker');
 const summary=picker.locator('summary');await expect(summary).toContainText('Any configuration');await summary.click();
 await expect(picker.getByRole('radio')).toHaveCount(VEHICLE_CONFIGURATIONS.length+1);
 for(const config of VEHICLE_CONFIGURATIONS){
  const option=picker.locator('label').filter({has:page.getByRole('radio',{name:config.name,exact:true})});
  await option.scrollIntoViewIfNeeded();
  await expect(option.locator('img')).toHaveAttribute('src',new RegExp(encodeURIComponent(config.image)));
 }
 await expect.poll(()=>picker.locator('.capacity-configuration-options img').evaluateAll((images:Element[])=>images.every((image:Element)=>(image as HTMLImageElement).complete&&(image as HTMLImageElement).naturalWidth>0))).toBe(true);
 await summary.scrollIntoViewIfNeeded();const pickerBox=await picker.boundingBox(),summaryBox=await summary.boundingBox();expect(summaryBox!.width).toBeGreaterThan(pickerBox!.width*.95);await page.screenshot({path:info.outputPath('configuration-pictures.png'),scale:'css'});
 await chooseTruckConfiguration(dialog,'Tractor + Container Trailer');await expect(summary).toContainText('Tractor + Container Trailer');await expect(summary.locator('img')).toHaveAttribute('src',/tractor-container-flatbed/);
 await expect(summary).toBeFocused();await page.keyboard.press('Enter');const selected=picker.getByRole('radio',{name:'Tractor + Container Trailer',exact:true});await selected.focus();await page.keyboard.press('ArrowRight');await expect(picker.getByRole('radio',{name:'Tractor + Dry Van Trailer',exact:true})).toBeChecked();
 await chooseTruckConfiguration(dialog,'Mini Box Truck');await expect(summary).toContainText('Mini Box Truck');
 await dialog.getByRole('button',{name:'Show matching trucks',exact:true}).click();await expect(page).toHaveURL((url:URL)=>url.searchParams.get('vehicleCategory')==='Mini Box Truck');
 const response=await page.request.get('/api/public/capacity?vehicleCategory=Mini%20Box%20Truck');expect(response.ok()).toBe(true);const data=await response.json();expect(data.items.length).toBeGreaterThan(0);expect(data.items.every((item:{cargo_configuration:string})=>item.cargo_configuration==='Mini Box Truck')).toBe(true);
 await openCapacityFilterDialog(page);await expect(picker.locator('summary')).toContainText('Mini Box Truck');await chooseTruckConfiguration(dialog,'Any configuration');await dialog.getByRole('button',{name:'Show matching trucks',exact:true}).click();await expect(page).toHaveURL((url:URL)=>!url.searchParams.get('vehicleCategory'));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
