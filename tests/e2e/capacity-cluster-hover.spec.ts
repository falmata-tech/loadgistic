import {expect,test} from './browser-test';

test('an Empty vehicle cluster has one readable label and zooms when activated',async({page},info)=>{
  test.setTimeout(150_000);
  const response=await page.request.get('/api/public/capacity?status=EMPTY');
  expect(response.ok()).toBe(true);
  const data=await response.json();
  const [first,second]=data.items.filter((item:{
    account_is_demo?:boolean;current_signal_geometry_visible?:boolean;
    location_lat?:number|null;location_lng?:number|null;
  })=>item.account_is_demo&&item.current_signal_geometry_visible!==false&&item.location_lat!=null&&item.location_lng!=null);
  expect(first&&second).toBeTruthy();
  // Co-locate existing public demo records in this browser response only.
  const nearby={...second,location_lat:first.location_lat,location_lng:first.location_lng};
  await page.route('**/api/public/capacity?**',route=>route.fulfill({
    json:{...data,items:[first,nearby],hasMore:false,nextCursor:null},
  }));
  await page.goto('/?status=EMPTY',{waitUntil:'commit'});
  const cluster=page.getByRole('button',{name:'2 empty vehicles',exact:true});
  await expect(cluster).toBeVisible({timeout:30_000});
  await expect(cluster).toHaveAttribute('aria-label','2 empty vehicles');
  await expect(cluster).not.toHaveAttribute('title',/./);
  if(info.project.name==='desktop-chromium'){
    const tooltip=page.locator('.capacity-marker-tooltip');
    for(const [width,height] of [[1280,800],[360,740]]){
      await page.setViewportSize({width,height});
      await cluster.hover();
      await expect(tooltip).toHaveText('2 empty vehicles');
      await expect.poll(()=>tooltip.evaluate(el=>{
        const text=document.createRange();
        text.selectNodeContents(el);
        return [...text.getClientRects()].filter(rect=>rect.width>0).length;
      })).toBe(1);
      await page.screenshot({path:info.outputPath(`cluster-hover-${width}.png`),scale:'css'});
    }
  }
  const camera=page.locator('.leaflet-proxy');
  const before=await camera.getAttribute('style');
  await cluster.click();
  await expect.poll(()=>camera.getAttribute('style')).not.toBe(before);
  await expect(cluster).toBeVisible();
  await expect(page.locator('.capacity-truck-map-marker.spread,.capacity-fan-connector')).toHaveCount(0);
});
