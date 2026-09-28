import {test,expect} from '@playwright/test';
import type {Browser,Page} from 'playwright-core';
import {readFileSync} from 'node:fs';
import {openCapacityFilters,closeCapacityFilters} from './capacity-drawer-helper';
const heading='Find truck capacity in Ethiopia';

test('introduction stays above a usable map across screen sizes and languages',async({page}:{page:Page},info:{project:{name:string};outputPath:(name:string)=>string})=>{
 test.setTimeout(150000);
 await page.goto('/');await expect(page.locator('.language-picker select:visible')).toBeEnabled();
 const mobile=info.project.name.includes('mobile');
 const sizes=mobile?[[320,640],[390,844],[760,900]]:[[761,900],[1024,768],[1280,800],[1920,1080]];
 for(const [width,height] of sizes){
  await page.setViewportSize({width,height});await page.locator('main').evaluate(el=>el.scrollTop=0);
  await expect(page.getByRole('heading',{level:1,name:heading,exact:true})).toBeVisible();
  await expect(page.locator('.public-app-context')).toHaveCount(0);
  await expect(page.locator('.leaflet-container')).toBeVisible();
  const intro=await page.locator('.market-introduction').boundingBox(),map=await page.locator('.public-map-shell').boundingBox();
  expect(intro).not.toBeNull();expect(map!.y).toBeGreaterThanOrEqual(intro!.y+intro!.height);
  expect(map!.height).toBeGreaterThanOrEqual(width<=760?320:360);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`introduction-${width}.png`)});
  await page.locator('main').evaluate(el=>el.scrollTop=el.scrollHeight);
  const drawer=await openCapacityFilters(page);
  await expect(drawer.getByRole('button',{name:'Filters',exact:true})).toBeInViewport();
  await drawer.getByRole('button',{name:'Filters',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Filters',exact:true});await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'Close filters'}).click();await closeCapacityFilters(page);
  await expect(page.locator('.leaflet-control-zoom-in')).toBeInViewport();
  await page.screenshot({path:info.outputPath(`map-controls-${width}.png`)});
 }
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});
 for(const locale of ['am','om','so','ti']){
  const messages=JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
  await page.locator('main').evaluate(el=>el.scrollTop=0);
  await page.locator('.language-picker select:visible').selectOption(locale);
  await expect(page.locator('.market-introduction h1')).toHaveText(messages[heading]);
  const intro=page.locator('.market-introduction');
  expect(await intro.evaluate(el=>el.scrollHeight<=el.clientHeight)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`introduction-${locale}.png`)});
 }
});

test('server response contains the introduction and search metadata before JavaScript runs',async({browser}:{browser:Browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false});
 try{
  const page=await context.newPage();await page.goto('http://127.0.0.1:3100/');
  // Next's streamed route is hidden until its reveal script runs; content must
  // already exist as real HTML. Visibility is checked in the browser workflow.
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('.market-introduction h1')).toHaveText(heading);
  await expect(page.locator('.market-introduction p')).toContainText('brokers, shippers and receivers');
  await expect(page).toHaveTitle('Truck Capacity & Shipment Tracking in Ethiopia | Loadgistic');
  await expect(page.locator('meta[name=description]')).toHaveAttribute('content',/Find truck capacity in Ethiopia/);
 }finally{await context.close();}
});
