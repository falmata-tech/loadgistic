import {test,expect} from './browser-test';
import sharp from 'sharp';

async function waitForNativeMapPaint(page:any){
  await expect(page.getByRole('progressbar',{name:'Loading truck availability',exact:true})).toHaveCount(0);
  await expect.poll(async()=>{
    const box=await page.locator('.maplibregl-canvas').first().boundingBox();if(!box||box.width<100||box.height<100)return false;
    const bytes=await page.screenshot({clip:{x:box.x+box.width*.2,y:box.y+box.height*.35,width:box.width*.6,height:box.height*.3}});
    const stats=await sharp(bytes).stats();
    return stats.channels.slice(0,3).some((channel:{mean:number})=>channel.mean<248);
  },{timeout:20000,message:'Native basemap must be painted before capturing the map.'}).toBe(true);
}

test('transporter search updates after a pause and applies identity only through Show trucks',async({page}:{page:any},info:any)=>{
  test.setTimeout(90000);
  if(info.project.name==='mobile-chromium')await page.setViewportSize({width:320,height:844});
  const searches:string[]=[],mapRequests:string[]=[];
  page.on('request',(request:any)=>{const url=new URL(request.url());if(url.pathname==='/api/capacity-search')searches.push(url.search);if(url.pathname==='/api/public/capacity')mapRequests.push(url.search);});
  await page.goto('/?status=EMPTY');
  const controls=page.locator('.capacity-map-controls');await expect(controls.getByRole('button')).toHaveCount(2);
  await expect(controls.getByRole('button',{name:'Transporter search',exact:true})).toBeEnabled();
  const people=page.getByRole('complementary',{name:'Transporter search'});
  await expect(people).toBeHidden();expect(searches).toEqual([]);
  await controls.getByRole('button',{name:'Transporter search',exact:true}).click();
  await expect(people).toBeVisible();await expect(people.locator('.capacity-result-card')).toHaveCount(0);expect(searches).toEqual([]);
  const response=await page.request.get('/api/capacity-search?status=EMPTY');expect(response.status()).toBe(200);
  const data=await response.json(),profile=data.items.find((item:any)=>item.kind==='COMPANY')||data.items[0];expect(profile).toBeTruthy();expect(data.items.length).toBeLessThanOrEqual(15);expect(data.pageSize).toBe(15);
  expect((await page.request.get('/api/capacity-search?view=private&q=Addis')).status()).toBe(401);
  const input=people.getByRole('searchbox',{name:'Search transporters'});await input.fill(profile.title);
  await expect(people.locator('.capacity-result-card')).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('q')).toBeNull();
  await expect(people.locator('.capacity-result-card').filter({hasText:profile.title}).first()).toBeVisible({timeout:15000});
  expect(searches.some(query=>new URLSearchParams(query).get('q')===profile.title)).toBe(true);
  expect(new URL(page.url()).searchParams.get('q')).toBeNull();
  expect(mapRequests.every(query=>new URLSearchParams(query).get('q')!==profile.title)).toBe(true);
  const card=people.locator('.capacity-result-card').filter({hasText:profile.title}).first();
  await expect(card.getByRole('link',{name:'Profile',exact:true})).toHaveAttribute('href',`/@${profile.handle}`);
  const clear=people.locator('form.capacity-people-search-form').getByRole('button',{name:'Clear search',exact:true});await expect(clear).toBeVisible();const clearBox=await clear.boundingBox();expect(clearBox!.width).toBeGreaterThanOrEqual(44);expect(clearBox!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({path:info.outputPath('capacity-transporter-search.png')});
  await card.getByRole('link',{name:/Show.*map/}).click();
  await expect(page).toHaveURL((url:URL)=>url.searchParams.get('provider')===profile.handle&&url.searchParams.get('status')==='EMPTY'&&!url.searchParams.has('q'),{timeout:30000});
  await expect(page.locator('.leaflet-container')).toBeVisible();await expect(people).toBeHidden();
  await controls.getByRole('button',{name:/Truck filters/}).click();
  const filters=page.getByRole('dialog',{name:'Truck filters',exact:true});await expect(filters).toBeVisible();
  await expect(filters.getByRole('searchbox')).toHaveCount(0);await expect(filters.locator('input[type="hidden"][name="status"]')).toHaveValue('EMPTY');
  await filters.getByRole('button',{name:'Show matching trucks',exact:true}).click();
  await expect(page).toHaveURL((url:URL)=>url.searchParams.get('provider')===profile.handle&&url.searchParams.get('status')==='EMPTY');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('capacity-selected-profile-map.png')});
});

test('native Capacity preview keeps people-search requests separate from map requests',async({page}:{page:any},info:any)=>{
  test.setTimeout(120000);
  const response=await page.request.get('/api/capacity-search?status=EMPTY');expect(response.status()).toBe(200);
  const profiles=(await response.json()).items,profile=profiles.find((item:any)=>item.kind==='COMPANY')||profiles[0];expect(profile).toBeTruthy();
  const searches:string[]=[],maps:string[]=[],tiles:number[]=[];
  page.on('response',(response:any)=>{if(new URL(response.url()).hostname==='tile.openstreetmap.org')tiles.push(response.status());});
  page.on('request',(request:any)=>{const url=new URL(request.url());if(url.pathname==='/api/mobile/public/discovery')searches.push(url.search);if(url.pathname==='/api/public/capacity')maps.push(url.search);});
  await page.goto('http://127.0.0.1:8084/?q=Draft%20without%20map%20matches');
  await expect(page.getByRole('button',{name:'Transporter search',exact:true})).toBeVisible({timeout:45000});
  await expect.poll(()=>tiles.filter(status=>status===200).length).toBeGreaterThan(0);
  await expect(page.getByText('The map could not load. Check your connection.',{exact:true})).toHaveCount(0);
  await waitForNativeMapPaint(page);
  await expect(page.getByLabel('Search transporters')).toHaveCount(0);expect(searches).toEqual([]);
  await page.getByRole('button',{name:'Transporter search',exact:true}).click();
  await expect(page.getByLabel('Search transporters')).toHaveValue('Draft without map matches');
  await page.getByLabel('Search transporters').fill(profile.title);
  await expect(page.getByText(profile.title,{exact:true}).first()).toBeVisible({timeout:30000});
  expect(searches.some(query=>new URLSearchParams(query).get('q')===profile.title)).toBe(true);
  expect(maps.every(query=>new URLSearchParams(query).get('q')!==profile.title)).toBe(true);
  await page.screenshot({path:info.outputPath('native-capacity-people-search.png')});
  await page.getByRole('button',{name:'Show trucks on map',exact:true}).first().click();
  await expect(page.getByLabel('Search transporters')).toHaveCount(0);
  await expect.poll(()=>maps.some(query=>new URLSearchParams(query).get('provider')===profile.handle)).toBe(true);
  await page.getByRole('button',{name:/Truck filters/}).click();
  await expect(page.getByText('Showing selected profile trucks',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await waitForNativeMapPaint(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('native-capacity-profile-map.png')});
});

test('a saved people-search draft in the URL leaves initial map discovery unfiltered',async({page}:{page:any},info:any)=>{
  test.setTimeout(60000);const draft='No profile named this draft',requests:string[]=[];
  page.on('request',(request:any)=>{const url=new URL(request.url());if(url.pathname==='/api/public/capacity')requests.push(url.search);});
  await page.goto(`/?q=${encodeURIComponent(draft)}`);
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect.poll(()=>page.locator('.leaflet-marker-icon').count()).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Transporter search',exact:true}).click();
  const people=page.getByRole('complementary',{name:'Transporter search'});
  await expect(people.getByRole('searchbox',{name:'Search transporters'})).toHaveValue(draft);
  await expect(people.getByText('No transporters match this search. Try another name, city or service.',{exact:true})).toBeVisible();
  expect(requests.every(query=>!new URLSearchParams(query).get('q'))).toBe(true);
  await page.screenshot({path:info.outputPath('capacity-search-draft-map.png')});
});

test('native explicit profile and truck deep links initialize map filters',async({page}:{page:any},info:any)=>{
  test.setTimeout(90000);
  const response=await page.request.get('/api/public/capacity');expect(response.status()).toBe(200);
  const truck=(await response.json()).items[0];expect(truck).toBeTruthy();
  const maps:string[]=[],searches:string[]=[],tiles:number[]=[];
  page.on('response',(response:any)=>{if(new URL(response.url()).hostname==='tile.openstreetmap.org')tiles.push(response.status());});
  page.on('request',(request:any)=>{const url=new URL(request.url());if(url.pathname==='/api/public/capacity')maps.push(url.search);if(url.pathname==='/api/mobile/public/discovery')searches.push(url.search);});
  await page.goto(`http://127.0.0.1:8084/?${new URLSearchParams({provider:truck.provider_handle,truck:truck.id,q:'Unsubmitted draft'})}`);
  await expect(page.getByRole('button',{name:'Transporter search',exact:true})).toBeVisible({timeout:45000});
  await expect.poll(()=>tiles.filter(status=>status===200).length).toBeGreaterThan(0);
  await expect(page.getByText('The map could not load. Check your connection.',{exact:true})).toHaveCount(0);
  await waitForNativeMapPaint(page);
  await expect.poll(()=>maps.some(query=>{const params=new URLSearchParams(query);return params.get('provider')===truck.provider_handle&&params.get('truck')===truck.id&&!params.has('q');})).toBe(true);
  expect(searches).toEqual([]);
  await page.getByRole('button',{name:/Truck filters/}).click();await expect(page.getByText('Showing selected profile trucks',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await waitForNativeMapPaint(page);
  const exit=page.getByRole('button',{name:'Back to map',exact:true});await expect(exit).toBeVisible();
  await page.screenshot({path:info.outputPath('native-capacity-explicit-identity.png')});
  await exit.click();await expect(exit).toHaveCount(0);
  await page.getByRole('button',{name:'Transporter search',exact:true}).click();await expect(page.getByLabel('Search transporters')).toHaveValue('Unsubmitted draft');
  await page.getByRole('button',{name:'Close transporter search',exact:true}).click();await expect(exit).toHaveCount(0);
  expect(maps.every(query=>new URLSearchParams(query).get('provider')===truck.provider_handle&&new URLSearchParams(query).get('truck')===truck.id)).toBe(true);
});

test('US visitor location can become an obscured web truck-near filter',async({page,context}:{page:any;context:any})=>{
  test.setTimeout(60000);const fix={latitude:41.8781,longitude:-87.6298};
  await context.grantPermissions(['geolocation'],{origin:'http://127.0.0.1:3100'});await context.setGeolocation(fix);
  await page.goto('/');await page.getByRole('button',{name:'Transporter search',exact:true}).click();
  await page.getByRole('button',{name:'Use my location',exact:true}).click();
  await expect(page.getByTestId('visitor-location-state')).toContainText('Location updated');
  await page.getByRole('button',{name:/Truck filters/}).click();const filters=page.getByRole('dialog',{name:'Truck filters',exact:true});
  await filters.getByLabel('Show trucks near my area',{exact:true}).check();
  await filters.getByRole('button',{name:'Show matching trucks',exact:true}).click();
  await expect(page).toHaveURL((url:URL)=>url.searchParams.has('nearLat')&&Number(url.searchParams.get('nearLng'))<0);
  const params=new URL(page.url()).searchParams;
  expect(Number(params.get('nearLat'))).not.toBe(fix.latitude);expect(Number(params.get('nearLng'))).not.toBe(fix.longitude);expect(params.get('nearRadiusKm')).toBe('20');
  const response=await page.request.get(`/api/public/capacity?${params}`);expect(response.status()).toBe(200);expect((await response.json()).filterError).toBeFalsy();
});

test('US visitor location can become an obscured native truck-near filter',async({page,context}:{page:any;context:any})=>{
  test.setTimeout(90000);const fix={latitude:41.8781,longitude:-87.6298},requests:string[]=[];
  await context.grantPermissions(['geolocation'],{origin:'http://127.0.0.1:8084'});await context.setGeolocation(fix);
  page.on('request',(request:any)=>{const url=new URL(request.url());if(url.pathname==='/api/public/capacity')requests.push(url.search);});
  await page.goto('http://127.0.0.1:8084/');await page.getByRole('button',{name:/Truck filters/}).click();
  await page.getByRole('button',{name:'Use my approximate area',exact:true}).click();
  await expect(page.getByRole('button',{name:'Update my approximate area',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Show matching trucks',exact:true}).click();
  await expect.poll(()=>requests.some(query=>Number(new URLSearchParams(query).get('nearLng'))<0)).toBe(true);
  const params=new URLSearchParams(requests.find(query=>Number(new URLSearchParams(query).get('nearLng'))<0));
  expect(Number(params.get('nearLat'))).not.toBe(fix.latitude);expect(Number(params.get('nearLng'))).not.toBe(fix.longitude);expect(params.get('nearRadiusKm')).toBe('50');
});
