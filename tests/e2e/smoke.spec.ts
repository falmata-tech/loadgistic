import { test, expect } from '@playwright/test';
import {localMailpitNumericCode} from './mailpit-helper';

async function login(page:any,email:string){
  await page.goto('/login');
  await page.locator('details.auth-fixture-login>summary').click();
  const fixtureForm=page.getByTestId('login-form');
  await fixtureForm.getByLabel('Email',{exact:true}).fill(email);
  await fixtureForm.getByLabel('Password').fill('Loadgistic123!');
  await fixtureForm.getByRole('button',{name:'Log in'}).click();
  await expect(page).toHaveURL(email==='admin@loadgistic.local'?/\/admin$/:/\/app\/home/);
}

async function choosePlace(page:any,label:string,query:string,option:RegExp){
  const accessibleLabel=new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?: \\(optional\\))?$`,'i');
  const input=page.getByRole('combobox',{name:accessibleLabel});
  await input.fill(query);
  await expect(page.getByRole('option',{name:option}).first()).toBeVisible({timeout:10_000});
  await page.getByRole('option',{name:option}).first().click();
}

async function findCapacitySignal(page:any,query:Record<string,string>,predicate:(item:any)=>boolean){
  let cursor='';
  for(let pageNumber=0;pageNumber<24;pageNumber+=1){
    const params=new URLSearchParams(query);
    if(cursor)params.set('cursor',cursor);
    const response=await page.request.get(`/api/public/capacity?${params.toString()}`);
    expect(response.ok()).toBeTruthy();
    const result=await response.json();
    const match=result.items.find(predicate);
    if(match)return match;
    if(!result.nextCursor)break;
    cursor=result.nextCursor;
  }
  return null;
}

test('public entry makes capacity immediately usable without an account',async({page}:{page:any})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Open Transport Capacity',includeHidden:true})).toHaveCount(1);
  await expect(page.locator('.map-workspace-heading')).toHaveCount(0);
  await expect(page.locator('a[href="/featured"]:visible').first()).toHaveAttribute('href','/featured');
  await expect(page.locator('.featured-provider-section')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Providers',exact:true})).toHaveCount(0);
  await expect(page.locator('.market-command-column').getByRole('combobox',{name:'Search published truck capacity'})).toBeVisible();
  await page.getByRole('button',{name:'Filters'}).click();
  const filterDialog=page.getByRole('dialog',{name:'Filters'});
  await expect(filterDialog).toBeVisible();
  await expect(filterDialog.getByRole('radio',{name:'Empty Full truck available'})).toBeVisible();
  await expect(filterDialog.getByRole('combobox',{name:/^Origin(?: \(optional\))?$/})).toBeVisible();
  await expect(filterDialog.getByRole('combobox',{name:/^Destination(?: \(optional\))?$/})).toBeVisible();
  await choosePlace(filterDialog,'Origin','Adama',/Adama, Ethiopia/i);
  await choosePlace(filterDialog,'Destination','Hawassa',/Hawassa, Ethiopia/i);
  await expect(filterDialog.getByLabel('Origin range')).toBeVisible();
  await expect(filterDialog.getByLabel('Destination range')).toBeVisible();
  await filterDialog.getByText('Service area',{exact:true}).click();
  await expect(filterDialog.getByLabel('Service area place')).toBeVisible();
  await expect(filterDialog.getByLabel('Area range')).toBeVisible();
  await choosePlace(filterDialog,'Service area place','Addis',/Addis Ababa, Ethiopia/i);
  await expect(filterDialog.getByLabel('Direction')).toBeVisible();
  await filterDialog.getByText('Partial',{exact:true}).click();
  await expect(filterDialog.getByRole('radio',{name:'Service area Empty trucks only'})).toBeDisabled();
  await expect(filterDialog.getByRole('radio',{name:'Capacity route Empty or Partial'})).toBeChecked();
  await expect(filterDialog.locator('.capacity-vehicle-picker')).not.toHaveAttribute('open','');
  await filterDialog.locator('.capacity-vehicle-picker>summary').click();
  await expect(filterDialog.getByRole('radio',{name:'Cargo van'})).toBeVisible();
  await expect(filterDialog.getByLabel('Truck configuration')).toBeVisible();
  await expect(filterDialog.getByLabel('Load type')).toBeVisible();
  await expect(filterDialog.getByLabel('Minimum available space')).toHaveCount(0);
  await expect(filterDialog.getByLabel('Stops')).toBeVisible();
  await expect(filterDialog.getByLabel('Updated')).toBeVisible();
  const nearToggle=filterDialog.getByLabel('Show trucks near my area');
  await expect(nearToggle).toBeVisible();
  if(await nearToggle.isEnabled()){
    await nearToggle.check();
    await expect(filterDialog.getByLabel('Distance')).toBeVisible();
  }
  await filterDialog.getByRole('button',{name:'Close filters'}).click();
  await expect(filterDialog).toBeHidden();
  await expect(page.getByRole('button',{name:'Map',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'List',exact:true})).toHaveCount(0);
  await expect(page.locator('.public-capacity-map')).toBeVisible();
  await expect(page.getByRole('button',{name:/location/i})).toBeVisible();
  await page.locator('a[href="/featured"]:visible').first().click();
  await expect(page).toHaveURL(/\/featured$/,{timeout:15_000});
  await expect(page.locator('.public-capacity-map')).toHaveCount(0);
  const currentPublicNav=(page.viewportSize()?.width||0)>760?page.getByRole('navigation',{name:'Public workspace navigation'}):page.getByRole('navigation',{name:'Public mobile navigation'});
  await expect(currentPublicNav.getByRole('link',{name:'Featured',exact:true})).toHaveAttribute('aria-current','page');
  const featured=page.locator('.featured-provider-section');
  await expect(featured.locator('.featured-programme-current')).toContainText(/trucks/i);
  const weekPanel=featured.locator('.regional-expo-week-panel');
  await expect(weekPanel).not.toHaveAttribute('open','');
  await weekPanel.locator('summary').click();
  await expect(featured.locator('.regional-expo-week>span')).toHaveCount(7);
  await weekPanel.locator('summary').click();
  const featuredTrucks=featured.locator('.featured-truck-tile');
  await expect.poll(()=>featuredTrucks.count()).toBeGreaterThan(1);
  await expect(featuredTrucks.first()).toContainText(/Company driver|Owner-operator|Self-managed driver/);
  const sponsorPanel=featured.locator('.expo-sponsored-rail');
  await expect(sponsorPanel).toBeVisible();
  await expect(featured.locator('.expo-sponsored-card').first()).toBeVisible();
  await expect(featured.getByRole('heading',{name:'Sponsors'})).toBeVisible();
  const schedulePanel=featured.locator('.expo-schedule-panel');
  await expect(schedulePanel).not.toHaveAttribute('open','');
  await expect(schedulePanel.locator('.expo-programme-strip')).toBeHidden();
  await expect(featured.locator('.featured-board-surface')).toBeVisible();
  await expect(featured.locator('.featured-board-stage')).toBeInViewport();
  await expect(featured.locator('.featured-board-toolbar')).toHaveCount(0);
  await expect(featured.locator('.expo-pan-hint')).toHaveCount(0);
  const billboardLayout=await featured.evaluate((section:any)=>{
    const experience=section.querySelector('.transport-expo-experience');
    const sectionTop=section.getBoundingClientRect().top;
    const live=section.querySelector('.expo-live-strip').getBoundingClientRect();
    const programme=section.querySelector('.expo-programme-strip').getBoundingClientRect();
    const venue=section.querySelector('.transport-expo-venue').getBoundingClientRect();
    const grid=section.querySelector('.featured-board-grid');
    const originalCards=[...grid.querySelectorAll('.featured-provider-tile')];
    const clones=[];
    while(grid.children.length<11){const clone:any=originalCards[clones.length%originalCards.length].cloneNode(true);clone.setAttribute('aria-hidden','true');grid.appendChild(clone);clones.push(clone);}
    const board=section.querySelector('.featured-board-surface').getBoundingClientRect();
    const sponsor=section.querySelector('.expo-sponsored-rail').getBoundingClientRect();
    const stage=section.querySelector('.featured-board-stage');
    const cards=[...section.querySelectorAll('.featured-provider-tile')].map((card:any)=>card.getBoundingClientRect());
    const rowTops=[...new Set(cards.map((card:any)=>Math.round(card.top)))];
    const overlaps=cards.some((card:any,index:number)=>cards.slice(index+1).some((other:any)=>card.left<other.right&&card.right>other.left&&card.top<other.bottom&&card.bottom>other.top));
    const finalCardBottom=Math.max(...cards.map((card:any)=>card.bottom));
    const result={sectionTop,liveHeight:live.height,programmeHeight:programme.height,venueWidth:venue.width,boardWidth:board.width,boardRight:board.right,boardTop:board.top,boardBottom:board.bottom,sponsorLeft:sponsor.left,sponsorTop:sponsor.top,sponsorBottom:sponsor.bottom,sponsorHeight:sponsor.height,finalCardBottom,rowCount:rowTops.length,overlaps,overflow:getComputedStyle(stage).overflow,experienceBackground:getComputedStyle(experience).backgroundImage,boardBackground:getComputedStyle(section.querySelector('.transport-expo-venue')).backgroundImage,boardTint:getComputedStyle(section.querySelector('.featured-board-surface')).backgroundColor,sponsorTint:getComputedStyle(section.querySelector('.expo-sponsored-rail')).backgroundColor};
    clones.forEach((clone:any)=>clone.remove());
    return result;
  });
  expect(Math.abs(billboardLayout.venueWidth-billboardLayout.boardWidth)).toBeLessThanOrEqual(2);
  expect(billboardLayout.rowCount).toBeGreaterThan(1);
  expect(billboardLayout.overlaps).toBe(false);
  expect(billboardLayout.boardBottom).toBeGreaterThanOrEqual(billboardLayout.finalCardBottom);
  expect(billboardLayout.overflow).toBe('auto');
  expect(billboardLayout.experienceBackground).toBe('none');
  expect(billboardLayout.boardBackground).toBe('none');
  expect(billboardLayout.boardTint).not.toBe(billboardLayout.sponsorTint);
  if((page.viewportSize()?.width||0)>760)expect(billboardLayout.sponsorLeft).toBeGreaterThan(billboardLayout.boardRight);
  else {
    expect(billboardLayout.sponsorBottom).toBeLessThanOrEqual(billboardLayout.boardTop);
    expect(billboardLayout.boardTop-billboardLayout.sectionTop).toBeLessThanOrEqual(281);
    expect(billboardLayout.liveHeight).toBeLessThanOrEqual(48);
    expect(billboardLayout.programmeHeight).toBe(0);
    expect(billboardLayout.sponsorHeight).toBeLessThanOrEqual(154);
  }
  await featuredTrucks.first().click();
  const providerDialog=page.locator('.expo-provider-dialog');
  await expect(providerDialog).toBeVisible();
  await expect(providerDialog.getByText('Programme time')).toBeVisible();
  const featuredProfile=providerDialog.getByRole('link',{name:'Transporter profile'});
  await expect(featuredProfile).toHaveAttribute('href',/^\/@[a-z0-9-]+$/);
  const featuredMap=providerDialog.getByRole('link',{name:'Find this truck'});
  if(await featuredMap.count()){
    await expect(featuredMap).toHaveAttribute('href',/^\/?\?q=.+$/);
    await featuredMap.click();
    await expect(page).toHaveURL(/\?q=.+$/);
    await expect(providerDialog).toBeHidden();
    await expect(page.locator('.public-capacity-map')).toBeVisible();
    await expect.poll(()=>page.locator('.capacity-truck-map-marker,.capacity-map-cluster').count()).toBeGreaterThan(0);
  }else{
    await expect(providerDialog.getByRole('link')).toHaveCount(1);
    await providerDialog.getByRole('button',{name:'Close featured truck details'}).click();
  }
  await page.goto('/capacity?q=Fuso');
  await expect(page).toHaveURL(/\?q=Fuso$/);
  await expect(page.getByRole('combobox',{name:'Search published truck capacity'})).toHaveValue('Fuso');
});

test('public mobile shell keeps every visitor destination directly reachable',async({page}:{page:any})=>{
  await page.goto('/');
  const mobile=(page.viewportSize()?.width||0)<=760;
  const appNav=page.getByRole('navigation',{name:'Public mobile navigation'});
  if(!mobile){
    await expect(appNav).toBeHidden();
    const workspaceNav=page.getByRole('navigation',{name:'Public workspace navigation'});
    await expect(workspaceNav).toBeVisible();
    await expect(workspaceNav.getByRole('link',{name:'Open capacity',exact:true})).toHaveAttribute('aria-current','page');
    await expect(workspaceNav.getByRole('link')).toHaveCount(8);
    for(const label of ['Private capacity','Featured','Track','Log in','About','Privacy','Terms'])await expect(workspaceNav.getByRole('link',{name:label,exact:true})).toBeVisible();
    await expect(workspaceNav.getByRole('link',{name:'Join',exact:true})).toHaveCount(0);
    await Promise.all([
      page.waitForURL(/\/privacy$/),
      workspaceNav.getByRole('link',{name:'Privacy',exact:true}).click()
    ]);
    await expect(page.getByRole('heading',{name:'Your information, handled with clear boundaries.'})).toBeVisible();
    await expect(page.getByRole('navigation',{name:'Public workspace navigation'}).getByRole('link',{name:'Privacy',exact:true})).toHaveAttribute('aria-current','page');
    await expect(page.locator('.home-footer')).toHaveCount(0);
    return;
  }

  await expect(appNav).toBeVisible();
  await expect(appNav.getByRole('link')).toHaveCount(5);
  for(const label of ['Open','Private','Featured','Track','About']){
    const destination=appNav.getByRole('link',{name:label,exact:true});
    await expect(destination).toBeVisible();
    const box=await destination.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.locator('.public-session-compact').getByRole('link',{name:'Log in'})).toBeVisible();
  await expect(page.locator('.home-footer')).toBeHidden();
  const marketTop=await page.locator('#capacity-market').evaluate((section:any)=>section.getBoundingClientRect().top);
  expect(marketTop).toBeLessThan(page.viewportSize()!.height);

  await appNav.getByRole('link',{name:'Featured',exact:true}).click();
  await expect(page).toHaveURL(/\/featured$/);
  await expect(page.locator('#featured-providers')).toBeInViewport();
  await expect(page.locator('.public-capacity-map')).toHaveCount(0);
  await appNav.getByRole('link',{name:'Track',exact:true}).click();
  await expect(page).toHaveURL(/\/track$/);
  await expect(page.getByRole('navigation',{name:'Public mobile navigation'})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Public mobile navigation'}).getByRole('link',{name:'Track',exact:true})).toHaveAttribute('aria-current','page');
});

test('Truck Market search suggests transporters and trucks and opens the selected truck',async({page}:{page:any})=>{
  await page.goto('/');
  const search=page.locator('.market-command-column').getByRole('combobox',{name:'Search published truck capacity'});
  await search.fill('BlueLine');
  const suggestions=page.getByRole('listbox',{name:'Search suggestions'});
  await expect(suggestions).toBeVisible();
  await expect(suggestions.getByText('Transporter',{exact:true}).first()).toBeVisible();
  const truckSuggestion=suggestions.locator('a').filter({has:page.locator('.capacity-suggestion-icon.truck')}).first();
  await expect(truckSuggestion).toBeVisible();
  await truckSuggestion.click();
  await expect(page).toHaveURL(/\?q=.+&truck=.+$/);
  await expect(page.locator('.capacity-truck-map-marker.selected')).toHaveCount(1);
  const selectedSummary=page.getByRole('complementary',{name:/truck summary$/i});
  await expect(selectedSummary).toBeVisible();
  await expect(selectedSummary.getByRole('link',{name:'Profile'})).toBeVisible();
});

test('public search and filters use every multi-city route and Service-area point',async({page}:{page:any})=>{
  const routeSignal=await findCapacitySignal(page,{geometry:'ROUTE'},(item:any)=>item.current_route_points.length>=3);
  expect(routeSignal).toBeTruthy();
  const origin=routeSignal.current_route_points[1];
  const destination=routeSignal.current_route_points[2];
  const routeQuery=new URLSearchParams({
    geometry:'ROUTE',originPlaceRef:origin.place_ref,origin:origin.label,originRadiusKm:'10',
    destinationPlaceRef:destination.place_ref,destination:destination.label,destinationRadiusKm:'10',directionMode:'DIRECT'
  });
  const routeMatchResponse=await page.request.get(`/api/public/capacity?${routeQuery.toString()}`);
  expect(routeMatchResponse.ok()).toBeTruthy();
  expect((await routeMatchResponse.json()).items.some((item:any)=>item.id===routeSignal.id)).toBe(true);

  const combinedRouteQuery=new URLSearchParams(routeQuery);
  combinedRouteQuery.set('status',routeSignal.status);
  combinedRouteQuery.set('vehicleCategory',routeSignal.cargo_configuration);
  if(routeSignal.accepts_full_load)combinedRouteQuery.set('loadType','FTL');
  else if(routeSignal.accepts_partial_load)combinedRouteQuery.set('loadType','PTL');
  if(routeSignal.accepts_multi_pick)combinedRouteQuery.set('stopOption','MULTI_PICK');
  else if(routeSignal.accepts_multi_drop)combinedRouteQuery.set('stopOption','MULTI_DROP');
  const combinedRouteResponse=await page.request.get(`/api/public/capacity?${combinedRouteQuery.toString()}`);
  expect(combinedRouteResponse.ok()).toBeTruthy();
  expect((await combinedRouteResponse.json()).items.some((item:any)=>item.id===routeSignal.id)).toBe(true);
  combinedRouteQuery.set('status',routeSignal.status==='EMPTY'?'PARTIAL':'EMPTY');
  const contradictoryRouteResponse=await page.request.get(`/api/public/capacity?${combinedRouteQuery.toString()}`);
  expect(contradictoryRouteResponse.ok()).toBeTruthy();
  expect((await contradictoryRouteResponse.json()).items.some((item:any)=>item.id===routeSignal.id)).toBe(false);

  const areaSignal=await findCapacitySignal(page,{geometry:'RADIUS'},(item:any)=>item.capacity_area_boundary.length>=3);
  expect(areaSignal).toBeTruthy();
  const boundary=areaSignal.capacity_area_boundary[1];
  const areaQuery=new URLSearchParams({geometry:'RADIUS',currentAreaPlaceRef:boundary.place_ref,currentArea:boundary.label,currentAreaRadiusKm:'10'});
  const areaMatchResponse=await page.request.get(`/api/public/capacity?${areaQuery.toString()}`);
  expect(areaMatchResponse.ok()).toBeTruthy();
  expect((await areaMatchResponse.json()).items.some((item:any)=>item.id===areaSignal.id)).toBe(true);

  await page.goto('/');
  const search=page.locator('.market-command-column').getByRole('combobox',{name:'Search published truck capacity'});
  await search.fill(origin.label.split(',')[0]);
  const suggestions=page.getByRole('listbox',{name:'Search suggestions'});
  await expect(suggestions).toBeVisible();
  await expect(suggestions.locator('a').filter({has:page.locator('.capacity-suggestion-icon.truck')}).first()).toBeVisible({timeout:10_000});
});

test('route filters accept either endpoint without requiring the other',async({page}:{page:any})=>{
  await page.goto('/capacity');
  await page.getByRole('button',{name:'Filters'}).click();
  const filterDialog=page.getByRole('dialog',{name:'Filters'});
  await choosePlace(filterDialog,'Origin','Adama',/Adama, Ethiopia/i);
  await filterDialog.getByRole('button',{name:'Show matching trucks'}).click();
  await expect(filterDialog).toBeHidden();
  await expect(page).toHaveURL(/originPlaceRef=/);
  expect(new URL(page.url()).searchParams.get('destinationPlaceRef')).toBe('');
  await expect(page.locator('.public-capacity-map')).toBeVisible();
  await expect.poll(()=>page.locator('.capacity-truck-map-marker,.capacity-map-cluster').count()).toBeGreaterThan(0);

  await page.goto('/capacity');
  await page.getByRole('button',{name:'Filters'}).click();
  await choosePlace(filterDialog,'Destination','Hawassa',/Hawassa, Ethiopia/i);
  await filterDialog.getByRole('button',{name:'Show matching trucks'}).click();
  await expect(filterDialog).toBeHidden();
  await expect(page).toHaveURL(/destinationPlaceRef=/);
  expect(new URL(page.url()).searchParams.get('originPlaceRef')).toBe('');
  await expect.poll(()=>page.locator('.capacity-truck-map-marker,.capacity-map-cluster').count()).toBeGreaterThan(0);
});

test('administrator can review and publish an ordered daily truck-and-Driver roster',async({page}:{page:any})=>{
  await login(page,'admin@loadgistic.local');
  await page.goto('/admin/featured');
  await expect(page.getByRole('heading',{name:'Daily Featured Trucks'})).toBeVisible();
  await expect(page.getByText(/eligible truck-and-Driver choices/).first()).toBeVisible();
  await expect(page.getByRole('heading',{name:"Choose today's trucks and Drivers"})).toBeVisible();
  await expect(page.getByText('07:30–09:00 EAT')).toBeVisible();
  await expect(page.getByRole('button',{name:'Automatic'})).toHaveClass(/active/);
  await expect(page.locator('.featured-schedule-timeline .programme-break').first()).toBeVisible();
  await expect(page.getByRole('heading',{name:'Sponsors'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Schedule sponsor'})).toBeVisible();
  const date=new Date();date.setUTCDate(date.getUTCDate()+7);
  await page.getByLabel('Feature date').fill(date.toISOString().slice(0,10));
  await page.getByRole('button',{name:'Load day'}).click();
  await expect(page).toHaveURL(new RegExp(`date=${date.toISOString().slice(0,10)}`));
  const initialFeaturedCount=await page.locator('.featured-roster-list>li').count();
  await expect(page.getByLabel('Add truck and Driver')).toBeEnabled();
  await expect.poll(()=>page.getByLabel('Add truck and Driver').locator('option').count()).toBeGreaterThan(1);
  await page.getByLabel('Add truck and Driver').selectOption({index:1});
  await expect(page.getByRole('button',{name:'Add',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Add',exact:true}).click();
  await expect(page.locator('.featured-roster-list>li')).toHaveCount(initialFeaturedCount+1);
  await page.getByLabel('Featured trucks').selectOption(String(initialFeaturedCount+1));
  await page.getByLabel('Headline').fill('Today’s featured trucks');
  await page.getByLabel('Short introduction').fill('Meet today’s featured trucks and the Drivers operating them.');
  await page.getByRole('button',{name:'Publish this day'}).click();
  await expect(page.getByText('Daily feature published.')).toBeVisible();
  await expect(page.getByText(/PUBLISHED/)).toBeVisible();
});

test('capacity Market is map-only and loads bounded truck batches',async({page}:{page:any})=>{
  await page.goto('/capacity');
  const commandColumn=page.locator('.market-command-column');
  await expect(commandColumn.getByRole('combobox',{name:'Search published truck capacity'})).toBeVisible();
  await expect(commandColumn.getByRole('button',{name:'Filters'})).toBeVisible();
  await expect(commandColumn.getByRole('button',{name:/location/i})).toBeVisible();
  await expect(page.locator('.public-capacity-map')).toBeVisible();
  await expect(page.locator('.public-capacity-grid')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Map',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'List',exact:true})).toHaveCount(0);
  await expect(page.getByRole('navigation',{name:'Truck list pagination'})).toHaveCount(0);
  await expect(commandColumn.getByRole('combobox',{name:'Search published truck capacity'})).toBeVisible();
  await page.getByRole('button',{name:/Filters/}).click();
  const vehiclePicker=page.locator('.capacity-vehicle-picker');
  await vehiclePicker.locator('summary').click();
  await expect(vehiclePicker.getByRole('radio',{name:'Courier motorcycle'})).toHaveCount(0);
  await expect(vehiclePicker.getByRole('radio',{name:'Courier car'})).toHaveCount(1);
  await expect(vehiclePicker.getByRole('radio',{name:'Mini Open Body Truck'})).toHaveCount(1);
  await expect(vehiclePicker.getByRole('radio',{name:'Heavy Rigid Stake Body Truck + Trailer'})).toHaveCount(1);
  await page.getByRole('button',{name:'Close filters'}).click();
  const response=await page.request.get('/api/public/capacity');
  expect(response.ok()).toBeTruthy();
  const result=await response.json();
  expect(result.items).toHaveLength(14);
  expect(result.hasMore).toBe(true);
  expect(result.nextCursor).toBeTruthy();
});

test('heavy rigid trailer trucks keep their own recognizable map artwork',async({page}:{page:any})=>{
  const configuration='Heavy Rigid Stake Body Truck + Trailer';
  const truck=await findCapacitySignal(page,{vehicleCategory:configuration},()=>true);
  expect(truck).toBeTruthy();
  expect(truck.cargo_configuration).toBe(configuration);
  await page.goto(`/?vehicleCategory=${encodeURIComponent(configuration)}&truck=${encodeURIComponent(truck.id)}`);
  const marker=page.locator('.capacity-truck-map-marker.selected.trailer-configuration');
  await expect(marker).toBeVisible();
  await expect(marker.locator('img')).toHaveAttribute('src','/vehicle-configurations/heavy-rigid-stake-body-truck-trailer.jpg');
  await expect(page.locator('.map-capacity-sheet')).toContainText('Trailer');
});

test('map clusters dense capacity and keeps truck and overlapping signal details inside the map',async({page}:{page:any})=>{
  await page.goto('/capacity');
  await expect(page.locator('.public-capacity-map')).toBeVisible();
  const initialMapCanvasBox=await page.locator('.public-map-canvas').boundingBox();
  expect(initialMapCanvasBox).toBeTruthy();
  await expect(page.locator('.capacity-map-cluster,.capacity-truck-map-marker').first()).toBeVisible();
  const initialClusters=page.locator('.capacity-map-cluster:visible');
  if(await initialClusters.count()){
    const clusterStatuses=await initialClusters.evaluateAll((clusters:any[])=>clusters.map(cluster=>({empty:cluster.classList.contains('empty'),partial:cluster.classList.contains('partial'),label:cluster.textContent?.trim()})));
    expect(clusterStatuses.every((cluster:{empty:boolean;partial:boolean;label?:string})=>cluster.empty!==cluster.partial)).toBe(true);
    expect(clusterStatuses.every((cluster:{empty:boolean;partial:boolean;label?:string})=>/Empty|Partial/.test(cluster.label||''))).toBe(true);
    expect(clusterStatuses.every((cluster:{label?:string})=>Number.parseInt(cluster.label||'0',10)<=8)).toBe(true);
  }
  const initialMarkerLabels=await page.locator('.capacity-map-cluster small:visible').evaluateAll((labels:any[])=>labels.map(label=>{const box=label.getBoundingClientRect();const marker=label.closest('.capacity-map-cluster');return{status:marker?.classList.contains('partial')?'PARTIAL':'EMPTY',left:box.left,right:box.right,top:box.top,bottom:box.bottom};}));
  expect(initialMarkerLabels.every((label:{status:string;left:number;right:number;top:number;bottom:number},index:number)=>initialMarkerLabels.slice(index+1).every((other:{status:string;left:number;right:number;top:number;bottom:number})=>label.status===other.status||label.right<=other.left||other.right<=label.left||label.bottom<=other.top||other.bottom<=label.top))).toBe(true);
  const mapContextLabel=page.locator('.ethiopia-map-label');
  if((page.viewportSize()?.width||0)<=620&&await mapContextLabel.isVisible()){
    const mapLabel=await mapContextLabel.boundingBox();
    const zoomControl=await page.locator('.leaflet-control-zoom').boundingBox();
    expect(mapLabel&&zoomControl).toBeTruthy();
    expect(mapLabel!.x).toBeGreaterThanOrEqual(zoomControl!.x+zoomControl!.width+4);
  }
  for(let attempt=0;attempt<8;attempt+=1){
    if(await page.locator('.capacity-truck-map-marker.vehicle-image-marker:visible').count())break;
    const cluster=page.locator('.capacity-map-cluster:visible').first();
    if(!await cluster.count())break;
    await cluster.click();
    await page.waitForTimeout(180);
  }
  const visibleVehicleImage=page.locator('.capacity-truck-map-marker.vehicle-image-marker img:visible').first();
  await expect(visibleVehicleImage).toBeVisible();
  await expect(visibleVehicleImage).toHaveAttribute('src',/\/vehicle-configurations\/.+\.(?:jpg|png)$/);
  await expect.poll(async()=>page.locator('.capacity-truck-map-marker.vehicle-image-marker img:visible').evaluateAll((images:any[])=>Math.max(0,...images.map((image:any)=>image.naturalWidth))),{timeout:10000}).toBeGreaterThan(0);
  await page.mouse.move(0,0);
  await expect(page.locator('.capacity-marker-tooltip')).toHaveCount(0);
  if((page.viewportSize()?.width||0)>760){
    const hoveredMarkerBox=await visibleVehicleImage.locator('xpath=ancestor::div[contains(@class,"capacity-truck-map-marker")]').boundingBox();
    await visibleVehicleImage.dispatchEvent('mouseover');
    const hoverSummary=page.locator('.capacity-marker-tooltip');
    await expect(hoverSummary).toBeVisible();
    const hoverSummaryBox=await hoverSummary.boundingBox();
    expect(hoveredMarkerBox&&hoverSummaryBox).toBeTruthy();
    expect(hoverSummaryBox!.y+hoverSummaryBox!.height).toBeLessThanOrEqual(hoveredMarkerBox!.y+6);
    expect(await hoverSummary.evaluate((tooltip:any)=>getComputedStyle(tooltip,'::before').borderTopWidth)).not.toBe('0px');
  }
  await expect(page.locator('.public-map-legend')).toContainText('Empty truck');
  await expect(page.locator('.public-map-legend')).toContainText('Partial truck');
  await expect(page.locator('.public-map-legend')).toContainText('Empty capacity route');
  await expect(page.locator('.public-map-legend')).toContainText('Partial capacity route');
  await expect(page.locator('.public-map-legend')).toBeVisible();
  const legendColors=await page.locator('.public-map-legend').evaluate((legend:any)=>Object.fromEntries(['empty-status','partial-status','privacy','radius','empty-route','partial-route','corridor'].map(className=>{const style=getComputedStyle(legend.querySelector(`.${className}`),'::before');return [className,{background:style.backgroundColor,border:style.borderColor,borderTop:style.borderTopColor}];})));
  expect(legendColors['empty-status'].background).toBe('rgb(22, 163, 74)');
  expect(legendColors['partial-status'].background).toBe('rgb(250, 204, 21)');
  expect(legendColors.privacy.border).toContain('rgb(124, 58, 237)');
  expect(legendColors.radius.border).toContain('rgb(22, 163, 74)');
  expect(legendColors['empty-route'].borderTop).toBe('rgb(22, 163, 74)');
  expect(legendColors['partial-route'].borderTop).toBe('rgb(234, 179, 8)');
  expect(legendColors.corridor.borderTop).toBe('rgb(37, 99, 235)');
  const partialTruck=await findCapacitySignal(page,{status:'PARTIAL'},(item:any)=>item.current_signal_geometry_visible!==false&&item.current_route_points?.length>=2);
  expect(partialTruck).toBeTruthy();
  await page.goto(`/?status=PARTIAL&truck=${encodeURIComponent(partialTruck.id)}`);
  await expect(page.locator('.map-capacity-sheet')).toBeVisible();
  await expect(page.locator('.public-capacity-map .leaflet-container')).toBeVisible();
  const selectedMapCanvas=page.locator('.public-map-canvas');
  const selectedSheet=page.locator('.map-capacity-sheet');
  const selectedLayout=await page.locator('.public-map-shell').evaluate((shell:any)=>{const map=shell.querySelector('.public-map-canvas').getBoundingClientRect();const leaflet=shell.querySelector('.leaflet-container').getBoundingClientRect();const sheet=shell.querySelector('.map-capacity-sheet').getBoundingClientRect();const outer=shell.getBoundingClientRect();return {map:{left:map.left,right:map.right,top:map.top,bottom:map.bottom,width:map.width},leaflet:{width:leaflet.width,height:leaflet.height},sheet:{left:sheet.left,right:sheet.right,top:sheet.top,bottom:sheet.bottom,width:sheet.width},outer:{left:outer.left,right:outer.right,width:outer.width}};});
  expect(Math.abs(selectedLayout.leaflet.width-selectedLayout.map.width)).toBeLessThanOrEqual(2);
  expect(selectedLayout.sheet.left).toBeGreaterThanOrEqual(selectedLayout.map.left);
  expect(selectedLayout.sheet.right).toBeLessThanOrEqual(selectedLayout.map.right+1);
  expect(selectedLayout.sheet.top).toBeGreaterThanOrEqual(selectedLayout.map.top);
  expect(selectedLayout.sheet.bottom).toBeLessThanOrEqual(selectedLayout.map.bottom+1);
  expect(Math.abs(selectedLayout.map.width-initialMapCanvasBox!.width)).toBeLessThanOrEqual(2);
  await expect(selectedMapCanvas).toBeVisible();
  await expect(selectedSheet).toBeVisible();
  await expect(page.locator('.capacity-truck-map-marker.selected')).toHaveCount(1);
  await expect(page.locator('.capacity-truck-map-marker.selected img')).toHaveAttribute('src',/\/vehicle-configurations\/.+\.(?:jpg|png)$/);
  await expect(page.locator('.capacity-truck-map-marker.selected strong')).toHaveCount(0);
  await expect(page.locator('.capacity-truck-map-marker.selected')).toHaveAttribute('title',/Partial capacity/);
  const markerShape=await page.locator('.capacity-truck-map-marker.selected').evaluate((element:any)=>({tailWidth:getComputedStyle(element,'::after').borderTopWidth,tailColor:getComputedStyle(element,'::after').borderTopColor,ring:getComputedStyle(element.querySelector('.vehicle-marker-image')).backgroundColor}));
  expect(markerShape.tailWidth).not.toBe('0px');
  expect(markerShape.tailColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(markerShape.ring).toBe('rgb(250, 204, 21)');
  await expect(page.locator('.capacity-truck-map-marker.selected')).toHaveClass(/\bpartial\b/);
  const selectedMarkerFit=await page.locator('.capacity-truck-map-marker.selected').evaluate((element:any)=>{const image=element.querySelector('img').getBoundingClientRect();const content=element.querySelector('.vehicle-marker-content').getBoundingClientRect();return {imageWidth:image.width,imageHeight:image.height,contentWidth:content.width,contentHeight:content.height};});
  expect(selectedMarkerFit.imageWidth).toBeGreaterThan(80);
  expect(selectedMarkerFit.imageHeight).toBeGreaterThan(80);
  expect(selectedMarkerFit.imageWidth).toBeGreaterThanOrEqual(selectedMarkerFit.contentWidth-10);
  expect(selectedMarkerFit.imageHeight).toBeGreaterThanOrEqual(selectedMarkerFit.contentHeight-10);
  await expect(page.locator('.selected-truck-label')).toHaveCount(0);
  await expect(page.locator('.capacity-map-cluster')).toHaveCount(0);
  await expect(page.locator('.capacity-truck-map-marker:not(.selected)')).toHaveCount(0);
  await expect(page.locator('.map-capacity-sheet').getByRole('link',{name:'Profile'})).toBeVisible();
  const publicCall=page.locator('.map-capacity-sheet').getByRole('link',{name:'Call'});
  await expect(publicCall).toBeVisible();
  await expect(publicCall).toHaveAttribute('href',/^tel:\+251/);
  const sheetMetrics=await page.locator('.map-capacity-sheet').evaluate((element:any)=>({clientHeight:element.clientHeight,scrollHeight:element.scrollHeight,height:element.getBoundingClientRect().height,viewport:window.innerHeight,overflow:getComputedStyle(element).overflowY}));
  expect(sheetMetrics.scrollHeight).toBeLessThanOrEqual(sheetMetrics.clientHeight+1);
  expect(sheetMetrics.overflow).not.toBe('auto');
  const truckSummaryTargets=await page.locator('.map-capacity-sheet').locator('button,a').evaluateAll((elements:any[])=>elements.map(element=>{const box=element.getBoundingClientRect();return {width:box.width,height:box.height};}));
  for(const target of truckSummaryTargets){expect(target.width).toBeGreaterThanOrEqual(44);expect(target.height).toBeGreaterThanOrEqual(44);}
  await expect(page.locator('.map-location-privacy-circle')).toBeVisible();
  const partialAvailabilitySignal=page.locator('.map-interactive-signal.capacity-partial');
  await expect(partialAvailabilitySignal).toBeVisible();
  await expect(partialAvailabilitySignal).toHaveAttribute('stroke','#eab308');
  const interactiveSignal=page.locator('.map-interactive-signal').first();
  await expect(interactiveSignal).toBeVisible();
  await interactiveSignal.focus();
  const signalInspector=page.locator('.capacity-signal-inspector');
  await expect(signalInspector).toBeVisible();
  await expect(signalInspector.locator('article')).toHaveCount(1);
  const inspectorStyle=await signalInspector.evaluate((element:any)=>({background:getComputedStyle(element).backgroundColor,borderWidth:getComputedStyle(element).borderWidth,borderColor:getComputedStyle(element).borderColor,color:getComputedStyle(element).color}));
  expect(inspectorStyle.background).toContain('255, 255, 255');
  expect(inspectorStyle.borderWidth).toBe('1px');
  expect(inspectorStyle.borderColor).not.toBe('rgb(0, 0, 0)');
  expect(inspectorStyle.color).toBe('rgb(11, 29, 58)');
  const inspectorBox=await signalInspector.boundingBox();
  const publicMapBox=await page.locator('.public-capacity-map').boundingBox();
  expect(inspectorBox&&publicMapBox).toBeTruthy();
  const signalInspectorBounds={inspectorLeft:inspectorBox!.x,inspectorRight:inspectorBox!.x+inspectorBox!.width,inspectorTop:inspectorBox!.y,inspectorBottom:inspectorBox!.y+inspectorBox!.height,mapLeft:publicMapBox!.x,mapRight:publicMapBox!.x+publicMapBox!.width,mapTop:publicMapBox!.y,mapBottom:publicMapBox!.y+publicMapBox!.height};
  expect(signalInspectorBounds.inspectorLeft).toBeGreaterThanOrEqual(signalInspectorBounds.mapLeft-1);
  expect(signalInspectorBounds.inspectorRight).toBeLessThanOrEqual(signalInspectorBounds.mapRight+1);
  expect(signalInspectorBounds.inspectorTop).toBeGreaterThanOrEqual(signalInspectorBounds.mapTop-1);
  expect(signalInspectorBounds.inspectorBottom).toBeLessThanOrEqual(signalInspectorBounds.mapBottom+1);
  await interactiveSignal.dispatchEvent('click');
  await expect(signalInspector).toHaveClass(/pinned/);
  await expect(signalInspector.locator('article')).toHaveCount(1);
  const signalCloseBox=await signalInspector.getByRole('button',{name:'Close map signal details'}).boundingBox();
  expect(signalCloseBox?.width).toBeGreaterThanOrEqual(44);
  expect(signalCloseBox?.height).toBeGreaterThanOrEqual(44);
  const signalBorderColors=await signalInspector.locator('article').evaluateAll((articles:any[])=>articles.map(article=>getComputedStyle(article).borderLeftColor));
  expect(new Set(signalBorderColors).size).toBe(1);
  await signalInspector.getByRole('button',{name:'Close map signal details'}).click();
  await expect(signalInspector).toBeHidden();
  await expect(page.locator('.map-capacity-sheet')).toBeVisible();
  await expect(page.locator('.public-map-legend')).toContainText('Empty service area');
  await expect(page.locator('.public-map-legend')).toContainText('Empty capacity route');
  await expect(page.locator('.public-map-legend')).toContainText('Partial capacity route');
  await expect(page.locator('.public-map-legend')).toContainText(/Regular service/i);
  await expect(page.locator('.public-map-legend')).not.toContainText('Next trip');
  const closeCard=page.getByRole('button',{name:'Close truck summary'});
  await expect(closeCard).toBeVisible();
  await closeCard.click();
  await expect(page.locator('.map-capacity-sheet')).toHaveCount(0);
  await expect.poll(async()=>Math.round((await page.locator('.public-map-canvas').boundingBox())?.width||0)).toBe(Math.round(initialMapCanvasBox!.width));
  await expect.poll(async()=>page.locator('.public-map-canvas,.leaflet-container').evaluateAll((elements:any[])=>{const [map,leaflet]=elements.map(element=>element.getBoundingClientRect().width);return Math.abs(map-leaflet);})).toBeLessThanOrEqual(2);
  await expect(page.locator('.capacity-map-cluster,.capacity-truck-map-marker').first()).toBeVisible();

  const emptyTruck=await findCapacitySignal(page,{status:'EMPTY'},(item:any)=>item.current_signal_geometry_visible!==false&&(item.current_route_points?.length>=2||item.capacity_area_boundary?.length>=3));
  expect(emptyTruck).toBeTruthy();
  await page.goto(`/capacity?truck=${encodeURIComponent(emptyTruck.id)}`);
  const emptyAvailabilitySignal=page.locator('.map-interactive-signal.capacity-empty');
  await expect(emptyAvailabilitySignal).toBeVisible();
  await expect(emptyAvailabilitySignal).toHaveAttribute('stroke','#16a34a');
  await expect(page.locator('.capacity-truck-map-marker.selected')).toHaveClass(/\bempty\b/);
  await expect(page.locator('.capacity-truck-map-marker.selected strong')).toHaveCount(0);
  await expect(page.locator('.capacity-truck-map-marker.selected')).toHaveAttribute('title',/Empty truck/);
  await expect(page.locator('.capacity-truck-map-marker.selected .vehicle-marker-image')).toHaveCSS('background-color','rgb(22, 163, 74)');
});

test('visitor location is requested on entry, centers the map, and may be refreshed',async({page,context}:{page:any;context:any})=>{
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:9.03,longitude:38.74});
  await page.goto('/');
  await expect(page.getByTestId('visitor-location-state')).toContainText('Location updated');
  await expect(page.getByRole('button',{name:'Refresh my location'})).toBeVisible();
  await expect(page.locator('.capacity-location-tooltip')).toHaveCount(0);
  await page.locator('.public-viewer-location-marker').dispatchEvent('mouseover');
  await expect(page.locator('.capacity-location-tooltip')).toContainText('Your location');
  await expect(page.locator('.public-capacity-map')).toBeVisible();
  const mapBox=await page.locator('.public-capacity-map .leaflet-container').boundingBox();
  const viewerMarkerBox=await page.locator('.public-viewer-location-marker').boundingBox();
  expect(mapBox&&viewerMarkerBox).toBeTruthy();
  expect(Math.abs((viewerMarkerBox!.x+viewerMarkerBox!.width/2)-(mapBox!.x+mapBox!.width/2))).toBeLessThan(mapBox!.width*.2);
  expect(Math.abs((viewerMarkerBox!.y+viewerMarkerBox!.height/2)-(mapBox!.y+mapBox!.height/2))).toBeLessThan(mapBox!.height*.2);
  await context.setGeolocation({latitude:9.08,longitude:38.78});
  let proximityRequests=0;
  page.on('request',(request:any)=>{const url=new URL(request.url());if(url.pathname==='/api/public/capacity'&&url.searchParams.get('nearLat')&&request.method()==='GET')proximityRequests+=1;});
  await page.getByRole('button',{name:'Refresh my location'}).click({force:true});
  await expect(page.getByTestId('visitor-location-state')).toContainText('Location updated');
  await page.waitForTimeout(250);
  expect(proximityRequests).toBe(0);
  if((page.viewportSize()?.width||0)>760)await expect(page.getByText('Your precise location remains on this device.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:/Filters/}).evaluate((button:any)=>button.click());
  await expect(page.getByRole('dialog',{name:'Filters'})).toBeVisible();
  const nearby=page.getByLabel('Show trucks near my area');
  await expect(nearby).toBeEnabled();
  await nearby.check();
  await page.getByLabel('Distance').selectOption('50');
  const filterDialog=page.getByRole('dialog',{name:'Filters'});
  await page.getByRole('button',{name:'Show matching trucks'}).click();
  await expect(filterDialog).toBeHidden();
  await expect(page).toHaveURL(/nearLat=.*nearLng=.*nearRadiusKm=50/);
  await expect(page.getByTestId('visitor-location-state')).toContainText('Location updated');
  await expect(page.getByRole('button',{name:'List',exact:true})).toHaveCount(0);
  await expect(page.locator('.capacity-map-cluster,.capacity-truck-map-marker').first()).toBeVisible();
});

test('denied visitor location keeps the map usable and exposes a real retry',async({page}:{page:any})=>{
  await page.addInitScript(()=>{
    (window as any).__locationRequestCount=0;
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
      getCurrentPosition:(_success:any,failure:any)=>{(window as any).__locationRequestCount+=1;failure({code:1,PERMISSION_DENIED:1,TIMEOUT:3,POSITION_UNAVAILABLE:2});}
    }});
  });
  await page.goto('/');
  await expect(page.getByTestId('visitor-location-state')).toContainText('Location permission is blocked');
  await expect(page.locator('.public-capacity-map')).toBeVisible();
  const retry=page.getByRole('button',{name:'Retry location permission'});
  await expect(retry).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__locationRequestCount)).toBe(1);
  await retry.click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__locationRequestCount)).toBe(2);
});

test('provider-name search filters the one Truck Market and truck details reach the microsite',async({page}:{page:any})=>{
  await page.goto('/providers?q=BlueLine');
  await expect(page).toHaveURL(/\?q=BlueLine$/);
  await expect(page.getByRole('button',{name:'Providers',exact:true})).toHaveCount(0);
  await expect(page.locator('.public-provider-map')).toHaveCount(0);
  await expect(page.locator('.provider-area-market-marker')).toHaveCount(0);
  const blueLineResponse=await page.request.get('/api/public/capacity?q=BlueLine');
  expect(blueLineResponse.ok()).toBeTruthy();
  const blueLineTrucks=(await blueLineResponse.json()).items;
  expect(blueLineTrucks.length).toBeGreaterThan(0);
  expect(blueLineTrucks.every((item:any)=>item.provider_name==='BlueLine Transport PLC')).toBe(true);
  await page.goto(`/@${blueLineTrucks[0].provider_handle}`);
  await expect(page.locator('.provider-handle')).toContainText('/@');
  await expect(page.getByRole('heading',{name:'Reviewed documents'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Trucks and published capacity'})).toBeVisible();
  await expect.poll(()=>page.locator('.provider-truck-card').count()).toBeGreaterThan(0);
  await expect(page.locator('.provider-truck-relative-map')).toHaveCount(0);
  const fleetTop=await page.locator('.provider-fleet-showcase').evaluate((element:any)=>element.getBoundingClientRect().top+window.scrollY);
  const aboutTop=await page.locator('.provider-about-card').evaluate((element:any)=>element.getBoundingClientRect().top+window.scrollY);
  expect(fleetTop).toBeLessThan(aboutTop);
  const mapButton=page.getByRole('button',{name:'View capacity on map'}).first();
  await expect(mapButton).toBeVisible();
  await mapButton.click();
  await expect(page.locator('.provider-truck-card.expanded')).toHaveCount(1);
  await expect(page.locator('.provider-truck-relative-map .public-capacity-map')).toBeVisible();
  await expect(page.getByText('Your precise location remains on this device.').last()).toBeVisible();
  await expect(page.getByRole('button',{name:'Close capacity map'})).toBeVisible();
  const profileMetrics=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  expect(profileMetrics.scroll).toBeLessThanOrEqual(profileMetrics.client+1);
  const mapActions=page.locator('.provider-truck-map-actions .button');
  await expect(mapActions).toHaveCount(2);
  for(const action of await mapActions.all())expect((await action.boundingBox())?.width||0).toBeGreaterThanOrEqual(44);
  await page.getByRole('button',{name:'Close map',exact:true}).click();
  await expect(page.locator('.provider-truck-relative-map')).toHaveCount(0);
  await expect(mapButton).toBeFocused();
  await expect(page.getByText(/confirm current originals/i)).toBeVisible();
  await expect(page.locator('.provider-microsite')).not.toContainText('null → null');
  await expect(page.locator('.provider-site-hero')).not.toHaveAttribute('style',/provider-primary/);
});

test('transporter map action keeps its trucks visible after visitor location refresh',async({page,context}:{page:any;context:any})=>{
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:14.0,longitude:40.0});
  await page.goto('/?q=BlueLine%20Transport%20PLC&provider=blueline-transport#capacity-market');
  await expect(page).toHaveURL(/provider=blueline-transport#capacity-market$/);
  await expect(page.getByTestId('visitor-location-state')).toContainText('The map is centered around your area');
  const response=await page.request.get('/api/public/capacity?q=BlueLine%20Transport%20PLC&provider=blueline-transport');
  expect(response.ok()).toBeTruthy();
  const trucks=(await response.json()).items;
  expect(trucks.length).toBeGreaterThan(0);
  expect(trucks.every((item:any)=>item.provider_handle==='blueline-transport')).toBe(true);
  await expect(page.locator('.capacity-map-cluster,.capacity-truck-map-marker').first()).toBeVisible();
});

test('provider edits business facts without designing the Loadgistic microsite',async({page}:{page:any})=>{
  await login(page,'transporter@loadgistic.local');
  await page.goto('/app/company-page');
  await expect(page.getByText('Describe your transport business clearly so customers can assess your services.')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Page colors'})).toHaveCount(0);
  await expect(page.getByLabel('YouTube video ID')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Save transporter information'})).toBeVisible();
  await page.getByLabel('Choose image').setInputFiles({name:'provider.png',mimeType:'image/png',buffer:Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc0000004010100f689891d0000000049454e44ae426082','hex')});
  await page.getByRole('button',{name:/^(Upload|Replace) image$/}).click();
  await expect(page.getByText('Provider image updated.')).toBeVisible();
  await page.getByRole('link',{name:'Open public page'}).click();
  await expect(page.getByRole('img',{name:'BlueLine Transport PLC transporter profile'})).toBeVisible();
});

test('fleet Driver access shows only current capacity and Tracking permissions',async({page}:{page:any})=>{
  await login(page,'transporter@loadgistic.local');
  await page.goto('/app/fleet');
  await page.locator('.fleet-driver-manager summary').first().click();
  await expect(page.getByLabel('Capacity updates').first()).toBeVisible();
  await expect(page.getByLabel('Tracking updates').first()).toBeVisible();
  for(const retired of ['Shipment Board','Call Businesses','Agree + assign shipments']){
    await expect(page.getByText(retired,{exact:true})).toHaveCount(0);
  }
});

test('administrator Operations shows provider-owned Tracking and no retired Network view',async({page}:{page:any})=>{
  await login(page,'admin@loadgistic.local');
  await page.goto('/admin/operations?view=TRACKING');
  await expect(page.getByLabel('Management area')).toHaveValue('TRACKING');
  await expect(page.getByLabel('Management area').locator('option',{hasText:'Network'})).toHaveCount(0);
  await expect(page.getByText('Tracking',{exact:true}).first()).toBeVisible();
  await expect(page.getByText(/customer owner email/i)).toHaveCount(0);
});

test('public Tracking submission shows progress and a visible invalid-code result',async({page}:{page:any})=>{
  await page.goto('/track');
  await page.getByLabel('Approved email').fill('unknown.tracking@example.test');
  await page.getByLabel('Tracking code').fill('LG-0000-0000-0000-0000');
  await page.getByRole('button',{name:'Email me a code'}).click();
  await page.getByLabel('One-time code').fill('000000');
  await page.getByRole('button',{name:'Open tracking'}).click();
  await expect(page.getByRole('alert').filter({hasText:/could not be verified/i})).toBeVisible();
  await expect(page.getByRole('button',{name:'Open tracking'})).toBeEnabled();
});

test('provider starts Tracking for multiple parties with one stable shipment code and ordered status actions',async({page}:{page:any})=>{
  test.slow();
  await login(page,'transporter@loadgistic.local');
  await page.goto('/app/provider-shipments/new');
  await page.getByLabel('Truck').selectOption({index:1});
  await page.getByLabel('Cargo summary').fill('Workshop machine parts');
  await choosePlace(page,'Origin','Addis',/Addis Ababa, Ethiopia/i);
  await choosePlace(page,'Destination','Adama',/Adama, Ethiopia/i);
  const ownerEmail='owner.e2e@example.test';
  const trackingPartyEmail='dispatch.e2e@example.test';
  await page.getByLabel('Customer owner email').fill(ownerEmail);
  await page.getByLabel('Additional tracking emails').fill(trackingPartyEmail);
  const createResponse=page.waitForResponse((response:any)=>response.url().endsWith('/api/provider-shipments')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Start Tracking'}).click();
  expect((await createResponse).status()).toBe(201);
  await expect(page.getByText('Tracking started')).toBeVisible({timeout:10_000});
  const trackingCode=(await page.locator('.party-code-grid article').first().locator('code').textContent())!;
  expect(trackingCode).toMatch(/^LG-[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
  const openTracking=page.getByRole('link',{name:'Open Tracking'});
  const trackingHref=await openTracking.getAttribute('href');
  expect(trackingHref).toMatch(/^\/app\/provider-shipments\/[0-9a-f-]{36}$/);
  await Promise.all([
    page.waitForURL(/\/app\/provider-shipments\/[0-9a-f-]{36}$/,{timeout:15_000}),
    openTracking.click()
  ]);
  await expect(page.getByRole('heading',{name:/Tracking · LGX-/})).toBeVisible({timeout:10_000});
  await expect(page.getByText(trackingPartyEmail,{exact:true})).toBeVisible();
  await expect(page.locator('.tracking-action-choice')).toHaveCount(6);
  await expect(page.locator('.tracking-action-choice strong')).toHaveText(['Going to pickup','Loading','En route','Unloading','Complete','Problem']);
  await page.locator('input[name="nextStatus"][value="LOADING"]').check();
  await expect(page.getByLabel('Photo (optional)')).toBeVisible();
  await page.getByRole('button',{name:'Save Loading'}).click();
  await expect(page.getByText('Tracking status updated.')).toBeVisible();
  await page.getByLabel('En route').check();
  await expect(page.getByLabel('Photo (optional)')).toHaveCount(0);
  await expect(page.getByText(trackingCode)).toBeVisible();
  await page.goto('/track');
  await page.getByLabel('Approved email').fill(ownerEmail);
  await page.getByLabel('Tracking code').fill(trackingCode);
  const requestedAt=Date.now();
  await page.getByRole('button',{name:'Email me a code'}).click();
  await page.getByLabel('One-time code').fill(await localMailpitNumericCode(ownerEmail,requestedAt,'Your shipment Tracking code'));
  await page.getByRole('button',{name:'Open tracking'}).click();
  await expect(page.getByText('Private shipment tracking')).toBeVisible();
  await expect(page.getByRole('heading',{name:/Track LGX-/})).toBeVisible();
  await page.goto('/track');
  await page.getByLabel('Approved email').fill(trackingPartyEmail);
  await page.getByLabel('Tracking code').fill(trackingCode);
  const partyRequestedAt=Date.now();
  await page.getByRole('button',{name:'Email me a code'}).click();
  await page.getByLabel('One-time code').fill(await localMailpitNumericCode(trackingPartyEmail,partyRequestedAt,'Your shipment Tracking code'));
  await page.getByRole('button',{name:'Open tracking'}).click();
  await expect(page.getByText('Private shipment tracking')).toBeVisible();
});

test('assigned Driver shares only an approximate location during travel',async({page,context}:{page:any;context:any})=>{
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:9.03,longitude:38.76});
  await login(page,'driver@loadgistic.local');
  await page.goto('/app/provider-shipments/new');
  await page.getByLabel('Truck').selectOption({index:1});
  await page.getByLabel('Cargo summary').fill('Workshop steel inputs');
  await choosePlace(page,'Origin','Addis',/Addis Ababa, Ethiopia/i);
  await choosePlace(page,'Destination','Adama',/Adama, Ethiopia/i);
  const ownerEmail='location.owner.e2e@example.test';
  await page.getByLabel('Customer owner email').fill(ownerEmail);
  await page.getByLabel('Status and approximate location').check();
  await page.getByRole('button',{name:'Start Tracking'}).click();
  await expect(page.getByText('Tracking started')).toBeVisible();
  const trackingCode=(await page.locator('.party-code-grid article').first().locator('code').textContent())!;
  await page.getByRole('link',{name:'Open Tracking'}).click();
  await expect(page.getByLabel('Going to pickup')).toBeChecked();
  const statusUpdate=page.waitForResponse((response:any)=>response.url().includes('/status')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Save Going to pickup'}).click();
  expect((await statusUpdate).status()).toBe(303);
  await expect(page.getByText('Tracking status updated.')).toBeVisible();
  await page.goto('/track');
  await page.getByLabel('Approved email').fill(ownerEmail);
  await page.getByLabel('Tracking code').fill(trackingCode);
  const requestedAt=Date.now();
  await page.getByRole('button',{name:'Email me a code'}).click();
  await page.getByLabel('One-time code').fill(await localMailpitNumericCode(ownerEmail,requestedAt,'Your shipment Tracking code'));
  await page.getByRole('button',{name:'Open tracking'}).click();
  await expect(page.getByText('Approximate Driver location',{exact:true})).toBeVisible();
  await expect(page.locator('.tracking-location-map .leaflet-container')).toBeVisible();
  await expect(page.getByText(/not an exact truck position/i)).toBeVisible();
  await expect(page.locator('.timeline')).toContainText('Going to pickup');
});

test('Driver Home stays focused on capacity and keeps Tracking in navigation',async({page,context}:{page:any;context:any})=>{
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:9.07,longitude:38.76});
  await login(page,'driver@loadgistic.local');
  await page.goto('/app/provider-shipments/new');
  await page.getByLabel('Truck').selectOption({index:1});
  await page.getByLabel('Cargo summary').fill('Fabricated window frames');
  await choosePlace(page,'Origin','Addis',/Addis Ababa, Ethiopia/i);
  await choosePlace(page,'Destination','Bishoftu',/Bishoftu, Ethiopia/i);
  await page.getByLabel('Customer owner email').fill('driver.owner.e2e@example.test');
  await page.getByRole('button',{name:'Start Tracking'}).click();
  await expect(page.getByText('Tracking started')).toBeVisible();
  const trackingCode=(await page.locator('.tracking-code-reveal-heading h1').textContent())!;
  await page.goto('/app/home');
  await expect(page.getByRole('heading',{name:'Capacity management',exact:true})).toHaveCount(1);
  await expect(page.getByRole('heading',{name:'Capacity',exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Truck availability'})).toHaveCount(0);
  await expect(page.getByText('Verify before you commit.')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Tracking now'})).toHaveCount(0);
  await expect(page.locator('.driver-active-tracking')).toHaveCount(0);
  await expect(page.getByText(trackingCode)).toHaveCount(0);
  if((page.viewportSize()?.width||0)<=760){
    const mobileNav=page.getByRole('navigation',{name:'Mobile navigation'});
    await expect(mobileNav.getByRole('link')).toHaveCount(5);
    for(const label of ['Home','Tracking','Network','Support','More'])await expect(mobileNav.getByRole('link',{name:label,exact:true})).toBeVisible();
    await expect(mobileNav.getByRole('link',{name:'Capacity',exact:true})).toHaveCount(0);
    await Promise.all([
      page.waitForURL(/\/app\/menu$/),
      mobileNav.getByRole('link',{name:'More',exact:true}).click()
    ]);
    await expect(page.getByRole('heading',{name:'More'})).toBeVisible({timeout:10_000});
    const menuGrid=page.locator('.workspace-menu-grid');
    for(const label of ['Public profile','Verification','Support','Account & plan','Open capacity','Public featured programme'])await expect(menuGrid.getByRole('link',{name:new RegExp(`^${label}`)})).toBeVisible();
    await expect(page.getByRole('button',{name:'Log out'})).toBeVisible();
    await page.goto('/app/home');
  }
  const primaryNavigation=(page.viewportSize()?.width||0)<=760
    ?page.getByRole('navigation',{name:'Mobile navigation'})
    :page.getByRole('navigation',{name:'Workspace navigation'});
  await Promise.all([
    page.waitForURL(/\/app\/provider-shipments$/),
    primaryNavigation.getByRole('link',{name:'Tracking',exact:true}).click()
  ]);
  await expect(page.getByText(trackingCode)).toBeVisible();
});

test('capacity summary keeps the map visible and Driver refresh persists location',async({page,context}:{page:any;context:any})=>{
  test.setTimeout(45_000);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:9.07,longitude:38.76});
  const automaticLocationSave=page.waitForResponse((response:any)=>response.url().endsWith('/api/capacity/location')&&response.request().method()==='POST');
  await login(page,'driver@loadgistic.local');
  expect((await automaticLocationSave).ok()).toBe(true);
  await expect(page.getByTestId('capacity-location-state')).toHaveCount(0);
  const summary=page.getByTestId('capacity-summary');
  await expect(summary).toBeVisible();
  await expect(summary.locator('.leaflet-container')).toBeVisible();
  await expect(summary.locator('.capacity-setting-truck-marker')).toBeVisible();
  await expect(summary.locator('.capacity-setting-truck-label')).toContainText('Truck area');
  await expect(summary.locator('.capacity-summary-map-header')).toBeVisible();
  await expect(summary.getByRole('navigation',{name:'Edit capacity signals'})).toBeVisible();
  await expect(summary.locator('.capacity-map-key')).toContainText('Regular service');
  await expect(summary.getByRole('region',{name:'Approximate truck location controls'})).toBeVisible();
  const zones=await summary.evaluate((root:HTMLElement)=>{
    const box=(selector:string)=>{const rect=(root.querySelector(selector) as HTMLElement|null)?.getBoundingClientRect();return rect?{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom}:null;};
    const overlaps=(first:ReturnType<typeof box>,second:ReturnType<typeof box>)=>Boolean(first&&second&&first.left<second.right-1&&first.right>second.left+1&&first.top<second.bottom-1&&first.bottom>second.top+1);
    const selectedTruck=box('.capacity-summary-map-header');
    const editRail=box('.capacity-summary-toolrail');
    const legend=box('.capacity-map-key');
    const locationDock=box('.capacity-location-dock');
    const attribution=box('.leaflet-control-attribution');
    const zoom=box('.leaflet-control-zoom');
    return {
      selectedTruck,editRail,legend,locationDock,
      selectedTruckOverlapsRail:overlaps(selectedTruck,editRail),
      selectedTruckOverlapsZoom:overlaps(selectedTruck,zoom),
      legendOverlapsDock:overlaps(legend,locationDock),
      legendOverlapsAttribution:overlaps(legend,attribution),
      dockOverlapsAttribution:overlaps(locationDock,attribution)
    };
  });
  expect(zones.selectedTruck).not.toBeNull();
  expect(zones.editRail).not.toBeNull();
  expect(zones.legend).not.toBeNull();
  expect(zones.locationDock).not.toBeNull();
  expect(zones.selectedTruck!.left).toBeLessThan(zones.editRail!.left);
  expect(zones.legend!.left).toBeLessThan(zones.locationDock!.left);
  expect(zones.selectedTruck!.top).toBeLessThan(zones.legend!.top);
  expect(zones.editRail!.top).toBeLessThan(zones.locationDock!.top);
  expect(zones.selectedTruckOverlapsRail).toBe(false);
  expect(zones.selectedTruckOverlapsZoom).toBe(false);
  expect(zones.legendOverlapsDock).toBe(false);
  expect(zones.legendOverlapsAttribution).toBe(false);
  expect(zones.dockOverlapsAttribution).toBe(false);
  const availabilityControl=page.getByRole('button',{name:/^Edit current capacity:/});
  const availabilityText=await availabilityControl.getAttribute('aria-label');
  const emptyAvailability=Boolean(availabilityText?.includes('Empty'));
  const expectedCapacityColor=emptyAvailability?'#16a34a':'#eab308';
  await expect(summary.locator(`path[stroke="${expectedCapacityColor}"]`).first()).toBeVisible();
  await expect(summary.locator('.capacity-setting-truck-marker-halo')).toHaveAttribute('stroke',expectedCapacityColor);
  await expect(summary.locator('path[stroke="#7c3aed"]').first()).toBeVisible();
  await expect(summary.locator('.capacity-map-key')).toContainText(emptyAvailability?'Empty availability':'Partial availability');
  const privacy=page.getByLabel('Approximate location radius');
  const currentPrivacy=await privacy.inputValue();
  const nextPrivacy=currentPrivacy==='5'?'10':'5';
  const privacySave=page.waitForResponse((response:any)=>response.url().endsWith('/api/capacity/location')&&response.request().method()==='POST');
  await privacy.selectOption(nextPrivacy);
  expect((await privacySave).ok()).toBe(true);
  await expect(summary).toContainText(`${nextPrivacy} km radius`);
  await expect(page.getByTestId('capacity-form')).toHaveCount(0);
  const save=page.waitForResponse((response:any)=>response.url().endsWith('/api/capacity/location')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Refresh truck location'}).click();
  const saved=await save;
  expect(saved.ok()).toBe(true);
  await expect(page.getByTestId('capacity-location-state')).toContainText('Approximate truck location saved');
  await expect(page.getByTestId('capacity-location-state')).toHaveCount(0,{timeout:6_000});
  await expect(page.getByTestId('capacity-form')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Capacity now'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Available by radius or corridor'})).toHaveCount(0);
  await expect(summary).toContainText('just now');
  await expect(summary).not.toContainText('Next trip');
  await expect(summary).toContainText('Regular service');
  await expect(page.locator('.capacity-market-planning')).toHaveCount(0);
  await page.getByRole('button',{name:/^Edit regular service:/}).click();
  await expect(page.getByTestId('capacity-planning-editor')).toBeVisible();
  await expect(page.getByTestId('capacity-planning-editor')).toContainText('one undated Service area or Capacity route');
  await page.getByTestId('capacity-planning-editor').getByRole('button',{name:'Back to summary'}).click();
  await page.getByRole('button',{name:/^Edit current capacity:/}).click();
  await expect(page.getByRole('heading',{name:'Capacity now'})).toBeVisible();
  await page.getByRole('button',{name:'Partial',exact:true}).click();
  await expect(page.getByLabel(/Space available/i)).toHaveCount(0);
  await expect(page.locator('input[name="availablePercent"]')).toHaveCount(0);
  await expect(page.getByText(/Confirm the actual fit directly/i)).toBeVisible();
  await expect(page.getByRole('heading',{name:'Available by radius or corridor'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Approximate current location'})).toHaveCount(0);
  await page.goto('/app/capacity');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading',{name:'Open Transport Capacity',includeHidden:true})).toHaveCount(1);
  await expect(page.locator('.map-workspace-heading')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'List',exact:true})).toHaveCount(0);
  await expect(page.locator('.public-capacity-map')).toBeVisible();
});

test('retired demand URLs redirect to the public supply market',async({page,request}:{page:any;request:any})=>{
  await page.goto('/app/loads');
  await expect(page).toHaveURL(/\/$/);
  const pageResponse=await request.get('/app/shipments/retired-id',{maxRedirects:0});
  expect(pageResponse.status()).toBe(307);
  expect(pageResponse.headers().location).toBe('/app/provider-shipments');
  const response=await request.post('/api/shipments',{form:{title:'retired'}});
  expect(response.status()).toBe(410);
  expect(await response.json()).toMatchObject({error:{code:'DEMAND_WORKFLOW_RETIRED'}});
  const nestedResponse=await request.post('/api/shipments/retired-id/status',{form:{status:'COMPLETED'}});
  expect(nestedResponse.status()).toBe(410);
  const proofResponse=await request.get('/api/files/proof/retired-id');
  expect(proofResponse.status()).toBe(410);
  const networkResponse=await request.post('/api/network',{form:{action:'REQUEST'}});
  expect(networkResponse.status()).toBe(410);
});

test('login page never publishes fixture credentials',async({page}:{page:any})=>{
  await page.goto('/login');
  await expect(page.getByTestId('email-code-request-form').getByLabel('Email',{exact:true})).toHaveValue('');
  await page.locator('details.auth-fixture-login>summary').click();
  await expect(page.getByTestId('login-form').getByLabel('Email',{exact:true})).toHaveValue('');
  await expect(page.getByTestId('login-form').getByLabel('Password')).toHaveValue('');
  await expect(page.getByText('@loadgistic.local')).toHaveCount(0);
  await expect(page.getByText('Loadgistic123!',{exact:false})).toHaveCount(0);
});
