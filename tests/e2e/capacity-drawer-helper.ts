import {expect} from '@playwright/test';

export async function openCapacityFilters(page:any){
  const trigger=page.locator('.capacity-drawer-handle button[aria-controls="capacity-filter-drawer"]');
  await expect(trigger).toBeEnabled({timeout:30_000});
  const drawer=page.locator('#capacity-filter-drawer');
  // CSS visibility changes during the opening transition. Read the committed
  // disclosure state, not a transient frame that can hide both role locators.
  if(await drawer.getAttribute('aria-hidden')==='true')await trigger.click();
  await expect(drawer).toBeVisible();return drawer;
}

export async function closeCapacityFilters(page:any){
  const drawer=page.locator('#capacity-filter-drawer');
  await expect(page.locator('.capacity-drawer-handle button[aria-controls="capacity-filter-drawer"]')).toBeEnabled({timeout:30_000});
  if(await drawer.getAttribute('aria-hidden')==='false'){
    if(await drawer.getByRole('button',{name:'Close truck summary'}).count()){
      // Swiping hides the drawer while preserving the selected truck.
      await expect.poll(()=>drawer.evaluate((el:HTMLElement)=>getComputedStyle(el).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
      const box=await drawer.locator('h2').boundingBox();
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
      await page.mouse.move(box.x+box.width/2-90,box.y+box.height/2,{steps:6});await page.mouse.up();
    }else await drawer.getByRole('button',{name:'Close transporter search'}).click();
  }
  await expect(drawer).toBeHidden();
}


export async function openCapacityFilterDialog(page:any){
 const dialog=page.locator('.capacity-filter-dialog');
 if(!await dialog.isVisible()){
  await page.locator('.capacity-map-controls .capacity-filter-trigger').click();
 }
 await expect(dialog).toBeVisible();return dialog;
}

export async function chooseTruckConfiguration(dialog:any,name:string|string[]){
 const picker=dialog.locator('.capacity-configuration-picker');
 if(!await picker.locator('details').evaluate((el:HTMLDetailsElement)=>el.open))await picker.locator('summary').click();
 await picker.getByRole('button',{name:'All vehicle types',exact:true}).click();
 for(const option of Array.isArray(name)?name:name==='All vehicle types'?[]:[name])await picker.getByRole('checkbox',{name:option,exact:true}).check();
}

export async function chooseCapacityOptions(dialog:any,key:string,values:string[]){
 const group=dialog.locator(`[data-filter-group="${key}"]`);
 const section=group.locator('xpath=ancestor::details[1]');
 if(await section.count()&&!await section.evaluate((element:HTMLDetailsElement)=>element.open))await section.locator(':scope > summary').click();
 await group.locator('[data-clear-options]').click();
 for(const value of values)await group.locator(`input[type="checkbox"][value="${value}"]`).check();
}
