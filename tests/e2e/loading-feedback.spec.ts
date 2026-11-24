import {openCapacityFilters,openCapacityFilterDialog} from './capacity-drawer-helper';
import {test,expect} from './browser-test';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

const folder=path.resolve('artifacts/loading-review-2026-09-21');

async function mapFrame(page:any){
  return page.evaluate(()=>{
    const map=document.querySelector('.public-map-shell')!.getBoundingClientRect();
    const footer=document.querySelector('body>.site-copyright')!.getBoundingClientRect();
    const navigation=document.querySelector('.public-mobile-nav');
    const bottom=navigation&&getComputedStyle(navigation).display!=='none'?navigation.getBoundingClientRect().top:innerHeight;
    return {mapHeight:map.height,footerTop:footer.top,mapClear:map.bottom<=footer.top+1,
      footerClear:footer.bottom<=bottom+1,noOverflow:document.documentElement.scrollHeight<=innerHeight+2};
  });
}

test('map loading placeholder resembles the map before its client code arrives',async({page}:{page:any},info:any)=>{
  test.setTimeout(60000);mkdirSync(folder,{recursive:true});
  let release:()=>void=()=>{};
  const ready=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/_next/static/chunks/*.js',async(route:any)=>{await ready;await route.continue();});
  try{
    await page.goto('/',{waitUntil:'commit'});
    const skeleton=page.locator('.surface-skeleton.skeleton-map:visible');
    await expect(skeleton).toBeVisible({timeout:30000});
    await expect(skeleton).toHaveAttribute('aria-busy','true');
    await expect(skeleton.locator('.skeleton-map-canvas')).toBeVisible();
    await expect(skeleton.locator('.skeleton-map-zoom')).toBeVisible();
    await expect(skeleton.locator('.skeleton-map-road')).toHaveCount(0);
    const bounds=await skeleton.boundingBox();
    expect(bounds!.height).toBeGreaterThan(250);
    const footer=await page.locator('body>.site-copyright').boundingBox();
    expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(footer!.y+1);
    await page.screenshot({path:path.join(folder,`${info.project.name}-map-skeleton.png`),scale:'css'});
    release();
    await expect(page.locator('.leaflet-container')).toBeVisible({timeout:30000});
    await expect(skeleton).toHaveCount(0);
  }finally{release();await page.unrouteAll({behavior:'wait'});}
});

test('map refresh uses a horizontal activity bar without hiding controls or announcing a percentage',async({page}:{page:any},info:any)=>{
  test.setTimeout(60000);mkdirSync(folder,{recursive:true});
  const initialCapacity=page.waitForResponse((r:any)=>new URL(r.url()).pathname==='/api/public/capacity');
  await page.goto('/');
  await initialCapacity;
  await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:30000});
  const originalMap=await page.locator('.leaflet-container').elementHandle();
  const frame=await mapFrame(page);
  expect(frame).toMatchObject({mapClear:true,footerClear:true,noOverflow:true});
  let release:()=>void=()=>{};let held=false;
  const ready=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/public/capacity?**',async(route:any)=>{held=true;await ready;await route.continue();});
  try{
    await page.locator('.leaflet-control-zoom-in').click();
    await expect.poll(()=>held).toBe(true);
    const feedback=page.getByTestId('capacity-feed-state');
    const track=feedback.locator('.loading-progress-track');
    await expect(track).toBeVisible();
    await expect(feedback.getByRole('status')).toContainText('Loading vehicles');
    await expect(feedback.locator('[aria-valuenow]')).toHaveCount(0);
    expect(await page.locator('.leaflet-container').evaluate((element:HTMLElement,original:HTMLElement)=>element===original,originalMap)).toBe(true);
    expect(await mapFrame(page)).toEqual(frame);
    const box=await track.boundingBox();expect(box.width).toBeGreaterThan(box.height*10);
    expect(await feedback.locator('.sr-only').evaluate((el:HTMLElement)=>getComputedStyle(el).position)).toBe('absolute');
    const activity=await feedback.boundingBox();
    for(const selector of ['.public-map-legend summary','.capacity-map-controls']){
      const control=await page.locator(selector).boundingBox();
      expect(activity.x+activity.width<=control.x||control.x+control.width<=activity.x||activity.y+activity.height<=control.y||control.y+control.height<=activity.y).toBe(true);
    }
    await page.screenshot({path:path.join(folder,`${info.project.name}-map-refresh.png`),scale:'css'});
    await page.emulateMedia({reducedMotion:'reduce'});
    expect(await track.locator('span').evaluate((el:HTMLElement)=>getComputedStyle(el).animationName)).toBe('none');
    await page.locator('.leaflet-control-zoom-out').click();
    release();await expect(feedback).toHaveCount(0,{timeout:30000});
  }finally{release();await page.unrouteAll({behavior:'wait'}).catch(()=>{});}
});

test('map failure, retry and empty responses retain the map and footer geometry',async({page}:{page:any},info:any)=>{
  test.setTimeout(60000);
  const initial=page.waitForResponse((response:any)=>new URL(response.url()).pathname==='/api/public/capacity');
  await page.goto('/');await initial;
  await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:30000});
  const map=page.locator('.leaflet-container');
  const originalMap=await map.elementHandle(),frame=await mapFrame(page);
  expect(frame).toMatchObject({mapClear:true,footerClear:true,noOverflow:true});
  let mode='failure',held=false,release:()=>void=()=>{};
  const ready=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/public/capacity?**',async(route:any)=>{
    if(mode==='failure'){held=true;await ready;await route.fulfill({status:503,json:{error:'Temporary outage'}});}
    else if(mode==='empty')await route.fulfill({status:200,json:{items:[],hasMore:false,nextCursor:null,pageSize:14}});
    else await route.continue();
  });
  async function stable(){
    expect(await map.evaluate((element:HTMLElement,original:HTMLElement)=>element===original,originalMap)).toBe(true);
    expect(await mapFrame(page)).toEqual(frame);
    await expect(page.locator('.capacity-map-controls')).toBeVisible();
  }
  try{
    await page.locator('.leaflet-control-zoom-in').click();await expect.poll(()=>held).toBe(true);
    await expect(page.getByTestId('capacity-feed-state').getByRole('status')).toBeVisible();await stable();
    release();
    const failure=page.getByTestId('capacity-feed-state');
    await expect(failure).toHaveAttribute('role','alert');
    await expect(failure).toContainText('Capacity could not be loaded.');await stable();
    mode='empty';await failure.getByRole('button',{name:'Try again',exact:true}).click();
    await expect(page.getByTestId('capacity-feed-state')).toHaveAttribute('role','status');
    await expect(page.getByTestId('capacity-feed-state')).toContainText('No matching available vehicles.');await stable();
    mode='success';
    const recovered=page.waitForResponse((response:any)=>new URL(response.url()).pathname==='/api/public/capacity'&&response.ok());
    await page.locator('.leaflet-control-zoom-out').click();await recovered;
    await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:30000});await stable();
    await page.screenshot({path:info.outputPath('map-recovered-stable-layout.png'),scale:'css'});
  }finally{release();await page.unrouteAll({behavior:'wait'}).catch(()=>{});}
});


test('search and place lookups show activity while preserving editable inputs',async({page}:{page:any},info:any)=>{
  test.setTimeout(60000);mkdirSync(folder,{recursive:true});
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible();
  let release:()=>void=()=>{};
  const ready=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/capacity-search?**',async(route:any)=>{await ready;await route.continue();});
  try{
    await openCapacityFilters(page);
    const input=page.locator('#capacity-market-search');
    await input.fill('Addis');await page.locator('.market-command-column').getByRole('button',{name:'Search',exact:true}).click();await openCapacityFilters(page);
    const loading=page.locator('.capacity-result-panel .loading-indicator');
    await expect(loading.locator('.loading-progress-track')).toBeVisible();
    await expect(loading.getByText('Finding transporters',{exact:true})).toHaveClass('sr-only');
    await expect(input).toBeEditable();
    await page.screenshot({path:path.join(folder,`${info.project.name}-search-loading.png`),scale:'css'});
    const completed=page.waitForResponse((response:any)=>{const url=new URL(response.url());return url.pathname==='/api/capacity-search'&&url.searchParams.get('q')==='Addis';},{timeout:20000});
    release();expect((await completed).ok()).toBe(true);await expect(loading).toHaveCount(0);
    await input.press('Escape');
  }finally{release();await page.unrouteAll({behavior:'wait'});}
  let releasePlace:()=>void=()=>{};
  const placeReady=new Promise<void>(resolve=>{releasePlace=resolve;});
  await page.route('**/api/places?q=**',async(route:any)=>{await placeReady;await route.continue();});
  try{
    await openCapacityFilterDialog(page,'availability');
    await page.getByRole('button',{name:'Route',exact:true}).click();
    const origin=page.locator('#capacity-route-origin');
    await origin.fill('Addis');
    const track=page.locator('.place-combobox .loading-progress-track');
    await expect(track).toBeVisible();await expect(origin).toBeEditable();
    const bar=await track.boundingBox();const field=await origin.boundingBox();
    expect(bar.y).toBeGreaterThan(field.y+field.height/2);
    expect(bar.y+bar.height).toBeLessThanOrEqual(field.y+field.height);
    await page.screenshot({path:path.join(folder,`${info.project.name}-place-loading.png`),scale:'css'});
    releasePlace();await expect(track).toHaveCount(0);
  }finally{releasePlace();await page.unrouteAll({behavior:'wait'});}
});
