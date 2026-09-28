import {test,expect} from '@playwright/test';
import type {Page} from 'playwright-core';
import {localAuditService,checked} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {openCapacityFilterDialog} from './capacity-drawer-helper';

test('public freight filters and Transporter login retain their destinations',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(90000);
 await page.goto('/');await expect(page.locator('.language-picker select')).toBeEnabled();
 const drawer=await openCapacityFilterDialog(page),config=drawer.getByRole('group',{name:'Truck configuration',exact:true});await config.locator('summary').click();
 await expect(config.getByRole('radio',{name:/Courier/})).toHaveCount(0);
 await expect(config.getByRole('radio',{name:'Cargo van',exact:true})).toHaveCount(1);
 await page.screenshot({path:info.outputPath('freight-filter.png')});
 await drawer.getByRole('button',{name:'Close filters'}).click();
 const login=page.getByRole('link',{name:'Transporter login',exact:true}).filter({visible:true});
 await expect(login).toHaveAttribute('href','/login');await login.click();
 await expect(page.getByTestId('email-code-request-form')).toBeVisible();
 await page.screenshot({path:info.outputPath('transporter-login.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('provider registration previews the container flatbed without courier choices',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(90000);const service=localAuditService();
 const owner=checked(await service.from('organization_members').select('user_id').eq('membership_role','OWNER').limit(1).single());
 const logout=await localSupportLogin(page,owner.user_id);
 try{
  await page.goto('/app/fleet/new');const config=page.getByLabel('Vehicle configuration',{exact:true});
  await expect(config).toBeVisible();await expect(page.locator('.language-picker select')).toBeEnabled();
  await expect(config.getByRole('radio',{name:/Courier/})).toHaveCount(0);
  await config.selectOption({label:'Interchangeable tractor'});
  await expect(page.getByLabel('Currently attached trailer',{exact:true})).toHaveValue('Tractor + Container Trailer');
  const image=page.locator('.vehicle-configuration-preview img');
  await expect(image).toHaveAttribute('src',/tractor-container-flatbed/);
  await expect.poll(()=>image.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
  await image.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('container-flatbed.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await logout();}
});

test('Featured shows the mixed Sunday theme alongside the unchanged weekdays',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(90000);await page.goto('/featured');
 await expect(page.locator('.featured-provider-tile')).toHaveCount(8);
 await page.locator('.regional-expo-week-panel summary').click();
 await expect(page.getByRole('region',{name:'Weekly featured truck types'}).getByText('Mixed',{exact:true})).toBeVisible();
 await expect(page.getByText('Courier cars',{exact:true})).toHaveCount(0);
 await page.screenshot({path:info.outputPath('featured-freight.png'),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
