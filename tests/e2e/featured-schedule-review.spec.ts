import {test,expect} from './browser-test';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {auditLogin} from './audit-helpers';
import {addLocalSmokeSponsor} from './sponsor-fixture-helper';

test('Sponsors stay separate, compact, and schedule-attributed',async({page}:{page:any})=>{
  test.setTimeout(45_000);
  const cleanups:Array<()=>Promise<void>>=[],marker=randomUUID().slice(0,8);
  try{
  for(let position=1;position<=4;position++)cleanups.push(await addLocalSmokeSponsor({position,name:`Schedule sponsor ${marker} ${position}`}));
  await page.goto('/featured');
  const sponsors=page.locator('.expo-sponsored-rail');
  await expect(sponsors.getByRole('heading',{name:'Sponsors'})).toBeVisible();
  const phone=(page.viewportSize()?.width||1280)<=620;
  if(phone)await expect.poll(()=>sponsors.locator('.expo-sponsored-card').count()).toBe(2);
  else await expect.poll(()=>sponsors.locator('.expo-sponsored-card').count()).toBeGreaterThan(2);
  if(phone){
    const firstPair=await sponsors.locator('.expo-sponsored-card').allTextContents();
    await expect.poll(async()=>JSON.stringify(await sponsors.locator('.expo-sponsored-card').allTextContents()),{timeout:12_000}).not.toBe(JSON.stringify(firstPair));
  }else await expect(sponsors.getByText('Advertiser',{exact:true}).first()).toBeVisible();
  await expect(sponsors.getByRole('button',{name:/next|previous|pause/i})).toHaveCount(0);

  await auditLogin(page,'admin@loadgistic.local');
  await page.goto('/admin/featured');
  if(await page.getByRole('link',{name:'Cancel editing',exact:true}).count())await page.getByRole('link',{name:'Cancel editing',exact:true}).click();await page.getByRole('button',{name:'Schedule sponsor',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Sponsors'})).toBeVisible();
  await expect(page.getByLabel('Sponsor type')).toContainText('Outside advertiser');
  }finally{
    let failed=false;
    for(const cleanup of cleanups.reverse())try{await cleanup();}catch{failed=true;}
    if(failed)throw new Error('LOCAL_FEATURED_SPONSOR_CLEANUP_FAILED');
  }
});

test('capture focused featured schedule review',async({page}:{page:any})=>{
  test.skip(process.env.CAPTURE_VISUAL_REVIEW!=='1','Focused visual capture only');
  const output=path.resolve(process.cwd(),'artifacts/featured-schedule-v1');
  fs.mkdirSync(output,{recursive:true});
  const project=test.info().project.name;

  await page.goto('/featured');
  const featured=page.locator('.featured-provider-section');
  await featured.scrollIntoViewIfNeeded();
  await expect(featured.getByRole('heading',{name:'Sponsors'})).toBeVisible();
  await expect.poll(()=>featured.locator('.featured-truck-tile').count()).toBeGreaterThan(0);
  await expect(featured.locator('.featured-truck-tile').first().locator('.featured-card-details > small').first()).toHaveText('Driver');
  await featured.screenshot({path:path.join(output,`${project}-public.png`)});
  await featured.locator('.expo-schedule-panel>summary').click();
  await expect(featured.locator('.expo-programme-strip')).toBeVisible();
  await featured.locator('.featured-programme-command').screenshot({path:path.join(output,`${project}-schedule.png`)});

  await auditLogin(page,'admin@loadgistic.local');
  await page.goto('/admin/featured');
  await page.getByRole('link',{name:'Edit programme',exact:true}).click();
  const scheduler=page.locator('.featured-roster-editor');
  await expect(scheduler.getByRole('button',{name:'Automatic'})).toBeVisible();
  await scheduler.screenshot({path:path.join(output,`${project}-admin.png`)});
  if(await page.getByRole('link',{name:'Cancel editing',exact:true}).count())await page.getByRole('link',{name:'Cancel editing',exact:true}).click();await page.getByRole('button',{name:'Schedule sponsor',exact:true}).click();
  await page.getByLabel('Sponsor type').selectOption('ADVERTISER');
  await page.locator('.featured-sponsor-admin').screenshot({path:path.join(output,`${project}-admin-sponsors.png`)});
});
