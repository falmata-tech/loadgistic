import {test,expect} from './browser-test';
import {closeCapacityFilters} from './capacity-drawer-helper';
import {randomUUID} from 'node:crypto';
import type {Response} from 'playwright-core';

test('two colocated vehicles separate on the map and each opens its ordinary details',async({page}:{page:any},info:any)=>{
 test.setTimeout(90_000);
 const response=await page.request.get('/api/public/capacity');
 expect(response.status()).toBe(200);
 const result=await response.json();
 const original=result.items?.find((item:{location_lat:number|null;location_lng:number|null})=>item.location_lat!=null&&item.location_lng!=null);
 expect(original,'The local demo must contain one located vehicle').toBeTruthy();
 const names=['Synthetic overlap one','Synthetic overlap two'];
 const ids=names.map(()=>randomUUID());
 let anchor:{lat:number;lng:number}|null=null;
 let releaseSynthetic:()=>void=()=>{};
 const syntheticGate=new Promise<void>(resolve=>{releaseSynthetic=resolve;});
 await page.route('**/api/public/capacity?**',(route:any)=>{
  if(!anchor){
   const bounds=new URL(route.request().url()).searchParams.get('viewport')?.split(',').map(Number);
   if(!bounds||bounds.length!==4||bounds.some(value=>!Number.isFinite(value)))throw Error('VISIBLE_VIEWPORT_REQUIRED');
   anchor={lat:(bounds[1]+bounds[3])/2,lng:(bounds[0]+bounds[2])/2};
  }
  const vehicles=names.map((provider_name,index)=>({...original,id:ids[index],provider_name,location_lat:anchor!.lat,location_lng:anchor!.lng,current_signal_geometry_visible:true}));
  return syntheticGate.then(()=>route.fulfill({json:{items:vehicles,hasMore:false,nextCursor:null}}));
 });
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await closeCapacityFilters(page);
 // The server initially renders real demo vehicles. Wait until the synthetic
 // viewport response replaces that marker before exercising the fan.
 const cluster=page.locator('.capacity-map-cluster:visible').first();
 await expect(cluster).toBeVisible();
 const initialCluster=await cluster.elementHandle();
 const syntheticResponse=page.waitForResponse((response:Response)=>new URL(response.url()).pathname==='/api/public/capacity'&&response.ok());
 releaseSynthetic();
 await syntheticResponse;
 await expect.poll(()=>initialCluster!.evaluate((element:Element)=>element.isConnected)).toBe(false);
 await expect(cluster).toBeVisible();
 await cluster.click();
 const spread=page.locator('.capacity-truck-map-marker.spread');
 await expect(spread).toHaveCount(2);
 await expect(page.locator('.capacity-fan-connector')).toHaveCount(2);
 await expect(page.locator('.capacity-cluster-picker')).toHaveCount(0);
 const boxes=await spread.evaluateAll((nodes:HTMLElement[])=>nodes.map(node=>{const box=node.getBoundingClientRect();return {left:box.left,right:box.right,top:box.top,bottom:box.bottom};}));
 expect(boxes[0].right<=boxes[1].left||boxes[1].right<=boxes[0].left||boxes[0].bottom<=boxes[1].top||boxes[1].bottom<=boxes[0].top).toBe(true);
 await page.locator('.capacity-truck-map-marker.spread[title*="Synthetic overlap one"]').click();
 await expect(page.locator('.capacity-truck-map-marker.selected[title*="Synthetic overlap one"]')).toBeVisible();
 await expect(page.locator('.capacity-truck-map-marker.spread')).toHaveCount(0);
 await page.locator('.capacity-truck-exit').click();
 await expect(page.locator('.capacity-map-cluster:visible').first()).toBeVisible();
 await page.locator('.capacity-map-cluster:visible').first().click();
 await expect(spread).toHaveCount(2);
 await page.keyboard.press('Escape');
 await expect(spread).toHaveCount(0);
 await page.locator('.capacity-map-cluster:visible').first().click();
 await expect(spread).toHaveCount(2);
 await page.locator('.leaflet-control-zoom-out').click();
 await expect(spread).toHaveCount(0);
 if(info.project.name==='mobile-chromium'){
  await page.setViewportSize({width:320,height:640});
  await expect(page.locator('.capacity-map-cluster:visible').first()).toBeVisible();
  await page.locator('.capacity-map-cluster:visible').first().click();
  await expect(spread).toHaveCount(2);
  await page.screenshot({path:info.outputPath('vehicle-fan-320.png'),scale:'css'});
 }
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
