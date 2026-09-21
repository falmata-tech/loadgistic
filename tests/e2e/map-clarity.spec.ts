import {openCapacityFilters} from './capacity-drawer-helper';
import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

const captures=path.resolve('artifacts/map-clarity-review-2026-09-21');
function distanceKm(a:any,b:any){
  const r=Math.PI/180,dLat=(b.lat-a.lat)*r,dLng=(b.lng-a.lng)*r;
  return 6371*2*Math.asin(Math.sqrt(Math.sin(dLat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLng/2)**2));
}

test('city and distance filter matches reported truck locations without GPS permission',async({page}: {page:any},info:any)=>{
  test.setTimeout(90000);mkdirSync(captures,{recursive:true});
  await page.addInitScript(()=>{(window as any).__geoCalls=0;Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(_:any,fail:any)=>{(window as any).__geoCalls++;fail({code:1,PERMISSION_DENIED:1});}}});});
  await page.goto('/');await expect(page.locator('.leaflet-container')).toBeVisible();
  await openCapacityFilters(page);
  await page.getByLabel('In or near a city',{exact:true}).fill('Adama');
  const suggestion=page.locator('#capacity-truck-city-results .place-result').first();
  await expect(suggestion).toBeVisible();await suggestion.click();
  const cityRef=await page.locator('input[name="truckCityPlaceRef"]').inputValue();
  expect(cityRef).toBeTruthy();
  await page.getByLabel('Distance from city',{exact:true}).selectOption('25');
  await page.locator('.capacity-truck-location-filter').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(captures,`${info.project.name}-city-filter.png`),scale:'css'});
  await page.getByRole('button',{name:'Show matching trucks'}).click();
  await expect(page).toHaveURL(/truckCityPlaceRef=/);
  const url=new URL(page.url());expect(url.searchParams.get('truckLocationRadiusKm')).toBe('25');
  expect(url.searchParams.has('nearLat')).toBe(false);
  expect(await page.evaluate(()=>(window as any).__geoCalls)).toBe(0);
  const places=await (await page.request.get('/api/places?q=Adama')).json();
  const city=places.results.find((p:any)=>p.id===cityRef);expect(city).toBeTruthy();
  let cursor='';const ids=new Set();let pages=0;
  do{
    const params=new URLSearchParams({truckCityPlaceRef:cityRef,truckLocationRadiusKm:'25',cursor});
    const response=await page.request.get(`/api/public/capacity?${params}`);expect(response.ok()).toBe(true);
    const data=await response.json();expect(data.filterError).toBeFalsy();
    for(const truck of data.items){
      expect(ids.has(truck.id)).toBe(false);ids.add(truck.id);
      expect(distanceKm(city,{lat:Number(truck.location_lat),lng:Number(truck.location_lng)})).toBeLessThanOrEqual(25+Number(truck.location_precision_km||20)+1.5);
    }
    cursor=data.nextCursor||'';pages++;expect(pages).toBeLessThan(25);
  }while(cursor);
  expect(ids.size).toBeGreaterThan(0);
  const invalid=await (await page.request.get('/api/public/capacity?truckCityPlaceRef=missing-city')).json();
  expect(invalid.items).toEqual([]);expect(invalid.filterError).toContain('Choose a suggested place');
  expect((await page.request.get(`/api/shared-capacity?truckCityPlaceRef=${encodeURIComponent(cityRef)}`)).status()).toBe(401);
  await openCapacityFilters(page);
  await expect(page.getByLabel('In or near a city',{exact:true})).not.toHaveValue('');
  await expect(page.getByLabel('Distance from city',{exact:true})).toHaveValue('25');
});

test('blue location feedback stays by controls and the small map key opens within the screen',async({page,context}: {page:any;context:any},info:any)=>{
  test.setTimeout(60000);mkdirSync(captures,{recursive:true});
  await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:9.03,longitude:38.74});
  await page.goto('/');await openCapacityFilters(page);
  const status=page.getByTestId('visitor-location-state');await expect(status).toContainText('Location updated');
  await expect(page.locator('.market-command-column').getByTestId('visitor-location-state')).toBeVisible();
  await expect(page.locator('.public-map-shell').getByTestId('visitor-location-state')).toHaveCount(0);
  await expect(page.locator('.public-viewer-location-marker')).toHaveAttribute('fill','#1a73e8');
  const key=page.locator('.public-map-legend');await expect(key).not.toHaveAttribute('open','');
  const summary=key.locator('summary');const closed=await summary.boundingBox();expect(closed.width).toBeLessThan(100);expect(closed.height).toBeGreaterThanOrEqual(44);
  await summary.click();await expect(key.locator('.public-map-legend-items')).toBeVisible();
  const box=await key.locator('.public-map-legend-items').boundingBox();const size=page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(size.width);expect(box.height).toBeLessThan(200);
  const colors=await key.evaluate((el:HTMLElement)=>({location:getComputedStyle(el.querySelector('.privacy')!,'::before').borderColor,regular:getComputedStyle(el.querySelector('.corridor')!,'::before').borderTopColor}));
  expect(colors.location).toContain('26, 115, 232');expect(colors.regular).toBe('rgb(192, 102, 32)');
  await expect.poll(()=>page.locator('.leaflet-tile').evaluateAll((tiles:HTMLImageElement[])=>tiles.length>0&&tiles.every(tile=>tile.complete&&tile.naturalWidth>0)),{timeout:20000}).toBe(true);
  await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:30000});
  await page.screenshot({path:path.join(captures,`${info.project.name}-map-key.png`),scale:'css'});
  await summary.click();await expect(key.locator('.public-map-legend-items')).toBeHidden();
});

test('signal detail card preserves wheel zoom and drag across its body',async({page}: {page:any},info:any)=>{
  test.setTimeout(90000);mkdirSync(captures,{recursive:true});
  const data=await (await page.request.get('/api/public/capacity')).json();
  const truck=data.items.find((t:any)=>t.current_signal_geometry_visible!==false&&t.location_lat!=null);expect(truck).toBeTruthy();
  const windows:string[]=[];page.on('request',(r:any)=>{const u=new URL(r.url());if(u.pathname==='/api/public/capacity'&&u.searchParams.has('viewport'))windows.push(u.searchParams.get('viewport')!);});
  await page.goto(`/?truck=${encodeURIComponent(truck.id)}`);
  const circle=page.locator('.map-location-privacy-circle');await expect(circle).toBeVisible();await expect(circle).toHaveAttribute('stroke','#1a73e8');
  await circle.focus();await page.keyboard.press('Enter');
  const panel=page.locator('.capacity-signal-inspector.pinned');await expect(panel).toBeVisible();
  await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:30000});
  await expect.poll(()=>windows.length,{timeout:20000}).toBeGreaterThan(0);
  await expect.poll(()=>page.locator('.leaflet-tile').evaluateAll((tiles:HTMLImageElement[])=>tiles.length>0&&tiles.every(tile=>tile.complete&&tile.naturalWidth>0)),{timeout:20000}).toBe(true);
  await page.screenshot({path:path.join(captures,`${info.project.name}-signal-detail.png`),scale:'css'});
  const before=windows.at(-1);expect(before).toBeTruthy();
  let box=await panel.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,-350);
  await expect.poll(()=>windows.at(-1)).not.toBe(before);
  const zoomed=windows.at(-1)!;const width=(v:string)=>{const b=v.split(',').map(Number);return b[2]-b[0];};expect(width(zoomed)).toBeLessThan(width(before!));
  await expect(panel).toBeVisible();box=await panel.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2-70,box.y+box.height/2,{steps:8});await page.mouse.up();
  await expect.poll(()=>windows.at(-1)).not.toBe(zoomed);
  if(info.project.name.includes('mobile')){
    const beforeTouch=windows.at(-1);box=await panel.boundingBox();
    const cdp=await page.context().newCDPSession(page);
    const point={x:box.x+box.width/2,y:box.y+box.height/2};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
    for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x-i*12,y:point.y}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect.poll(()=>windows.at(-1)).not.toBe(beforeTouch);await cdp.detach();
  }
  await panel.getByRole('button',{name:'Close map signal details'}).click();await expect(panel).toHaveCount(0);
  const sheet=page.locator('.map-capacity-sheet');await expect(sheet).toBeVisible();
  const beforeSheet=windows.at(-1);const copy=await sheet.locator('.map-truck-identity').boundingBox();
  await page.mouse.move(copy.x+copy.width/2,copy.y+copy.height/2);await page.mouse.down();await page.mouse.move(copy.x+copy.width/2-55,copy.y+copy.height/2,{steps:6});await page.mouse.up();
  await expect.poll(()=>windows.at(-1)).not.toBe(beforeSheet);
  await sheet.getByRole('button',{name:'Close truck summary'}).click();await expect(sheet).toHaveCount(0);

});
