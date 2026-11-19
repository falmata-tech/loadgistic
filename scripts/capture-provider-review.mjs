import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';

const baseUrl=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:3100';
const providerHandle=process.env.PROVIDER_REVIEW_HANDLE||'blueline-transport';
const output=path.resolve(process.cwd(),'artifacts/provider-profile-v4');
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});

async function reviewState(name,viewport){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  page.setDefaultTimeout(45_000);
  await page.goto(`${baseUrl}/@${providerHandle}`,{waitUntil:'domcontentloaded',timeout:75_000});
  const map=page.locator('.provider-map-workbench');
  const marker=map.locator('.capacity-truck-map-marker').first();
  const retry=map.getByRole('button',{name:'Try again',exact:true});
  await marker.or(retry).first().waitFor({state:'visible',timeout:50_000});
  if(await retry.isVisible())await retry.click();
  await marker.waitFor({state:'visible',timeout:40_000});
  await page.screenshot({path:path.join(output,`${name}-profile-fold.png`)});
  await map.scrollIntoViewIfNeeded();
  await map.screenshot({path:path.join(output,`${name}-map.png`)});

  await marker.click();
  await map.getByRole('button',{name:'Vehicle details',exact:true}).click();
  const details=page.getByRole('dialog',{name:'Vehicle details',exact:true});
  await details.screenshot({path:path.join(output,`${name}-vehicle-details.png`)});
  await details.getByRole('button',{name:'Close map signal details',exact:true}).click();
  await details.waitFor({state:'hidden'});
  await context.close();
}

await reviewState('desktop',{width:1440,height:1000});
await reviewState('mobile',{width:390,height:844});
await browser.close();
