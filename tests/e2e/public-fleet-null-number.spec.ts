import {expect,test} from './browser-test';

type PublicFleet={handle:string;trucks:{number:string;capacity:unknown|null}[]};
test('existing local numbered and legacy null-number trucks keep closed maps and usable actions',async({page})=>{
 test.skip(process.env.CHECK_EXISTING_NULL_FLEET!=='1','Read-only check of existing local legacy records');
 test.setTimeout(90000);
 const featureResponse=await page.request.get('/api/mobile/public/featured');expect(featureResponse.ok()).toBe(true);
 const feature=await featureResponse.json() as {trucks:{handle:string}[]};
 const fleets:PublicFleet[]=[];
 for(const handle of [...new Set(feature.trucks.map(truck=>truck.handle))].slice(0,8)){
  const response=await page.request.get(`/api/mobile/public/providers/${encodeURIComponent(handle)}`);expect(response.ok()).toBe(true);fleets.push(await response.json() as PublicFleet);
 }
 const capacityResponse=await page.request.get('/api/public/capacity');expect(capacityResponse.ok()).toBe(true);
 const capacity=await capacityResponse.json() as {items:{provider_handle:string}[]};
 const capacityHandle=capacity.items[0]?.provider_handle;
 if(capacityHandle&&!fleets.some(fleet=>fleet.handle===capacityHandle)){
  const response=await page.request.get(`/api/mobile/public/providers/${encodeURIComponent(capacityHandle)}`);expect(response.ok()).toBe(true);fleets.push(await response.json() as PublicFleet);
 }
 const legacy=fleets.find(fleet=>fleet.trucks.some(truck=>!truck.number));
 const numbered=fleets.find(fleet=>fleet.trucks.some(truck=>truck.number));
 expect(Boolean(legacy),'Existing local null-number fleet fixture is required').toBe(true);
 expect(Boolean(numbered),'Existing local numbered fleet fixture is required').toBe(true);
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
 for(const [fleet,index,missing] of [[legacy!,legacy!.trucks.findIndex(truck=>!truck.number),true],[numbered!,numbered!.trucks.findIndex(truck=>truck.number),false]] as const){
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:900});const response=await page.goto(`/@${encodeURIComponent(fleet.handle)}`);expect(response?.status()).toBe(200);
   const disclosure=page.locator('.provider-fleet-disclosure');if(await disclosure.count())await disclosure.locator(':scope > summary').click();
   const card=page.locator('.provider-truck-card').nth(index);await expect(card).toBeVisible();await expect(page.locator('.provider-truck-map-panel')).toHaveCount(0);
   const number=card.locator('.provider-truck-title-row > span > strong');if(missing)await expect(number).toBeEmpty();else await expect(number).not.toBeEmpty();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   if(fleet.trucks[index].capacity){
    const trigger=card.getByRole('button',{name:'View capacity on map',exact:true});await expect(trigger).toHaveAttribute('aria-expanded','false');await trigger.click();
    const panel=card.locator('.provider-truck-map-panel');await expect(panel).toBeVisible();await expect(page.locator('.provider-truck-map-panel')).toHaveCount(1);await expect(panel).not.toHaveAttribute('aria-label',/null|undefined|row:|number:/);
    await expect(panel.locator('.leaflet-container')).toBeVisible({timeout:30000});await panel.getByRole('button',{name:'Close map',exact:true}).click();await expect(page.locator('.provider-truck-map-panel')).toHaveCount(0);
    await expect(card.getByRole('button',{name:'View capacity on map',exact:true})).toBeFocused();
   }else await expect(card.getByRole('link',{name:'Ask about this vehicle',exact:true})).toHaveAttribute('href','#provider-contacts');
  }
 }
 expect(errors).toEqual([]);
});
