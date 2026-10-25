import {openCapacityFilters} from './capacity-drawer-helper';
import {test,expect} from './browser-test';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

async function verifyShell(page:any,testInfo:any,surface:string){
  await expect(page.locator('.leaflet-container')).toBeVisible({timeout:30_000});
  const phone=testInfo.project.name.includes('mobile');
  const viewports=phone?[[320,640],[390,844],[760,900]]:
    [[761,900],[1024,768],[1180,900],[1181,900],[1440,900],[1920,1080],[2560,900]];
  const captures=path.resolve('artifacts/map-shell-2026-09-14');
  mkdirSync(captures,{recursive:true});
  for(const [width,height] of viewports){
    await page.setViewportSize({width,height});
    // The introduction can scroll away on short screens while the map keeps its usable height.
    await page.locator('main.public-market-introduced').evaluate((el:HTMLElement)=>el.scrollTop=el.scrollHeight);
    await openCapacityFilters(page);
    await expect.poll(async()=>page.evaluate(()=>{
      const box=(selector:string)=>document.querySelector(selector)!.getBoundingClientRect();
      const header=box('.public-header');
      const nav=box(innerWidth<=760?'.public-mobile-nav':'.public-workspace-nav');
      const workspace=box('.home-market-shell');
      const tools=box('.market-command-column');
      const map=box('.public-map-shell');
      const sessionBar=document.querySelector('.shared-capacity-session-bar')?.getBoundingClientRect();
      const sessionWorkspace=document.querySelector('.shared-capacity-session-workspace')?.getBoundingClientRect();
      // scrollTop rounds to whole CSS pixels; measured edges retain fractions.
      // Diagnostics: tablet bottom 768.03125 / viewport 768; phone top 58.15625 / header 59.
      const rounding=1;
      return {
        navigationClear:innerWidth>1180?workspace.left>=nav.right+8:
          innerWidth>760?workspace.top>=nav.bottom:workspace.bottom<=nav.top,
        headerClear:workspace.top+rounding>=header.bottom,
        withinViewport:workspace.right<=innerWidth+rounding&&workspace.bottom<=innerHeight+rounding,
        toolsContained:tools.left>=workspace.left&&tools.right<=workspace.right,
        sessionClear:!sessionBar||(sessionBar.bottom<=workspace.top&&sessionBar.left>=workspace.left&&sessionBar.right<=workspace.right),
        sessionMapContained:!sessionWorkspace||workspace.bottom<=sessionWorkspace.bottom+rounding,
        usableMap:map.width>=Math.min(280,innerWidth-10)&&map.height>=(innerHeight<=640?300:400),
        noDocumentOverflow:document.documentElement.scrollWidth<=innerWidth&&
          document.documentElement.scrollHeight<=innerHeight,
      };
    }),{message:`Navigation and map bounds at ${width}px`}).toEqual({
      navigationClear:true,headerClear:true,withinViewport:true,
      toolsContained:true,sessionClear:true,sessionMapContained:true,usableMap:true,noDocumentOverflow:true,
    });
    await page.getByRole('button',{name:'Vehicle filters',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Vehicle filters',exact:true});
    await expect(dialog).toBeVisible();
    const bounds=await dialog.boundingBox();
    expect(bounds).toBeTruthy();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y+bounds.height).toBeLessThanOrEqual(height);
    if([320,390,1024,1920].includes(width))await page.screenshot({path:path.join(captures,`${surface}-filters-${width}.png`),scale:'css'});
    await dialog.getByRole('button',{name:'Close filters'}).click();
    await expect(dialog).not.toBeVisible();
    if([320,390,1024,1920].includes(width)){
      await expect(page.locator('.public-feed-overlay.loading')).not.toBeVisible({timeout:30_000});
      await page.screenshot({path:path.join(captures,`${surface}-map-${width}.png`),scale:'css'});
    }
  }
  const nav=page.getByRole('navigation',{name:phone?'Mobile navigation':'Site navigation',exact:true});
  await Promise.all([page.waitForURL(/\/about$/,{waitUntil:'domcontentloaded'}),nav.getByRole('link',{name:'About',exact:true}).click()]);
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator('main.public-market-workspace')).toHaveCount(0);
}

test('map and search reserve navigation space at every shell breakpoint',async({page}:{page:any},testInfo:any)=>{
  test.setTimeout(120_000);
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await verifyShell(page,testInfo,'open');
});

test('retired email-only private map leads to account sign-in',async({page}:{page:any})=>{
 await page.goto('/shared-capacity');
 await expect(page).toHaveURL(/\/login\?from=shared-capacity/);
 await expect(page.getByLabel('6-digit email code')).toHaveCount(0);
 expect((await page.request.get('/api/shared-capacity')).status()).toBe(410);
});
