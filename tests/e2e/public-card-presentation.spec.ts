import {test,expect} from './browser-test';
import type {Page,Locator} from 'playwright-core';
import {readFileSync} from 'node:fs';
import {translateMessage} from '../../src/lib/i18n/core';
import {workflowRows} from '../../apps/mobile/src/localization/workflow-messages';
import {locationSourceLabel} from '../../src/lib/location-source.js';
import {reportedSpacePercent} from '../../src/lib/capacity-space-estimate.js';
import {FEATURED_PUBLIC_HEADING} from '../../src/lib/featured-heading-presentation.js';
const preview='http://127.0.0.1:8084';
async function bounded(page:Page,target:Locator){const box=await target.boundingBox(),viewport=page.viewportSize()!;expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(viewport.width+.5);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
async function featuredTimesStayOnOneLine(times:Locator){return times.evaluateAll(nodes=>nodes.every(node=>{const range=document.createRange();range.selectNodeContents(node);const rects=[...range.getClientRects()].filter(rect=>rect.width>0);return /^\d{1,2}:\d{2}(?:AM|PM)–\d{1,2}:\d{2}(?:AM|PM) EAT$/.test(node.textContent||'')&&rects.length===1&&rects[0].width<=node.clientWidth+1;}));}
async function paintedImages(target:Locator){await expect.poll(()=>target.locator('img').evaluateAll(images=>images.length>0&&images.every(image=>image instanceof HTMLImageElement&&image.complete&&image.naturalWidth>0)),{timeout:30_000}).toBe(true);}
async function actualPortrait(target:Locator,label:string,path:string){
 const portrait=target.getByRole('img',{name:label,exact:true}).first();await expect(portrait).toBeVisible();
 if(!path){expect(await portrait.evaluate(element=>element instanceof HTMLImageElement||Boolean(element.querySelector('img')))).toBe(false);return;}
 await expect.poll(()=>portrait.evaluate(element=>{const image=element instanceof HTMLImageElement?element:element.querySelector('img');return Boolean(image?.complete&&image.naturalWidth>0);}),{timeout:30_000}).toBe(true);
 const expected=new URL(path,preview);expect(await portrait.evaluate(element=>{const image=element instanceof HTMLImageElement?element:element.querySelector('img');const source=new URL(image?.currentSrc||image?.src||'');return source.pathname+source.search;})).toBe(expected.pathname+expected.search);
}
async function settledNativeModal(page:Page){await expect.poll(()=>page.getByRole('button',{name:'Close map signal details',exact:true}).last().evaluate(element=>{for(let node:Element|null=element;node;node=node.parentElement)if(Number(getComputedStyle(node).opacity)<1)return false;return true;})).toBe(true);}

async function featuredForProfileReview(page:Page){
 const response=await page.request.get('/api/mobile/public/featured');expect(response.ok()).toBe(true);
 const current=await response.json();
 if(current.trucks.length>1)return current;
 // Keep programme setup inside the browser. The profiles and their images still
 // come from the local app, even on a day without a published programme.
 const trucks=[];
 for(const [index,handle] of ['blueline-transport','abebe-owner-operator'].entries()){
  const response=await page.request.get(`/api/mobile/public/providers/${handle}?view=map`);expect(response.ok()).toBe(true);
  const provider=await response.json();
  trucks.push({slot:index+1,name:provider.name,handle,portrait:provider.image,place:provider.city,
   isCompany:provider.isCompany,fleetSize:provider.fleet.total,available:false,driver:'',driverKind:'',truck:'',configuration:'',image:''});
 }
 const feature={...current,published:true,trucks,start:'22:30',end:'23:59',programme:trucks.map(({slot})=>({
  kind:'PROVIDER',slot,label:'',startsAt:`${current.date}T19:30:00Z`,endsAt:`${current.date}T20:59:00Z`,timeLabel:'22:30–23:59'
 }))};
 await page.route(`${preview}/api/mobile/public/featured`,route=>route.fulfill({json:feature}));
 return feature;
}

test('native Featured account and transporter cards retain real facts and destinations in readable bounded groups',async({page},info)=>{
 test.setTimeout(150_000);const feature=await featuredForProfileReview(page);const truck=feature.trucks.find((truck:{portrait:string})=>truck.portrait)||feature.trucks[0],errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
 const widths=info.project.name==='mobile-chromium'?[390,320]:[1280];
 for(const width of widths){
  await page.setViewportSize({width,height:width===320?640:width===1280?900:844});await page.goto(preview+'/featured');await expect(page.getByRole('heading',{name:FEATURED_PUBLIC_HEADING,exact:true})).toBeVisible({timeout:45_000});
  const tile=page.getByTestId('featured-account-tile').filter({hasText:truck.name}).first();await expect(tile).toBeVisible({timeout:45_000});await bounded(page,tile);
  await actualPortrait(tile,truck.name,truck.portrait);
  for(const value of [truck.name,truck.handle,String(truck.fleetSize)])await expect(tile).toContainText(value);
  await expect(tile).toContainText(/\d{1,2}:\d{2}(?:AM|PM)–\d{1,2}:\d{2}(?:AM|PM) EAT/);await expect(page.getByRole('button',{name:'How Featured works',exact:true})).toHaveCount(0);
  await expect(page.getByTestId('featured-account-tile')).toHaveCount(feature.trucks.length);
  if(width<=390){const first=await page.getByTestId('featured-account-tile').nth(0).boundingBox(),second=await page.getByTestId('featured-account-tile').nth(1).boundingBox();expect(first&&second).toBeTruthy();expect(Math.abs(first!.y-second!.y)).toBeLessThanOrEqual(1);expect(second!.x).toBeGreaterThan(first!.x+first!.width);}
  await page.screenshot({path:info.outputPath(`native-featured-${width}.png`),scale:'css'});
  await tile.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath(`native-featured-card-${width}.png`),scale:'css'});
  await page.getByRole('button',{name:'View schedule',exact:true}).click();await expect(page.getByRole('button',{name:'Hide schedule',exact:true})).toBeVisible();
  const times=page.getByTestId('featured-schedule-time');await expect(times).toHaveCount(feature.programme.length);expect(await featuredTimesStayOnOneLine(times)).toBe(true);await page.screenshot({path:info.outputPath(`native-featured-schedule-${width}.png`),scale:'css'});await page.getByRole('button',{name:'Hide schedule',exact:true}).click();
  await tile.click();const close=page.getByRole('button',{name:'Close featured account details',exact:true}).last();await expect(close).toBeVisible();if(truck.place)await expect(page.getByText(truck.place,{exact:true}).last()).toBeVisible();
  const profile=page.getByRole('link',{name:'Transporter profile',exact:true}).last();await expect(profile).toHaveAttribute('href',`/transporter?handle=${encodeURIComponent(truck.handle)}`);await profile.click({trial:true});expect((await profile.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const vehicles=page.getByRole('link',{name:'View available vehicles',exact:true});expect(await vehicles.count()).toBe(truck.available?1:0);if(truck.available)await expect(vehicles).toHaveAttribute('href',`/?provider=${encodeURIComponent(truck.handle)}`);
  await close.click();await expect(vehicles).toHaveCount(0);await tile.click();
  await page.getByRole('link',{name:'Transporter profile',exact:true}).last().click();
  const providerResponse=await page.request.get(`/api/mobile/public/providers/${encodeURIComponent(truck.handle)}?view=map`);expect(providerResponse.ok()).toBe(true);const provider=await providerResponse.json();expect(provider.trucks).toEqual([]);await expect(page.getByRole('heading',{name:provider.name,exact:true})).toBeVisible({timeout:30_000});await bounded(page,page.getByRole('heading',{name:provider.name,exact:true}));
  for(const [field,label] of [['phone','Call transporter'],['whatsapp','WhatsApp'],['email','Email transporter'],['website','Website']] as const)expect(await page.getByRole('button',{name:label,exact:true}).count()).toBe(provider.contacts[field]?1:0);
  await actualPortrait(page.locator('body'),provider.name,provider.image);
  const documents=page.getByRole('button',{name:'Account documents',exact:true});
  await expect(documents).toHaveAttribute('aria-expanded','false');await documents.click();await expect(documents).toHaveAttribute('aria-expanded','true');
  const map=page.getByTestId('profile-fleet-map');await expect(map.locator('.maplibregl-canvas')).toBeVisible();await bounded(page,map);
  await expect(page.getByTestId('provider-fleet-disclosure')).toHaveCount(0);
  await page.screenshot({path:info.outputPath(`native-transporter-${width}.png`),scale:'css'});
  await page.getByRole('button',{name:'Report content',exact:true}).first().scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Report content',exact:true}).first()).toBeVisible();
  await page.goBack();await expect(page.getByRole('heading',{name:FEATURED_PUBLIC_HEADING,exact:true})).toBeVisible({timeout:45_000});
 }
 expect(errors).toEqual([]);
});

test('native Featured board and detail fit an English 320px phone',async({page},info)=>{
 test.skip(info.project.name!=='mobile-chromium','The compact layout check targets a narrow phone.');test.setTimeout(90_000);
 await page.setViewportSize({width:320,height:640});
 const response=await page.request.get('/api/mobile/public/featured');expect(response.ok()).toBe(true);const feature=await response.json();expect(feature.trucks.length).toBeGreaterThan(1);
 await page.goto(preview+'/featured');const tiles=page.getByTestId('featured-account-tile');await expect(tiles).toHaveCount(feature.trucks.length,{timeout:45_000});
 const first=await tiles.nth(0).boundingBox(),second=await tiles.nth(1).boundingBox();expect(first&&second).toBeTruthy();expect(Math.abs(first!.y-second!.y)).toBeLessThanOrEqual(1);expect(second!.x).toBeGreaterThan(first!.x+first!.width);
 await bounded(page,tiles.nth(0));await bounded(page,tiles.nth(1));await page.screenshot({path:info.outputPath('native-featured-english-320.png'),scale:'css'});
 await page.getByRole('button',{name:'View schedule',exact:true}).click();await expect(page.getByRole('button',{name:'Hide schedule',exact:true})).toBeVisible();await page.getByRole('button',{name:'Hide schedule',exact:true}).click();
 await tiles.nth(0).click();const close=page.getByRole('button',{name:'Close featured account details',exact:true}).last();await expect(close).toBeVisible();
 await expect(close.locator('..').getByRole('link',{name:'Transporter profile',exact:true})).toHaveAttribute('href',`/transporter?handle=${encodeURIComponent(feature.trucks[0].handle)}`);
 await page.screenshot({path:info.outputPath('native-featured-detail-english-320.png'),scale:'css'});await close.click();await expect(close).toHaveCount(0);
});

test('native Capacity facts remain readable while details close and selected exit preserves applied filters',async({page},info)=>{
 test.setTimeout(150_000);const response=await page.request.get('/api/public/capacity');expect(response.ok()).toBe(true);const payload=await response.json(),signal=payload.items.find((item:{current_signal_geometry_visible?:boolean;assigned_driver_portrait_url?:string})=>item.current_signal_geometry_visible!==false&&item.assigned_driver_portrait_url)||payload.items.find((item:{current_signal_geometry_visible?:boolean})=>item.current_signal_geometry_visible!==false);expect(signal).toBeTruthy();const errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
 const percent=reportedSpacePercent(signal.status,signal.available_percent,signal.available_percent_reported_at);
 for(const width of info.project.name==='mobile-chromium'?[390,320]:[1280]){
  await page.setViewportSize({width,height:width===320?640:width===1280?900:844});const params=new URLSearchParams({truck:signal.id});await page.goto(`${preview}/?${params}`);await expect(page.getByRole('button',{name:'Vehicle and driver',exact:true})).toBeVisible({timeout:45_000});
  await page.getByRole('button',{name:/^Vehicle filters/}).click();await page.getByRole('button',{name:'All vehicle types',exact:true}).click();await page.getByRole('checkbox',{name:signal.cargo_configuration,exact:true}).check();await page.getByRole('button',{name:'Close',exact:true}).click();
  const applied=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/public/capacity'&&url.searchParams.get('vehicleCategory')===signal.cargo_configuration;});await page.getByRole('button',{name:'Show vehicles',exact:true}).click();expect((await applied).ok()).toBe(true);await expect(page.getByRole('progressbar',{name:'Loading vehicle availability',exact:true})).toHaveCount(0,{timeout:30_000});
  const sourceLabel=locationSourceLabel(signal.location_source),demo=signal.current_signal_geometry_visible!==false&&signal.location_lat!==null&&signal.location_lng!==null&&signal.location_is_demo===true;
  const markerName=`${[signal.vehicle_make,signal.vehicle_model].filter(Boolean).join(' ')}, ${signal.assigned_driver_first_name}, ${signal.status==='EMPTY'?'Empty':'Partial'}${percent===null?'':`, Available space: ${percent}%`}${sourceLabel?', '+sourceLabel:''}${demo?', Demo location':''}`;
  const marker=page.getByRole('button',{name:markerName,exact:true});
  await expect(marker).toBeVisible();
  if(percent!==null)await expect(marker).toContainText(`${percent}%`);
  // The explicit truck query already selected this vehicle; inspect its control once.
  await expect(page.getByRole('button',{name:'Vehicle and driver',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Vehicle and driver',exact:true}).click();await settledNativeModal(page);const title=page.getByRole('heading',{name:'Vehicle details',exact:true});await expect(title).toBeVisible();await bounded(page,title);
  await expect(page.getByText(signal.provider_name,{exact:true}).last()).toBeVisible();await expect(page.getByText(signal.assigned_driver_first_name,{exact:true}).last()).toBeVisible();const profile=page.getByRole('link',{name:'Profile',exact:true});await expect(profile).toHaveAttribute('href',`/transporter?handle=${encodeURIComponent(signal.provider_handle)}`);await profile.click({trial:true});
  await actualPortrait(page.locator('body'),signal.assigned_driver_first_name,signal.assigned_driver_portrait_url||'');
  await page.screenshot({path:info.outputPath(`native-truck-details-${width}.png`),scale:'css'});
  const confirmation=page.getByText('Confirm availability directly.',{exact:true});await confirmation.scrollIntoViewIfNeeded();await expect(confirmation).toBeVisible();await page.screenshot({path:info.outputPath(`native-truck-updates-${width}.png`),scale:'css'});
  await page.getByRole('button',{name:'Close map signal details',exact:true}).last().click();await expect(title).toHaveCount(0);await expect(page.getByRole('button',{name:'Back to map',exact:true})).toBeVisible();
  if(signal.availability_geometry==='ROUTE'){await page.getByRole('button',{name:'Planned route',exact:true}).click();await settledNativeModal(page);for(const point of signal.current_route_points)await expect(page.getByText(point.label,{exact:true}).last()).toBeVisible();await page.getByRole('button',{name:'Close map signal details',exact:true}).last().click();}
  await page.getByRole('button',{name:'Back to map',exact:true}).click();await expect(page.getByRole('button',{name:'Vehicle and driver',exact:true})).toHaveCount(0);await expect(page.locator('.maplibregl-canvas').first()).toBeVisible();
  await page.getByRole('button',{name:/^Vehicle filters/}).click();await expect(page.getByRole('button',{name:signal.cargo_configuration,exact:true})).toBeVisible();await page.getByRole('button',{name:'Close filters',exact:true}).click();
  const profileScope=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/public/capacity'&&url.searchParams.get('provider')===signal.provider_handle;});
  await page.goto(`${preview}/transporter?handle=${encodeURIComponent(signal.provider_handle)}`);await expect(page.getByRole('heading',{name:signal.provider_name,exact:true})).toBeVisible({timeout:30_000});
  await expect(page.getByTestId('profile-fleet-map').locator('.maplibregl-canvas')).toBeVisible();
  await expect(page.getByTestId('provider-fleet-disclosure')).toHaveCount(0);
  const matched=await profileScope;expect(matched.ok()).toBe(true);const result=await matched.json();
  expect(result.items.length).toBeGreaterThan(0);
  expect(result.items.every((item:{provider_handle:string})=>item.provider_handle===signal.provider_handle)).toBe(true);
  const selectedTruck=signal.id;
  const marketScope=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/public/capacity'&&url.searchParams.get('provider')===signal.provider_handle&&url.searchParams.get('truck')===selectedTruck;});
  await page.goto(`${preview}/?${new URLSearchParams({provider:signal.provider_handle,truck:selectedTruck})}`);
  const market=await marketScope;expect(market.ok()).toBe(true);
  const selectedSignal=(await market.json()).items.find((item:{id:string})=>item.id===selectedTruck);expect(selectedSignal).toBeTruthy();
  await expect(page.getByRole('button',{name:'Vehicle and driver',exact:true})).toBeVisible();
  const incompatible=selectedSignal.cargo_configuration==='Courier car'?'Cargo van':'Courier car';
  await page.getByRole('button',{name:/^Vehicle filters/}).click();await page.getByRole('button',{name:'All vehicle types',exact:true}).click();await page.getByRole('checkbox',{name:incompatible,exact:true}).check();await page.getByRole('button',{name:'Close',exact:true}).click();
  const excluded=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/public/capacity'&&url.searchParams.get('vehicleCategory')===incompatible;});await page.getByRole('button',{name:'Show vehicles',exact:true}).click();const excludedResult=await excluded;expect(excludedResult.ok()).toBe(true);expect((await excludedResult.json()).items.some((item:{id:string})=>item.id===selectedTruck)).toBe(false);
  await expect(page.getByRole('progressbar',{name:'Loading vehicle availability',exact:true})).toHaveCount(0,{timeout:30_000});await expect(page.getByRole('button',{name:'Vehicle and driver',exact:true})).toHaveCount(0);
 }
 expect(errors).toEqual([]);
});

test('web Featured account facts keep existing actions with readable phone typography',async({page},info)=>{
 test.setTimeout(120_000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
 const featuredResponse=await page.request.get('/api/mobile/public/featured');expect(featuredResponse.ok()).toBe(true);const feature=await featuredResponse.json();
 const showsBroadcast=['LIVE','SCHEDULED'].includes(feature.tiktokStatus)&&Boolean(feature.tiktokUrl)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(feature.start);
 for(const width of info.project.name==='mobile-chromium'?[390,320]:[1280]){
  await page.setViewportSize({width,height:width===320?640:width===1280?900:844});await page.goto('/featured');const card=page.locator('.featured-provider-tile').first();await expect(card).toBeVisible();await paintedImages(card);await bounded(page,page.locator('.featured-board-stage'));await expect(page.locator('#featured-provider-title')).toHaveText(FEATURED_PUBLIC_HEADING);await expect(page.getByText('How Featured works',{exact:true})).toHaveCount(0);await expect(page.getByText('Meet the transport accounts in today’s showcase and explore the vehicles they publish.',{exact:true})).toHaveCount(0);await expect(card.locator('em')).toHaveText(/\d{1,2}:\d{2}(?:AM|PM)–\d{1,2}:\d{2}(?:AM|PM) EAT/);
  expect(await featuredTimesStayOnOneLine(page.locator('.featured-provider-tile em'))).toBe(true);
  const broadcast=page.locator('.featured-tiktok-status');if(showsBroadcast){await expect(broadcast).toContainText('TikTok LIVE');await bounded(page,broadcast);expect(await broadcast.evaluate(element=>{const text=element.querySelector('strong');if(!text)return false;const box=element.getBoundingClientRect(),label=text.getBoundingClientRect();return label.right<=box.right+1&&label.bottom<=box.bottom+1;})).toBe(true);}else await expect(broadcast).toHaveCount(0);
  expect(await card.locator('.featured-card-details small').last().evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(12);
  await page.screenshot({path:info.outputPath(`web-featured-${width}.png`),scale:'css'});await card.click();await expect(page.locator('.featured-truck-dialog')).toBeVisible();await expect(page.locator('.featured-truck-dialog').getByRole('link',{name:'Transporter profile',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close featured account details',exact:true}).click();await expect(page.locator('.featured-truck-dialog')).toHaveCount(0);
  const response=await page.request.get('/api/public/capacity'),payload=await response.json(),signal=payload.items.find((item:{current_signal_geometry_visible?:boolean})=>item.current_signal_geometry_visible!==false);expect(response.ok()&&signal).toBeTruthy();await page.goto(`/?truck=${encodeURIComponent(signal.id)}`);await page.getByRole('button',{name:'Vehicle and driver',exact:true}).click();await expect(page.locator('.truck-inspection')).toBeVisible();await bounded(page,page.locator('.truck-inspection'));
  if(width<=480)expect(await page.locator('.truck-inspection-people').evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(1);
  await expect(page.locator('.truck-inspection').getByRole('link',{name:'Profile',exact:true})).toBeVisible();await page.screenshot({path:info.outputPath(`web-truck-details-${width}.png`),scale:'css'});
 }
 expect(errors).toEqual([]);
});

test('native card labels translate in Amharic and Oromo while public record content stays unchanged',async({page},info)=>{
 test.skip(info.project.name!=='mobile-chromium','One phone language review covers the changed native card labels.');test.setTimeout(180_000);await page.setViewportSize({width:390,height:844});
 const response=await page.request.get('/api/mobile/public/featured');expect(response.ok()).toBe(true);const feature=await response.json(),truck=feature.trucks[0];expect(truck).toBeTruthy();const names={am:'አማርኛ',om:'Afaan Oromo'};let previous:Record<string,string>={};
 await page.goto(preview+'/featured');await expect(page.getByRole('heading',{name:FEATURED_PUBLIC_HEADING,exact:true})).toBeVisible({timeout:45_000});
 for(const locale of ['am','om'] as const){
  const column={am:1,om:2,so:3,ti:4}[locale],catalog={...JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8')),...Object.fromEntries(workflowRows.map(row=>[row[0],row[column]]))},t=(message:string)=>translateMessage(catalog,message);
  await page.getByRole('button',{name:translateMessage(previous,'Language'),exact:true}).click();await page.getByRole('radio',{name:names[locale],exact:true}).click();await page.getByRole('dialog').getByRole('button').click();await expect(page.getByRole('dialog')).toHaveCount(0);
  const tile=page.getByTestId('featured-account-tile').filter({hasText:truck.name}).first();await expect(tile).toBeVisible({timeout:45_000});await expect(tile).toContainText(truck.handle);await expect(tile).toContainText(t('Transport Provider'));await actualPortrait(tile,truck.name,truck.portrait);await bounded(page,tile);
  await page.screenshot({path:info.outputPath(`native-featured-${locale}-390.png`),scale:'css'});await page.getByRole('button',{name:t('View schedule'),exact:true}).click();const times=page.getByTestId('featured-schedule-time');await expect(times).toHaveCount(feature.programme.length);expect(await featuredTimesStayOnOneLine(times)).toBe(true);await page.screenshot({path:info.outputPath(`native-featured-schedule-${locale}-390.png`),scale:'css'});await page.getByRole('button',{name:t('Hide schedule'),exact:true}).click();await tile.click();if(truck.place)await expect(page.getByText(truck.place,{exact:true}).last()).toBeVisible();
  const action=page.getByRole('link',{name:t('Transporter profile'),exact:true}).last();await action.click({trial:true});expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);await action.click();
  const providerResponse=await page.request.get(`/api/mobile/public/providers/${encodeURIComponent(truck.handle)}`);expect(providerResponse.ok()).toBe(true);const provider=await providerResponse.json();await expect(page.getByRole('heading',{name:provider.name,exact:true})).toBeVisible({timeout:30_000});await expect(page.locator('body')).toContainText(t(provider.kind));if(provider.headline)await expect(page.getByText(provider.headline,{exact:true})).toBeVisible();await bounded(page,page.getByRole('heading',{name:provider.name,exact:true}));
  for(const [field,label] of [['phone','Call transporter'],['whatsapp','WhatsApp'],['email','Email transporter'],['website','Website']] as const)expect(await page.getByRole('button',{name:t(label),exact:true}).count()).toBe(provider.contacts[field]?1:0);
  await page.screenshot({path:info.outputPath(`native-transporter-${locale}-390.png`),scale:'css'});await page.goto(preview+'/featured');await expect(page.getByRole('heading',{name:t(FEATURED_PUBLIC_HEADING),exact:true})).toBeVisible({timeout:45_000});previous=catalog;
 }
});
