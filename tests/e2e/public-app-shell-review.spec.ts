import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test('capture focused public application shell review',async({page}:{page:any})=>{
  test.skip(process.env.CAPTURE_VISUAL_REVIEW!=='1','Focused visual capture only');
  const output=path.resolve(process.cwd(),'artifacts/public-app-shell-v3');
  fs.mkdirSync(output,{recursive:true});
  const project=test.info().project.name;

  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Find capacity for local and long-distance freight.'})).toBeVisible();
  await expect(page.locator('.public-capacity-map')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollHeight<=window.innerHeight+2)).toBe(true);
  if((page.viewportSize()?.width||0)<=760){
    const headingBottom=await page.locator('.public-workspace-heading').evaluate((element:any)=>element.getBoundingClientRect().bottom);
    const controlsTop=await page.locator('.market-command-column').evaluate((element:any)=>element.getBoundingClientRect().top);
    expect(controlsTop-headingBottom).toBeLessThan(24);
  }
  await page.screenshot({path:path.join(output,`${project}-market.png`),fullPage:false});

  const navigation=(page.viewportSize()?.width||0)>760?page.getByRole('navigation',{name:'Public workspace navigation'}):page.getByRole('navigation',{name:'Public mobile navigation'});
  await navigation.getByRole('link',{name:'Featured',exact:true}).click();
  await expect(page).toHaveURL(/\/featured$/);
  await expect(page.locator('.featured-board-surface')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollHeight<=window.innerHeight+2)).toBe(true);
  if((page.viewportSize()?.width||0)<=520){
    const sponsor=page.locator('.expo-sponsored-rail');
    if(await sponsor.count()){
      const sponsorBox=await sponsor.boundingBox();
      for(const card of await sponsor.locator('.expo-sponsored-card').all())expect((await card.boundingBox())?.width||0).toBeLessThanOrEqual((sponsorBox?.width||0)-12);
    }
  }
  await page.screenshot({path:path.join(output,`${project}-featured.png`),fullPage:false});
});
