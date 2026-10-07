import {openCapacityFilters,openCapacityFilterDialog,closeCapacityFilters} from './capacity-drawer-helper';
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
  await openCapacityFilterDialog(page);
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
  // This checks control geometry and colors, not external tile availability.
  // Keep real Leaflet tile loading, using a clearly synthetic image response.
  await page.route('https://tile.openstreetmap.org/**',async(route:any)=>route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eef3f1"/><path d="M0 128H256M128 0V256" stroke="#d7e1dc"/></svg>'}));
  await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:9.03,longitude:38.74});
  await page.goto('/');await openCapacityFilters(page);
  await page.getByRole('button',{name:'Use my location',exact:true}).click();
  const status=page.getByTestId('visitor-location-state');await expect(status).toContainText('Location updated');
  await expect(page.locator('.market-command-column').getByTestId('visitor-location-state')).toBeVisible();
  await expect(page.locator('.public-map-shell').getByTestId('visitor-location-state')).toHaveCount(0);
  await expect(page.locator('.public-viewer-location-marker')).toHaveAttribute('fill','#1a73e8');
  await closeCapacityFilters(page);
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

test('modal scroll leaves camera still and map zoom resumes after dismissal',async({page}:{page:any},info:any)=>{
 test.setTimeout(90000);mkdirSync(captures,{recursive:true});
 const data=await(await page.request.get('/api/public/capacity')).json();
 const truck=data.items.find((t:any)=>t.current_signal_geometry_visible!==false&&t.location_lat!=null);expect(truck).toBeTruthy();
 await page.goto(`/?truck=${encodeURIComponent(truck.id)}`);
 const circle=page.locator('.map-location-privacy-circle'),panel=page.locator('.capacity-info-card');
 await expect(circle).toBeVisible({timeout:30000});await circle.focus();await expect(panel).toHaveCount(0);
 await page.keyboard.press('Enter');await expect(panel).toBeVisible();
 await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:30000});
 const map=page.locator('.leaflet-proxy'),zoom=()=>map.evaluate((el:HTMLElement)=>el.style.transform);
 const before=await zoom();const box=await panel.boundingBox();await page.mouse.move(box.x+30,box.y+55);await page.mouse.wheel(0,180);await page.waitForTimeout(400);expect(await zoom()).toBe(before);
 await panel.getByRole('button',{name:'Close map signal details'}).click();await expect(panel).toHaveCount(0);await expect(circle).toBeVisible();
 await page.locator('.leaflet-control-zoom-in').click();await expect.poll(zoom).not.toBe(before);
 await page.locator('.map-info-bubble.truck').click();await expect(panel).toHaveClass(/truck/);
 await page.screenshot({path:path.join(captures,`${info.project.name}-signal-detail.png`),scale:'css'});
});
