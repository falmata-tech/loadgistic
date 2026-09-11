import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';

const baseUrl=process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:3100';
const output=path.resolve(process.cwd(),'artifacts/featured-board-driver-home-v1');
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});

async function publicState(name,viewport){
  const page=await browser.newPage({viewport});
  await page.goto(`${baseUrl}/featured`,{waitUntil:'networkidle'});
  const featured=page.locator('.featured-provider-section');
  await featured.scrollIntoViewIfNeeded();
  await featured.screenshot({path:path.join(output,`${name}-featured-board.png`)});
  await featured.locator('.featured-provider-tile').first().click();
  await page.getByRole('dialog').screenshot({path:path.join(output,`${name}-provider-detail.png`)});
  await page.close();
}

await publicState('desktop',{width:1440,height:1000});
await publicState('mobile',{width:412,height:915});

const admin=await browser.newPage({viewport:{width:1440,height:1000}});
await admin.goto(`${baseUrl}/login`,{waitUntil:'networkidle'});
await admin.locator('details.auth-fixture-login>summary').click();
await admin.getByLabel('Email').fill('admin@loadgistic.local');
await admin.getByLabel('Password').fill('Loadgistic123!');
await admin.getByRole('button',{name:'Log in'}).click();
await admin.goto(`${baseUrl}/admin/featured`,{waitUntil:'networkidle'});
await admin.locator('.featured-roster-editor').screenshot({path:path.join(output,'admin-roster.png')});
await admin.close();

for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:412,height:915}]]){
  const driver=await browser.newPage({viewport});
  await driver.goto(`${baseUrl}/login`,{waitUntil:'networkidle'});
  await driver.locator('details.auth-fixture-login>summary').click();
  await driver.getByLabel('Email').fill('driver@loadgistic.local');
  await driver.getByLabel('Password').fill('Loadgistic123!');
  await driver.getByRole('button',{name:'Log in'}).click();
  await driver.goto(`${baseUrl}/app/home`,{waitUntil:'networkidle'});
  await driver.screenshot({path:path.join(output,`${name}-driver-home.png`),fullPage:false});
  await driver.close();
}
await browser.close();
