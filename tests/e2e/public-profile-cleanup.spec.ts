import {test,expect} from './browser-test';

test('native transporter profile keeps useful detail and shows its scoped map above the fleet',async({page},info)=>{
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
    const scoped=page.waitForResponse(r=>{const url=new URL(r.url());return url.pathname==='/api/public/capacity'&&url.searchParams.get('provider')===handle;});
    await page.goto(`http://localhost:8084/transporter?handle=${encodeURIComponent(handle)}`);
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
    await page.getByTestId('provider-fleet-disclosure').click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`native-profile-${width}.png`),fullPage:true,scale:'css'});
  }
  expect(errors).toEqual([]);
});
