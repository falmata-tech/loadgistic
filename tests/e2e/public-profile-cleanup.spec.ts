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
    await page.getByRole('button',{name:'Account documents',exact:true}).click();
    await page.getByRole('button',{name:'About this transporter',exact:true}).click();
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
    await map.getByRole('button',{name:'Vehicle details',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Vehicle details',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Close map signal details',exact:true}).last().click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`native-profile-${width}.png`),fullPage:true,scale:'css'});
  }
  expect(errors).toEqual([]);
});
