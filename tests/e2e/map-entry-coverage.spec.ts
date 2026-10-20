import {test,expect} from './browser-test';
import type {Page} from 'playwright-core';

async function basemapReady(page:Page,selector='.leaflet-container'){
  await expect(page.locator(selector)).toBeVisible({timeout:30_000});
  await expect.poll(()=>page.locator(`${selector} .leaflet-tile-loaded`).evaluateAll(tiles=>tiles.filter(tile=>tile instanceof HTMLImageElement&&tile.naturalWidth>0).length),{timeout:30_000}).toBeGreaterThan(0);
}

async function clearTouchTargets(page:Page,selectors:string){
  await expect.poll(()=>page.evaluate(selectors=>{
    return [...document.querySelectorAll<HTMLElement>(selectors)].filter(element=>element.checkVisibility()).flatMap(element=>{
      const box=element.getBoundingClientRect();
      if(box.width===0||box.height===0)return [];
      const style=getComputedStyle(element);
      const inset=(value:string,size:number)=>Math.min(size/2,Math.max(2,(value.endsWith('%')?parseFloat(value)*size/100:parseFloat(value)||0)*(1-Math.SQRT1_2)+1));
      const corner=(radius:string,right:boolean,bottom:boolean)=>{
        const values=radius.split(' '),x=inset(values[0],box.width),y=inset(values[1]||values[0],box.height);
        return [right?box.right-x:box.left+x,bottom?box.bottom-y:box.top+y];
      };
      // Diagonal probes follow the actual rounded hit path. The dock must still
      // leave the entire rectangular target clear, including its corner bounds.
      const points=[corner(style.borderTopLeftRadius,false,false),corner(style.borderTopRightRadius,true,false),corner(style.borderBottomLeftRadius,false,true),corner(style.borderBottomRightRadius,true,true),[box.left+box.width/2,box.top+2],[box.left+box.width/2,box.bottom-2],[box.left+2,box.top+box.height/2],[box.right-2,box.top+box.height/2],[box.left+box.width/2,box.top+box.height/2]];
      const blockedPoints=points.filter(([x,y])=>!element.contains(document.elementFromPoint(x,y)));
      return blockedPoints.length?[{target:element.getAttribute('aria-label')||element.textContent?.trim(),blockedPoints}]:[];
    });
  },selectors)).toEqual([]);
}

test('Capacity basemap extends to application navigation without retired transport chat',async({page},info)=>{
  test.setTimeout(90_000);
  const phone=info.project.name.includes('mobile');
  for(const width of phone?[390,320]:[1440,1024]){
    await page.setViewportSize({width,height:phone?(width===320?640:844):900});
    await page.goto('/');await basemapReady(page);
    await page.locator('main.public-market-workspace').evaluate(element=>{element.scrollTop=element.scrollHeight;});
    await expect.poll(()=>page.evaluate(()=>{
      const map=document.querySelector('.public-map-shell')!.getBoundingClientRect();
      const nav=document.querySelector('.public-mobile-nav')!.getBoundingClientRect();
      return {fillsBottom:Math.abs(map.bottom-(innerWidth<=760?nav.top:innerHeight))<=10,noRetiredChat:document.querySelector('.public-assistance-dock')===null,noOverflow:document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight};
    })).toEqual({fillsBottom:true,noRetiredChat:true,noOverflow:true});
    await clearTouchTargets(page,'.capacity-map-controls button,.leaflet-control-zoom a,.public-map-legend summary,.leaflet-control-attribution a,.public-mobile-nav a');
    await page.getByRole('button',{name:'Transporter search',exact:true}).click();
    await expect(page.getByLabel('Search transporters')).toBeVisible();
    await clearTouchTargets(page,'.capacity-people-drawer .capacity-drawer-actions button,.capacity-people-drawer .capacity-drawer-actions a');
    await page.getByRole('button',{name:'Close transporter search',exact:true}).click();
    await expect(page.getByRole('button',{name:'Need help with transport?',exact:true})).toHaveCount(0);
    await expect(page.locator('.public-assistance-dock,.public-chat-dialog')).toHaveCount(0);
    await page.screenshot({path:info.outputPath(`capacity-full-map-${width}.png`),scale:'css'});
  }
});

test('unverified Tracking entry keeps an empty basemap behind its working email form',async({page,context},info)=>{
  test.setTimeout(90_000);
  await context.setExtraHTTPHeaders({'x-forwarded-for':info.project.name.includes('mobile')?'127.0.0.246':'127.0.0.245'});
  const privateRequests:string[]=[];
  page.on('request',request=>{if(/\/api\/(?:mobile\/)?(?:visitor\/tracking|tracking\/(?:shipments|session)|provider-shipments)/.test(new URL(request.url()).pathname))privateRequests.push(request.url());});
  const phone=info.project.name.includes('mobile');
  for(const width of phone?[390,320]:[1440,1024]){
    await page.setViewportSize({width,height:phone?(width===320?640:844):900});
    await page.goto('/track');await basemapReady(page,'.tracking-entry-map .leaflet-container');
    await expect(page.getByRole('heading',{name:'Follow your shipment',exact:true})).toBeVisible();
    await expect(page.locator('.tracking-entry-map .leaflet-marker-pane>*,.tracking-entry-map .leaflet-overlay-pane>*')).toHaveCount(0);
    await expect(page.getByLabel('6-digit email code')).toHaveCount(0);
    await expect.poll(()=>page.evaluate(()=>{
      const map=document.querySelector('.tracking-entry-map')!.getBoundingClientRect(),form=document.querySelector('.tracking-unlock-panel')!.getBoundingClientRect();
      const nav=document.querySelector('.public-mobile-nav')!.getBoundingClientRect();
      return {mapBehindForm:map.left<=form.left&&map.right>=form.right&&map.top<=form.top&&map.bottom>=form.bottom,fillsWorkspace:Math.abs(map.bottom-(innerWidth<=760?nav.top:innerHeight))<=10,noOverflow:document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight};
    })).toEqual({mapBehindForm:true,fillsWorkspace:true,noOverflow:true});
    await page.getByLabel('Email',{exact:true}).fill(`entry-layout-${info.project.name}@example.test`);
    await clearTouchTargets(page,'.tracking-entry-map .leaflet-control-zoom a,.tracking-entry-map .leaflet-control-attribution a,.public-mobile-nav a');
    await page.getByRole('button',{name:'Email me a code',exact:true}).click({trial:true});
    await page.screenshot({path:info.outputPath(`tracking-entry-basemap-${width}.png`),scale:'css'});
  }
  const otp=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/tracking/otp'&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Email me a code',exact:true}).click();expect((await otp).ok()).toBe(true);
  await expect(page.getByLabel('6-digit email code')).toBeVisible();
  await page.getByLabel('6-digit email code').fill('111111');
  const verify=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/tracking/unlock'&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Open tracking',exact:true}).click();expect((await verify).status()).toBe(401);
  await expect(page.locator('.tracking-unlock-panel [role=alert]')).toBeVisible();await basemapReady(page,'.tracking-entry-map .leaflet-container');
  if(phone){
    // A reduced visual viewport exercises the same bounded form scroll used with a keyboard.
    await page.setViewportSize({width:390,height:480});await page.getByLabel('6-digit email code').focus();
    await page.getByRole('button',{name:'Open tracking',exact:true}).scrollIntoViewIfNeeded();await page.getByRole('button',{name:'Open tracking',exact:true}).click({trial:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
    await page.screenshot({path:info.outputPath('tracking-entry-short-viewport.png'),scale:'css'});
  }
  await page.getByRole('button',{name:'Change email',exact:true}).scrollIntoViewIfNeeded();await page.getByRole('button',{name:'Change email',exact:true}).click();
  await expect(page.getByLabel('Email',{exact:true})).toBeVisible();expect(privateRequests).toEqual([]);
});
