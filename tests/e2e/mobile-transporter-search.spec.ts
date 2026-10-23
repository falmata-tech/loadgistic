import {test,expect} from './browser-test';
import type {Page,Locator} from 'playwright-core';
import {readFileSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
import {translateMessage} from '../../src/lib/i18n/core';
import {workflowRows} from '../../apps/mobile/src/localization/workflow-messages';

const preview='http://127.0.0.1:8084';
async function clearTarget(page:Page,button:Locator){
 await button.click({trial:true});const box=await button.boundingBox();expect(box).toBeTruthy();
 expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44);
 expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
 expect(await button.evaluate(element=>{const bounds=element.getBoundingClientRect();const hit=document.elementFromPoint(bounds.x+bounds.width/2,bounds.y+bounds.height/2);return hit===element||element.contains(hit);})).toBe(true);
}
async function paintedMap(page:Page){
 await expect(page.getByRole('progressbar',{name:'Loading vehicle availability',exact:true})).toHaveCount(0,{timeout:30_000});
 await expect(page.locator('.maplibregl-canvas:visible')).toHaveCount(1);
 await expect.poll(async()=>{const box=await page.locator('.maplibregl-canvas:visible').boundingBox();if(!box)return false;const stats=await sharp(await page.screenshot({clip:{x:box.x+box.width*.2,y:box.y+box.height*.3,width:box.width*.6,height:box.height*.3}})).stats();return stats.channels.slice(0,3).some(channel=>channel.mean<248&&channel.stdev>4);},{timeout:30_000,message:'The real basemap must paint before the review capture.'}).toBe(true);
}

test('Expo transporter search coalesces typing and clears inline without reloading the phone map',async({page},info)=>{
 test.skip(info.project.name!=='mobile-chromium','One phone preview covers native 390 and 320 layouts.');test.setTimeout(120_000);
 const response=await page.request.get('/api/capacity-search?status=EMPTY');expect(response.ok()).toBe(true);
 const profiles=(await response.json()).items,profile=profiles.find((item:{kind:string;title:string})=>item.kind==='COMPANY'&&Array.from(item.title).length>3);expect(profile).toBeTruthy();
 const maps:URL[]=[],searches:{url:URL;at:number}[]=[],errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.name));page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/public/capacity')maps.push(url);if(url.pathname==='/api/mobile/public/discovery')searches.push({url,at:Date.now()});});
 await page.setViewportSize({width:390,height:844});await page.goto(`${preview}/?provider=${encodeURIComponent(profile.handle)}`);
 await expect(page.getByRole('button',{name:'Transporter search',exact:true})).toBeVisible({timeout:45_000});await paintedMap(page);
 const canvas=page.locator('.maplibregl-canvas:visible');await canvas.evaluate(node=>node.setAttribute('data-search-map-proof','preserved'));const mapCount=maps.length;
 expect(maps.every(url=>url.searchParams.get('provider')===profile.handle&&!url.searchParams.has('q'))).toBe(true);expect(searches).toEqual([]);
 await page.getByRole('button',{name:'Transporter search',exact:true}).click();const input=page.getByLabel('Search transporters',{exact:true}),clear=page.getByRole('button',{name:'Clear search',exact:true});await clearTarget(page,clear);
 await input.fill('😀');await expect(page.getByText('Enter at least two characters.',{exact:true})).toBeVisible();await page.waitForTimeout(650);expect(searches).toEqual([]);

 // Hold one genuine authorized response after its server work finishes. This
 // proves newer text cannot start another transport or show obsolete matches.
 let release:()=>void=()=>{},held=false;const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/mobile/public/discovery?**',async route=>{if(held){await route.continue();return;}held=true;const result=await route.fetch();expect(result.ok()).toBe(true);await gate;await route.fulfill({response:result});});
 try{
  const firstQuery=Array.from(profile.title).slice(0,2).join(''),started=Date.now();await input.fill(firstQuery);
  await expect.poll(()=>searches.length).toBe(1);expect(searches[0].at-started).toBeGreaterThanOrEqual(475);
  await input.fill('Newest discarded interest');await page.waitForTimeout(650);expect(searches).toHaveLength(1);
  await clear.click();await expect(input).toHaveValue('');await expect(page.getByRole('button',{name:'Show vehicles on map',exact:true})).toHaveCount(0);
  await input.fill(profile.title);await page.waitForTimeout(650);expect(searches).toHaveLength(1);
  const current=page.waitForResponse(result=>{const url=new URL(result.url());return url.pathname==='/api/mobile/public/discovery'&&url.searchParams.get('q')===profile.title;});release();expect((await current).ok()).toBe(true);
  await expect(page.getByText(profile.title,{exact:true}).first()).toBeVisible({timeout:30_000});expect(searches).toHaveLength(2);expect(searches[1].url.searchParams.get('page')).toBe('1');expect(searches[1].url.searchParams.has('provider')).toBe(false);
  await clearTarget(page,clear);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await clear.click();await expect(input).toHaveValue('');await expect(page.getByRole('button',{name:'Show vehicles on map',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Close transporter search',exact:true}).click();
  await expect(input).toHaveCount(0);await expect(canvas).toHaveAttribute('data-search-map-proof','preserved');expect(maps).toHaveLength(mapCount);
  await page.getByRole('button',{name:/^Vehicle filters/}).click();await expect(page.getByText('Showing selected profile vehicles',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 }finally{release();await page.unroute('**/api/mobile/public/discovery?**');}
 expect(errors).toEqual([]);
});

test('Expo transporter search clear targets remain usable in English and Amharic on narrow phones',async({page},info)=>{
 test.skip(info.project.name!=='mobile-chromium','One native phone language review covers the changed controls.');test.setTimeout(120_000);
 // Review captures use ordinary, unmodified local API responses only.
 const response=await page.request.get('/api/capacity-search?status=EMPTY');expect(response.ok()).toBe(true);const profiles=(await response.json()).items,profile=profiles.find((item:{kind:string})=>item.kind==='COMPANY');expect(profile).toBeTruthy();
 const maps:URL[]=[],errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/public/capacity')maps.push(url);});
 await page.setViewportSize({width:390,height:844});await page.goto(`${preview}/?provider=${encodeURIComponent(profile.handle)}`);await expect(page.getByRole('button',{name:'Transporter search',exact:true})).toBeVisible({timeout:45_000});await paintedMap(page);
 const canvas=page.locator('.maplibregl-canvas:visible');await canvas.evaluate(node=>node.setAttribute('data-search-map-proof','preserved'));const mapCount=maps.length;
 await page.getByRole('button',{name:'Transporter search',exact:true}).click();const input=page.getByLabel('Search transporters',{exact:true}),clear=page.getByRole('button',{name:'Clear search',exact:true});await input.fill(profile.title);await expect(page.getByText(profile.title,{exact:true}).first()).toBeVisible({timeout:30_000});
 for(const width of [390,320]){await page.setViewportSize({width,height:width===320?640:844});await clearTarget(page,clear);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`native-transporter-search-en-${width}.png`),scale:'css'});}
 await clear.click();await expect(input).toHaveValue('');await expect(page.getByRole('button',{name:'Show vehicles on map',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Close transporter search',exact:true}).click();await expect(input).toHaveCount(0);
 const catalog={...JSON.parse(readFileSync('src/lib/i18n/messages/am.json','utf8')),...Object.fromEntries(workflowRows.map(row=>[row[0],row[1]]))},t=(message:string)=>translateMessage(catalog,message);
 await page.getByRole('button',{name:'Language',exact:true}).click();await page.getByRole('radio',{name:'አማርኛ',exact:true}).click();await page.getByRole('dialog').getByRole('button').click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:t('Transporter search'),exact:true}).click();const translatedInput=page.getByLabel(t('Search transporters'),{exact:true}),translatedClear=page.getByRole('button',{name:t('Clear search'),exact:true});await clearTarget(page,translatedClear);
 await translatedInput.fill(profile.title);await expect(page.getByText(profile.title,{exact:true}).first()).toBeVisible({timeout:30_000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('native-transporter-search-am-320.png'),scale:'css'});
 await translatedClear.click();await expect(translatedInput).toHaveValue('');await page.screenshot({path:info.outputPath('native-transporter-search-am-cleared-320.png'),scale:'css'});await page.getByRole('button',{name:t('Close transporter search'),exact:true}).click();
 await expect(canvas).toHaveAttribute('data-search-map-proof','preserved');expect(maps).toHaveLength(mapCount);expect(errors).toEqual([]);
});

test('Expo transporter profiles remain independent of applied truck filters until Show trucks',async({page},info)=>{
 test.skip(info.project.name!=='mobile-chromium','One genuine phone workflow checks native profile/map separation.');test.setTimeout(120_000);
 const loadStarted=Date.now(),seenCursors=new Set<string>(),mapLoads:Array<{status:number;elapsedMs:number;items:number|null;hasMore:boolean|null;hasCursor:boolean;repeatedCursor:boolean}>=[];
 page.on('response',async response=>{
  if(new URL(response.url()).pathname!=='/api/public/capacity'||mapLoads.length>=40)return;
  const cursor=new URL(response.url()).searchParams.get('cursor')||'';
  const row={status:response.status(),elapsedMs:Date.now()-loadStarted,items:null as number|null,hasMore:null as boolean|null,hasCursor:Boolean(cursor),repeatedCursor:Boolean(cursor)&&seenCursors.has(cursor)};
  if(cursor)seenCursors.add(cursor);
  mapLoads.push(row);
  try{const body=await response.json();row.items=Array.isArray(body.items)?body.items.length:null;row.hasMore=typeof body.hasMore==='boolean'?body.hasMore:null;}catch{/* No response body or raw transport error is retained. */}
  writeFileSync(info.outputPath('native-profile-map-load-counts.json'),JSON.stringify(mapLoads),{mode:0o600});
 });
 const seedResponse=await page.request.get('/api/capacity-search?page=1');expect(seedResponse.ok()).toBe(true);const profiles=(await seedResponse.json()).items,profile=profiles.find((item:{kind:string})=>item.kind==='COMPANY');expect(profile).toBeTruthy();
 const searches:URL[]=[],maps:URL[]=[],errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));page.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/mobile/public/discovery')searches.push(url);if(url.pathname==='/api/public/capacity')maps.push(url);});
 await page.setViewportSize({width:390,height:844});await page.goto(preview+'/');await expect(page.getByRole('button',{name:'Transporter search',exact:true})).toBeVisible({timeout:45_000});await paintedMap(page);const initialMapCount=maps.length;
 await page.getByRole('button',{name:'Transporter search',exact:true}).click();const input=page.getByLabel('Search transporters',{exact:true});
 const baselineResponse=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/mobile/public/discovery'&&url.searchParams.get('q')===profile.title;});await input.fill(profile.title);const baselineHttp=await baselineResponse;expect(baselineHttp.ok()).toBe(true);const baseline=await baselineHttp.json();expect(baseline.items.length).toBeGreaterThan(0);await expect(page.getByText(profile.title,{exact:true}).first()).toBeVisible({timeout:30_000});expect(maps).toHaveLength(initialMapCount);
 expect([...searches[0].searchParams.keys()].sort()).toEqual(['page','q']);const resultActions=page.getByRole('button',{name:'Show vehicles on map',exact:true});await expect(resultActions).toHaveCount(baseline.items.length);
 await page.getByRole('button',{name:/^Vehicle filters/}).click();await page.getByRole('checkbox',{name:'Partly loaded',exact:true}).check();await page.getByRole('button',{name:'Any configuration',exact:true}).click();await page.getByRole('checkbox',{name:'Cargo van',exact:true}).check();await page.getByRole('button',{name:'Close',exact:true}).click();
 const applied=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/public/capacity'&&url.searchParams.get('status')==='PARTIAL'&&url.searchParams.get('vehicleCategory')==='Cargo van';});await page.getByRole('button',{name:'Show vehicles',exact:true}).click();expect((await applied).ok()).toBe(true);
 await expect(page.getByRole('progressbar',{name:'Loading vehicle availability',exact:true})).toHaveCount(0,{timeout:30_000});await expect(input).toHaveValue(profile.title);await expect(resultActions).toHaveCount(baseline.items.length);await page.waitForTimeout(650);expect(searches,'map filter changes must leave the existing profile result and search scope intact').toHaveLength(1);
 const filteredMapCount=maps.length,canvas=page.locator('.maplibregl-canvas:visible');await canvas.evaluate(node=>node.setAttribute('data-search-map-proof','filtered-map-preserved'));
 const repeated=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/public/discovery');await page.getByRole('button',{name:'Search',exact:true}).click();const repeatedHttp=await repeated;expect(repeatedHttp.ok()).toBe(true);const current=await repeatedHttp.json();
 expect({items:current.items,total:current.total,page:current.page,hasMore:current.hasMore}).toEqual({items:baseline.items,total:baseline.total,page:baseline.page,hasMore:baseline.hasMore});expect(searches[1].search).toBe(searches[0].search);await expect(resultActions).toHaveCount(baseline.items.length);await expect(canvas).toHaveAttribute('data-search-map-proof','filtered-map-preserved');expect(maps).toHaveLength(filteredMapCount);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('native-independent-profile-search-390.png'),scale:'css'});
 const identity=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/public/capacity'&&url.searchParams.get('provider')===profile.handle&&url.searchParams.get('status')==='PARTIAL'&&url.searchParams.get('vehicleCategory')==='Cargo van'&&!url.searchParams.has('q');});
 const matchingProfiles=current.items.filter((item:{key:string})=>item.key===profile.key);expect(matchingProfiles).toHaveLength(1);
 const profileIndex=current.items.findIndex((item:{key:string})=>item.key===profile.key);expect(profileIndex).toBeGreaterThanOrEqual(0);
 await resultActions.nth(profileIndex).click();expect((await identity).ok()).toBe(true);await expect(input).toHaveCount(0);expect(errors).toEqual([]);
});
