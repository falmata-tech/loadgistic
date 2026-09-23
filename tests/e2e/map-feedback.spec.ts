import {openCapacityFilters,closeCapacityFilters} from './capacity-drawer-helper';
import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

async function assertReadableFeedback(page:any,withFeedback=false){
  await expect(page.locator('.public-feed-overlay')).toHaveCount(withFeedback?1:0);
  await expect.poll(()=>page.evaluate(()=>{
    const feedback=document.querySelector('.public-feed-overlay')?.getBoundingClientRect();
    const sheet=document.querySelector('.map-capacity-sheet')!.getBoundingClientRect();
    const canvas=document.querySelector('.public-map-canvas')!.getBoundingClientRect();
    const handle=document.querySelector('.capacity-drawer-handle')!.getBoundingClientRect();
    const chat=document.querySelector('.public-chat-launcher')!.getBoundingClientRect();
    const overlaps=(a:DOMRect,b:DOMRect)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
    return {
      clearIdentityAndActions:[...document.querySelectorAll('.map-truck-identity,.map-focus-exit,.map-capacity-sheet>.public-card-actions')].every(element=>!feedback||!overlaps(feedback,element.getBoundingClientRect())),
      clearFilterHandle:[...document.querySelectorAll('.map-truck-identity,.map-focus-exit,.map-capacity-sheet>.public-card-actions')].every(element=>!overlaps(handle,element.getBoundingClientRect())),
      contained:sheet.top>=canvas.top&&sheet.bottom<=canvas.bottom&&sheet.left>=canvas.left&&sheet.right<=canvas.right,
      feedbackReadable:!feedback||(feedback.left>=canvas.left&&feedback.right<=canvas.right&&feedback.top>=canvas.top&&feedback.bottom<=canvas.bottom),
      retryReachable:[...document.querySelectorAll('.public-feed-overlay button')].every(element=>{const rect=element.getBoundingClientRect();return !overlaps(chat,rect)&&element.contains(document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2));}),
      chatClearOfHeader:[...document.querySelectorAll('.public-header a')].every(element=>!overlaps(chat,element.getBoundingClientRect())),
      zoomReachable:[...document.querySelectorAll('.leaflet-control-zoom a')].every(element=>{const rect=element.getBoundingClientRect();return element.contains(document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2));}),
      noOverflow:document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight,
    };
  })).toEqual({clearIdentityAndActions:true,clearFilterHandle:true,contained:true,feedbackReadable:true,retryReachable:true,chatClearOfHeader:true,zoomReachable:true,noOverflow:true});
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
  await expect(page.locator('.map-capacity-sheet')).toBeVisible();
  await expect(page.getByTestId('visitor-location-state')).toContainText('Location permission is blocked');
  const captures=path.resolve('artifacts/map-feedback-2026-09-14');
  mkdirSync(captures,{recursive:true});
  const widths=info.project.name.includes('mobile')?[[760,900],[390,844],[320,640]]:[[761,900],[1024,768],[1280,720]];
  for(const [width,height] of widths){
    await page.setViewportSize({width,height});
    await openCapacityFilters(page);
    await expect(page.getByTestId('visitor-location-state')).toBeVisible();
    await closeCapacityFilters(page);
    await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:15000});
    await assertReadableFeedback(page);
    await page.screenshot({path:path.join(captures,`selected-${width}.png`),scale:'css'});
  }
  // Hold a real viewport request, then fail it. The selected record must survive
  // both states, and retry must return to the actual local capacity adapter.
  let release:(()=>void)|undefined;
  await page.route('**/api/public/capacity?**',async(route:any)=>{
    await new Promise<void>(resolve=>{release=resolve;});
    await route.fulfill({status:503,contentType:'application/json',body:'{"error":"Synthetic capacity outage"}'});
  });
  try{
    await page.locator('.leaflet-control-zoom-out').click();
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
    await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:15000});
    await expect(page.getByTestId('visitor-location-state')).toContainText('Location permission is blocked');
    await assertReadableFeedback(page);
    await page.getByRole('button',{name:'Ask Loadgistic',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Ask Loadgistic'})).toBeVisible();
    await page.getByRole('button',{name:'Minimize chat'}).click();
    await page.getByRole('button',{name:'Close truck summary'}).click();
    await expect(page.locator('.map-capacity-sheet')).toHaveCount(0);
    await openCapacityFilters(page);
    await expect(page.getByTestId('visitor-location-state')).toBeVisible();
    // Closing a query-selected truck remounts the unfiltered feed and loads it.
    await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:15000});
    await expect(page.locator('.public-feed-overlay')).toHaveCount(0);
  }finally{
    release?.();
    await page.unroute('**/api/public/capacity?**');
  }
});
