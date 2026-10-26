import {test,expect} from './browser-test';
import fs from 'node:fs';
import path from 'node:path';

test('one company footer reserves map space and stays above phone navigation',async({page}:{page:any})=>{
  await page.goto('/');
  const footer=page.locator('body>.site-copyright');
  await expect(footer).toHaveCount(1);
  await expect(footer).toContainText(`© ${new Date().getFullYear()} MarketVision Technology`);
  await expect(footer).toContainText('Jigjiga, Somali Region, Ethiopia');
  const company=footer.getByRole('link',{name:'MarketVision Technology',exact:true});
  await expect(company).toHaveAttribute('href','https://marketvisiontech.com/');
  await page.locator('.leaflet-control-attribution').waitFor();
  const fits=await page.evaluate(()=>{
    const box=(selector:string)=>document.querySelector(selector)?.getBoundingClientRect();
    const footer=box('.site-copyright'),map=box('.public-map-canvas'),attribution=box('.leaflet-control-attribution'),navigation=box('.public-mobile-nav');
    return Boolean(footer&&map&&attribution&&map.bottom<=footer.top+1&&attribution.bottom<=map.bottom+1&&(!navigation||getComputedStyle(document.querySelector('.public-mobile-nav')!).display==='none'||footer.bottom<=navigation.top+1)&&document.documentElement.scrollWidth<=innerWidth+2&&document.documentElement.scrollHeight<=innerHeight+2);
  });
  expect(fits).toBe(true);
  await page.goto('/about');
  await expect(page.locator('body>.site-copyright')).toHaveCount(1);
  await expect(page.getByRole('link',{name:'MarketVision Technology',exact:true})).toHaveCount(1);
  await page.goto('/track');
  const action=page.getByRole('button',{name:'Email me a code',exact:true});
  await expect(action).toBeVisible();
  expect(await page.evaluate(()=>{
    const button=document.querySelector('.tracking-unlock-panel .auth-primary-action')?.getBoundingClientRect();
    const panel=document.querySelector('.tracking-unlock-panel')?.getBoundingClientRect();
    const footer=document.querySelector('.site-copyright')?.getBoundingClientRect();
    const stage=document.querySelector('.tracking-entry-stage')?.getBoundingClientRect();
    return Boolean(button&&panel&&footer&&stage&&button.bottom<=panel.bottom+1&&stage.bottom<=footer.top+1);
  })).toBe(true);
  for(const [width,height] of [[320,568],[844,390]]){
    await page.setViewportSize({width,height});
    await page.goto('/');
    await page.locator('.leaflet-control-attribution').waitFor();
    await page.locator('main').evaluate((element:HTMLElement)=>{element.scrollTop=element.scrollHeight;});
    expect(await page.evaluate((shortPortrait:boolean)=>{
      const box=(selector:string)=>document.querySelector(selector)?.getBoundingClientRect();
      const map=box('.public-map-canvas'),footer=box('.site-copyright'),attribution=box('.leaflet-control-attribution'),controls=box('.capacity-map-controls');
      const main=document.querySelector('main');
      return Boolean(map&&footer&&attribution&&controls&&map.bottom<=footer.top+1&&attribution.bottom<=map.bottom+1&&controls.height>=44&&map.height>=controls.height+attribution.height+50&&document.documentElement.scrollHeight<=innerHeight+2&&document.documentElement.scrollWidth<=innerWidth+2&&(!shortPortrait||main&&main.scrollHeight<=main.clientHeight+2));
    },width<=360)).toBe(true);
    await page.goto('/track');
    await page.locator('.leaflet-control-attribution').waitFor();
    expect(await page.evaluate(()=>{
      const box=(selector:string)=>document.querySelector(selector)?.getBoundingClientRect();
      const action=box('.tracking-unlock-panel .auth-primary-action'),panel=box('.tracking-unlock-panel'),stage=box('.tracking-entry-stage'),footer=box('.site-copyright'),attribution=box('.leaflet-control-attribution');
      return Boolean(action&&panel&&stage&&footer&&attribution&&action.height>=44&&action.bottom<=panel.bottom+1&&stage.bottom<=footer.top+1&&attribution.bottom<=stage.bottom+1&&document.documentElement.scrollHeight<=innerHeight+2&&document.documentElement.scrollWidth<=innerWidth+2);
    })).toBe(true);
  }
});

test('capture focused public application shell review',async({page}:{page:any})=>{
  test.skip(process.env.CAPTURE_VISUAL_REVIEW!=='1','Focused visual capture only');
  const output=path.resolve(process.cwd(),'artifacts/public-app-shell-v3');
  fs.mkdirSync(output,{recursive:true});
  const project=test.info().project.name;

  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Find space for your next load',level:1,exact:true})).toHaveCount(1);
  await expect(page.getByRole('heading',{name:'Find space for your next load',level:1,exact:true})).toBeVisible();
  await expect(page.locator('.map-workspace-heading')).toHaveCount(0);
  await expect(page.locator('.public-capacity-map')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollHeight<=window.innerHeight+2)).toBe(true);
  const introduction=await page.locator('.market-introduction').boundingBox();
  const map=await page.locator('.public-map-canvas').boundingBox();
  const controls=await page.locator('.capacity-map-controls').boundingBox();
  expect(introduction&&map&&controls).toBeTruthy();
  expect(map!.y).toBeGreaterThanOrEqual(introduction!.y+introduction!.height-1);
  expect(controls!.x).toBeGreaterThanOrEqual(map!.x);
  expect(controls!.x+controls!.width).toBeLessThanOrEqual(map!.x+map!.width);
  expect(controls!.y).toBeGreaterThanOrEqual(map!.y);
  expect(controls!.y+controls!.height).toBeLessThanOrEqual(map!.y+map!.height);
  await page.getByRole('button',{name:'Vehicle filters',exact:true}).click({trial:true});
  await page.screenshot({path:path.join(output,`${project}-market.png`),fullPage:false});

  const navigation=(page.viewportSize()?.width||0)>760?page.getByRole('navigation',{name:'Site navigation'}):page.getByRole('navigation',{name:'Mobile navigation'});
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
