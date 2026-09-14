import {expect,test} from '@playwright/test';

type BrowserFixtures={page:any;context:any};

test('low-end phone replaces bounded public viewport summaries without draining cursors',async({page,context}:BrowserFixtures)=>{
  test.setTimeout(60000);
  const client=await context.newCDPSession(page);
  try{
  await client.send('Emulation.setCPUThrottlingRate',{rate:6});
  const viewports:string[]=[];let cursorRequests=0;const startedAt=Date.now();const responses:{status:number;elapsedMs:number}[]=[];let failedRequests=0;
  page.on('response',(response:any)=>{const url=new URL(response.url());if(url.pathname==='/api/public/capacity')responses.push({status:response.status(),elapsedMs:Date.now()-startedAt});});
  page.on('requestfailed',(request:any)=>{if(new URL(request.url()).pathname==='/api/public/capacity')failedRequests++;});
  page.on('request',(request:any)=>{
    const url=new URL(request.url());if(url.pathname!=='/api/public/capacity')return;
    if(url.searchParams.has('cursor'))cursorRequests+=1;
    if(url.searchParams.get('overview')==='1')viewports.push(url.searchParams.get('viewport')||'');
  });
  await page.goto('/');
  try{await expect(page.locator('.capacity-overview-cell').first()).toBeVisible({timeout:20000});}
  catch{throw new Error('MAP_STARTUP_DIAGNOSTIC '+JSON.stringify({requests:viewports.length,responses,failedRequests}));}
  expect(viewports.length).toBeGreaterThan(0);expect(viewports.every(bounds=>bounds.split(',').length===4)).toBe(true);
  expect(cursorRequests).toBe(0);expect(await page.locator('.capacity-overview-cell').count()).toBeLessThanOrEqual(200);
  const before=viewports.at(-1);const map=page.locator('.leaflet-container');const box=await map.boundingBox();expect(box).toBeTruthy();
  await page.mouse.move(box!.x+box!.width*.7,box!.y+box!.height*.55);await page.mouse.down();
  await page.mouse.move(box!.x+box!.width*.3,box!.y+box!.height*.55,{steps:5});await page.mouse.up();
  await expect.poll(()=>viewports.at(-1),{timeout:10000}).not.toBe(before);
  await expect(page.getByText('Loading trucks in this map area…',{exact:true})).toHaveCount(0);
  expect(cursorRequests).toBe(0);expect(await page.locator('.capacity-overview-cell').count()).toBeLessThanOrEqual(200);
  const settled=viewports.length;await page.waitForTimeout(1000);expect(viewports.length).toBe(settled);
  const heap=await client.send('Runtime.getHeapUsage');expect(heap.usedSize).toBeLessThan(96*1024*1024);
  }finally{await client.send('Emulation.setCPUThrottlingRate',{rate:1}).catch(()=>undefined);await client.detach();}
});
