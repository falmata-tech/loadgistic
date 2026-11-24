import {test,expect} from './browser-test';
import {closeCapacityFilters} from './capacity-drawer-helper';
import {randomUUID} from 'node:crypto';
import type {Response} from 'playwright-core';

test('public entry keeps ordinary vehicle markers round with compact location badges',async({page},info)=>{
 test.setTimeout(90_000);
 await page.goto('/',{waitUntil:'domcontentloaded',timeout:45_000});
 await expect(page.locator('.capacity-map-cluster').first()).toBeVisible({timeout:30_000});
 const readMarkers=()=>page.evaluate(()=>{
  return [...document.querySelectorAll<HTMLElement>('.capacity-truck-map-marker:not(.selected) .vehicle-marker-image')].flatMap(frame=>{
   const badge=frame.querySelector<HTMLElement>(':scope > [title]');
   const icon=badge?.querySelector('svg');
   const picture=frame.querySelector('.vehicle-marker-content');
   if(!icon||!badge||!picture||!frame.offsetWidth)return [];
   const shape=frame.getBoundingClientRect(),image=picture.getBoundingClientRect();
   const badgeBox=badge.getBoundingClientRect(),iconBox=icon.getBoundingClientRect();
   const percentage=frame.querySelector('.vehicle-marker-space')?.getBoundingClientRect();
   return [{
    roundFrame:Math.abs(shape.width-shape.height)<=1,
    roundPicture:Math.abs(image.width-image.height)<=1,
    badgePosition:getComputedStyle(badge).position,
    badgeSize:[badgeBox.width,badgeBox.height],
    iconSize:[iconBox.width,iconBox.height],
    intrinsicIconSize:[icon.getAttribute('width'),icon.getAttribute('height')],
    percentageAttached:!percentage||percentage.right<=shape.right+4&&percentage.bottom<=shape.bottom+2,
   }];
  });
 });
 const check=async(name:string)=>{
  await expect(page.locator('.capacity-truck-map-marker.selected')).toHaveCount(0);
  await expect.poll(async()=>(await readMarkers()).length,{timeout:30_000}).toBeGreaterThan(0);
  const markers=await readMarkers();
  expect(markers.length).toBeGreaterThan(0);
  for(const marker of markers){
   expect(marker).toEqual({
    roundFrame:true,roundPicture:true,badgePosition:'absolute',
    badgeSize:[22,22],iconSize:[14,14],intrinsicIconSize:['14','14'],percentageAttached:true,
   });
  }
  await page.screenshot({path:info.outputPath(name+'.png'),scale:'css'});
 };
 await check('ordinary-capacity-markers');
 const camera=page.locator('.leaflet-proxy');
 const before=await camera.getAttribute('style');
 await page.locator('.leaflet-control-zoom-in').click();
 await expect.poll(()=>camera.getAttribute('style')).not.toBe(before);
 await expect(page.locator('.leaflet-zoom-anim')).toHaveCount(0);
 await check('ordinary-capacity-markers-after-zoom');
});

test('two colocated vehicles zoom in before offering a picker with ordinary truck details',async({page}:{page:any},info:any)=>{
 test.setTimeout(90_000);
 const response=await page.request.get('/api/public/capacity');
 expect(response.status()).toBe(200);
 const result=await response.json();
 const original=result.items?.find((item:{location_lat:number|null;location_lng:number|null})=>item.location_lat!=null&&item.location_lng!=null);
 expect(original,'The local demo must contain one located vehicle').toBeTruthy();
 const names=['Synthetic overlap one','Synthetic overlap two'];
 const ids=names.map(()=>randomUUID());
 let anchor:{lat:number;lng:number}|null=null;
 const viewportWidths:number[]=[];
 let releaseSynthetic:()=>void=()=>{};
 const syntheticGate=new Promise<void>(resolve=>{releaseSynthetic=resolve;});
 await page.route('**/api/public/capacity?**',(route:any)=>{
  const bounds=new URL(route.request().url()).searchParams.get('viewport')?.split(',').map(Number);
  if(!bounds||bounds.length!==4||bounds.some((value:number)=>!Number.isFinite(value)))throw Error('VISIBLE_VIEWPORT_REQUIRED');
  viewportWidths.push(bounds[2]-bounds[0]);
  if(!anchor){
   anchor={lat:(bounds[1]+bounds[3])/2,lng:(bounds[0]+bounds[2])/2};
  }
  const vehicles=names.map((provider_name,index)=>({...original,id:ids[index],provider_name,location_lat:anchor!.lat,location_lng:anchor!.lng,current_signal_geometry_visible:true}));
  return syntheticGate.then(()=>route.fulfill({json:{items:vehicles,hasMore:false,nextCursor:null}}));
 });
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await closeCapacityFilters(page);
 // The server initially renders real demo vehicles. Wait until the synthetic
 // viewport response replaces that marker before exercising cluster taps.
 const cluster=page.locator('.capacity-map-cluster:visible').first();
 await expect(cluster).toBeVisible();
 const initialCluster=await cluster.elementHandle();
 const syntheticResponse=page.waitForResponse((response:Response)=>new URL(response.url()).pathname==='/api/public/capacity'&&response.ok());
 releaseSynthetic();
 await syntheticResponse;
 await expect.poll(()=>initialCluster!.evaluate((element:Element)=>element.isConnected)).toBe(false);
 await expect(cluster).toBeVisible();
 const originalWidth=viewportWidths.at(-1)!;
 await cluster.click();
 await expect.poll(()=>viewportWidths.at(-1)!).toBeLessThan(originalWidth);
 const picker=page.locator('.capacity-cluster-picker:visible');
 await expect(picker).toHaveCount(0);
 await expect(page.locator('.capacity-fan-connector,.capacity-truck-map-marker.spread')).toHaveCount(0);
 const zoomIn=page.locator('.leaflet-control-zoom-in');
 for(let attempt=0;attempt<8&&!(await zoomIn.evaluate((element:HTMLElement)=>element.classList.contains('leaflet-disabled')));attempt+=1){
  await cluster.click();
  await expect(picker).toHaveCount(0);
  await expect(page.locator('.capacity-fan-connector,.capacity-truck-map-marker.spread')).toHaveCount(0);
 }
 await expect(zoomIn).toHaveClass(/leaflet-disabled/);
 await cluster.focus();
 await page.keyboard.press('Space');
 await expect(picker).toBeVisible();
 await expect(picker.getByRole('button',{name:/Synthetic overlap/})).toHaveCount(2);
 await page.screenshot({path:info.outputPath('coincident-truck-picker.png'),scale:'css'});
 await picker.getByRole('button',{name:/Synthetic overlap one/}).click();
 await expect(page.locator('.capacity-truck-map-marker.selected[aria-label*="Synthetic overlap one"]')).toBeVisible();
 await page.locator('.capacity-truck-exit').click();
 await expect(cluster).toBeVisible();
 await expect(zoomIn).toHaveClass(/leaflet-disabled/);
 await expect(cluster.locator('span').first()).toHaveText('2');
 await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0);
 if(info.project.name==='mobile-chromium')await cluster.tap();else await cluster.click();
 await expect(picker).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(picker).toHaveCount(0);
});

test('a larger colocated group keeps a bounded, selectable fallback on phone and desktop',async({page}:{page:any},info:any)=>{
 test.setTimeout(90_000);
 const phone=info.project.name==='mobile-chromium',viewport={width:phone?320:1280,height:phone?640:800};
 await page.setViewportSize(viewport);
 const response=await page.request.get('/api/public/capacity');
 expect(response.status()).toBe(200);
 const result=await response.json();
 const original=result.items?.find((item:{location_lat:number|null;location_lng:number|null})=>item.location_lat!=null&&item.location_lng!=null);
 expect(original,'The local demo must contain one located vehicle').toBeTruthy();
 const ids=Array.from({length:5},()=>randomUUID());
 let anchor:{lat:number;lng:number}|null=null;
 await page.route('**/api/public/capacity?**',(route:any)=>{
  if(!anchor){
   const bounds=new URL(route.request().url()).searchParams.get('viewport')?.split(',').map(Number);
   if(!bounds||bounds.length!==4||bounds.some(value=>!Number.isFinite(value)))throw Error('VISIBLE_VIEWPORT_REQUIRED');
   anchor={lat:(bounds[1]+bounds[3])/2,lng:(bounds[0]+bounds[2])/2};
  }
  const vehicles=ids.map((id,index)=>({...original,id,provider_name:`Synthetic fleet ${index+1}`,location_lat:anchor!.lat,location_lng:anchor!.lng,current_signal_geometry_visible:true}));
  return route.fulfill({json:{items:vehicles,hasMore:false,nextCursor:null}});
 });
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await closeCapacityFilters(page);
 await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:30000});
 const picker=page.locator('.capacity-cluster-picker:visible');
 for(let attempt=0;attempt<8&&await picker.count()===0;attempt+=1){
  await expect(page.locator('.capacity-map-cluster:visible').first()).toBeVisible();
  await page.locator('.capacity-map-cluster:visible').first().click();
  await expect(page.locator('.leaflet-zoom-anim')).toHaveCount(0);
  await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:30000});
 }
 await expect(picker).toBeVisible();
 const options=picker.locator('.capacity-cluster-picker-content button');
 await expect(options).toHaveCount(5);
 await expect(page.locator('.public-map-legend')).toBeHidden();
 await expect.poll(async()=>{const box=await picker.boundingBox(),filter=await page.locator('.capacity-filter-trigger').boundingBox();return box&&filter?box.y-filter.y-filter.height:-1000;},{timeout:10000}).toBeGreaterThanOrEqual(-1);
 const bounds=await picker.boundingBox();
 const filterBounds=await page.locator('.capacity-filter-trigger').boundingBox();
 const mapBounds=await page.locator('.public-map-canvas').boundingBox();
 expect(bounds).toBeTruthy();
 expect(filterBounds).toBeTruthy();
 expect(mapBounds).toBeTruthy();
 expect(bounds!.x).toBeGreaterThanOrEqual(0);
 expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(viewport.width);
 expect(bounds!.y).toBeGreaterThanOrEqual(filterBounds!.y+filterBounds!.height-1);
 expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(mapBounds!.y+mapBounds!.height-15);
 await page.screenshot({path:info.outputPath(`large-group-${viewport.width}.png`),scale:'css'});
 await options.last().click();
 await expect(page.locator('.capacity-truck-map-marker.selected')).toBeVisible();
});
