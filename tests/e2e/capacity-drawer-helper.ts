import {expect} from '@playwright/test';

export async function openCapacityFilters(page:any){
  const trigger=page.locator('.capacity-drawer-handle button');
  await expect(trigger).toBeEnabled();
  const drawer=page.locator('#capacity-filter-drawer');
  // CSS visibility changes during the opening transition. Read the committed
  // disclosure state, not a transient frame that can hide both role locators.
  if(await drawer.getAttribute('aria-hidden')==='true')await trigger.click();
  await expect(drawer).toBeVisible();return drawer;
}

export async function closeCapacityFilters(page:any){
  const drawer=page.locator('#capacity-filter-drawer');
  await expect(page.locator('.capacity-drawer-handle button')).toBeEnabled();
  if(await drawer.getAttribute('aria-hidden')==='false')await drawer.getByRole('button',{name:'Close filter drawer'}).click();
  await expect(drawer).toBeHidden();
}


export async function openCapacityFilterDialog(page:any){
 const dialog=page.locator('.capacity-filter-dialog');
 if(!await dialog.isVisible()){
  const drawer=await openCapacityFilters(page);await drawer.getByRole('button',{name:/^Filters/}).click();
 }
 await expect(dialog).toBeVisible();return dialog;
}

export async function chooseTruckConfiguration(dialog:any,name:string){
 const picker=dialog.locator('.capacity-configuration-picker');
 if(!await picker.locator('details').evaluate((el:HTMLDetailsElement)=>el.open))await picker.locator('summary').click();
 await picker.getByRole('radio',{name,exact:true}).check();
}
