import {test,expect} from './browser-test';
import type {Page} from 'playwright-core';
import sharp from 'sharp';

const preview='http://localhost:8084';
test.use({trace:'off',screenshot:'off'});
async function paintedMap(page:Page){
 const map=page.locator('.maplibregl-map:visible');await expect(map).toBeVisible({timeout:30000});
 await expect.poll(async()=>{
  const box=await map.boundingBox();if(!box||box.width<100||box.height<100)return false;
  const image=await page.screenshot({clip:{x:box.x+box.width*.1,y:box.y+box.height*.65,width:box.width*.8,height:box.height*.2}});
  return (await sharp(image).stats()).channels.slice(0,3).some(channel=>channel.stdev>5&&channel.mean<248);
 },{timeout:30000}).toBe(true);
 return map;
}

test('Expo Capacity keeps full map and search controls without retired transport chat',async({page},info)=>{
 test.skip(info.project.name!=='mobile-chromium','Phone Expo browser workflow');test.setTimeout(120000);
 for(const width of [390,320]){
  await page.setViewportSize({width,height:width===320?640:844});await page.goto(preview+'/');
  await expect(page.getByRole('button',{name:'Transporter search',exact:true})).toBeVisible({timeout:30000});
  await expect(page.getByRole('progressbar',{name:'Loading truck availability',exact:true})).toHaveCount(0,{timeout:30000});
  const map=await paintedMap(page),chat=page.getByRole('link',{name:'Need help with transport?',exact:true});
  const [frame,tabs,attribution]=await Promise.all([map.boundingBox(),page.getByRole('tab',{name:'Capacity',exact:true}).boundingBox(),map.locator('.maplibregl-ctrl-attrib').boundingBox()]);
  expect(frame&&tabs&&attribution).toBeTruthy();
  expect(Math.abs(frame!.y+frame!.height-tabs!.y)).toBeLessThan(12);
  await expect(chat).toHaveCount(0);
  await page.getByRole('button',{name:'Transporter search',exact:true}).click();
  await expect(page.getByLabel('Search transporters')).toBeVisible();
  await page.getByRole('button',{name:'Clear search',exact:true}).scrollIntoViewIfNeeded();
  await page.getByRole('button',{name:'Clear search',exact:true}).click({trial:true});
  const clear=await page.getByRole('button',{name:'Clear search',exact:true}).boundingBox();
  expect(clear).toBeTruthy();
  await page.getByRole('button',{name:'Close transporter search',exact:true}).click();
  await expect(chat).toHaveCount(0);await paintedMap(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`expo-capacity-retired-chat-${width}.png`),scale:'css'});
 }
});

test('Expo Tracking entry has an empty map behind verification without private shipment reads',async({page,context},info)=>{
 test.skip(info.project.name!=='mobile-chromium','Phone Expo browser workflow');test.setTimeout(120000);
 await context.setExtraHTTPHeaders({'x-forwarded-for':'127.0.0.243'});
 const privateRequests:string[]=[];
 page.on('request',request=>{if(/\/api\/mobile\/visitor\/tracking\/shipments(?:\/|\?|$)/.test(new URL(request.url()).pathname))privateRequests.push(request.url());});
 for(const width of [390,320]){
  await page.setViewportSize({width,height:width===320?640:844});await page.goto(preview+'/about');
  await page.getByRole('tab',{name:'Track',exact:true}).click();
  await expect(page.getByText('Follow your shipment',{exact:true})).toBeVisible();
  const map=await paintedMap(page);
  await expect(map.locator('[data-marker-id]')).toHaveCount(0);
  const [frame,input,tabs]=await Promise.all([map.boundingBox(),page.getByLabel('Your email',{exact:true}).boundingBox(),page.getByRole('tab',{name:'Track',exact:true}).boundingBox()]);
  expect(frame&&input&&tabs).toBeTruthy();expect(Math.abs(frame!.y+frame!.height-tabs!.y)).toBeLessThan(12);
  expect(input!.y).toBeGreaterThan(frame!.y);expect(input!.y+input!.height).toBeLessThan(frame!.y+frame!.height);
  await page.getByLabel('Your email',{exact:true}).fill('expo-entry-layout@example.test');
  await page.getByRole('button',{name:'Send email code',exact:true}).click({trial:true});
  await page.screenshot({path:info.outputPath(`expo-tracking-entry-map-${width}.png`),scale:'css'});
 }
 const otp=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/visitor/tracking/request'&&response.request().method()==='POST');
 await page.getByRole('button',{name:'Send email code',exact:true}).click();expect((await otp).ok()).toBe(true);
 await page.getByLabel('Email verification code',{exact:true}).fill('111111');
 const verify=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/visitor/tracking/verify'&&response.request().method()==='POST');
 await page.getByRole('button',{name:'Open private access',exact:true}).click();expect((await verify).status()).toBe(401);
 await expect(page.getByRole('alert')).toBeVisible();await paintedMap(page);expect(privateRequests).toEqual([]);
 await page.setViewportSize({width:390,height:480});await page.getByLabel('Email verification code',{exact:true}).focus();
 await page.getByRole('button',{name:'Open private access',exact:true}).scrollIntoViewIfNeeded();await page.getByRole('button',{name:'Open private access',exact:true}).click({trial:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('expo-tracking-entry-short-viewport.png'),scale:'css'});
});
