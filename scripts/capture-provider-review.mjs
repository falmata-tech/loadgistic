import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';

const baseUrl=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:3100';
const providerHandle=process.env.PROVIDER_REVIEW_HANDLE||'blueline-transport';
const output=path.resolve(process.cwd(),'artifacts/provider-profile-v4');
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});

async function reviewState(name,viewport){
  const context=await browser.newContext({viewport,geolocation:{latitude:9.03,longitude:38.74},permissions:['geolocation']});
  const page=await context.newPage();
  await page.goto(`${baseUrl}/@${providerHandle}`,{waitUntil:'domcontentloaded'});
  await page.locator('.provider-fleet-showcase').waitFor({state:'visible'});
  await page.screenshot({path:path.join(output,`${name}-profile-fold.png`)});

  const fleet=page.locator('.provider-fleet-showcase');
  await fleet.scrollIntoViewIfNeeded();
  await fleet.screenshot({path:path.join(output,`${name}-fleet.png`)});

  const mapButton=page.getByRole('button',{name:'View capacity on map'}).first();
  await mapButton.scrollIntoViewIfNeeded();
  await mapButton.click();
  await page.locator('.provider-truck-relative-map .leaflet-container').waitFor({state:'visible'});
  await page.locator('.provider-truck-relative-map .leaflet-tile-loaded').first().waitFor({state:'visible',timeout:10_000}).catch(()=>{});
  await page.waitForTimeout(1_800);
  await page.locator('.provider-truck-card.expanded').screenshot({path:path.join(output,`${name}-truck-map.png`)});
  await context.close();
}

await reviewState('desktop',{width:1440,height:1000});
await reviewState('mobile',{width:390,height:844});
await browser.close();
