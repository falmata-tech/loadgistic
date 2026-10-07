import {openCapacityFilters,closeCapacityFilters} from './capacity-drawer-helper';
import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

async function assertReadableFeedback(page:any,withFeedback=false){
  await expect(page.locator('.public-feed-overlay')).toHaveCount(withFeedback?1:0);
  if(withFeedback)await page.locator('.public-feed-overlay').scrollIntoViewIfNeeded();
  await expect.poll(()=>page.evaluate(()=>{
    const modal=document.querySelector('.capacity-info-card');
    const drawer=modal?.getBoundingClientRect();
    const scroll=document.querySelector('.public-map-canvas')!.getBoundingClientRect();
    const canvas=document.querySelector('.public-map-canvas')!.getBoundingClientRect();
    const feedback=document.querySelector('.public-feed-overlay')?.getBoundingClientRect();
    const reachable=(element:Element)=>{const r=element.getBoundingClientRect();return element.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));};
    return {
      contained:!drawer||(drawer.top>=canvas.top&&drawer.bottom<=canvas.bottom+1&&drawer.left>=canvas.left&&drawer.right<=canvas.right),
      feedbackReadable:!feedback||(feedback.left>=scroll.left&&feedback.right<=scroll.right&&feedback.top>=scroll.top-1&&feedback.bottom<=scroll.bottom+1),
      retryReachable:[...document.querySelectorAll('.public-feed-overlay button')].every(reachable),
      closeReachable:!modal||reachable(document.querySelector('.capacity-info-card>header button')!),
      zoomInteractionCorrect:[...document.querySelectorAll('.leaflet-control-zoom a')].every(element=>reachable(element)===!modal),
      noOverflow:document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight,
    };
  })).toEqual({contained:true,feedbackReadable:true,retryReachable:true,closeReachable:true,zoomInteractionCorrect:true,noOverflow:true});
}

test('selected truck feedback stays readable through location denial and refresh recovery',async({page}: {page:any},info:any)=>{
  test.setTimeout(120_000);
  page.setDefaultTimeout(20_000);
  await page.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
    getCurrentPosition:(_success:unknown,failure:(error:object)=>void)=>failure({code:1,PERMISSION_DENIED:1,TIMEOUT:3,POSITION_UNAVAILABLE:2}),
  }}));
  const response=await page.request.get('/api/public/capacity');
  expect(response.ok()).toBe(true);
  const truck=(await response.json()).items[0];
  expect(truck).toBeTruthy();
  await page.goto(`/?truck=${encodeURIComponent(truck.id)}`,{waitUntil:'domcontentloaded'});
  await expect(page.locator('.map-info-bubble.truck')).toBeVisible({timeout:30000});
  await openCapacityFilters(page);await page.getByRole('button',{name:'Use my location',exact:true}).click();
  await expect(page.getByTestId('visitor-location-state')).toContainText('Location permission is blocked');
  await closeCapacityFilters(page);await page.locator('.capacity-truck-map-marker').first().click();
  const captures=info.outputPath('map-feedback');
  mkdirSync(captures,{recursive:true});
  const widths=info.project.name.includes('mobile')?[[760,900],[390,844],[320,640]]:[[761,900],[1024,768],[1280,720]];
  for(const [width,height] of widths){
    await page.setViewportSize({width,height});
    if(!await page.locator('.capacity-info-card').count())await page.locator('.map-info-bubble.truck').click();
    await expect(page.locator('.map-capacity-sheet')).toBeVisible();
    // This case reviews the truck summary, not the separate hover signal preview.
    await page.mouse.move(0,0);
    await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:15000});
    await assertReadableFeedback(page);
    await page.screenshot({path:path.join(captures,`selected-${width}.png`),scale:'css'});
  }
  await page.getByRole('button',{name:'Close map signal details'}).click();
  // Hold a real viewport request, then fail it. The selected record must survive
  // both states, and retry must return to the actual local capacity adapter.
  let release:(()=>void)|undefined;
  await page.route('**/api/public/capacity?**',async(route:any)=>{
    await new Promise<void>(resolve=>{release=resolve;});
    await route.fulfill({status:503,contentType:'application/json',body:'{"error":"Synthetic capacity outage"}'});
  });
  try{
    await page.locator('.leaflet-control-zoom-out').click();
    await page.mouse.move(0,0);
    await expect(page.getByTestId('capacity-feed-state')).toContainText('Loading trucks');
    await assertReadableFeedback(page,true);
    await expect.poll(()=>Boolean(release)).toBe(true);
    release!();
    await expect(page.getByTestId('capacity-feed-state')).toContainText('Capacity could not be loaded');
    await assertReadableFeedback(page,true);
    const retry=page.getByRole('button',{name:'Try again',exact:true});
    await expect(retry).toBeVisible();
    const box=await retry.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({path:path.join(captures,`${info.project.name}-refresh-error.png`),scale:'css'});
    await page.unroute('**/api/public/capacity?**');
    await retry.click();
    await page.mouse.move(0,0);
    await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:15000});
    await expect(page.getByTestId('visitor-location-state')).toContainText('Location permission is blocked');
    await assertReadableFeedback(page);

    await page.locator('.map-info-bubble.truck').click();
    await page.getByRole('button',{name:'Close map signal details'}).click();
    await expect(page.locator('.map-capacity-sheet')).toHaveCount(0);
    await openCapacityFilters(page);
    await expect(page.getByTestId('visitor-location-state')).toBeVisible();
    // Closing restores the mounted results and the retained location feedback.
    await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:15000});
    await expect(page.locator('.public-feed-overlay')).toHaveCount(0);
  }finally{
    release?.();
    await page.unroute('**/api/public/capacity?**');
  }
});
