import {test,expect} from './browser-test';
import {chooseCapacityOptions,chooseTruckConfiguration,openCapacityFilterDialog} from './capacity-drawer-helper';
import type {Page} from 'playwright-core';
import {writeFileSync} from 'node:fs';
import {focusedBrowserEvidence} from '../../scripts/lib/focused-browser-evidence.mjs';

const configurations=['Cargo van','Mini Box Truck'];
const selection=(page:Page,key:string)=>page.locator(`.capacity-filter-dialog input[type="hidden"][name="${key}"]`);

test('five current multi-option filter groups remain draft until apply and clear back to the map',async({page},info)=>{
 test.setTimeout(90_000);await page.goto('/');await expect(page.locator('.leaflet-container')).toBeVisible();
 const before=page.url(),dialog=await openCapacityFilterDialog(page,'availability');
 await chooseTruckConfiguration(dialog,configurations);
 await expect(selection(page,'loadType')).toHaveCount(0);
 await chooseCapacityOptions(dialog,'status',['EMPTY','PARTIAL']);await chooseCapacityOptions(dialog,'locationSource',['GPS','MOBILE']);
 await dialog.getByRole('button',{name:'Route',exact:true}).click();
 await chooseCapacityOptions(dialog,'stopOption',['MULTI_PICK','MULTI_DROP']);
 await dialog.locator('[data-filter-section="more"] > summary').click();
 await chooseCapacityOptions(dialog,'freshness',['FRESH','UPDATE_NEEDED']);
 const expected={vehicleCategory:'Cargo van,Mini Box Truck',status:'EMPTY,PARTIAL',locationSource:'GPS,MOBILE',stopOption:'MULTI_DROP,MULTI_PICK',freshness:'FRESH,UPDATE_NEEDED'};
 for(const [key,value] of Object.entries(expected)){await expect(selection(page,key)).toHaveCount(1);await expect(selection(page,key)).toHaveValue(value);}
 expect(page.url()).toBe(before);await expect(dialog.getByRole('group',{name:'Reviewed documents',exact:true})).toContainText('Every selected document must match.');
 await expect(dialog.getByRole('combobox',{name:'Direction',exact:true})).toHaveCount(1);await expect(dialog.getByRole('combobox',{name:'Distance from city',exact:true})).toHaveCount(1);
 await dialog.locator('.capacity-configuration-picker summary').click();await dialog.evaluate((element:HTMLElement)=>{element.scrollTop=0;});
 await page.screenshot({path:info.outputPath('multiple-filter-draft.png'),scale:'css'});
 if(info.project.name==='mobile-chromium'){
  const original=page.viewportSize()!;
  for(const width of [390,320]){
   await page.setViewportSize({width,height:width===320?640:844});await dialog.evaluate((element:HTMLElement)=>{element.scrollTop=0;});
   const box=await dialog.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:info.outputPath(`multiple-filter-draft-${width}.png`),scale:'css'});
  }
  await page.setViewportSize(original);
 }
 await dialog.getByRole('button',{name:'Show vehicles',exact:true}).click();
 await expect(page).toHaveURL(url=>!url.searchParams.has('loadType')&&Object.entries(expected).every(([key,value])=>url.searchParams.get(key)===value&&url.searchParams.getAll(key).length===1));
 await expect(page.locator('.public-feed-overlay.loading')).not.toBeVisible({timeout:30_000});
 await openCapacityFilterDialog(page);await chooseCapacityOptions(dialog,'status',['EMPTY']);await expect(selection(page,'status')).toHaveValue('EMPTY');expect(new URL(page.url()).searchParams.get('status')).toBe('EMPTY,PARTIAL');
 await dialog.getByRole('button',{name:'Close filters',exact:true}).click();await openCapacityFilterDialog(page);await expect(selection(page,'status')).toHaveValue('EMPTY');
 await dialog.getByRole('link',{name:'Clear',exact:true}).click();await expect(page).toHaveURL(url=>!url.searchParams.has('loadType')&&!Object.keys(expected).some(key=>url.searchParams.get(key)));
 await expect(page.locator('.leaflet-container')).toBeVisible();await openCapacityFilterDialog(page);
 for(const key of Object.keys(expected))await expect(selection(page,key)).toHaveValue('');
 await page.screenshot({path:info.outputPath('multiple-filter-cleared.png'),scale:'css'});
});

async function allPublicItems(page:Page,query:Record<string,string>){
 const items=new Map<string,Record<string,unknown>>();let cursor='';
 for(let count=0;count<20;count++){
  const params=new URLSearchParams(query);if(cursor)params.set('cursor',cursor);
  const response=await page.request.get(`/api/public/capacity?${params}`);expect(response.ok()).toBe(true);
  const result=await response.json();expect(result.filterError||'').toBe('');
  for(const item of result.items){expect(items.has(item.id)).toBe(false);items.set(item.id,item);}
  if(!result.hasMore)return [...items.values()];expect(result.nextCursor).toBeTruthy();expect(result.nextCursor).not.toBe(cursor);cursor=result.nextCursor;
 }
 throw Error('BOUNDED_CAPACITY_FIXTURE_EXCEEDED');
}

test('multiple configurations form a union while other option groups intersect under actual public matching',async({page})=>{
 test.setTimeout(90_000);
 const first=await allPublicItems(page,{vehicleCategory:configurations[0]}),second=await allPublicItems(page,{vehicleCategory:configurations[1]});
 expect(first.length).toBeGreaterThan(0);expect(second.length).toBeGreaterThan(0);
 const union=await allPublicItems(page,{vehicleCategory:configurations.join(',')});
 expect(union.map(item=>item.id).sort()).toEqual([...first,...second].map(item=>item.id).sort());
 const filtered=await allPublicItems(page,{vehicleCategory:configurations.join(','),status:'EMPTY',loadType:'FTL,PTL'});
 expect(filtered.length).toBeGreaterThan(0);expect(filtered.every(item=>item.status==='EMPTY'&&(item.accepts_full_load||item.accepts_partial_load)&&configurations.includes(String(item.cargo_configuration)))).toBe(true);
 expect(filtered.map(item=>item.id).sort()).toEqual(union.filter(item=>item.status==='EMPTY'&&(item.accepts_full_load||item.accepts_partial_load)).map(item=>item.id).sort());
 const canonical=await allPublicItems(page,{vehicleCategory:'Mini Box Truck,Cargo van,Mini Box Truck'});expect(canonical.map(item=>item.id).sort()).toEqual(union.map(item=>item.id).sort());
 expect((await page.request.get('/api/shared-capacity?vehicleCategory=Cargo%20van,Mini%20Box%20Truck')).status()).toBe(410);
 const unsupported=await page.request.get('/api/public/capacity?vehicleCategory=Cargo%20van,unsupported');expect(unsupported.status()).toBe(400);
});

test('invalid multi-option deep links stay denied until an explicit filter correction',async({page},info)=>{
 const startedAt=Date.now();
 test.setTimeout(60_000);await page.clock.install();
 let invalidRequests=0,releaseFailure:()=>void=()=>{};
 const failedRefresh=new Promise<void>(resolve=>{releaseFailure=resolve;});
 // A mistaken background retry would remain pending, then fail. Neither
 // transition may clear the known filter error or its correction action.
 await page.route('**/api/public/capacity?**',async route=>{
  if(!new URL(route.request().url()).searchParams.get('vehicleCategory')?.includes('unsupported'))return route.continue();
  invalidRequests++;await failedRefresh;
  await route.fulfill({status:400,json:{error:'Invalid capacity filter.'}}).catch(()=>{});
 });
 try{
  await page.goto('/?vehicleCategory=Cargo%20van,unsupported');
  const state=page.getByTestId('capacity-feed-state'),review=page.getByRole('button',{name:'Review filters',exact:true});
  const filterError='Check your search and vehicle filters.';
  await expect(state).toHaveAttribute('role','alert');
  await expect(state).toContainText(filterError,{useInnerText:true});
  const invalidMessage=await state.innerText();
  async function expectKnownFilterError(stage:'VIEWPORT_TICK'|'INVALID_REAPPLY'){
   try{
    await expect(state,'invalid query retains its alert').toHaveAttribute('role','alert');
    await expect(state,'invalid query retains its error state').toHaveClass(/\berror\b/);
    // The alert also contains a separate action. Check the known message rather
    // than snapshotting layout-generated separators around that action.
    await expect(state,'invalid query retains the known visible error').toContainText(filterError,{useInnerText:true});
    await expect(review,'invalid query retains Review filters').toBeVisible();
    await expect(review,'invalid query keeps Review filters usable').toBeEnabled();
   }catch(error){
    const observations=await state.evaluateAll((elements,{expectedText,errorText})=>{
     const element=elements[0] as HTMLElement|undefined,button=element?.querySelector('button');
     const normalize=(value:string)=>value.replace(/\s+/g,' ').trim();
     return {alert:elements.length===1&&element?.getAttribute('role')==='alert',loading:elements.some(item=>item.classList.contains('loading')),
      textEqual:element?normalize(element.innerText)===normalize(expectedText):false,
      errorPresent:element?normalize(element.innerText).includes(normalize(errorText)):false,
      initialLabelPresent:expectedText.includes('Review filters'),currentLabelPresent:element?.innerText.includes('Review filters')??false,
      fontZero:button?Number.parseFloat(getComputedStyle(button).fontSize)===0:false};
    },{expectedText:invalidMessage,errorText:filterError}).catch(()=>({}));
    const evidence=focusedBrowserEvidence({title:info.title,project:info.project.name,stage,error,elapsedMs:Date.now()-startedAt,
     observations:{...observations,reviewVisible:await review.isVisible().catch(()=>false),invalidRequests}});
    if(evidence)console.log('CI_BROWSER_FOCUSED_EVIDENCE '+JSON.stringify(evidence));
    throw error;
   }
  }
  await expect(review).toBeVisible();await expect(page.locator('.leaflet-container')).toBeVisible();
  await page.locator('.leaflet-control-zoom-in').click();await page.clock.fastForward(16_000);
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await expectKnownFilterError('VIEWPORT_TICK');
  expect(invalidRequests).toBe(0);
  await review.click();
  const dialog=page.getByRole('dialog',{name:'Vehicle filters',exact:true});await expect(selection(page,'vehicleCategory')).toHaveValue('Cargo van,unsupported');
  const invalidBeforeApply=page.url();
  await Promise.all([page.waitForURL(url=>url.href!==invalidBeforeApply,{waitUntil:'domcontentloaded'}),dialog.getByRole('button',{name:'Show vehicles',exact:true}).click()]);
  await expect(dialog).toBeHidden();await page.clock.fastForward(16_000);
  await expectKnownFilterError('INVALID_REAPPLY');
  expect(invalidRequests).toBe(0);releaseFailure();
  await review.click();await chooseTruckConfiguration(dialog,'Mini Box Truck');await expect(selection(page,'vehicleCategory')).toHaveValue('Mini Box Truck');
  const waitForCorrectedResponse=()=>page.waitForResponse(response=>{
   const url=new URL(response.url());return url.pathname==='/api/public/capacity'&&url.searchParams.get('vehicleCategory')==='Mini Box Truck'&&response.ok();
  });
  const initialCorrectedResponse=waitForCorrectedResponse();
  const correctedAt=Date.now();
  await Promise.all([page.waitForURL(url=>url.searchParams.get('vehicleCategory')==='Mini Box Truck',{waitUntil:'domcontentloaded'}),dialog.getByRole('button',{name:'Show vehicles',exact:true}).click()]);
  writeFileSync(info.outputPath('filter-correction-navigation.json'),JSON.stringify({scope:'LOCAL_BROWSER',elapsedMs:Date.now()-correctedAt,correctedCategory:true}),{mode:0o600});
  expect(await (await initialCorrectedResponse).finished()).toBeNull();
  await expect(page).toHaveURL(url=>url.searchParams.get('vehicleCategory')==='Mini Box Truck');await expect(state).toHaveCount(0,{timeout:30_000});
  // Settle the initial viewport request before testing a separate polling tick.
  // Otherwise the tick may correctly skip a request that is still in flight.
  const correctedRefresh=waitForCorrectedResponse();
  await page.clock.runFor(16_000);expect(await (await correctedRefresh).finished()).toBeNull();await expect(state).toHaveCount(0,{timeout:30_000});
  expect(invalidRequests).toBe(0);
  await page.goto('/?vehicleCategory=Cargo%20van&vehicleCategory=Mini%20Box%20Truck');await expect(state).toHaveAttribute('role','alert');
  expect((await page.request.get('/api/public/capacity?vehicleCategory=Cargo%20van&vehicleCategory=Mini%20Box%20Truck')).status()).toBe(400);
 }finally{releaseFailure();await page.unroute('**/api/public/capacity?**').catch(()=>{});}
});
