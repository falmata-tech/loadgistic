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
