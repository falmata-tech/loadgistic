import {test,expect} from './browser-test';
import type {Page} from 'playwright-core';
import {localAuditService,checked} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {openCapacityFilterDialog} from './capacity-drawer-helper';

test('public courier filters and guest workspace entry retain their destinations',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(90000);
 await page.goto('/');await expect(page.locator('.language-picker select:visible')).toBeEnabled();
 const drawer=await openCapacityFilterDialog(page),config=drawer.getByRole('group',{name:'Vehicle type',exact:true});await config.locator('summary').click();
 await expect(config.getByRole('checkbox',{name:'Courier car',exact:true})).toHaveCount(1);await expect(config.getByRole('checkbox',{name:'Courier motorcycle',exact:true})).toHaveCount(1);
 await expect(config.getByRole('checkbox',{name:'Cargo van',exact:true})).toHaveCount(1);
 await page.screenshot({path:info.outputPath('freight-filter.png')});
 await drawer.getByRole('button',{name:'Close filters'}).click();
 const login=page.getByTestId('public-session-action').getByRole('link',{name:'Sign in',exact:true});
 await expect(login).toHaveAttribute('href','/login');await login.click();
 await expect(page.getByTestId('email-code-request-form')).toBeVisible();
 await page.screenshot({path:info.outputPath('transporter-login.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('provider registration retains courier choices and previews the container flatbed',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(90000);const service=localAuditService();
 const owner=checked(await service.from('organization_members').select('user_id').eq('membership_role','OWNER').limit(1).single());
 const logout=await localSupportLogin(page,owner.user_id);
 try{
  await page.goto('/app/fleet/new');const config=page.getByLabel('Vehicle configuration',{exact:true});
  await expect(config).toBeVisible();await expect(page.locator('.language-picker select:visible')).toBeEnabled();
  await expect(config.getByRole('option',{name:'Courier car',exact:true})).toHaveCount(1);await expect(config.getByRole('option',{name:'Courier motorcycle',exact:true})).toHaveCount(1);
  for(const [name,path]of [['Courier car','courier-car'],['Courier motorcycle','courier-motorcycle']]){await config.selectOption({label:name});const courier=page.locator('.vehicle-configuration-preview img');await expect(courier).toHaveAttribute('src',new RegExp(path));await expect.poll(()=>courier.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);}
  await config.selectOption({label:'Interchangeable tractor'});
  await expect(page.getByLabel('Currently attached trailer',{exact:true})).toHaveValue('Tractor + Container Trailer');
  const image=page.locator('.vehicle-configuration-preview img');
  await expect(image).toHaveAttribute('src',/tractor-container-flatbed/);
  await expect.poll(()=>image.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
  await image.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('container-flatbed.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await logout();}
});

test('Featured introduces distinct provider accounts without vehicle-type days',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(90000);await page.goto('/featured');
 const providers=page.locator('.featured-provider-tile');await expect.poll(()=>providers.count()).toBeGreaterThan(0);
 expect(await providers.count()).toBeLessThanOrEqual(8);
 const labels=await providers.evaluateAll(elements=>elements.map(element=>element.getAttribute('aria-label')));
 expect(labels.every(label=>label?.startsWith('Featured account '))).toBe(true);
 expect(new Set(labels).size).toBe(labels.length);
 await expect(page.locator('.regional-expo-week-panel')).toHaveCount(0);
 await page.screenshot({path:info.outputPath('featured-freight.png'),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
