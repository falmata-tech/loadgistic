import {expect} from '@playwright/test';
import type {Page} from 'playwright-core';
import {calendarDay} from '../../src/lib/date-calendar';
export async function chooseDate(page:Page,label:string,date:string){
 await page.getByRole('button',{name:label,exact:true}).click();
 const dialog=page.locator('dialog.date-picker-dialog[open]');await expect(dialog).toBeVisible();
 const choice=dialog.getByRole('button',{name:new RegExp('^'+calendarDay(date,'en').label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:,|$)')});
 for(let week=0;week<20;week++){
  if(await choice.count()){await choice.click();await expect(dialog).toHaveCount(0);return;}
  await dialog.getByRole('button',{name:'Next week',exact:true}).click();
 }
 throw Error('Synthetic future date did not appear within the calendar’s bounded next weeks.');
}
