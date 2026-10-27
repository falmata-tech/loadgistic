import {test,expect} from './browser-test';
import type {Page} from 'playwright-core';
import {VEHICLE_CONFIGURATIONS} from '../../src/lib/vehicle-configurations';
import sharp from 'sharp';

const csv='Cargo van,Mini Box Truck';
async function configs(page:Page,info?:{outputPath:(name:string)=>string}){
 await page.getByRole('button',{name:'All vehicle types',exact:true}).click();
 await expect.poll(()=>page.locator('[role="checkbox"] img[src*="/vehicle-configurations/"]').evaluateAll((images,count)=>images.length===count&&images.every(image=>image instanceof HTMLImageElement&&image.complete&&image.naturalWidth>0),VEHICLE_CONFIGURATIONS.length),{timeout:30_000}).toBe(true);
 for(const name of ['Cargo van','Mini Box Truck']){const option=page.getByRole('checkbox',{name,exact:true});await option.check();await expect(option).toBeChecked();}
 if(info){
  for(const width of [390,320]){
   await page.setViewportSize({width,height:width===320?640:844});
   for(const name of ['Cargo van','Mini Box Truck']){
    const option=page.getByRole('checkbox',{name,exact:true});await option.scrollIntoViewIfNeeded();await expect(option).toBeChecked();
    const box=await option.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({path:info.outputPath(`native-multiple-configuration-gallery-${width}-${name==='Cargo van'?'cargo':'box'}.png`),scale:'css'});
   }
  }
  await page.setViewportSize({width:390,height:844});
 }
 await expect(page.getByRole('button',{name:'Close',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Close',exact:true}).click();await expect(page.getByRole('button',{name:'2 vehicle types',exact:true})).toBeVisible();
}
async function checkControls(page:Page){
 for(const label of ['Close filters','Reset vehicle filters','Show vehicles']){
  const button=page.getByRole('button',{name:label,exact:true});await button.click({trial:true});
  const box=await button.boundingBox(),viewport=page.viewportSize()!;expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(viewport.width);expect(box!.y+box!.height).toBeLessThanOrEqual(viewport.height);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.getByRole('button',{name:'Show vehicles',exact:true}).evaluate(element=>getComputedStyle(element).backgroundColor)).toBe('rgb(21, 94, 239)');
}

async function mapPainted(page:Page){
 await expect(page.getByRole('progressbar',{name:'Loading vehicle availability',exact:true})).toHaveCount(0,{timeout:30_000});
 await expect.poll(async()=>{
  const box=await page.locator('.maplibregl-canvas').first().boundingBox();if(!box||box.width<100||box.height<100)return false;
  const stats=await sharp(await page.screenshot({clip:{x:box.x+box.width*.2,y:box.y+box.height*.25,width:box.width*.6,height:box.height*.5}})).stats();
  return stats.channels.slice(0,3).some(channel=>channel.mean<248&&channel.stdev>4);
 },{timeout:30_000,message:'The map must paint before a review capture.'}).toBe(true);
}

test('Expo multi-option controls keep drafts and submit canonical groups plus document filters on narrow phones',async({page},info)=>{
 test.setTimeout(120_000);const requests:URL[]=[];
 page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/public/capacity')requests.push(url);});
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:8084/?q=Preserved%20people%20draft');
 await expect(page.getByRole('button',{name:'Vehicle filters',exact:true})).toBeVisible({timeout:45_000});await expect(page.getByRole('progressbar',{name:'Loading vehicle availability',exact:true})).toHaveCount(0,{timeout:30_000});
 await page.getByRole('button',{name:'Vehicle filters',exact:true}).click();await configs(page,info);
 await page.getByRole('radio',{name:'Route',exact:true}).click();await page.getByRole('button',{name:'Vehicle location',exact:true}).click();await page.getByRole('button',{name:'More filters',exact:true}).click();
 for(const label of ['Full truck','Shared space'])await expect(page.getByRole('checkbox',{name:label,exact:true})).toHaveCount(0);
 for(const label of ['Empty vehicle','Partly loaded','GPS device','Manually entered','Multiple pickups','Multiple drop-offs','Within 12 hours','More than 12 hours ago']){await page.getByRole('checkbox',{name:label,exact:true}).check();await expect(page.getByRole('checkbox',{name:label,exact:true})).toBeChecked();}
 await page.getByRole('checkbox',{name:'Business License',exact:true}).check();
 const expected={vehicleCategory:csv,status:'EMPTY,PARTIAL',locationSource:'GPS,MANUAL',stopOption:'MULTI_DROP,MULTI_PICK',freshness:'FRESH,UPDATE_NEEDED',ownerDocs:'BUSINESS_LICENSE'};
 expect(requests.every(url=>!Object.keys(expected).some(key=>url.searchParams.get(key)))).toBe(true);
 for(const width of [390,320]){
  await page.setViewportSize({width,height:width===320?640:844});await checkControls(page);
  await page.screenshot({path:info.outputPath(`native-multiple-filter-draft-${width}.png`),scale:'css'});
  await page.getByRole('button',{name:'Vehicle',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath(`native-multiple-filter-top-${width}.png`),scale:'css'});
  const summary=page.getByRole('button',{name:'2 vehicle types',exact:true});await summary.scrollIntoViewIfNeeded();await expect(summary.locator('..').locator('img')).toHaveCount(2);
  await page.screenshot({path:info.outputPath(`native-multiple-configurations-selected-${width}.png`),scale:'css'});
 }
 const applied=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/public/capacity'&&!url.searchParams.has('loadType')&&Object.entries(expected).every(([key,value])=>url.searchParams.get(key)===value&&url.searchParams.getAll(key).length===1);});
 await page.getByRole('button',{name:'Show vehicles',exact:true}).click();expect((await applied).ok()).toBe(true);
 await expect(page.getByRole('progressbar',{name:'Loading vehicle availability',exact:true})).toHaveCount(0,{timeout:30_000});
 await page.getByRole('button',{name:'Search transporters',exact:true}).click();await expect(page.getByRole('textbox',{name:'Search transporters',exact:true})).toHaveValue('Preserved people draft');await page.getByRole('button',{name:'Close transporter search',exact:true}).click();
 await page.getByRole('button',{name:/Vehicle filters/}).click();await page.getByRole('button',{name:'Reset vehicle filters',exact:true}).click();
 const reset=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/public/capacity'&&!url.searchParams.has('loadType')&&!Object.keys(expected).some(key=>url.searchParams.get(key));});
 await page.getByRole('button',{name:'Show vehicles',exact:true}).click();expect((await reset).ok()).toBe(true);
 await expect(page.locator('.maplibregl-canvas').first()).toBeVisible();
});

test('Expo route and nearby filters use the same ranges and defaults as web',async({page,context},info)=>{
 test.setTimeout(120_000);await context.grantPermissions(['geolocation'],{origin:'http://127.0.0.1:8084'});await context.setGeolocation({latitude:9.03,longitude:38.74});
 const requests:URL[]=[];page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/public/capacity')requests.push(url);});
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:8084/');
 await expect(page.getByRole('button',{name:'Vehicle filters',exact:true})).toBeVisible({timeout:45_000});await mapPainted(page);
 await page.getByRole('button',{name:'Vehicle filters',exact:true}).click();
 await page.getByRole('button',{name:'Vehicle location',exact:true}).click();
 await page.getByRole('button',{name:'Use my approximate area',exact:true}).click();
 await expect(page.getByRole('button',{name:'Update my approximate area',exact:true})).toBeVisible();
 const nearbyRadius=page.getByRole('radio',{name:'20 km',exact:true});await expect(nearbyRadius).toBeChecked();
 const chooseCity=async(city:string,label:'Origin'|'Destination')=>{
  const pickerLabel=page.getByText(label,{exact:true}).first(),picker=pickerLabel.locator('..');
  await picker.getByRole('button',{name:'Choose a city',exact:true}).click();
  const placeDialog=page.getByRole('dialog').filter({hasText:label}).last();
  await placeDialog.getByLabel('Search cities',{exact:true}).fill(city);
  const result=placeDialog.getByRole('button',{name:new RegExp(city,'i')}).first();await expect(result).toBeVisible({timeout:20_000});await result.click();
  await expect(picker.getByRole('button',{name:new RegExp(city,'i')})).toBeVisible();
 };
 await page.getByRole('radio',{name:'Route',exact:true}).click();
 await chooseCity('Addis Ababa','Origin');await chooseCity('Adama','Destination');
 const range=(label:string)=>page.getByText(label,{exact:true}).locator('..');
 await expect(range('Origin range').getByRole('radio',{name:'50 km',exact:true})).toBeChecked();
 await expect(range('Destination range').getByRole('radio',{name:'50 km',exact:true})).toBeChecked();
 await expect(range('Distance from my area').getByRole('radio',{name:'20 km',exact:true})).toBeChecked();
 await range('Origin range').getByRole('radio',{name:'25 km',exact:true}).click();
 await range('Destination range').getByRole('radio',{name:'100 km',exact:true}).click();
 await page.getByRole('radio',{name:'Route',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('native-capacity-route-ranges.png'),scale:'css'});
 const applied=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/public/capacity'&&url.searchParams.has('originPlaceRef')&&url.searchParams.has('destinationPlaceRef')&&url.searchParams.get('originRadiusKm')==='25'&&url.searchParams.get('destinationRadiusKm')==='100'&&url.searchParams.get('nearRadiusKm')==='20';});
 await page.getByRole('button',{name:'Show vehicles',exact:true}).click();expect((await applied).ok()).toBe(true);
 await expect.poll(()=>requests.some(url=>url.searchParams.get('originRadiusKm')==='25'&&url.searchParams.get('destinationRadiusKm')==='100'&&url.searchParams.get('nearRadiusKm')==='20')).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Expo private Capacity requires an account instead of an email code',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('http://127.0.0.1:8084/capacity?view=private');
 await expect(page.getByLabel('Email verification code')).toHaveCount(0);
 const denied=await page.request.get('/api/mobile/visitor/capacity/signals');
 expect(denied.status()).toBe(410);
 expect(await denied.json()).toMatchObject({error:{code:'ACCOUNT_REQUIRED'}});
});
