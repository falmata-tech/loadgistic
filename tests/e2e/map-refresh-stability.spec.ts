import {test,expect} from './browser-test';
import type {Page} from 'playwright-core';

test('visible Capacity map reloads saved signals after a minute without losing its map',async({page}:{page:Page})=>{
 await page.clock.install();
 const firstWindow=page.waitForResponse(async response=>new URL(response.url()).pathname==='/api/public/capacity'&&response.ok()&&!(await response.json()).hasMore,{timeout:30000});
 await page.goto('/');await firstWindow;
 await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:30000});
 const map=page.locator('.leaflet-container'),instance=await map.elementHandle();
 const refreshed=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/public/capacity'&&response.ok(),{timeout:15000});
 await page.clock.fastForward(60000);
 await refreshed;
 expect(await instance!.evaluate(element=>element.isConnected)).toBe(true);
 await expect(map).toBeVisible();
});

test('paginated refresh preserves markers and camera until the replacement finishes',async({page}:{page:Page},info:{outputPath:(name:string)=>string})=>{
 test.setTimeout(90000);
 const initialViewport=page.waitForResponse(response=>{
  const url=new URL(response.url());
  return url.pathname==='/api/public/capacity'&&url.searchParams.has('viewport')&&response.ok();
 },{timeout:30000});
 await page.goto('/');
 await initialViewport;
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
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(()=>started).toBe(true);
  await expect(markers.first()).toBeVisible();
  const count=await markers.count();expect(count).toBeGreaterThan(0);
  const camera=await page.locator('.leaflet-map-pane').evaluate(el=>(el as HTMLElement).style.transform);
  releaseFirst();await expect.poll(()=>continued).toBe(true);
  await expect(markers).toHaveCount(count);
  await expect(page.getByTestId('capacity-feed-state')).toContainText('Loading vehicles');
  expect(await instance!.evaluate(el=>el.isConnected)).toBe(true);
  expect(await page.locator('.leaflet-map-pane').evaluate(el=>(el as HTMLElement).style.transform)).toBe(camera);
  await page.screenshot({path:info.outputPath('map-refresh-retains-trucks.png')});
  releaseLast();
  await expect(markers).toHaveCount(0); // Successful authoritative empty result.
  await expect(page.getByTestId('capacity-feed-state')).toContainText('No matching available vehicles.');
  // Observe beyond the 350ms viewport debounce: rendering must not start a loop.
  await page.waitForTimeout(900);
  expect(requests,JSON.stringify(windows)).toBe(2);
  expect(await instance!.evaluate(el=>el.isConnected)).toBe(true);
  expect(await page.locator('.leaflet-map-pane').evaluate(el=>(el as HTMLElement).style.transform)).toBe(camera);
 }finally{releaseFirst();releaseLast();await page.unroute('**/api/public/capacity?**');}
});
