import {openCapacityFilters} from './capacity-drawer-helper';
import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

const folder=path.resolve('artifacts/loading-review-2026-09-21');

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
    await page.screenshot({path:path.join(folder,`${info.project.name}-map-skeleton.png`),scale:'css'});
    release();
    await expect(page.locator('.leaflet-container')).toBeVisible({timeout:30000});
    await expect(skeleton).toHaveCount(0);
  }finally{release();await page.unrouteAll({behavior:'wait'});}
});

test('map refresh uses a horizontal activity bar without hiding controls or announcing a percentage',async({page}:{page:any},info:any)=>{
  test.setTimeout(60000);mkdirSync(folder,{recursive:true});
  await page.goto('/');
  await page.waitForResponse((r:any)=>new URL(r.url()).pathname==='/api/public/capacity');
  await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:30000});
  let release:()=>void=()=>{};let held=false;
  const ready=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/public/capacity?**',async(route:any)=>{held=true;await ready;await route.continue();});
  try{
    await page.locator('.leaflet-control-zoom-in').click();
    await expect.poll(()=>held).toBe(true);
    const feedback=page.getByTestId('capacity-feed-state');
    const track=feedback.locator('.loading-progress-track');
    await expect(track).toBeVisible();
    await expect(feedback.getByRole('status')).toContainText('Loading trucks');
    await expect(feedback.locator('[aria-valuenow]')).toHaveCount(0);
    const box=await track.boundingBox();expect(box.width).toBeGreaterThan(box.height*10);
    expect(await feedback.locator('.sr-only').evaluate((el:HTMLElement)=>getComputedStyle(el).position)).toBe('absolute');
    const activity=await feedback.boundingBox();
    for(const selector of ['.public-map-legend summary','.public-chat-launcher']){
      const control=await page.locator(selector).boundingBox();
      expect(activity.x+activity.width<=control.x||control.x+control.width<=activity.x||activity.y+activity.height<=control.y||control.y+control.height<=activity.y).toBe(true);
    }
    await page.screenshot({path:path.join(folder,`${info.project.name}-map-refresh.png`),scale:'css'});
    await page.emulateMedia({reducedMotion:'reduce'});
    expect(await track.locator('span').evaluate((el:HTMLElement)=>getComputedStyle(el).animationName)).toBe('none');
    await page.locator('.leaflet-control-zoom-out').click();
    release();await expect(feedback).toHaveCount(0,{timeout:30000});
  }finally{release();await page.unrouteAll({behavior:'wait'});}
});


test('search and place lookups show activity while preserving editable inputs',async({page}:{page:any},info:any)=>{
  test.setTimeout(60000);mkdirSync(folder,{recursive:true});
  await page.goto('/');
  await expect(page.locator('.leaflet-container')).toBeVisible();
  let release:()=>void=()=>{};
  const ready=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/public/capacity?q=**',async(route:any)=>{await ready;await route.continue();});
  try{
    await openCapacityFilters(page);
    const input=page.locator('#capacity-market-search');
    await input.fill('Addis');
    const loading=page.locator('.capacity-suggestion-loading');
    await expect(loading.locator('.loading-progress-track')).toBeVisible();
    await expect(loading.getByText('Finding trucks…')).toHaveClass('sr-only');
    await expect(input).toBeEditable();
    await page.screenshot({path:path.join(folder,`${info.project.name}-search-loading.png`),scale:'css'});
    const completed=page.waitForResponse((response:any)=>{const url=new URL(response.url());return url.pathname==='/api/public/capacity'&&url.searchParams.get('q')==='Addis';},{timeout:20000});
    release();expect((await completed).ok()).toBe(true);await expect(loading).toHaveCount(0);
    await input.press('Escape');
  }finally{release();await page.unrouteAll({behavior:'wait'});}
  let releasePlace:()=>void=()=>{};
  const placeReady=new Promise<void>(resolve=>{releasePlace=resolve;});
  await page.route('**/api/places?q=**',async(route:any)=>{await placeReady;await route.continue();});
  try{
    await openCapacityFilters(page);
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
