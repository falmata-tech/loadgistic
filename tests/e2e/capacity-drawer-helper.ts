import {expect} from '@playwright/test';

export async function openCapacityFilters(page:any){
  await expect(page.locator('.capacity-drawer-handle button')).toBeEnabled();
  const drawer=page.getByRole('complementary',{name:'Capacity filters'});
  if(!await drawer.isVisible())await page.getByRole('button',{name:/^Filters/}).click();
  await expect(drawer).toBeVisible();return drawer;
}
