import {expect,test} from '@playwright/test';

type BrowserFixtures={page:any;context:any};

test('low-end phone keeps automatic public map loading progressive and bounded',async({page,context}:BrowserFixtures)=>{
  const client=await context.newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate',{rate:6});
  let cursorRequests=0;
  page.on('request',(request:any)=>{if(request.url().includes('/api/public/capacity?')&&request.url().includes('cursor='))cursorRequests+=1;});
  await page.goto('/');
  await page.locator('.capacity-truck-map-marker,.capacity-map-cluster').first().waitFor({state:'visible'});
  await expect(page.getByRole('button',{name:'Load more trucks'})).toHaveCount(0);
  await expect.poll(()=>cursorRequests,{timeout:5_000}).toBe(1);
  await page.waitForTimeout(1_000);
  expect(cursorRequests).toBe(1);
  const before=await page.locator('.capacity-truck-map-marker,.capacity-map-cluster').count();
  expect(before).toBeLessThanOrEqual(40);
  const map=page.locator('.leaflet-container');
  const box=await map.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x+box!.width*.65,box!.y+box!.height*.55);
  await page.mouse.down();
  await page.mouse.move(box!.x+box!.width*.45,box!.y+box!.height*.55,{steps:5});
  await page.mouse.up();
  await expect.poll(()=>cursorRequests,{timeout:5_000}).toBe(2);
  await page.waitForTimeout(500);
  const after=await page.locator('.capacity-truck-map-marker,.capacity-map-cluster').count();
  expect(after).toBeLessThanOrEqual(60);
  const heap=await client.send('Runtime.getHeapUsage');
  expect(heap.usedSize).toBeLessThan(96*1024*1024);
});
