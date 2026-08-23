import {expect,test} from '@playwright/test';

type BrowserFixtures={page:any;context:any};

test('low-end phone keeps public map loading deliberate and bounded',async({page,context}:BrowserFixtures)=>{
  const client=await context.newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate',{rate:6});
  let cursorRequests=0;
  page.on('request',(request:any)=>{if(request.url().includes('/api/public/capacity?')&&request.url().includes('cursor='))cursorRequests+=1;});
  await page.goto('/');
  await page.locator('.capacity-truck-map-marker,.capacity-map-cluster').first().waitFor({state:'visible'});
  await page.waitForTimeout(1_500);
  expect(cursorRequests).toBe(0);
  const before=await page.locator('.capacity-truck-map-marker,.capacity-map-cluster').count();
  expect(before).toBeLessThanOrEqual(20);
  await page.getByRole('button',{name:'Load more trucks'}).click();
  await expect.poll(()=>cursorRequests).toBe(1);
  await page.waitForTimeout(500);
  const after=await page.locator('.capacity-truck-map-marker,.capacity-map-cluster').count();
  expect(after).toBeLessThanOrEqual(40);
  const heap=await client.send('Runtime.getHeapUsage');
  expect(heap.usedSize).toBeLessThan(96*1024*1024);
});
