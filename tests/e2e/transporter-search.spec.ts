import {expect,test} from './browser-test';
import {chooseTruckConfiguration} from './capacity-drawer-helper';

test('web transporter search coalesces issued work, composes text safely and clears without changing the map',async({page},info)=>{
 test.setTimeout(90000);
 const current=await page.request.get('/api/public/capacity');expect(current.ok()).toBe(true);const signal=(await current.json()).items[0];expect(signal).toBeTruthy();
 const seen:{q:string;page:string|null}[]=[],errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
 let releaseFirst=()=>{},releaseClear=()=>{};
 const first=new Promise<void>(resolve=>{releaseFirst=resolve;}),clearPending=new Promise<void>(resolve=>{releaseClear=resolve;});
 await page.route('**/api/capacity-search?**',async route=>{
  const params=new URL(route.request().url()).searchParams,q=params.get('q')||'';seen.push({q,page:params.get('page')});
  if(q==='Older')await first;if(q==='Still pending')await clearPending;
  await route.fulfill({json:{items:[{kind:'COMPANY',key:q,title:q==='Older'?'Obsolete match':q,handle:'example-transporter',matching_trucks:1}],total:31,hasMore:params.get('page')!=='3',page:Number(params.get('page')),pageSize:15}});
 });
 await page.setViewportSize({width:info.project.name==='mobile-chromium'?320:1440,height:900});
 await page.goto(`/?${new URLSearchParams({status:'EMPTY',provider:signal.provider_handle})}`);const map=page.locator('.leaflet-container');await expect(map).toBeVisible();
 await expect.poll(()=>map.locator('.leaflet-tile-loaded').count()).toBeGreaterThan(0);await expect(page.locator('.public-feed-overlay.loading')).toHaveCount(0,{timeout:30000});
 const element=await map.elementHandle(),camera=await map.locator('.leaflet-map-pane').evaluate(node=>(node as HTMLElement).style.transform);
 await page.clock.install();await page.getByRole('button',{name:'Transporter search',exact:true}).click();
 const drawer=page.getByRole('complementary',{name:'Transporter search',exact:true}),input=drawer.getByRole('searchbox',{name:'Search transporters',exact:true}),clear=drawer.locator('form').getByRole('button',{name:'Clear search',exact:true});
 await input.fill('😀');await page.clock.runFor(500);expect(seen).toEqual([]);await expect(drawer.getByText('Enter at least two characters.',{exact:true})).toBeVisible();
 await input.fill('Older');await page.clock.runFor(499);expect(seen).toEqual([]);await page.clock.runFor(1);await expect.poll(()=>seen.length).toBe(1);
 await input.fill('Intermediate');await page.clock.runFor(500);expect(seen.length).toBe(1);await input.fill('Latest');await page.clock.runFor(500);expect(seen.length).toBe(1);
 releaseFirst();await expect(drawer.getByRole('heading',{name:'Latest',exact:true})).toBeVisible();expect(seen.map(item=>item.q)).toEqual(['Older','Latest']);await expect(drawer.getByText('Obsolete match',{exact:true})).toHaveCount(0);
 await drawer.getByRole('button',{name:'Next',exact:true}).click();await expect.poll(()=>seen.at(-1)?.page).toBe('2');
 await input.fill('Fresh query');await page.clock.runFor(500);await expect(drawer.getByRole('heading',{name:'Fresh query',exact:true})).toBeVisible();expect(seen.at(-1)?.page).toBe('1');
 await input.fill('Still pending');await page.clock.runFor(500);await expect.poll(()=>seen.at(-1)?.q).toBe('Still pending');const count=seen.length;
 const box=await clear.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44);
 const hit=await clear.evaluate(node=>{const box=node.getBoundingClientRect(),x=(box.left+box.right)/2,y=(box.top+box.bottom)/2;return [[box.left+2,y],[box.right-2,y],[x,box.top+2],[x,box.bottom-2]].every(([left,top])=>node.contains(document.elementFromPoint(left,top)));});expect(hit).toBe(true);
 await clear.click();await expect(input).toHaveValue('');await expect(input).toBeFocused();releaseClear();await page.clock.runFor(500);await expect(drawer.locator('.capacity-result-card')).toHaveCount(0);expect(seen.length).toBe(count);
 expect(new URL(page.url()).searchParams.get('status')).toBe('EMPTY');expect(new URL(page.url()).searchParams.get('provider')).toBe(signal.provider_handle);expect(await map.evaluate((node,previous)=>node===previous,element)).toBe(true);expect(await map.locator('.leaflet-map-pane').evaluate(node=>(node as HTMLElement).style.transform)).toBe(camera);
 await input.dispatchEvent('compositionstart');await input.fill('አዲ');await page.clock.runFor(500);await input.press('Enter');expect(seen.length).toBe(count);
 await input.dispatchEvent('compositionend');await page.clock.runFor(499);expect(seen.length).toBe(count);await input.press('Enter');await expect.poll(()=>seen.at(-1)?.q).toBe('አዲ');const entered=seen.length;await page.clock.runFor(500);expect(seen.length).toBe(entered);
 await page.getByRole('button',{name:'Close transporter search',exact:true}).click();await expect(drawer).toBeHidden();await page.clock.runFor(500);expect(seen.length).toBe(entered);
 expect(errors).toEqual([]);
});

test('web transporter profiles remain independent of applied truck filters until Show trucks',async({page},info)=>{
 test.setTimeout(90000);await page.setViewportSize({width:320,height:844});
 const available=await page.request.get('/api/capacity-search');expect(available.ok()).toBe(true);const profile=(await available.json()).items.find((item:{kind:string})=>item.kind==='COMPANY');expect(Boolean(profile)).toBe(true);
 const searches:string[]=[],errors:string[]=[];page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/capacity-search')searches.push(url.search);});page.on('pageerror',error=>errors.push(error.name));
 await page.goto('/');await page.getByRole('button',{name:'Transporter search',exact:true}).click();
 const drawer=page.getByRole('complementary',{name:'Transporter search',exact:true}),input=drawer.getByRole('searchbox',{name:'Search transporters',exact:true});
 const first=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/capacity-search'&&url.searchParams.get('q')===profile.title;});
 await input.fill(profile.title);const response=await first;expect(response.ok()).toBe(true);const result=await response.json();expect(result.items.length).toBeLessThanOrEqual(15);
 await expect(drawer.locator('.capacity-result-card').first()).toBeVisible({timeout:15000});
 const before=await drawer.locator('.capacity-result-card').allTextContents(),count=await drawer.locator('.capacity-result-count').textContent(),pagination=drawer.locator('.capacity-result-pagination'),pageNumber=await pagination.count()?await pagination.textContent():null;
 expect(searches.length).toBe(1);
 await page.getByRole('button',{name:/Truck filters/}).click();const dialog=page.getByRole('dialog',{name:'Truck filters',exact:true});await dialog.getByRole('checkbox',{name:'Partly loaded',exact:true}).check();await chooseTruckConfiguration(dialog,'Cargo van');
 await dialog.getByRole('group',{name:'Reviewed documents',exact:true}).getByRole('checkbox',{name:'National ID',exact:true}).first().check();
 await dialog.getByRole('button',{name:'Show matching trucks',exact:true}).click();await expect(page).toHaveURL(url=>url.searchParams.get('status')==='PARTIAL'&&url.searchParams.get('vehicleCategory')==='Cargo van'&&url.searchParams.get('ownerDocs')==='IDENTITY',{timeout:30000});
 await expect(drawer).toBeVisible();await expect(input).toHaveValue(profile.title);await expect(drawer.locator('.capacity-result-card').first()).toBeVisible();
 expect(JSON.stringify(await drawer.locator('.capacity-result-card').allTextContents())===JSON.stringify(before),'Map filters must preserve profile rows and ranking').toBe(true);expect(await drawer.locator('.capacity-result-count').textContent()===count).toBe(true);expect((await pagination.count()?await pagination.textContent():null)===pageNumber).toBe(true);expect(searches.length).toBe(1);
 for(const query of searches){const params=new URLSearchParams(query);expect([...params.keys()].every(key=>['q','page','view','blocked'].includes(key))).toBe(true);expect(params.get('q')).toBe(profile.title);expect(params.get('page')).toBe('1');}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('web-transporter-independent-320.png'),scale:'css'});
 const card=drawer.locator('.capacity-result-card[data-result-kind="COMPANY"]').filter({has:page.getByRole('heading',{name:profile.title,exact:true})}).first(),show=card.getByRole('link',{name:'Show trucks on map',exact:true});
 const target=new URL((await show.getAttribute('href'))!,'http://localhost');expect(target.searchParams.get('status')).toBe('PARTIAL');expect(target.searchParams.get('vehicleCategory')).toBe('Cargo van');expect(target.searchParams.get('ownerDocs')).toBe('IDENTITY');expect(target.searchParams.get('provider')).toBe(profile.handle);
 await show.click();await expect(page).toHaveURL(url=>url.searchParams.get('provider')===profile.handle&&url.searchParams.get('status')==='PARTIAL'&&url.searchParams.get('vehicleCategory')==='Cargo van'&&url.searchParams.get('ownerDocs')==='IDENTITY',{timeout:30000});await expect(drawer).toBeHidden();expect(searches.length).toBe(1);expect(errors).toEqual([]);
});
