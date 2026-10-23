import {openCapacityFilters,closeCapacityFilters} from './capacity-drawer-helper';
import {test,expect} from './browser-test';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

async function selectVisibleVehicle(page:any){
  // Explore the ordinary map so viewport changes continue to load capacity.
  // A fixed truck deep link intentionally suppresses those refresh requests.
  for(let attempt=0;attempt<7;attempt++){
    await expect(page.locator('.capacity-truck-map-marker,.capacity-map-cluster').first()).toBeVisible({timeout:15000});
    const markers=page.locator('.capacity-truck-map-marker');
    const index=await markers.evaluateAll((elements:Element[])=>elements.findIndex(element=>{
      const rect=element.getBoundingClientRect(),map=document.querySelector('.public-map-canvas')!.getBoundingClientRect();
      const x=rect.left+rect.width/2,y=rect.top+rect.height/2,hit=document.elementFromPoint(x,y);
      return x>=map.left&&x<=map.right&&y>=map.top&&y<=map.bottom&&(hit===element||Boolean(hit&&element.contains(hit)));
    }));
    if(index>=0){await markers.nth(index).click();return;}
    const picker=page.locator('.capacity-cluster-picker-content button');
    if(await picker.count()){await picker.first().click();return;}
    await page.locator('.capacity-map-cluster').first().click();
  }
  throw Error('VISIBLE_CAPACITY_VEHICLE_REQUIRED');
}

async function assertReadableFeedback(page:any,withFeedback=false){
  await expect(page.locator('.public-feed-overlay')).toHaveCount(withFeedback?1:0);
  if(withFeedback)await page.locator('.public-feed-overlay').scrollIntoViewIfNeeded();
  await expect.poll(()=>page.evaluate(()=>{
    const modal=document.querySelector('.capacity-info-card');
    const dialog=modal?.getBoundingClientRect();
    const scroll=document.querySelector('.public-map-canvas')!.getBoundingClientRect();
    const feedback=document.querySelector('.public-feed-overlay')?.getBoundingClientRect();
    const reachable=(element:Element)=>{const r=element.getBoundingClientRect();return element.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));};
    return {
      dialogWithinViewport:!dialog||(dialog.top>=15&&dialog.bottom<=innerHeight-15&&dialog.left>=15&&dialog.right<=innerWidth-15),
      feedbackReadable:!feedback||(feedback.left>=scroll.left&&feedback.right<=scroll.right&&feedback.top>=scroll.top-1&&feedback.bottom<=scroll.bottom+1),
      retryReachable:[...document.querySelectorAll('.public-feed-overlay button')].every(reachable),
      closeReachable:!modal||reachable(document.querySelector('.capacity-info-card>header button')!),
      zoomInteractionCorrect:[...document.querySelectorAll('.leaflet-control-zoom a')].every(element=>reachable(element)===!modal),
      noOverflow:document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight,
    };
  })).toEqual({dialogWithinViewport:true,feedbackReadable:true,retryReachable:true,closeReachable:true,zoomInteractionCorrect:true,noOverflow:true});
}

test('selected truck feedback stays readable through location denial and refresh recovery',async({page}: {page:any},info:any)=>{
  test.setTimeout(120_000);
  page.setDefaultTimeout(20_000);
  await page.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
    getCurrentPosition:(_success:unknown,failure:(error:object)=>void)=>failure({code:1,PERMISSION_DENIED:1,TIMEOUT:3,POSITION_UNAVAILABLE:2}),
  }}));
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await closeCapacityFilters(page);await selectVisibleVehicle(page);
  await expect(page.locator('.map-info-bubble.truck')).toBeVisible({timeout:30000});
  await openCapacityFilters(page);await page.getByRole('button',{name:'Use my location',exact:true}).click();
  await expect(page.getByTestId('visitor-location-state')).toContainText('Location permission is blocked');
  await closeCapacityFilters(page);await selectVisibleVehicle(page);
  const selectedTitle=await page.locator('.capacity-truck-map-marker.selected').getAttribute('title');expect(selectedTitle).toBeTruthy();
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
    await expect(page.getByTestId('capacity-feed-state')).toContainText('Loading vehicles');
    await assertReadableFeedback(page,true);
    await expect.poll(()=>Boolean(release)).toBe(true);
    release!();
    await expect(page.getByTestId('capacity-feed-state')).toContainText('Capacity could not be loaded');
    await expect(page.locator('.capacity-truck-map-marker.selected')).toHaveAttribute('title',selectedTitle!);
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
    await expect(page.locator('.capacity-truck-map-marker.selected')).toHaveAttribute('title',selectedTitle!);
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
