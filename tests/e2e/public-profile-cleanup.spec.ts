import {test,expect} from './browser-test';

test('native transporter profile keeps useful detail and scopes its map action above the fleet',async({page},info)=>{
  test.setTimeout(120_000);
  const response=await page.request.get('/api/public/capacity');
  expect(response.ok()).toBe(true);
  const capacity=await response.json();
  const handle=capacity.items[0]?.provider_handle;
  expect(typeof handle).toBe('string');
  const profileResponse=await page.request.get(`/api/mobile/public/providers/${encodeURIComponent(handle)}`);
  expect(profileResponse.ok()).toBe(true);
  const provider=await profileResponse.json();
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.name));
  for(const width of [390,320]){
    await page.setViewportSize({width,height:width===320?640:844});
    await page.goto(`http://localhost:8084/transporter?handle=${encodeURIComponent(handle)}`);
    await expect(page.getByRole('heading',{name:provider.name,exact:true})).toBeVisible({timeout:45_000});
    for(const title of ['Transport services','Regular service','Confirm service details before booking']){
      await expect(page.getByRole('heading',{name:title,exact:true})).toHaveCount(0);
    }
    await expect(page.getByRole('heading',{name:'Documents',exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Verified shipment reviews',exact:true})).toBeVisible();
    const map=page.getByRole('link',{name:'See vehicles on the map',exact:true});
    await expect(map).toHaveAttribute('href',`/?provider=${encodeURIComponent(handle)}`);
    await page.screenshot({path:info.outputPath(`native-profile-overview-${width}.png`),scale:'css'});
    await map.scrollIntoViewIfNeeded();
    const bounds=await map.boundingBox();
    expect(bounds).not.toBeNull();expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width+.5);
    const next=provider.fleet.total>1?page.getByRole('button',{name:new RegExp('^View vehicles and drivers')}):page.getByRole('heading',{name:'Vehicles and published capacity',exact:true});
    await expect(next).toBeVisible();
    expect(bounds!.y+bounds!.height).toBeLessThanOrEqual((await next.boundingBox())!.y+.5);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`native-profile-${width}.png`),fullPage:true,scale:'css'});
  }
  const filtered=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/public/capacity'&&url.searchParams.get('provider')===handle;});
  await page.getByRole('link',{name:'See vehicles on the map',exact:true}).click();
  const result=await filtered;expect(result.ok()).toBe(true);
  const rows=await result.json();expect(rows.items.length).toBeGreaterThan(0);
  expect(rows.items.every((row:{provider_handle:string})=>row.provider_handle===handle)).toBe(true);
  await expect(page.locator('.maplibregl-canvas:visible')).toHaveCount(1);
  expect(errors).toEqual([]);
});
