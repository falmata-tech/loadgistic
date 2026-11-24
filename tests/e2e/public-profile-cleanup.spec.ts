import {test,expect} from './browser-test';

test('native transporter profile keeps useful detail and opens vehicles and drivers from its scoped map',async({page},info)=>{
  test.setTimeout(120_000);
  const handle=process.env.PROVIDER_REVIEW_HANDLE||'blueline-transport';
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.name));
  for(const width of [390,320]){
    await page.setViewportSize({width,height:width===320?640:844});
    const scoped=page.waitForResponse(r=>{const url=new URL(r.url());return url.pathname==='/api/public/capacity'&&url.searchParams.get('provider')===handle;});
    const profile=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/mobile/public/providers/${handle}`);
    await page.goto(`http://localhost:8084/transporter?handle=${encodeURIComponent(handle)}`,{waitUntil:'domcontentloaded'});
    const providerResponse=await profile;
    expect(providerResponse.ok()).toBe(true);
    const provider=await providerResponse.json();
    expect(provider.trucks).toEqual([]);
    await expect(page.getByRole('heading',{name:provider.name,exact:true})).toBeVisible({timeout:45_000});
    for(const title of ['Transport services','Regular service','Confirm service details before booking']){
      await expect(page.getByRole('heading',{name:title,exact:true})).toHaveCount(0);
    }
    await expect(page.getByRole('heading',{name:'Account documents',exact:true})).toBeVisible();
    if(provider.about)await expect(page.getByRole('heading',{name:'About this transporter',exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Verified shipment reviews'})).toBeVisible();
    const response=await scoped;
    expect(response.ok()).toBe(true);
    const rows=await response.json();
    expect(rows.items.length).toBeGreaterThan(0);
    expect(rows.items.every((row:{provider_handle:string})=>row.provider_handle===handle)).toBe(true);
    const map=page.getByTestId('profile-fleet-map');await expect(map.locator('.maplibregl-canvas')).toBeVisible();
    await expect(page.getByTestId('provider-fleet-disclosure')).toHaveCount(0);
    // Pick a scoped vehicle from its map, then inspect its driver in the details.
    const row=rows.items.find((item:{vehicle_make:string;vehicle_model:string})=>item.vehicle_make&&item.vehicle_model);
    expect(row).toBeTruthy();
    const marker=map.getByRole('button',{name:row.vehicle_make+' '+row.vehicle_model}).first();
    await marker.click();
    await map.getByRole('button',{name:'Vehicle and driver',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Vehicle details',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Close map signal details',exact:true}).last().click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`native-profile-${width}.png`),fullPage:true,scale:'css'});
  }
  expect(errors).toEqual([]);
});

test('provider profile rails align and Back to Open Market clears the provider scope',async({page},info)=>{
  test.setTimeout(120_000);
  const phone=info.project.name==='mobile-chromium';
  await page.setViewportSize(phone?{width:320,height:640}:{width:1440,height:920});
  const handle='awash-fleet-services-04';
  const scoped=page.waitForResponse(response=>{
    const url=new URL(response.url());
    return response.ok()&&url.pathname==='/api/public/capacity'&&url.searchParams.get('provider')===handle;
  });
  await page.goto('/@'+handle,{waitUntil:'domcontentloaded'});
  const hero=page.locator('.provider-map-profile .provider-site-hero');
  const about=page.locator('.profile-map-information');
  const map=page.locator('.provider-map-workbench');
  const back=page.getByRole('link',{name:'Back to Open Market',exact:true});
  await expect(hero.getByRole('heading',{level:1})).toBeVisible();
  await expect(hero.getByRole('heading',{name:'Account documents'})).toBeVisible();
  await expect(about.getByRole('heading',{name:'Verified shipment reviews'})).toBeVisible();
  await expect(map.locator('.leaflet-container')).toBeVisible({timeout:30_000});
  const rows=(await (await scoped).json()).items;
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every((row:{provider_handle:string})=>row.provider_handle===handle)).toBe(true);
  const heroBox=(await hero.boundingBox())!,aboutBox=(await about.boundingBox())!,mapBox=(await map.boundingBox())!;
  for(const box of [aboutBox,mapBox]){
    expect(Math.abs(box.x-heroBox.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(box.x+box.width-heroBox.x-heroBox.width)).toBeLessThanOrEqual(2);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(phone){
    const identity=(await hero.locator('.provider-profile-main').boundingBox())!;
    const documents=(await hero.locator('.provider-profile-documents').boundingBox())!;
    const aboutHeading=(await about.getByRole('heading').first().boundingBox())!;
    expect(Math.abs(aboutHeading.x-identity.x)).toBeLessThanOrEqual(2);
    expect(documents.y).toBeGreaterThan(identity.y+identity.height);
  }
  await page.screenshot({path:info.outputPath('profile-rails.png'),fullPage:true,scale:'css'});
  await expect(back).toHaveAttribute('href','/');
  const market=page.waitForResponse(response=>{
    const url=new URL(response.url());
    return response.ok()&&url.pathname==='/api/public/capacity'&&url.searchParams.has('viewport')&&!url.searchParams.get('provider')&&!url.searchParams.get('truck');
  });
  await back.click();
  await expect(page).toHaveURL(url=>url.pathname==='/'&&!url.search);
  await expect(page.locator('.provider-map-profile')).toHaveCount(0);
  const marketRows=(await (await market).json()).items;
  expect(marketRows.some((row:{provider_handle:string})=>row.provider_handle!==handle)).toBe(true);
});

test('cover video plays in place and fullscreen returns to the same profile',async({page},info)=>{
  test.setTimeout(120_000);
  const phone=info.project.name==='mobile-chromium';
  await page.setViewportSize(phone?{width:320,height:640}:{width:1440,height:920});
  let playerRequests=0;
  await page.route('https://www.youtube-nocookie.com/embed/**',route=>{
    playerRequests++;
    const url=new URL(route.request().url());
    expect(url.pathname).toMatch(/^\/embed\/[A-Za-z0-9_-]{11}$/);
    expect(url.searchParams.get('autoplay')).toBe('1');
    expect(url.searchParams.get('playsinline')).toBe('1');
    expect(url.searchParams.get('origin')).toBe(new URL(page.url()).origin);
    return route.fulfill({
      contentType:'text/html',
      body:`<button onclick="document.documentElement.requestFullscreen()">Fullscreen</button>
        <button onclick="document.exitFullscreen()">Exit fullscreen</button>`
    });
  });
  await page.goto('/@abyssinia-road-cargo-03',{waitUntil:'domcontentloaded'});
  const cover=page.locator('.profile-cover');
  const play=cover.getByRole('button',{name:'Play cover video',exact:true});
  const player=cover.locator('iframe');
  await expect(play).toBeVisible();
  await expect(cover).not.toContainText(/Cover video|Example video|African Development Bank/);
  await expect(player).toHaveCount(0);
  expect(playerRequests).toBe(0);
  const poster=(await play.boundingBox())!;
  const hero=(await page.locator('.provider-site-hero').boundingBox())!;
  expect(poster.x).toBeGreaterThanOrEqual(hero.x);
  expect(poster.x+poster.width).toBeLessThanOrEqual(hero.x+hero.width);
  await play.click();
  await expect(player).toBeVisible();
  const loading=cover.getByRole('status',{name:''});
  await expect(loading).toHaveText('Loading video…');
  await expect(cover.locator('img')).toBeVisible();
  await expect(play).toHaveCount(0);
  await expect(page.getByRole('dialog',{name:'Cover video'})).toHaveCount(0);
  expect((await player.boundingBox())?.height).toBeCloseTo(poster.height);
  expect((await player.boundingBox())?.width).toBeCloseTo(poster.width);
  await expect(page.getByRole('heading',{name:'Verified shipment reviews'})).toBeVisible();
  await expect(page.locator('.provider-map-workbench .leaflet-container')).toBeVisible();
  const content=player.contentFrame();
  const signal=(event:string,info?:number)=>content.locator('body').evaluate((_,message)=>{
    parent.postMessage(JSON.stringify(message),new URL(document.referrer).origin);
  },{event,info});
  await signal('onReady');
  await signal('onStateChange',3);
  await expect(loading).toHaveText('Loading video…');
  await signal('onError',153);
  await expect(cover.getByText('Video couldn’t load.')).toBeVisible();
  await expect(cover.getByRole('link',{name:'Watch on YouTube'})).toHaveAttribute('href',/^https:\/\/www\.youtube\.com\/watch\?v=/);
  await expect(player).toHaveCount(0);
  await cover.getByRole('button',{name:'Try again'}).click();
  await expect(loading).toHaveText('Loading video…');
  await signal('onStateChange',1);
  await expect(loading).toHaveCount(0);
  expect(playerRequests).toBe(2);
  await content.getByRole('button',{name:'Fullscreen',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.tagName)).toBe('IFRAME');
  await content.getByRole('button',{name:'Exit fullscreen',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
  await expect(page).toHaveURL(/\/@abyssinia-road-cargo-03$/);
  await expect(player).toBeVisible();
});

test('opening a vehicle profile and returning install the right document policies',async({page},info)=>{
  test.setTimeout(120_000);
  const phone=info.project.name==='mobile-chromium';
  await page.setViewportSize(phone?{width:390,height:844}:{width:1280,height:840});
  const handle='fikru-desta-transport';
  const playerOrigin='https://www.youtube-nocookie.com';
  const thumbnailOrigin='https://i.ytimg.com';
  await page.route(`${playerOrigin}/embed/**`,route=>route.fulfill({
    contentType:'text/html',
    body:`<p id="player">Embedded video</p><script>
      window.addEventListener('message',message=>{
        if(message.source===parent&&message.origin===new URL(document.referrer).origin)
          parent.postMessage('{"event":"onStateChange","info":1}',message.origin);
      });
    </script>`
  }));
  const initial=await page.goto('/?provider='+handle,{waitUntil:'domcontentloaded'});
  expect(initial?.headers()['content-security-policy']).not.toContain(playerOrigin);
  await page.locator('.capacity-truck-map-marker:visible').first().click({timeout:35_000});
  await page.getByRole('button',{name:'Vehicle and driver',exact:true}).click();
  const profileLink=page.getByRole('link',{name:'Profile',exact:true});
  await expect(profileLink).toHaveAttribute('href','/@'+handle);
  const profileDocument=page.waitForResponse(response=>response.request().isNavigationRequest()
    &&new URL(response.url()).pathname==='/@'+handle);
  await profileLink.click();
  const profilePolicy=(await profileDocument).headers()['content-security-policy'];
  expect(profilePolicy).toContain(playerOrigin);
  expect(profilePolicy).toContain(thumbnailOrigin);
  await page.getByRole('button',{name:'Play cover video',exact:true}).click();
  await expect(page.frameLocator('.profile-cover iframe').locator('#player')).toBeVisible();
  await expect(page.getByText('Loading video…',{exact:true})).toHaveCount(0);
  const marketDocument=page.waitForResponse(response=>response.request().isNavigationRequest()
    &&new URL(response.url()).pathname==='/');
  await page.getByRole('link',{name:'Back to Open Market',exact:true}).click();
  const marketPolicy=(await marketDocument).headers()['content-security-policy'];
  expect(marketPolicy).not.toContain(playerOrigin);
  expect(marketPolicy).not.toContain(thumbnailOrigin);
  await expect(page).toHaveURL(url=>url.pathname==='/'&&!url.search);
});
