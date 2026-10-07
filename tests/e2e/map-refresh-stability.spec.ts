import {test,expect} from '@playwright/test';
import type {Page} from 'playwright-core';

test('viewport pagination preserves markers and camera until the replacement finishes',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(90000);
 const initialWindow=page.waitForResponse(async response=>new URL(response.url()).pathname==='/api/public/capacity'&&response.ok()&&!(await response.json()).hasMore,{timeout:30000});
 await page.goto('/');await initialWindow;
 const markers=page.locator('.capacity-map-cluster,.capacity-truck-map-marker');
 await expect(markers.first()).toBeVisible({timeout:30000});
 await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:30000});
 const map=page.locator('.leaflet-container');
 const instance=await map.elementHandle();
 let releaseFirst:()=>void=()=>{},releaseLast:()=>void=()=>{};
 let started=false,continued=false,requests=0;
 const windows:string[]=[];
 const firstGate=new Promise<void>(resolve=>{releaseFirst=resolve;});
 const lastGate=new Promise<void>(resolve=>{releaseLast=resolve;});
 // Simulate a slow paginated refresh, while leaving the initial real local map
 // and its records intact. Empty intermediate pages must not blank the map.
 await page.route('**/api/public/capacity?**',async route=>{
  requests++;windows.push(new URL(route.request().url()).search);
  if(new URL(route.request().url()).searchParams.has('cursor')){
   continued=true;await lastGate;
   await route.fulfill({json:{items:[],hasMore:false,nextCursor:null,pageSize:60}});
  }else{
   started=true;await firstGate;
   await route.fulfill({json:{items:[],hasMore:true,nextCursor:'test-delayed-page',pageSize:60}});
  }
 });
 try{
  await page.locator('.leaflet-control-zoom-in').click();
  await expect.poll(()=>started).toBe(true);
  await expect(markers.first()).toBeVisible();
  const count=await markers.count();expect(count).toBeGreaterThan(0);
  const camera=await page.locator('.leaflet-map-pane').evaluate(el=>(el as HTMLElement).style.transform);
  releaseFirst();await expect.poll(()=>continued).toBe(true);
  await expect(markers).toHaveCount(count);
  await expect(page.getByTestId('capacity-feed-state')).toContainText('Loading trucks');
  expect(await instance!.evaluate(el=>el.isConnected)).toBe(true);
  expect(await page.locator('.leaflet-map-pane').evaluate(el=>(el as HTMLElement).style.transform)).toBe(camera);
  await page.screenshot({path:info.outputPath('map-refresh-retains-trucks.png')});
  releaseLast();
  await expect(markers).toHaveCount(0); // Successful authoritative empty result.
  await expect(page.getByTestId('capacity-feed-state')).toContainText('No truck signals');
  // Observe beyond the 350ms viewport debounce: rendering must not start a loop.
  await page.waitForTimeout(900);
  expect(requests,JSON.stringify(windows)).toBe(2);
  expect(await instance!.evaluate(el=>el.isConnected)).toBe(true);
  expect(await page.locator('.leaflet-map-pane').evaluate(el=>(el as HTMLElement).style.transform)).toBe(camera);
 }finally{releaseFirst();releaseLast();await page.unroute('**/api/public/capacity?**');}
});
