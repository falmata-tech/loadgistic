import {test,expect} from './browser-test';
import type {Page,Locator} from 'playwright-core';
import {readFileSync} from 'node:fs';
import {translateMessage} from '../../src/lib/i18n/core';
import {workflowRows} from '../../apps/mobile/src/localization/workflow-messages';
const preview='http://127.0.0.1:8084';
async function bounded(page:Page,target:Locator){const box=await target.boundingBox(),viewport=page.viewportSize()!;expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(viewport.width+.5);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
async function paintedImages(target:Locator){await expect.poll(()=>target.locator('img').evaluateAll(images=>images.length>0&&images.every(image=>image instanceof HTMLImageElement&&image.complete&&image.naturalWidth>0)),{timeout:30_000}).toBe(true);}
async function actualPortrait(target:Locator,label:string,path:string){
 const portrait=target.getByRole('img',{name:label,exact:true}).first();await expect(portrait).toBeVisible();
 if(!path){expect(await portrait.evaluate(element=>element instanceof HTMLImageElement||Boolean(element.querySelector('img')))).toBe(false);return;}
 await expect.poll(()=>portrait.evaluate(element=>{const image=element instanceof HTMLImageElement?element:element.querySelector('img');return Boolean(image?.complete&&image.naturalWidth>0);}),{timeout:30_000}).toBe(true);
 const expected=new URL(path,preview);expect(await portrait.evaluate(element=>{const image=element instanceof HTMLImageElement?element:element.querySelector('img');const source=new URL(image?.currentSrc||image?.src||'');return source.pathname+source.search;})).toBe(expected.pathname+expected.search);
}
async function settledNativeModal(page:Page){await expect.poll(()=>page.getByRole('button',{name:'Close map signal details',exact:true}).last().evaluate(element=>{for(let node:Element|null=element;node;node=node.parentElement)if(Number(getComputedStyle(node).opacity)<1)return false;return true;})).toBe(true);}

test('native Featured and transporter cards retain real facts and destinations in readable bounded groups',async({page},info)=>{
 test.setTimeout(150_000);const response=await page.request.get('/api/mobile/public/featured');expect(response.ok()).toBe(true);const feature=await response.json();expect(feature.trucks.length).toBeGreaterThan(0);const truck=feature.trucks.find((truck:{portrait:string})=>truck.portrait)||feature.trucks[0],errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
 const widths=info.project.name==='mobile-chromium'?[390,320]:[1280];
 for(const width of widths){
  await page.setViewportSize({width,height:width===320?640:width===1280?900:844});await page.goto(preview+'/featured');await expect(page.getByRole('button',{name:'Weekly themes',exact:true})).toBeVisible({timeout:45_000});
  const heading=page.getByRole('heading',{name:truck.driver,exact:true}).first(),card=page.getByTestId('public-summary-card').filter({has:heading}).first();await expect(heading).toBeVisible();await bounded(page,card);await paintedImages(card);
  await actualPortrait(card,truck.driver,truck.portrait);
  for(const value of [truck.name,truck.driverKind,truck.truck,truck.configuration,truck.place])await expect(card).toContainText(value);
  const profile=card.getByRole('link',{name:'Transporter profile',exact:true});await expect(profile).toHaveAttribute('href',`/transporter?handle=${encodeURIComponent(truck.handle)}`);await profile.click({trial:true});expect((await profile.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.getByRole('link',{name:'Transporter profile',exact:true}).count()).toBe(feature.trucks.length+feature.sponsors.filter((sponsor:{kind:string})=>sponsor.kind==='TRANSPORTER').length);
  expect(await card.getByRole('link',{name:'View available vehicles',exact:true}).count()).toBe(truck.available?1:0);
  await page.screenshot({path:info.outputPath(`native-featured-${width}.png`),scale:'css'});
  await card.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath(`native-featured-card-${width}.png`),scale:'css'});
  await page.getByRole('button',{name:'View schedule',exact:true}).click();await expect(page.getByRole('button',{name:'Hide schedule',exact:true})).toBeVisible();await page.getByRole('button',{name:'Hide schedule',exact:true}).click();
  await profile.click();const providerResponse=await page.request.get(`/api/mobile/public/providers/${encodeURIComponent(truck.handle)}`);expect(providerResponse.ok()).toBe(true);const provider=await providerResponse.json();await expect(page.getByRole('heading',{name:provider.name,exact:true})).toBeVisible({timeout:30_000});await bounded(page,page.getByRole('heading',{name:provider.name,exact:true}));
  for(const [field,label] of [['phone','Call transporter'],['whatsapp','WhatsApp'],['email','Email transporter'],['website','Website']] as const)expect(await page.getByRole('button',{name:label,exact:true}).count()).toBe(provider.contacts[field]?1:0);
  await actualPortrait(page.locator('body'),provider.name,provider.image);
  await expect(page.getByRole('heading',{name:'Documents',exact:true})).toBeVisible();await page.screenshot({path:info.outputPath(`native-transporter-${width}.png`),scale:'css'});
  if(provider.trucks.length){const fleet=page.getByRole('button',{name:/^View vehicles and drivers \(/});if(await fleet.count())await fleet.click();const row=provider.trucks[0],truckCard=page.getByTestId('public-summary-card').filter({has:page.getByRole('heading',{name:row.name,exact:true})}).first();await actualPortrait(truckCard,row.driver||'Driver not named',row.portrait);await bounded(page,truckCard);await truckCard.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath(`native-transporter-driver-portrait-${width}.png`),scale:'css'});}
  await page.getByRole('button',{name:'Report content',exact:true}).first().scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Report content',exact:true}).first()).toBeVisible();
  await page.goBack();await expect(page.getByRole('button',{name:'Weekly themes',exact:true})).toBeVisible({timeout:45_000});
 }
 expect(errors).toEqual([]);
});

test('native Capacity facts remain readable while details close and selected exit preserves applied filters',async({page},info)=>{
 test.setTimeout(150_000);const response=await page.request.get('/api/public/capacity');expect(response.ok()).toBe(true);const payload=await response.json(),signal=payload.items.find((item:{current_signal_geometry_visible?:boolean;assigned_driver_portrait_url?:string})=>item.current_signal_geometry_visible!==false&&item.assigned_driver_portrait_url)||payload.items.find((item:{current_signal_geometry_visible?:boolean})=>item.current_signal_geometry_visible!==false);expect(signal).toBeTruthy();const errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
 for(const width of info.project.name==='mobile-chromium'?[390,320]:[1280]){
  await page.setViewportSize({width,height:width===320?640:width===1280?900:844});const params=new URLSearchParams({truck:signal.id});await page.goto(`${preview}/?${params}`);await expect(page.getByRole('button',{name:'Vehicle details',exact:true})).toBeVisible({timeout:45_000});
  await page.getByRole('button',{name:/^Vehicle filters/}).click();await page.getByRole('button',{name:'Any configuration',exact:true}).click();await page.getByRole('checkbox',{name:signal.cargo_configuration,exact:true}).check();await page.getByRole('button',{name:'Close',exact:true}).click();
  const applied=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/public/capacity'&&url.searchParams.get('vehicleCategory')===signal.cargo_configuration;});await page.getByRole('button',{name:'Show matching vehicles',exact:true}).click();expect((await applied).ok()).toBe(true);await expect(page.getByRole('progressbar',{name:'Loading vehicle availability',exact:true})).toHaveCount(0,{timeout:30_000});
  const markerName=`${[signal.vehicle_make,signal.vehicle_model].filter(Boolean).join(' ')}, ${signal.assigned_driver_first_name}, ${signal.status==='EMPTY'?'Empty':'Partial'}`;await page.getByRole('button',{name:markerName,exact:true}).click();
  await page.getByRole('button',{name:'Vehicle details',exact:true}).click();await settledNativeModal(page);const title=page.getByRole('heading',{name:'Vehicle details',exact:true});await expect(title).toBeVisible();await bounded(page,title);
  await expect(page.getByText(signal.provider_name,{exact:true}).last()).toBeVisible();await expect(page.getByText(signal.assigned_driver_first_name,{exact:true}).last()).toBeVisible();const profile=page.getByRole('link',{name:'Profile',exact:true});await expect(profile).toHaveAttribute('href',`/transporter?handle=${encodeURIComponent(signal.provider_handle)}`);await profile.click({trial:true});
  await actualPortrait(page.locator('body'),signal.assigned_driver_first_name,signal.assigned_driver_portrait_url||'');
  await page.screenshot({path:info.outputPath(`native-truck-details-${width}.png`),scale:'css'});
  const confirmation=page.getByText('Confirm availability directly.',{exact:true});await confirmation.scrollIntoViewIfNeeded();await expect(confirmation).toBeVisible();await page.screenshot({path:info.outputPath(`native-truck-updates-${width}.png`),scale:'css'});
  await page.getByRole('button',{name:'Close map signal details',exact:true}).last().click();await expect(title).toHaveCount(0);await expect(page.getByRole('button',{name:'Back to map',exact:true})).toBeVisible();
  if(signal.availability_geometry==='ROUTE'){await page.getByRole('button',{name:'Capacity route',exact:true}).click();await settledNativeModal(page);for(const point of signal.current_route_points)await expect(page.getByText(point.label,{exact:true}).last()).toBeVisible();await page.getByRole('button',{name:'Close map signal details',exact:true}).last().click();}
  await page.getByRole('button',{name:'Back to map',exact:true}).click();await expect(page.getByRole('button',{name:'Vehicle details',exact:true})).toHaveCount(0);await expect(page.locator('.maplibregl-canvas').first()).toBeVisible();
  await page.getByRole('button',{name:/^Vehicle filters/}).click();await expect(page.getByRole('button',{name:signal.cargo_configuration,exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.goto(`${preview}/transporter?handle=${encodeURIComponent(signal.provider_handle)}`);await expect(page.getByRole('heading',{name:signal.provider_name,exact:true})).toBeVisible({timeout:30_000});
  const fleet=page.getByRole('button',{name:/^View vehicles and drivers \(/});if(await fleet.count())await fleet.click();
  const mapAction=page.getByRole('link',{name:'View capacity on map',exact:true}).first();await expect(mapAction).toHaveAttribute('href',`/?provider=${encodeURIComponent(signal.provider_handle)}`);
  const matching=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/public/capacity'&&url.searchParams.get('provider')===signal.provider_handle;});
  await mapAction.click();const matched=await matching;expect(matched.ok()).toBe(true);const result=await matched.json();expect(result.items.length).toBeGreaterThan(0);expect(result.items.every((item:{provider_handle:string})=>item.provider_handle===signal.provider_handle)).toBe(true);
  await expect(page).toHaveURL(url=>url.searchParams.get('provider')===signal.provider_handle&&!url.searchParams.has('q'));await expect(page.locator('.maplibregl-canvas:visible')).toHaveCount(1);await expect(page.locator('.maplibregl-canvas:visible')).toBeVisible();
 }
 expect(errors).toEqual([]);
});

test('web Featured facts and truck identities keep existing actions with readable phone typography',async({page},info)=>{
 test.setTimeout(120_000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
 for(const width of info.project.name==='mobile-chromium'?[390,320]:[1280]){
  await page.setViewportSize({width,height:width===320?640:width===1280?900:844});await page.goto('/featured');const card=page.locator('.featured-provider-tile').first();await expect(card).toBeVisible();await paintedImages(card);await bounded(page,page.locator('.featured-board-stage'));
  expect(await card.locator('.featured-card-details small').last().evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(12);
  await page.screenshot({path:info.outputPath(`web-featured-${width}.png`),scale:'css'});await card.click();await expect(page.locator('.featured-truck-dialog')).toBeVisible();await expect(page.locator('.featured-truck-dialog').getByRole('link',{name:'Transporter profile',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close featured vehicle details',exact:true}).click();await expect(page.locator('.featured-truck-dialog')).toHaveCount(0);
  const response=await page.request.get('/api/public/capacity'),payload=await response.json(),signal=payload.items.find((item:{current_signal_geometry_visible?:boolean})=>item.current_signal_geometry_visible!==false);expect(response.ok()&&signal).toBeTruthy();await page.goto(`/?truck=${encodeURIComponent(signal.id)}`);await page.getByRole('button',{name:'Vehicle details',exact:true}).click();await expect(page.locator('.truck-inspection')).toBeVisible();await bounded(page,page.locator('.truck-inspection'));
  if(width<=480)expect(await page.locator('.truck-inspection-people').evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(1);
  await expect(page.locator('.truck-inspection').getByRole('link',{name:'Profile',exact:true})).toBeVisible();await page.screenshot({path:info.outputPath(`web-truck-details-${width}.png`),scale:'css'});
 }
 expect(errors).toEqual([]);
});

test('native card labels translate in four languages while public record content stays unchanged',async({page},info)=>{
 test.skip(info.project.name!=='mobile-chromium','One phone language review covers the changed native card labels.');test.setTimeout(180_000);await page.setViewportSize({width:390,height:844});
 const response=await page.request.get('/api/mobile/public/featured');expect(response.ok()).toBe(true);const feature=await response.json(),truck=feature.trucks[0];expect(truck).toBeTruthy();const names={am:'አማርኛ',om:'Afaan Oromo'};let previous:Record<string,string>={};
 await page.goto(preview+'/featured');await expect(page.getByRole('button',{name:'Weekly themes',exact:true})).toBeVisible({timeout:45_000});
 for(const locale of ['am','om'] as const){
  const column={am:1,om:2,so:3,ti:4}[locale],catalog={...JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8')),...Object.fromEntries(workflowRows.map(row=>[row[0],row[column]]))},t=(message:string)=>translateMessage(catalog,message);
  await page.getByRole('button',{name:translateMessage(previous,'Language'),exact:true}).click();await page.getByRole('radio',{name:names[locale],exact:true}).click();await page.getByRole('dialog').getByRole('button').click();await expect(page.getByRole('dialog')).toHaveCount(0);
  const card=page.getByTestId('public-summary-card').filter({has:page.getByRole('heading',{name:truck.driver,exact:true})}).first();await expect(card).toContainText(truck.name);await expect(card).toContainText(truck.place);await expect(card).toContainText(t(truck.driverKind));await expect(card).toContainText(t(truck.configuration));await paintedImages(card);await bounded(page,card);
  const action=card.getByRole('link',{name:t('Transporter profile'),exact:true});await action.click({trial:true});expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);await page.screenshot({path:info.outputPath(`native-featured-${locale}-390.png`),scale:'css'});await action.click();
  const providerResponse=await page.request.get(`/api/mobile/public/providers/${encodeURIComponent(truck.handle)}`);expect(providerResponse.ok()).toBe(true);const provider=await providerResponse.json();await expect(page.getByRole('heading',{name:provider.name,exact:true})).toBeVisible({timeout:30_000});await expect(page.locator('body')).toContainText(t(provider.kind));if(provider.headline)await expect(page.getByText(provider.headline,{exact:true})).toBeVisible();await bounded(page,page.getByRole('heading',{name:provider.name,exact:true}));
  for(const [field,label] of [['phone','Call transporter'],['whatsapp','WhatsApp'],['email','Email transporter'],['website','Website']] as const)expect(await page.getByRole('button',{name:t(label),exact:true}).count()).toBe(provider.contacts[field]?1:0);
  await page.screenshot({path:info.outputPath(`native-transporter-${locale}-390.png`),scale:'css'});await page.goto(preview+'/featured');await expect(page.getByRole('button',{name:t('Weekly themes'),exact:true})).toBeVisible({timeout:45_000});previous=catalog;
 }
});
