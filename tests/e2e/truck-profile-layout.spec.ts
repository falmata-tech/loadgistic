import {test,expect} from '@playwright/test';
import {closeCapacityFilters} from './capacity-drawer-helper';

test('truck modal groups identity, contacts, updates and entity documents without a long stack',async({page}:{page:any},info:any)=>{
 test.setTimeout(90000);
 const response=await page.request.get('/api/public/capacity?q=Merkato&status=PARTIAL');expect(response.ok()).toBe(true);
 const truck=(await response.json()).items.find((item:{vehicle_model:string})=>item.vehicle_model==='X200');expect(truck).toBeTruthy();
 await page.goto(`/?q=Merkato&status=PARTIAL&truck=${encodeURIComponent(truck.id)}`);
 await page.locator('.map-info-bubble.truck').click({timeout:30000});
 const modal=page.locator('dialog.capacity-info-card.truck'),sheet=modal.locator('.truck-inspection');
 await expect(sheet).toContainText(truck.provider_name);await expect(sheet).toContainText(truck.assigned_driver_first_name);
 await expect(sheet.locator('h3')).toHaveText(`${truck.vehicle_make} ${truck.vehicle_model}`);
 const image=sheet.locator('.truck-inspection-image img');await expect.poll(()=>image.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
 await expect(sheet.getByRole('link',{name:'Profile',exact:true})).toHaveAttribute('href',`/@${truck.provider_handle}`);
 const phone=truck.assigned_driver_phone||truck.contact_phone;
 if(phone)await expect(sheet.locator('a[href^="tel:"]')).toHaveAttribute('href',`tel:${phone}`);
 const composition=await sheet.evaluate((el:HTMLElement)=>{
  const people=[...el.querySelectorAll('.truck-inspection-person')].map(el=>el.getBoundingClientRect());
  const docs=[...el.querySelectorAll('.truck-document-summary')].map(el=>el.getBoundingClientRect());
  const content=el.closest('.capacity-info-content')!;
  return {peopleSideBySide:Math.abs(people[0].top-people[1].top)<1&&people[0].right<=people[1].left,docsSideBySide:docs.every(rect=>Math.abs(rect.top-docs[0].top)<1),horizontalOverflow:content.scrollWidth-content.clientWidth,verticalOverflow:content.scrollHeight-content.clientHeight};
 });
 expect(composition).toEqual({peopleSideBySide:true,docsSideBySide:true,horizontalOverflow:0,verticalOverflow:0});
 for(const link of await sheet.locator('a').all()){const box=await link.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);expect(box.width).toBeGreaterThanOrEqual(44);}
 await page.screenshot({path:info.outputPath('truck-profile.png')});
 const documents=sheet.locator('.truck-document-summary').first();await documents.locator(':scope>summary').click();
 await expect(documents).toHaveAttribute('open','');
 const row=await documents.boundingBox(),container=await sheet.locator('.map-truck-documents').boundingBox();expect(Math.abs(row.width-container.width)).toBeLessThan(2);
 const badge=documents.locator('.verification-badge').first();await badge.locator('summary').click();await expect(badge.locator('.verification-badge-details')).toBeVisible();
 await expect(badge).toContainText(/Review applies to this document category only|No current reviewed evidence/);
 await page.screenshot({path:info.outputPath('truck-documents-expanded.png')});
 await documents.locator(':scope>summary').click();
 // Translation expansion must not push content horizontally outside the modal.
 await modal.getByRole('button',{name:'Close map signal details'}).click();
 await page.locator('.language-picker select').selectOption('am');
 await page.locator('.map-info-bubble.truck').click();
 await expect(sheet).toContainText(truck.provider_name);
 expect(await sheet.evaluate((el:HTMLElement)=>{const content=el.closest('.capacity-info-content')!;return content.scrollWidth<=content.clientWidth;})).toBe(true);
 await page.screenshot({path:info.outputPath('truck-profile-amharic.png')});
 await page.keyboard.press('Escape');
 await page.locator('.language-picker select').selectOption('en');
 await page.locator('.map-info-bubble.truck').click();
 if(info.project.name.includes('mobile')){
  await page.setViewportSize({width:320,height:740});
  expect(await sheet.evaluate((el:HTMLElement)=>{const content=el.closest('.capacity-info-content')!;return content.scrollWidth<=content.clientWidth;})).toBe(true);
  await page.screenshot({path:info.outputPath('truck-profile-small-phone.png')});
 }
 await page.getByRole('dialog').getByRole('button',{name:'Close map signal details'}).click();
 await expect(page.locator('.capacity-truck-map-marker.selected')).toBeVisible();
});

test('long truck profiles stay bounded and a fallback phone belongs to the transporter',async({page}:{page:any})=>{
 test.setTimeout(60000);
 const data=await(await page.request.get('/api/public/capacity?q=Merkato&status=PARTIAL')).json();
 const original=data.items.find((item:{vehicle_model:string})=>item.vehicle_model==='X200');expect(original).toBeTruthy();
 const companyPhone=original.contact_phone||original.assigned_driver_phone;expect(companyPhone).toBeTruthy();
 const truck={...original,provider_name:'Long transporter name '.repeat(7),assigned_driver_first_name:'Long driver name '.repeat(6),vehicle_model:'Long vehicle model '.repeat(5),assigned_driver_phone:null,contact_phone:companyPhone};
 await page.route('**/api/public/capacity?**',(route:any)=>route.fulfill({json:{items:[truck],hasMore:false,nextCursor:null}}));
 await page.goto('/?q=truck-profile-layout-fixture');
 await closeCapacityFilters(page);
 await page.locator('.capacity-truck-map-marker').first().click({timeout:30000});
 await page.locator('.map-info-bubble.truck').click();
 const sheet=page.locator('.truck-inspection'),content=page.locator('.capacity-info-content');
 await expect(sheet.locator('.transporter a[href^="tel:"]')).toHaveAttribute('href',`tel:${companyPhone}`);
 await expect(sheet.locator('.driver a[href^="tel:"]')).toHaveCount(0);await expect(sheet.locator('.driver')).toContainText('Phone not published');
 expect(await content.evaluate((el:HTMLElement)=>el.scrollWidth-el.clientWidth)).toBe(0);
 expect(await content.evaluate((el:HTMLElement)=>el.scrollHeight>el.clientHeight)).toBe(true);
 await page.getByRole('button',{name:'Close map signal details'}).click();await expect(page.locator('.capacity-truck-map-marker.selected')).toBeVisible();
});
