import {expect} from './browser-test';
import type {Page} from 'playwright-core';

/** Uses the visible Fleet list, retaining an Assign driver vehicle context. */
export async function openFleetDriver(page:Page,identity:{id?:string;name?:string},edit=false){
 const current=new URL(page.url()),query=new URLSearchParams({view:'drivers'});
 if(current.pathname==='/app/fleet')for(const key of ['vehicle','driverPage','truckPage']){const value=current.searchParams.get(key);if(value)query.set(key,value);}
 await page.goto('/app/fleet?'+query,{waitUntil:'domcontentloaded'});
 const row=identity.id?page.locator(`article:has(a[href*="driver=${identity.id}"])`):page.locator('article').filter({has:page.getByText(identity.name!,{exact:true})});
 await expect(row).toHaveCount(1);await row.getByRole('link',{name:'Manage',exact:true}).click();
 const detail=page.locator('#driver-access');await expect(detail.getByRole('button',{name:'Edit assignment',exact:true})).toBeVisible();
 if(!edit)return detail;
 await detail.getByRole('button',{name:'Edit assignment',exact:true}).click();
 return page.getByRole('dialog',{name:'Assigned vehicle',exact:true});
}
