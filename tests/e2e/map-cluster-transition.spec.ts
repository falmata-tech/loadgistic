import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

async function settled(page:any){
  await expect(page.locator('.capacity-map-cluster,.capacity-truck-map-marker').first()).toBeVisible({timeout:30000});
  await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:30000});
}
async function reachableCluster(page:any){
  const cells=page.locator('.capacity-map-cluster');
  const index=await cells.evaluateAll((elements:HTMLElement[])=>elements.findIndex(element=>{
    const box=element.getBoundingClientRect();return element.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));
  }));
  expect(index).toBeGreaterThanOrEqual(0);return cells.nth(index);
}

test('map automatically loads all viewport pages and a cluster zoom needs one activation',async({page}: {page:any},info:any)=>{
  test.setTimeout(90000);
  const requests:URL[]=[];
  const responses:{viewport:string|null;hasMore:boolean}[]=[];
  page.on('request',(request:any)=>{const u=new URL(request.url());if(u.pathname==='/api/public/capacity')requests.push(u);});
  page.on('response',async(response:any)=>{const u=new URL(response.url());if(u.pathname==='/api/public/capacity'&&response.ok()){
    try{const data=await response.json();responses.push({viewport:u.searchParams.get('viewport'),hasMore:data.hasMore});}catch{}
  }});
  await page.goto('/');
  await expect.poll(()=>responses.length).toBeGreaterThan(0);
  await settled(page);
  await expect.poll(()=>responses.at(-1)?.hasMore).toBe(false);
  expect(requests.every(u=>!u.searchParams.has('overview'))).toBe(true);
  await expect(page.locator('.capacity-overview-cell')).toHaveCount(0);
  await expect(page.getByRole('button',{name:/Show area summaries|More trucks in this area|^Show trucks$/})).toHaveCount(0);
  const cluster=await reachableCluster(page);
  expect(await cluster.evaluate((el:HTMLElement)=>getComputedStyle(el).borderRadius)).toBe('50%');
  const before=requests.at(-1)!.searchParams.get('viewport');
  const folder=path.resolve('artifacts/map-cluster-review-2026-09-21');mkdirSync(folder,{recursive:true});
  await page.screenshot({path:path.join(folder,`${info.project.name}-map.png`),scale:'css'});
  requests.length=0;
  if(info.project.name.includes('mobile'))await cluster.tap();else{await cluster.focus();await page.keyboard.press('Enter');}
  await expect.poll(()=>requests.length).toBeGreaterThan(0);
  await settled(page);
  await expect(page.locator('.leaflet-popup')).toHaveCount(0);
  expect(requests[0].searchParams.has('cursor')).toBe(false);
  const after=requests[0].searchParams.get('viewport')!;
  expect(after).not.toBe(before);
  expect(requests.every(u=>u.searchParams.get('viewport')===after)).toBe(true);
  expect(new Set(requests.map(u=>u.searchParams.get('cursor'))).size).toBe(requests.length);
  expect(after.split(',').map(Number)[2]-after.split(',').map(Number)[0]).toBeLessThan(before!.split(',').map(Number)[2]-before!.split(',').map(Number)[0]);
  await page.screenshot({path:path.join(folder,`${info.project.name}-zoomed.png`),scale:'css'});
  const map=await page.locator('.leaflet-container').boundingBox();
  requests.length=0;
  await page.mouse.move(map.x+map.width*.8,map.y+map.height*.55);
  await page.mouse.down();
  await page.mouse.move(map.x+map.width*.6,map.y+map.height*.55,{steps:6});
  await page.mouse.up();
  await expect.poll(()=>requests.length).toBeGreaterThan(0);
  await settled(page);
  expect(requests[0].searchParams.get('viewport')).not.toBe(after);
  expect(requests[0].searchParams.has('cursor')).toBe(false);
  await expect.poll(()=>responses.at(-1)?.hasMore).toBe(false);
});

test('loading failure retains existing markers and retry automatically completes the window',async({page}:{page:any})=>{
  test.setTimeout(60000);
  await page.goto('/');await page.waitForResponse((r:any)=>new URL(r.url()).pathname==='/api/public/capacity');await settled(page);
  let fail=true;
  await page.route('**/api/public/capacity?**',async(route:any)=>{
    if(!fail)return route.continue();
    await route.fulfill({status:503,contentType:'application/json',body:'{"error":"Synthetic map outage"}'});
  });
  await page.locator('.leaflet-control-zoom-in').click();
  await expect(page.getByTestId('capacity-feed-state')).toContainText('Capacity could not be loaded');
  expect(await page.locator('.capacity-map-cluster,.capacity-truck-map-marker').count()).toBeGreaterThan(0);
  fail=false;await page.getByRole('button',{name:'Try again',exact:true}).click();await settled(page);
  await page.unroute('**/api/public/capacity?**');
});
