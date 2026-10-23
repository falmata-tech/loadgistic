import {expect} from './browser-test';
import type {Page,Locator} from 'playwright-core';

export async function clickFleetLink(page:Page,link:Locator){
 const href=await link.getAttribute('href');
 if(!href)throw Error('FLEET_DRIVER_DESTINATION_MISSING');
 const destination=new URL(href,page.url());
 if(destination.origin!==new URL(page.url()).origin||!destination.pathname.startsWith('/app/fleet'))throw Error('FLEET_DESTINATION_SCOPE_MISMATCH');
 await Promise.all([page.waitForURL(destination.href,{waitUntil:'domcontentloaded',timeout:30_000}),link.click()]);
}

/** Uses the visible Fleet list, retaining an Assign driver vehicle context. */
export async function openFleetDriver(page:Page,identity:{id?:string;name?:string},edit=false){
 const current=new URL(page.url()),query=new URLSearchParams({view:'drivers'});
 if(current.pathname==='/app/fleet')for(const key of ['vehicle','driverPage','truckPage']){const value=current.searchParams.get(key);if(value)query.set(key,value);}
 await page.goto('/app/fleet?'+query,{waitUntil:'domcontentloaded'});
 const row=identity.id?page.locator(`article:has(a[href*="driver=${identity.id}"])`):page.locator('article').filter({has:page.getByText(identity.name!,{exact:true})});
 await expect(row).toHaveCount(1);
 // A Next client navigation can outlive the click; assert the actual link's
 // destination before checking controls belonging to the new record.
 await clickFleetLink(page,row.getByRole('link',{name:'Manage',exact:true}));
 const detail=page.locator('#driver-access');await expect(detail.getByRole('button',{name:'Edit assignment',exact:true})).toBeVisible();
 if(!edit)return detail;
 await detail.getByRole('button',{name:'Edit assignment',exact:true}).click();
 return page.getByRole('dialog',{name:'Assigned vehicle',exact:true});
}
