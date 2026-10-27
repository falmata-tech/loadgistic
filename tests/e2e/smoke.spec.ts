import {auditOpenTrackingProgress} from './audit-helpers';
import {chooseDate} from './date-picker-helper';
import {openCapacityFilters,openCapacityFilterDialog} from './capacity-drawer-helper';
import { test, expect } from './browser-test';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {randomInt,randomUUID} from 'node:crypto';
import path from 'node:path';
import {localMailpitNumericCode} from './mailpit-helper';
import {localSupportLogin} from './provider-support-helper';
import {localAuditService,checked,auditLogin,auditIdentity,acceptAuditContentPolicy,auditProvider,auditFleetProvider,auditDeleteVehicles,auditAssignAndPublishSelfDrivenVehicle} from './audit-helpers';
import {addLocalSmokeSponsor,temporarilyHideLocalSponsors} from './sponsor-fixture-helper';
import {getProviderCapacityWorkspace,addProviderRegularCapacity,publishProviderCapacity} from '../../src/lib/provider-capacity.js';
import {createProviderVehicle,updateFleetDriverAccess} from '../../src/lib/fleet.js';
import {createProviderShipment,getProviderTrackingWorkspace} from '../../src/lib/provider-tracking.js';
import {removePrivateUpload} from '../../src/lib/private-storage.js';
import {removeProviderProfileImage} from '../../src/lib/provider-profile.js';

let cleanupSmokeSponsor:(()=>Promise<void>)|undefined;
test.beforeEach(async({},info:{title:string})=>{
  if(info.title==='public entry makes capacity immediately usable without an account')cleanupSmokeSponsor=await addLocalSmokeSponsor();
});
test.afterEach(async()=>{
  try{await cleanupSmokeSponsor?.();}finally{cleanupSmokeSponsor=undefined;}
});

test('Featured without sponsors keeps the provider board usable',async({page}:{page:any})=>{
  const restore=await temporarilyHideLocalSponsors();
  try{
    await page.goto('/featured');
    await expect(page.locator('.featured-truck-tile').first()).toBeVisible();
    await expect(page.locator('.transport-expo-experience')).toHaveClass(/without-sponsors/);
    await expect(page.locator('.expo-sponsored-rail')).toHaveCount(0);
    const mobile=(page.viewportSize()?.width||0)<=760;
    const navigation=page.getByRole('navigation',{name:mobile?'Mobile navigation':'Site navigation'});
    await expect(navigation.getByRole('link',{name:'Capacity',exact:true})).toBeVisible();
  }finally{await restore();}
});

async function login(page:any,email:string,destination?:string){
  // Fixture aliases can be migrated to the owner's deliverable +addresses.
  // Use the shared local-only identity resolver; OTP has its own visible tests.
  await auditLogin(page,email,destination);
}

async function fixtureDrivingVehicle(email:string){
  const service=localAuditService(),actor=await auditIdentity(service,email);
  const assignment=checked(await service.from('driver_vehicle_assignments').select('vehicle_id').eq('driver_user_id',actor.id).eq('active',true).single());
  const workspace=await getProviderTrackingWorkspace(actor,{limit:1});
  expect(workspace.access?.can_manage_tracking).toBe(true);
  expect(workspace.vehicles.filter((vehicle:{id:string})=>vehicle.id===assignment.vehicle_id)).toHaveLength(1);
  return {service,actor,actorId:actor.id,vehicleId:assignment.vehicle_id};
}

async function selectFixtureDrivingVehicle(page:any,email:string){
  const pair=await fixtureDrivingVehicle(email);
  const vehicle=page.getByRole('combobox',{name:'Vehicle',exact:true});await expect(vehicle).toBeVisible();
  await vehicle.selectOption(pair.vehicleId);await expect(vehicle).toHaveValue(pair.vehicleId);
  return pair;
}

async function removeSmokeShipment(service:any,id:string){
  checked(await service.from('access_email_deliveries').delete().eq('entity_id',id));
  checked(await service.from('audit_logs').delete().eq('entity_id',id));
  checked(await service.from('provider_shipments').delete().eq('id',id));
}

async function choosePlace(page:any,label:string,query:string,option:RegExp){
  const accessibleLabel=new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?: \\(optional\\))?$`,'i');
  const input=page.getByRole('combobox',{name:accessibleLabel});
  await input.fill(query);
  await expect(page.getByRole('option',{name:option}).first()).toBeVisible({timeout:30_000});
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
  test.setTimeout(60_000);
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'The visibility you need to serve your customers reliably',level:1})).toHaveCount(1);
  await expect(page.locator('.map-workspace-heading')).toHaveCount(0);
  await expect(page.locator('a[href="/featured"]:visible').first()).toHaveAttribute('href','/featured');
  await expect(page.locator('.featured-provider-section')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Providers',exact:true})).toHaveCount(0);
  const drawer=await openCapacityFilters(page);
  await expect(drawer.getByRole('searchbox',{name:'Search transporters'})).toBeVisible();
  const filterDialog=await openCapacityFilterDialog(page);
  await expect(filterDialog.getByRole('group',{name:'Load status',exact:true})).toBeVisible();
  await filterDialog.getByRole('button',{name:'Route',exact:true}).click();
  await choosePlace(filterDialog,'Origin','Adama',/Adama, Ethiopia/i);
  await choosePlace(filterDialog,'Destination','Hawassa',/Hawassa, Ethiopia/i);
  await expect(filterDialog.getByRole('group',{name:'Vehicle type',exact:true})).toBeVisible();
  await filterDialog.locator('.capacity-configuration-picker summary').click();await expect(filterDialog.getByRole('checkbox',{name:'Cargo van',exact:true})).toHaveCount(1);await filterDialog.locator('.capacity-configuration-picker summary').click();
  await filterDialog.locator('[data-filter-section="location"] > summary').click();
  const nearToggle=filterDialog.getByLabel('Show vehicles near my area');
  await expect(nearToggle).toBeVisible();
  if(await nearToggle.isEnabled()){await nearToggle.check();await expect(filterDialog.locator('#capacity-near-radius')).toBeVisible();}

  await expect(filterDialog.getByRole('combobox',{name:'Origin range',exact:true})).toBeVisible();
  await expect(filterDialog.getByRole('combobox',{name:'Destination range',exact:true})).toBeVisible();
  await expect(filterDialog.getByRole('radiogroup',{name:'Capacity signal'})).toHaveCount(0);
  await expect(filterDialog.getByRole('combobox',{name:'Direction',exact:true})).toBeVisible();
  await expect(filterDialog.getByRole('group',{name:'Space needed',exact:true})).toHaveCount(0);
  await expect(filterDialog.getByLabel('Minimum available space')).toHaveCount(0);
  await filterDialog.locator('[data-filter-section="more"] summary').click();
  await expect(filterDialog.getByRole('group',{name:'Stops',exact:true})).toBeVisible();
  await expect(filterDialog.getByRole('group',{name:'Updated',exact:true})).toBeVisible();
  await filterDialog.getByRole('button',{name:'Close filters'}).click();
  await expect(filterDialog).toBeHidden();
  await expect(page.getByRole('button',{name:'Map',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'List',exact:true})).toHaveCount(0);
  await expect(page.locator('.public-capacity-map')).toBeVisible();
  await expect(page.getByRole('button',{name:/location/i})).toBeVisible();
  await Promise.all([page.waitForURL(/\/featured$/,{waitUntil:'domcontentloaded',timeout:30_000}),page.locator('a[href="/featured"]:visible').first().click()]);
  await expect(page.locator('.public-capacity-map')).toHaveCount(0);
  const currentPublicNav=(page.viewportSize()?.width||0)>760?page.getByRole('navigation',{name:'Site navigation'}):page.getByRole('navigation',{name:'Mobile navigation'});
  await expect(currentPublicNav.getByRole('link',{name:'Featured',exact:true})).toHaveAttribute('aria-current','page');
  const featured=page.locator('.featured-provider-section');
  await expect(featured.locator('.featured-programme-current')).toContainText(/Transport Providers/i);
  await expect(featured.locator('.regional-expo-week-panel')).toHaveCount(0);
  const featuredTrucks=featured.locator('.featured-truck-tile');
  await expect.poll(()=>featuredTrucks.count()).toBeGreaterThan(1);
  await expect(featuredTrucks.first()).toHaveAttribute('aria-label',/^Featured account .+, \d+ vehicles$/);
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
    // The TikTok LIVE header adds its measured height above the board.
    expect(billboardLayout.boardTop-billboardLayout.sectionTop).toBeLessThanOrEqual(283+billboardLayout.liveHeight);
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
  const featuredMap=providerDialog.getByRole('link',{name:'View available vehicles'});
  if(await featuredMap.count()){
    await expect(featuredMap).toHaveAttribute('href',/^\/\?provider=.+$/);
    await featuredMap.click();
    await expect(page).toHaveURL(/\?provider=.+$/);
    await expect(providerDialog).toBeHidden();
    await expect(page.locator('.public-capacity-map')).toBeVisible();
    await expect.poll(()=>page.locator('.capacity-truck-map-marker,.capacity-map-cluster').count()).toBeGreaterThan(0);
    await expect(page.getByText('Loading vehicles in this map area…',{exact:true})).toHaveCount(0,{timeout:20_000});
    const inMapTarget=async(selector:string)=>page.locator(selector+':visible').evaluateAll((elements:any[],className:string)=>{
      const map=document.querySelector('.leaflet-container')?.getBoundingClientRect();
      if(!map)return -1;
      return elements.findIndex(element=>{
        const bounds=element.getBoundingClientRect(),x=(bounds.left+bounds.right)/2,y=(bounds.top+bounds.bottom)/2;
        return bounds.width>0&&bounds.height>0&&x>map.left+12&&x<map.right-12&&y>map.top+12&&y<map.bottom-12&&document.elementFromPoint(x,y)?.closest(className)===element;
      });
    },selector);
    let selectedFromCluster=false;
    for(let attempt=0;attempt<8;attempt+=1){
      await expect(page.locator('.leaflet-zoom-anim')).toHaveCount(0);
      if(await inMapTarget('.capacity-truck-map-marker')>=0)break;
      const clusterIndex=await inMapTarget('.capacity-map-cluster');
      if(clusterIndex<0){
        const zoom=page.locator('.leaflet-control-zoom-in');
        if((await zoom.getAttribute('class'))?.includes('leaflet-disabled'))break;
        await zoom.click();
        await page.waitForTimeout(180);
        continue;
      }
      await page.locator('.capacity-map-cluster:visible').nth(clusterIndex).click();
      await page.waitForTimeout(180);
      const picker=page.locator('.capacity-cluster-picker:visible');
      if(await picker.count()){
        await picker.getByRole('button').first().click();
        selectedFromCluster=true;
        break;
      }
    }
    if(selectedFromCluster)await expect(page.locator('.capacity-truck-map-marker.selected')).toBeVisible();
    else{
      const markerIndex=await inMapTarget('.capacity-truck-map-marker');
      expect(markerIndex,'A filtered vehicle marker must be reachable in the map viewport').toBeGreaterThanOrEqual(0);
      await page.locator('.capacity-truck-map-marker:visible').nth(markerIndex).click();
    }
    await page.locator('.map-info-bubble.truck').click();
  await expect(page.locator('.map-capacity-sheet')).toBeVisible();
  }else{
    await expect(providerDialog.getByRole('link')).toHaveCount(1);
    await providerDialog.getByRole('button',{name:'Close featured account details'}).click();
  }
});

test('legacy capacity URL opens an independent transporter search',async({page}:{page:any})=>{
  await page.goto('/capacity?q=Fuso');
  await expect(page).toHaveURL(/\?q=Fuso$/);
  await page.locator('.capacity-drawer-handle').waitFor({state:'attached',timeout:15000});
  const drawer=await openCapacityFilters(page);
  await expect(drawer.getByRole('searchbox',{name:'Search transporters'})).toHaveValue('Fuso');
  await expect(drawer.getByRole('button',{name:'Clear search'})).toBeEnabled();
  await page.getByRole('button',{name:'Vehicle filters',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Vehicle filters'}).getByRole('searchbox',{name:'Search transporters'})).toHaveCount(0);
});

test('public mobile shell keeps every visitor destination directly reachable',async({page}:{page:any})=>{
  await page.goto('/');
  const mobile=(page.viewportSize()?.width||0)<=760;
  const appNav=page.getByRole('navigation',{name:'Mobile navigation'});
  if(!mobile){
    await expect(appNav).toBeHidden();
    const workspaceNav=page.getByRole('navigation',{name:'Site navigation'});
    await expect(workspaceNav).toBeVisible();
    await expect(workspaceNav.getByRole('link',{name:'Capacity',exact:true})).toHaveAttribute('aria-current','page');
    await expect(workspaceNav.getByRole('link')).toHaveCount(6);
    for(const label of ['Featured','Track','About','Privacy','Terms'])await expect(workspaceNav.getByRole('link',{name:label,exact:true})).toBeVisible();
    await expect(workspaceNav.getByRole('link',{name:'Join',exact:true})).toHaveCount(0);
    await Promise.all([
      page.waitForURL(/\/privacy$/),
      workspaceNav.getByRole('link',{name:'Privacy',exact:true}).click()
    ]);
    await expect(page.getByRole('heading',{name:'Privacy',exact:true,level:1})).toBeVisible();
    await expect(page.getByRole('link',{name:'Delete account and data',exact:true})).toBeVisible();
    await expect(page.getByRole('navigation',{name:'Site navigation'}).getByRole('link',{name:'Privacy',exact:true})).toHaveAttribute('aria-current','page');
    await expect(page.locator('.home-footer')).toHaveCount(0);
    return;
  }

  await expect(appNav).toBeVisible();
  await expect(appNav.getByRole('link')).toHaveCount(4);
  for(const label of ['Capacity','Featured','Track','About']){
    const destination=appNav.getByRole('link',{name:label,exact:true});
    await expect(destination).toBeVisible();
    const box=await destination.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.locator('.public-session-compact').getByRole('link',{name:'Sign in'})).toBeVisible();
  await expect(page.locator('.home-footer')).toBeHidden();
  const marketTop=await page.locator('#capacity-market').evaluate((section:any)=>section.getBoundingClientRect().top);
  expect(marketTop).toBeLessThan(page.viewportSize()!.height);

  await appNav.getByRole('link',{name:'Featured',exact:true}).click();
  await expect(page).toHaveURL(/\/featured$/);
  await expect(page.locator('#featured-providers')).toBeInViewport();
  await expect(page.locator('.public-capacity-map')).toHaveCount(0);
  await expect(appNav.getByRole('link',{name:'Featured',exact:true})).toHaveAttribute('aria-current','page');
  await appNav.getByRole('link',{name:'Track',exact:true}).click();
  await expect(page).toHaveURL(/\/track$/);
  await expect(page.getByRole('navigation',{name:'Mobile navigation'})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'Track',exact:true})).toHaveAttribute('aria-current','page');
});

test('Truck Market profile results focus the provider trucks',async({page}:{page:any})=>{
  await page.goto('/');const drawer=await openCapacityFilters(page);
  await drawer.getByRole('searchbox',{name:'Search transporters'}).fill('BlueLine');
  await drawer.getByRole('button',{name:'Search',exact:true}).click();await openCapacityFilters(page);
  const profile=page.locator('[data-result-kind="COMPANY"]').first();await expect(profile).toBeVisible();
  await expect(profile.getByRole('link',{name:'Profile',exact:true})).toBeVisible();
  await profile.getByRole('link',{name:'Show vehicles on map',exact:true}).click();
  await expect(page).toHaveURL(/provider=/);await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.locator('[data-result-kind="TRUCK"]')).toHaveCount(0);
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
  if(combinedRouteQuery.get('status')==='PARTIAL'&&combinedRouteQuery.get('loadType')==='FTL'){
    const invalidCombination=await page.request.get(`/api/public/capacity?${combinedRouteQuery.toString()}`);
    expect(invalidCombination.status()).toBe(400);
    // Test status exclusion with a valid request, separately from validation.
    combinedRouteQuery.delete('loadType');
  }
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
  await openCapacityFilters(page);
  const search=page.locator('.market-command-column').getByRole('searchbox',{name:'Search transporters'});
  await search.fill(routeSignal.provider_name);
  await page.locator('.market-command-column').getByRole('button',{name:'Search',exact:true}).click();await openCapacityFilters(page);
  await expect(page.locator('.capacity-result-card').first()).toBeVisible({timeout:30_000});
});

test('route filters accept either endpoint without requiring the other',async({page}:{page:any})=>{
  await page.goto('/capacity');
  await openCapacityFilters(page);
  const filterDialog=await openCapacityFilterDialog(page);
  await filterDialog.getByRole('button',{name:'Route',exact:true}).click();
  await choosePlace(filterDialog,'Origin','Adama',/Adama, Ethiopia/i);
  await filterDialog.getByRole('button',{name:'Show vehicles'}).click();
  await expect(page).toHaveURL(/originPlaceRef=/);
  expect(new URL(page.url()).searchParams.get('destinationPlaceRef')).toBe('');
  await expect(page.locator('.public-capacity-map')).toBeVisible();
  await expect.poll(()=>page.locator('.capacity-truck-map-marker,.capacity-map-cluster,.capacity-overview-cell').count(),{timeout:30_000}).toBeGreaterThan(0);

  await page.goto('/capacity');
  await openCapacityFilterDialog(page);
  await filterDialog.getByRole('button',{name:'Route',exact:true}).click();
  await choosePlace(filterDialog,'Destination','Hawassa',/Hawassa, Ethiopia/i);
  await filterDialog.getByRole('button',{name:'Show vehicles'}).click();
  await expect(page).toHaveURL(/destinationPlaceRef=/);
  expect(new URL(page.url()).searchParams.get('originPlaceRef')).toBe('');
  await expect.poll(()=>page.locator('.capacity-truck-map-marker,.capacity-map-cluster,.capacity-overview-cell').count(),{timeout:30_000}).toBeGreaterThan(0);
});

test('administrator can review and publish an ordered daily provider-account roster',async({page}:{page:any})=>{
  test.setTimeout(90000);
  const service=localAuditService();
  const suffix=randomUUID().slice(0,8),headline=`Featured roster test ${suffix}`;
  const firstWeek=randomInt(0,4);
  let featureDate='';
  // Keep the weekday's vehicle theme while staying outside automatic selection's
  // seven-day window. Never edit an existing administrator's programme.
  for(let offset=0;offset<4;offset++){
    const candidate=new Date();candidate.setUTCDate(candidate.getUTCDate()+7*(2+(firstWeek+offset)%4));
    const iso=candidate.toISOString().slice(0,10);
    if(checked(await service.from('featured_provider_days').select('id').eq('feature_date',iso)).length===0){featureDate=iso;break;}
  }
  expect(featureDate,'No unused Featured test date exists within the calendar range.').not.toBe('');
  try{
  await login(page,'admin@loadgistic.local');
  await page.goto('/admin/featured');
  await expect(page.getByRole('heading',{name:'Daily Featured on TikTok LIVE'})).toBeVisible();
  await page.getByRole('link',{name:'Edit programme',exact:true}).click();
  await expect(page.locator('.featured-admin-status')).toContainText('Eligible accounts:');
  await expect(page.getByRole('heading',{name:"Choose today's Transport Providers"})).toBeVisible();
  await expect(page.getByText('10:30PM–11:59PM EAT',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Automatic'})).toHaveClass(/active/);
  await page.getByRole('link',{name:'Cancel editing',exact:true}).click();await page.getByRole('button',{name:'Schedule sponsor',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Sponsors'})).toBeVisible();
  const sponsorDialog=page.getByRole('dialog',{name:'Schedule sponsor'});
  await expect(sponsorDialog.getByRole('button',{name:'Save',exact:true})).toBeVisible();
  await sponsorDialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await chooseDate(page,'Feature date',featureDate);
  await page.getByRole('button',{name:'Load day'}).click();
  await expect(page).toHaveURL(new RegExp(`date=${featureDate}`));
  await page.getByRole('link',{name:'Edit programme',exact:true}).click();
  await expect(page).toHaveURL(/edit=day/);
  await expect(page.getByLabel('Add Transport Provider')).toBeEnabled();
  await expect.poll(()=>page.getByLabel('Add Transport Provider').locator('option').count()).toBeGreaterThan(1);
  // A streamed URL can arrive before the saved roster. Wait for the hydrated
  // editor, then prepare a known three-account roster without relying on today
  // already having a schedule or appending another account on every test run.
  const remove=page.locator('.featured-roster-actions button.danger');
  while(await remove.count())await remove.first().click();
  for(let count=1;count<=3;count++){
    await page.getByLabel('Add Transport Provider').selectOption({index:1});
    await page.getByRole('button',{name:'Add',exact:true}).click();
    await expect(page.locator('.featured-roster-list>li')).toHaveCount(count);
  }
  await page.getByLabel('Featured accounts').selectOption('3');
  await page.getByLabel('Sponsor mentions').selectOption('2');
  await expect(page.locator('.featured-schedule-timeline .programme-break').first()).toBeVisible();
  await page.getByLabel('Headline').fill(headline);
  await page.getByLabel('Short introduction').fill('Meet today’s featured Transport Providers and the vehicles they publish.');
  expect(checked(await service.from('featured_provider_days').select('id').eq('feature_date',featureDate))).toHaveLength(0);
  await page.getByRole('button',{name:'Publish this day'}).click();
  await expect(page.getByText('Daily feature published.')).toBeVisible();
  await expect(page.locator('.featured-admin-status').getByText('Published',{exact:true})).toBeVisible();
  }finally{
    // Manual publication creates no rotation history. Remove only this test's
    // uniquely titled row and its audit events; slots cascade with the day.
    const owned=checked(await service.from('featured_provider_days').select('id').eq('feature_date',featureDate).eq('public_headline',headline));
    for(const row of owned){
      checked(await service.from('audit_logs').delete().eq('entity_id',row.id));
      checked(await service.from('featured_provider_days').delete().eq('id',row.id).eq('public_headline',headline));
    }
  }
});

test('capacity Market keeps truck markers and bounded map batches alongside search results',async({page}:{page:any})=>{
  await page.goto('/capacity');
  const commandColumn=await openCapacityFilters(page);
  await expect(commandColumn.getByRole('searchbox',{name:'Search transporters'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Vehicle filters',exact:true})).toBeVisible();
  await expect(commandColumn.getByRole('button',{name:/location/i})).toBeVisible();
  await expect(page.locator('.public-capacity-map')).toBeVisible();
  await expect(page.locator('.public-capacity-grid')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Map',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'List',exact:true})).toHaveCount(0);
  await expect(page.getByRole('navigation',{name:'Truck list pagination'})).toHaveCount(0);
  await expect(commandColumn.getByRole('searchbox',{name:'Search transporters'})).toBeVisible();
  const filters=await openCapacityFilterDialog(page);
  const configurations=filters.getByRole('group',{name:'Vehicle type',exact:true});await configurations.locator('summary').click();
  await expect(configurations.getByRole('checkbox',{name:'Courier motorcycle',exact:true})).toHaveCount(1);
  await expect(configurations.getByRole('checkbox',{name:'Courier car',exact:true})).toHaveCount(1);
  await expect(configurations.getByRole('checkbox',{name:'Mini Open Body Truck',exact:true})).toHaveCount(1);
  await expect(configurations.getByRole('checkbox',{name:'Heavy Rigid Stake Body Truck + Trailer',exact:true})).toHaveCount(1);
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
  await page.locator('.map-info-bubble.truck').click();
  await expect(page.locator('.map-capacity-sheet')).toContainText('Trailer');
});

test('map clusters dense capacity and keeps truck and overlapping signal dialogs within the viewport',async({page}:{page:any},info:any)=>{
  test.setTimeout(90000);
  await page.goto('/capacity');
  await expect(page.locator('.public-capacity-map')).toBeVisible({timeout:20000});
  await expect(page.locator('.capacity-map-cluster,.capacity-truck-map-marker').first()).toBeVisible({timeout:20000});
  await expect(page.getByText('Loading vehicles in this map area…',{exact:true})).toHaveCount(0,{timeout:30000});
  await expect(page.getByRole('button',{name:/Show area summaries|More trucks in this area|^Show trucks$/})).toHaveCount(0);
  await expect.poll(()=>page.locator('.leaflet-tile:visible').evaluateAll((tiles:any[])=>tiles.length>0&&tiles.every(tile=>tile.complete&&tile.naturalWidth>0)),{timeout:20000}).toBe(true);
  const captures=path.resolve('artifacts/capacity-viewport-2026-09-14');mkdirSync(captures,{recursive:true});
  await page.screenshot({path:path.join(captures,`${info.project.name}-map.png`),scale:'css'});
  const initialMapCanvasBox=await page.locator('.public-map-canvas').boundingBox();
  expect(initialMapCanvasBox).toBeTruthy();
  await expect(page.locator('.capacity-map-cluster,.capacity-truck-map-marker').first()).toBeVisible({timeout:30_000});
  const initialClusters=page.locator('.capacity-map-cluster:visible');
  if(await initialClusters.count()){
    const clusterStatuses=await initialClusters.evaluateAll((clusters:any[])=>clusters.map(cluster=>({empty:cluster.classList.contains('empty'),partial:cluster.classList.contains('partial'),label:cluster.textContent?.trim()})));
    expect(clusterStatuses.every((cluster:{empty:boolean;partial:boolean;label?:string})=>cluster.empty!==cluster.partial)).toBe(true);
    expect(clusterStatuses.every((cluster:{empty:boolean;partial:boolean;label?:string})=>/Empty|Partial/.test(cluster.label||''))).toBe(true);
    expect(clusterStatuses.every((cluster:{label?:string})=>Number.parseInt(cluster.label||'0',10)<=8)).toBe(true);
  }
  // Assert settled labels after automatic viewport loading.
  await expect(page.locator('.leaflet-zoom-anim')).toHaveCount(0);
  await expect(page.getByText('Loading vehicles in this map area…',{exact:true})).toHaveCount(0,{timeout:20000});
  await expect.poll(async()=>{
    const labels=await page.locator('.capacity-map-cluster small:visible').evaluateAll((elements:any[])=>elements.map(label=>{const box=label.getBoundingClientRect();const marker=label.closest('.capacity-map-cluster');return{status:marker?.classList.contains('partial')?'PARTIAL':'EMPTY',left:box.left,right:box.right,top:box.top,bottom:box.bottom};}));
    return labels.every((label:any,index:number)=>labels.slice(index+1).every((other:any)=>label.status===other.status||label.right<=other.left||other.right<=label.left||label.bottom<=other.top||other.bottom<=label.top));
  },{timeout:10000}).toBe(true);
  await expect(page.locator('.ethiopia-map-label')).toHaveCount(0);
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
  await expect(page.locator('.public-map-legend .empty-status')).toHaveText('Empty');
  await expect(page.locator('.public-map-legend .partial-status')).toHaveText('Partial');
  await expect(page.locator('.public-map-legend .radius')).toHaveText('Planned area');
  await expect(page.locator('.public-map-legend .empty-route')).toHaveText('Planned route');
  await expect(page.locator('.public-map-legend')).toBeVisible();
  const legendColors=await page.locator('.public-map-legend').evaluate((legend:any)=>Object.fromEntries(['empty-status','partial-status','privacy','radius','empty-route','corridor'].map(className=>{const style=getComputedStyle(legend.querySelector(`.${className}`),'::before');return [className,{background:style.backgroundColor,border:style.borderColor,borderTop:style.borderTopColor}];})));
  expect(legendColors['empty-status'].background).toBe('rgb(21, 94, 239)');
  expect(legendColors['partial-status'].background).toBe('rgb(102, 112, 133)');
  expect(legendColors.privacy.border).toContain('rgb(120, 70, 167)');
  expect(legendColors.radius.border).toContain('rgb(215, 223, 235)');
  expect(legendColors['empty-route'].borderTop).toBe('rgb(21, 94, 239)');
  expect(legendColors.corridor.borderTop).toBe('rgb(192, 102, 32)');
  const partialTruck=await findCapacitySignal(page,{status:'PARTIAL'},(item:any)=>item.current_signal_geometry_visible!==false&&item.current_route_points?.length>=2);
  expect(partialTruck).toBeTruthy();
  await page.goto(`/?status=PARTIAL&truck=${encodeURIComponent(partialTruck.id)}`);
  await page.locator('.map-info-bubble.truck').click();
  await expect(page.locator('.map-capacity-sheet')).toBeVisible();
  await expect(page.locator('.public-capacity-map .leaflet-container')).toBeVisible();
  const selectedMapCanvas=page.locator('.public-map-canvas');
  const selectedSheet=page.locator('.map-capacity-sheet');
  const selectedLayout=await page.locator('.public-map-shell').evaluate((shell:any)=>{const map=shell.querySelector('.public-map-canvas').getBoundingClientRect();const leaflet=shell.querySelector('.leaflet-container').getBoundingClientRect();const dialog=document.querySelector('.capacity-info-card')!.getBoundingClientRect();const outer=shell.getBoundingClientRect();return {map:{left:map.left,right:map.right,top:map.top,bottom:map.bottom,width:map.width},leaflet:{width:leaflet.width,height:leaflet.height},dialog:{left:dialog.left,right:dialog.right,top:dialog.top,bottom:dialog.bottom,width:dialog.width},viewport:{width:innerWidth,height:innerHeight},outer:{left:outer.left,right:outer.right,width:outer.width}};});
  expect(Math.abs(selectedLayout.leaflet.width-selectedLayout.map.width)).toBeLessThanOrEqual(2);
  expect(selectedLayout.dialog.left).toBeGreaterThanOrEqual(15);
  expect(selectedLayout.dialog.right).toBeLessThanOrEqual(selectedLayout.viewport.width-15);
  expect(selectedLayout.dialog.top).toBeGreaterThanOrEqual(15);
  expect(selectedLayout.dialog.bottom).toBeLessThanOrEqual(selectedLayout.viewport.height-15);
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
  expect(markerShape.ring).toBe('rgb(21, 94, 239)');
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
  const publicCall=page.locator('.map-capacity-sheet').getByRole('link',{name:/^Call(?: driver)?$/});
  await expect(publicCall).toBeVisible();
  const publishedPhone=partialTruck.assigned_driver_phone||partialTruck.contact_phone;
  expect(publishedPhone,'The selected public record must publish the displayed contact').toBeTruthy();
  await expect(publicCall).toHaveAttribute('href',`tel:${publishedPhone}`);
  const sheetMetrics=await page.locator('.capacity-info-content').evaluate((element:any)=>({clientHeight:element.clientHeight,scrollHeight:element.scrollHeight,height:element.getBoundingClientRect().height,viewport:window.innerHeight,overflow:getComputedStyle(element).overflowY}));
  expect(sheetMetrics.overflow).toBe('auto');
  // The drawer scrolls independently; it must not forward wheel input to the map.
  const summaryZoom=()=>page.locator('.leaflet-proxy').evaluate((element:HTMLElement)=>Number(element.style.transform.match(/scale\(([\d.]+)\)/)?.[1]));
  const initialZoom=await summaryZoom();expect(initialZoom).toBeGreaterThan(0);
  const identityBounds=await page.locator('.truck-inspection-identity h3').boundingBox();
  await page.mouse.move(identityBounds.x+identityBounds.width/2,identityBounds.y+identityBounds.height/2);
  await page.mouse.wheel(0,120);await page.waitForTimeout(500);
  expect(await summaryZoom()).toBe(initialZoom);
  const truckSummaryTargets=await page.locator('.map-capacity-sheet').locator('button,a').evaluateAll((elements:any[])=>elements.map(element=>{const box=element.getBoundingClientRect();return {width:box.width,height:box.height};}));
  for(const target of truckSummaryTargets){expect(target.width).toBeGreaterThanOrEqual(44);expect(target.height).toBeGreaterThanOrEqual(44);}
  await expect(page.locator('.map-location-privacy-circle')).toBeVisible();
  const partialAvailabilitySignal=page.locator('.map-interactive-signal.capacity-partial');
  await expect(partialAvailabilitySignal).toBeVisible();
  await expect(partialAvailabilitySignal).toHaveAttribute('stroke','#667085');
  const interactiveSignal=page.locator('.map-interactive-signal').first();
  await expect(interactiveSignal).toBeVisible();
  await page.getByRole('button',{name:'Close map signal details'}).click();
  await interactiveSignal.focus();await page.keyboard.press('Enter');
  const signalInspector=page.locator('.capacity-info-card');
  await expect(signalInspector).toBeVisible();
  await expect(signalInspector.locator('article')).toHaveCount(1);
  const inspectorStyle=await signalInspector.evaluate((element:any)=>({background:getComputedStyle(element).backgroundColor,borderWidth:getComputedStyle(element).borderWidth,borderColor:getComputedStyle(element).borderColor,color:getComputedStyle(element).color}));
  expect(inspectorStyle.background).toContain('255, 255, 255');
  expect(inspectorStyle.borderWidth).toBe('2px');
  expect(inspectorStyle.borderColor).not.toBe('rgb(0, 0, 0)');
  expect(inspectorStyle.color).toBe('rgb(11, 29, 58)');
  const inspectorBox=await signalInspector.boundingBox();
  const publicMapBox=await page.locator('.public-capacity-map').boundingBox();
  expect(inspectorBox&&publicMapBox).toBeTruthy();
  const signalInspectorBounds={inspectorLeft:inspectorBox!.x,inspectorRight:inspectorBox!.x+inspectorBox!.width,inspectorTop:inspectorBox!.y,inspectorBottom:inspectorBox!.y+inspectorBox!.height,mapLeft:publicMapBox!.x,mapRight:publicMapBox!.x+publicMapBox!.width,mapTop:publicMapBox!.y,mapBottom:publicMapBox!.y+publicMapBox!.height};
  expect(signalInspectorBounds.inspectorLeft).toBeGreaterThanOrEqual(15);
  expect(signalInspectorBounds.inspectorRight).toBeLessThanOrEqual(page.viewportSize()!.width-15);
  expect(signalInspectorBounds.inspectorTop).toBeGreaterThanOrEqual(15);
  expect(signalInspectorBounds.inspectorBottom).toBeLessThanOrEqual(page.viewportSize()!.height-15);
  await interactiveSignal.dispatchEvent('click');
  await expect(signalInspector).toBeVisible();
  await expect(signalInspector.locator('article')).toHaveCount(1);
  const signalCloseBox=await signalInspector.getByRole('button',{name:'Close map signal details'}).boundingBox();
  expect(signalCloseBox?.width).toBeGreaterThanOrEqual(44);
  expect(signalCloseBox?.height).toBeGreaterThanOrEqual(44);
  const signalBorderColors=await signalInspector.locator('article').evaluateAll((articles:any[])=>articles.map(article=>getComputedStyle(article).borderLeftColor));
  expect(new Set(signalBorderColors).size).toBe(1);
  await signalInspector.getByRole('button',{name:'Close map signal details'}).click();
  await expect(signalInspector).toBeHidden();
  await page.locator('.map-info-bubble.truck').click();
  await expect(page.locator('.map-capacity-sheet')).toBeVisible();
  await expect(page.locator('.public-map-legend .radius')).toHaveText('Planned area');
  await expect(page.locator('.public-map-legend .empty-route')).toHaveText('Planned route');
  await expect(page.locator('.public-map-legend .corridor')).toHaveText(['Preferred area','Preferred corridor']);
  await expect(page.locator('.public-map-legend')).not.toContainText('Next trip');
  await page.screenshot({path:path.join(captures,`${info.project.name}-selected-truck.png`),scale:'css'});
  const closeCard=page.getByRole('button',{name:'Close map signal details'});
  await expect(closeCard).toBeVisible();
  await closeCard.click();
  await expect(page.locator('.map-capacity-sheet')).toHaveCount(0);
  await expect.poll(async()=>Math.round((await page.locator('.public-map-canvas').boundingBox())?.width||0)).toBe(Math.round(initialMapCanvasBox!.width));
  await expect.poll(async()=>page.locator('.public-map-canvas,.leaflet-container').evaluateAll((elements:any[])=>{const [map,leaflet]=elements.map(element=>element.getBoundingClientRect().width);return Math.abs(map-leaflet);})).toBeLessThanOrEqual(2);
  await expect(page.locator('.capacity-overview-cell,.capacity-map-cluster,.capacity-truck-map-marker').first()).toBeVisible();

  const emptyTruck=await findCapacitySignal(page,{status:'EMPTY'},(item:any)=>item.current_signal_geometry_visible!==false&&(item.current_route_points?.length>=2||item.capacity_area_boundary?.length>=3));
  expect(emptyTruck).toBeTruthy();
  await page.goto(`/capacity?truck=${encodeURIComponent(emptyTruck.id)}`);
  const emptyAvailabilitySignal=page.locator('.map-interactive-signal.capacity-empty');
  await expect(emptyAvailabilitySignal).toBeVisible({timeout:30_000});
  await expect(emptyAvailabilitySignal).toHaveAttribute('stroke','#155eef');
  await expect(page.locator('.capacity-truck-map-marker.selected')).toHaveClass(/\bempty\b/);
  await expect(page.locator('.capacity-truck-map-marker.selected strong')).toHaveCount(0);
  await expect(page.locator('.capacity-truck-map-marker.selected')).toHaveAttribute('title',/Empty vehicle/);
  await expect(page.locator('.capacity-truck-map-marker.selected .vehicle-marker-image')).toHaveCSS('background-color','rgb(21, 94, 239)');
});

test('visitor location is requested explicitly, centers the map, and may be refreshed',async({page,context}:{page:any;context:any})=>{
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:9.03,longitude:38.74});
  await page.goto('/');await openCapacityFilters(page);
  await expect(page.getByTestId('visitor-location-state')).toHaveCount(0);
  await page.getByRole('button',{name:'Use my location',exact:true}).click();
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
  await openCapacityFilters(page);
  const filterDialog=await openCapacityFilterDialog(page);
  await filterDialog.locator('[data-filter-section="location"] > summary').click();
  const nearby=page.getByLabel('Show vehicles near my area');
  await expect(nearby).toBeEnabled();
  await nearby.check();
  await page.locator('#capacity-near-radius').selectOption('50');
  await page.getByRole('button',{name:'Show vehicles'}).click();
  await expect(page).toHaveURL(/nearLat=.*nearLng=.*nearRadiusKm=50/);
  await expect(page.getByTestId('visitor-location-state')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'List',exact:true})).toHaveCount(0);
  await expect(page.locator('.capacity-map-cluster,.capacity-truck-map-marker').first()).toBeVisible({timeout:30_000});
});

test('denied visitor location keeps the map usable and exposes a real retry',async({page}:{page:any})=>{
  await page.addInitScript(()=>{
    (window as any).__locationRequestCount=0;
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
      getCurrentPosition:(_success:any,failure:any)=>{(window as any).__locationRequestCount+=1;failure({code:1,PERMISSION_DENIED:1,TIMEOUT:3,POSITION_UNAVAILABLE:2});}
    }});
  });
  await page.goto('/');await openCapacityFilters(page);
  await expect(page.getByTestId('visitor-location-state')).toHaveCount(0);
  await page.getByRole('button',{name:'Use my location',exact:true}).click();
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
  await page.goto(`/@${blueLineTrucks[0].provider_handle}`,{waitUntil:'domcontentloaded'});
  await expect(page.locator('.provider-handle')).toHaveText('Transport Provider');
  await expect(page.locator('.provider-site-identity > p').first()).toHaveText(`@${blueLineTrucks[0].provider_handle}`);
  await expect(page.getByRole('heading',{name:'Account documents'})).toBeVisible();
  const fleetToggle=page.locator('.provider-fleet-disclosure>summary');
  if(await fleetToggle.count())await expect(page.locator('.provider-fleet-disclosure')).toHaveAttribute('open','');
  await expect(page.getByRole('heading',{name:'Vehicles and published capacity'})).toBeVisible();
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
  await expect(page.locator('.provider-trust-card .verification-badge').first()).toBeVisible();
  await expect(page.locator('.provider-microsite')).not.toContainText('null → null');
  await expect(page.locator('.provider-site-hero')).not.toHaveAttribute('style',/provider-primary/);
});

test('transporter map action keeps its trucks visible after visitor location refresh',async({page,context}:{page:any;context:any})=>{
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:14.0,longitude:40.0});
  await page.goto('/?q=BlueLine%20Transport%20PLC&provider=blueline-transport#capacity-market');
  await expect(page).toHaveURL(/provider=blueline-transport#capacity-market$/);
  await openCapacityFilters(page);await page.getByRole('button',{name:'Use my location',exact:true}).click();
  await expect(page.getByTestId('visitor-location-state')).toContainText('Location updated');
  const response=await page.request.get('/api/public/capacity?q=BlueLine%20Transport%20PLC&provider=blueline-transport');
  expect(response.ok()).toBeTruthy();
  const trucks=(await response.json()).items;
  expect(trucks.length).toBeGreaterThan(0);
  expect(trucks.every((item:any)=>item.provider_handle==='blueline-transport')).toBe(true);
  await expect(page.locator('.capacity-map-cluster,.capacity-truck-map-marker').first()).toBeVisible({timeout:30_000});
});

test('provider edits business facts without designing the Loadgistic microsite',async({page}:{page:any},info:any)=>{
  test.setTimeout(90_000);
  const service=localAuditService(),actor=await auditFleetProvider(service,'smoke-profile'),accountName=`Synthetic smoke provider ${actor.suffix}`;
  writeFileSync(info.outputPath('profile-owned-fixture.json'),JSON.stringify({userId:actor.id,organizationId:actor.organization_id})+'\n',{mode:0o600});
  try{
  await localSupportLogin(page,actor.id);
  await page.goto('/app/company-page',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('button',{name:'Save transporter information'})).toHaveCount(0);
  await page.getByRole('button',{name:'Edit profile',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'Transporter profile',exact:true});
  await expect(page.getByText('Describe your transport business clearly so customers can assess your services.')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Page colors'})).toHaveCount(0);
  await expect(page.getByLabel('YouTube video ID')).toHaveCount(0);
  await editor.getByLabel('Account name',{exact:true}).fill(accountName);
  await editor.getByLabel('About the business',{exact:true}).fill('Regional freight with owner-led dispatch.');
  await editor.getByLabel('Region or city administration',{exact:true}).selectOption('ADDIS_ABABA');
  await choosePlace(editor,'Base city or town','Addis',/Addis Ababa, Ethiopia/i);
  await editor.getByText('Publish transporter profile',{exact:true}).click();
  await expect(editor.getByRole('checkbox',{name:/^Publish transporter profile/})).toBeChecked();
  const saved=page.waitForResponse((response:any)=>new URL(response.url()).pathname==='/api/company-page'&&response.request().method()==='POST');
  await editor.getByRole('button',{name:'Save transporter information'}).click();expect((await saved).status()).toBe(303);
  await expect(editor).toHaveCount(0);
  expect(checked(await service.from('company_pages').select('about,published').eq('organization_id',actor.organization_id).single())).toMatchObject({about:'Regional freight with owner-led dispatch.',published:true});
  await page.getByRole('button',{name:'Change photo',exact:true}).click();
  const imageEditor=page.getByRole('dialog',{name:'Transporter image',exact:true});
  await imageEditor.getByLabel('Choose image').setInputFiles({name:'provider.png',mimeType:'image/png',buffer:readFileSync('public/icon-192.png')});
  const imageSaved=page.waitForResponse((response:any)=>new URL(response.url()).pathname==='/api/company-page/image'&&response.request().method()==='POST');
  await imageEditor.getByRole('button',{name:/^(Upload|Replace) image$/}).click();const imageResponse=await imageSaved;expect(imageResponse.status()).toBe(303);
  const imageDestination=new URL(imageResponse.headers().location,page.url());expect(imageDestination.searchParams.get('success')).toBe('Provider image updated.');
  await page.waitForURL(imageDestination.href,{waitUntil:'domcontentloaded'});
  await expect(page.getByText('Provider image updated.')).toBeVisible();
  const publicImageLoaded=page.waitForResponse((response:any)=>new URL(response.url()).pathname===`/api/public/providers/smoke-profile-${actor.suffix}/image`&&response.request().method()==='GET');
  await Promise.all([page.waitForURL(new RegExp(`/@smoke-profile-${actor.suffix}$`),{waitUntil:'domcontentloaded'}),page.getByRole('link',{name:'Open public page'}).click()]);
  await expect(page.getByRole('heading',{name:accountName,exact:true,level:1})).toBeVisible();
  const publicImage=await publicImageLoaded;expect(publicImage.status()).toBe(200);await publicImage.finished();
  const photo=page.getByRole('img',{name:`${accountName} transporter profile`,exact:true});await expect(photo).toBeVisible();
  await expect.poll(()=>photo.evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBe(true);
  await expect(page.getByText(actor.email,{exact:true})).toHaveCount(0);
  }finally{
    test.setTimeout(info.timeout+30_000);
    const image=checked(await service.from('company_pages').select('profile_image_path').eq('organization_id',actor.organization_id).single());
    if(image.profile_image_path)await removeProviderProfileImage(actor);
    checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));
    checked(await service.auth.admin.deleteUser(actor.id));checked(await service.from('organizations').delete().eq('id',actor.organization_id));
  }
});

test('fleet Driver access shows only current capacity and Tracking permissions',async({page}:{page:any})=>{
  await login(page,'transporter@loadgistic.local','/app/fleet?view=drivers');
  await page.getByRole('link',{name:'Manage',exact:true}).first().click();await page.getByRole('button',{name:'Edit assignment',exact:true}).click();
  await expect(page.getByLabel('Capacity updates').first()).toBeVisible();
  await expect(page.getByLabel('Tracking updates').first()).toBeVisible();
  for(const retired of ['Shipment Board','Call Businesses','Agree + assign shipments']){
    await expect(page.getByText(retired,{exact:true})).toHaveCount(0);
  }
});

test('administrator Operations shows provider-owned Tracking and no retired Network view',async({page}:{page:any})=>{
  await login(page,'admin@loadgistic.local');
  if((page.viewportSize()?.width||0)<=700){
    // Phone navigation enters records through the visible Overview cards;
    // desktop record tabs are intentionally hidden at this breakpoint.
    const overview=page.locator('.admin-overview-page'),tracking=overview.getByRole('link',{name:/^Tracking\b/});
    await expect(tracking).toHaveAttribute('href','/admin/operations?view=TRACKING');
    await expect(overview.getByRole('link',{name:/^Network\b/})).toHaveCount(0);
    await Promise.all([page.waitForURL(/\/admin\/operations\?view=TRACKING$/,{waitUntil:'domcontentloaded'}),tracking.click()]);
    await expect(page.getByRole('textbox',{name:'Search Tracking',exact:true})).toBeVisible();
  }else{
    await page.goto('/admin/operations?view=TRACKING');
    const inventory=page.getByRole('navigation',{name:'Platform record type',exact:true});
    await expect(inventory.getByRole('link',{name:'Tracking',exact:true})).toHaveAttribute('href','/admin/operations?view=TRACKING');await expect(inventory.getByRole('link',{name:'Tracking',exact:true})).toHaveClass(/active/);
    await expect(inventory.getByRole('link',{name:'Network',exact:true})).toHaveCount(0);
  }
  await expect(page.getByText('Tracking',{exact:true}).first()).toBeVisible();
  await expect(page.getByText(/customer owner email/i)).toHaveCount(0);
});

test('public Tracking submission shows progress and a visible invalid-code result',async({page}:{page:any})=>{
  await page.goto('/track');
  await page.getByLabel('Email',{exact:true}).fill('unknown.tracking@example.test');

  await page.getByRole('button',{name:'Email me a code'}).click();
  await page.getByLabel('6-digit email code').fill('000000');
  await page.getByRole('button',{name:'Open tracking'}).click();
  await expect(page.getByRole('alert').filter({hasText:/could not be verified/i})).toBeVisible();
  await expect(page.getByRole('button',{name:'Open tracking'})).toBeEnabled();
});

test('provider starts Tracking for one owner, who shares status with a viewer after verifying email',async({page}:{page:any},info:any)=>{
  test.setTimeout(180000);
  // Keep synthetic email workflows independent of other tests' client rate
  // buckets without disabling origin or recipient rate limits.
  await page.context().setExtraHTTPHeaders({'x-forwarded-for':info.project.name.startsWith('mobile')?'127.0.0.249':'127.0.0.248'});
  const service=localAuditService();let provider:any,vehicleId='',shipmentId='',ownerEmail='',trackingPartyEmail='';
  let primaryFailure:unknown;
  try{
  await test.step('tracking: prepare synthetic provider and vehicle',async()=>{
  provider=await auditProvider(service,'smoke-owner-share');
  vehicleId=(await createProviderVehicle(provider,{useBasis:'OWNED',make:'Toyota',model:'Tracking smoke',plate:`TEST-${provider.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false})).id;
  expect(checked(await service.rpc('set_provider_driving_mode',{actor_user_id:provider.id,requested_drives_truck:true}))).toBe(true);
  await updateFleetDriverAccess(provider,provider.id,{vehicleId,canManageCapacity:true,canManageTracking:true});
  });
  // Exercise ordinary email login, including when fixture-password disclosure
  // is disabled in the local preview.
  await test.step('tracking: provider email sign-in',async()=>{
  const email=provider.email;
  await page.goto('/login',{waitUntil:'domcontentloaded'});
  const access=page.getByTestId('email-code-request-form');await access.getByLabel('Email',{exact:true}).fill(email);
  const loginRequested=Date.now();await access.getByRole('button',{name:'Email me a code'}).click();
  await expect(page.getByTestId('email-code-form')).toBeVisible({timeout:30000});
  await page.getByLabel('Six-digit code',{exact:true}).fill(await localMailpitNumericCode(email,loginRequested,['Your Loadgistic signup code','Your Loadgistic sign-in code']));
  await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page).toHaveURL(/\/app\/home/,{timeout:30000});await expect(page.locator('.app-main')).toBeVisible();
  });
  await test.step('tracking: create shipment and open provider detail',async()=>{
  await page.goto('/app/provider-shipments/new');
  await page.getByRole('combobox',{name:'Vehicle',exact:true}).selectOption(vehicleId);
  await page.getByLabel('Cargo summary').fill('Workshop machine parts');
  await choosePlace(page,'Origin','Addis',/Addis Ababa, Ethiopia/i);
  await choosePlace(page,'Passing through city','Dire',/Dire Dawa, Ethiopia/i);
  await expect(page.locator('input[name="passingPlaceRef"]')).toHaveValue(/\S+/);
  await choosePlace(page,'Destination','Adama',/Adama, Ethiopia/i);
  ownerEmail=`owner-${provider.suffix}@example.test`;
  trackingPartyEmail=`dispatch-${provider.suffix}@example.test`;
  await chooseDate(page,'Expected delivery',new Date(Date.now()+2*86400000).toISOString().slice(0,10));
  await page.getByLabel('Shipment owner email').fill(ownerEmail);
  await expect(page.getByLabel('Additional tracking emails')).toHaveCount(0);
  const createResponse=page.waitForResponse((response:any)=>response.url().endsWith('/api/provider-shipments')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Start Tracking'}).click();
  const created=await createResponse;expect(created.status()).toBe(201);
  shipmentId=(await created.json()).id;
  await expect(page.getByText('Tracking started')).toBeVisible({timeout:10_000});
  await expect(page.getByRole('button',{name:'Copy link',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Copy code',exact:true})).toHaveCount(0);
  const openTracking=page.getByRole('link',{name:'Open Tracking'});
  const trackingHref=await openTracking.getAttribute('href');
  expect(trackingHref).toMatch(/^\/app\/provider-shipments\/[0-9a-f-]{36}$/);
  await Promise.all([
    page.waitForURL(/\/app\/provider-shipments\/[0-9a-f-]{36}$/,{timeout:15_000}),
    openTracking.click()
  ]);
  await expect(page.getByRole('heading',{name:/Tracking · LGX-/})).toBeVisible({timeout:10_000});
  await expect(page.getByText(ownerEmail,{exact:true})).toBeVisible();
  expect(checked(await service.from('provider_tracking_recipients').select('recipient_role').eq('shipment_id',shipmentId))).toEqual([{recipient_role:'OWNER'}]);
  });
  await test.step('tracking: provider status and proof',async()=>{
  await auditOpenTrackingProgress(page);await expect(page.locator('.tracking-journey li')).toHaveCount(2);
  await expect(page.getByLabel('Report a problem')).toBeEnabled();
  await expect(page.locator('.tracking-journey strong')).toHaveText(['Going to pickup','Loading']);
  await page.locator('input[name="nextStatus"][value="LOADING"]').check();
  await expect(page.getByLabel('Photo proof required')).toBeVisible();await page.locator('input[name=proof]').setInputFiles('public/icon-192.png');
  await page.getByRole('button',{name:'Save Loading'}).click();
  await expect(page.getByText('Tracking status updated.')).toBeVisible({timeout:30_000});
  await auditOpenTrackingProgress(page);await page.getByLabel('En route').check();
  await expect(page.getByLabel('Photo proof required')).toHaveCount(0);
  await expect(page.getByText('The shipment owner manages who can follow this shipment.')).toBeVisible();
  });
  await test.step('tracking: owner email access and viewer invitation',async()=>{
  await page.goto('/track');
  await page.getByLabel('Email',{exact:true}).fill(ownerEmail);

  const requestedAt=Date.now();
  const ownerCodeResponse=page.waitForResponse((response:any)=>new URL(response.url()).pathname==='/api/tracking/otp'&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Email me a code'}).click();
  expect((await ownerCodeResponse).status()).toBe(200);
  await expect(page.getByLabel('6-digit email code')).toBeVisible();
  await page.getByLabel('6-digit email code').fill(await localMailpitNumericCode(ownerEmail,requestedAt,'Your Loadgistic tracking sign-in code'));
  await Promise.all([
    page.waitForURL(/\/track\/[0-9a-f-]{36}$/,{timeout:15_000}),
    page.getByRole('button',{name:'Open tracking'}).click()
  ]);
  await expect(page.getByText('Private shipment tracking')).toBeVisible();
  await expect(page.getByRole('heading',{name:/Track LGX-/})).toBeVisible();
  await page.getByRole('button',{name:'Share tracking'}).click();
  const sharing=page.getByRole('dialog',{name:'Share tracking'});await expect(sharing).toBeVisible();
  await sharing.getByLabel('Viewer name').fill('Dispatch desk');
  await sharing.getByLabel('Viewer email').fill(trackingPartyEmail);
  const invitationAt=Date.now();
  const invitation=page.waitForResponse((response:any)=>response.url().endsWith(`/api/tracking/${shipmentId}/sharing`)&&response.request().method()==='POST');
  await sharing.getByRole('button',{name:'Send invitation'}).click();
  expect((await invitation).status()).toBe(200);
  await expect(sharing.getByRole('status')).toContainText('Invitation sent');
  await expect(sharing.getByText('Dispatch desk')).toBeVisible();
  const viewers=checked(await service.from('provider_tracking_recipients').select('recipient_role,shared_by_recipient_id').eq('shipment_id',shipmentId));
  expect(viewers).toHaveLength(2);expect(viewers.find((row:any)=>row.recipient_role==='TRACKING_PARTY')?.shared_by_recipient_id).toBeTruthy();
  await expect.poll(async()=>{
    const inbox=await (await fetch('http://127.0.0.1:55324/api/v1/messages')).json();
    return (inbox.messages||[]).some((item:any)=>item.Subject==='Your Loadgistic tracking access'&&Date.parse(item.Created)>=invitationAt-2000&&item.To?.some((to:any)=>to.Address===trackingPartyEmail));
  },{timeout:15000}).toBe(true);
  await sharing.getByRole('button',{name:'Close editor'}).click();
  });
  await test.step('tracking: viewer email access and restricted detail',async()=>{
  await page.getByRole('button',{name:'Log out',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Follow your shipment'})).toBeVisible();
  await page.getByLabel('Email',{exact:true}).fill(trackingPartyEmail);

  const partyRequestedAt=Date.now();
  const partyCodeResponse=page.waitForResponse((response:any)=>new URL(response.url()).pathname==='/api/tracking/otp'&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Email me a code'}).click();
  expect((await partyCodeResponse).status()).toBe(200);
  await expect(page.getByLabel('6-digit email code')).toBeVisible();
  await page.getByLabel('6-digit email code').fill(await localMailpitNumericCode(trackingPartyEmail,partyRequestedAt,'Your Loadgistic tracking sign-in code'));
  await Promise.all([
    page.waitForURL(/\/track\/[0-9a-f-]{36}$/,{timeout:15_000}),
    page.getByRole('button',{name:'Open tracking'}).click()
  ]);
  await expect(page.getByText('Private shipment tracking')).toBeVisible();
  await expect(page.locator('[data-route-stop]')).toHaveCount(3);
  await expect(page.getByRole('button',{name:'Open proof'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Share tracking'})).toHaveCount(0);
  expect(checked(await service.from('profiles').select('id').eq('email',trackingPartyEmail))).toHaveLength(0);
  });
  }catch(error){primaryFailure=error;throw error;
  }finally{
    try{
    await test.step('tracking: clean up synthetic records',async()=>{
    if(shipmentId){
      const proofs=checked(await service.from('provider_shipment_events').select('proof_storage_path').eq('shipment_id',shipmentId).not('proof_storage_path','is',null));
      for(const proof of proofs){
        const reference=String(proof.proof_storage_path||'');
        if(!/^supabase:\/\/shipment-proof\/tracking-proof\/[0-9]{4}-[0-9]{2}-[0-9]{2}\/[a-f0-9-]{36}\.png$/.test(reference))throw Error('UNEXPECTED_SYNTHETIC_PROOF_SCOPE');
        await removePrivateUpload(reference);
      }
      checked(await service.from('access_email_deliveries').delete().eq('entity_id',shipmentId));
      checked(await service.from('audit_logs').delete().eq('entity_id',shipmentId));
      checked(await service.from('provider_shipments').delete().eq('id',shipmentId));
    }
    if(vehicleId){checked(await service.from('audit_logs').delete().eq('entity_id',vehicleId));checked(await auditDeleteVehicles(service,'id',vehicleId));}
    if(provider){checked(await service.from('audit_logs').delete().eq('actor_user_id',provider.id));checked(await service.auth.admin.deleteUser(provider.id));}
    });
    }catch(cleanupError){
      if(!primaryFailure)throw cleanupError;
      test.info().annotations.push({type:'synthetic-cleanup-failed',description:'Tracking fixture cleanup failed after the primary test error.'});
    }
  }
});

test('assigned Driver shares only an approximate location during travel',async({page,context}:{page:any;context:any})=>{
  test.setTimeout(120000);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:9.03,longitude:38.76});
  await login(page,'driver@loadgistic.local');
  await page.goto('/app/provider-shipments/new');
  const pair=await selectFixtureDrivingVehicle(page,'driver@loadgistic.local');
  await page.getByLabel('Cargo summary').fill('Workshop steel inputs');
  await choosePlace(page,'Origin','Addis',/Addis Ababa, Ethiopia/i);
  await choosePlace(page,'Passing through city','Dire',/Dire Dawa, Ethiopia/i);
  await choosePlace(page,'Destination','Adama',/Adama, Ethiopia/i);
  const ownerEmail=`location.owner.${Date.now()}@example.test`;
  await chooseDate(page,'Expected delivery',new Date(Date.now()+2*86400000).toISOString().slice(0,10));
  await page.getByLabel('Shipment owner email').fill(ownerEmail);
  await page.getByLabel('Status and approximate location').check();
  const started=page.waitForResponse((response:any)=>new URL(response.url()).pathname==='/api/provider-shipments'&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Start Tracking'}).click();
  const startResponse=await started;expect(startResponse.status()).toBe(201);
  const shipmentId=(await startResponse.json()).id;expect(shipmentId).toMatch(/^[0-9a-f-]{36}$/);
  try{
  await expect(page.getByText('Tracking started')).toBeVisible();
  await expect(page.getByRole('button',{name:'Copy link',exact:true})).toBeVisible();
  expect(new URL((await page.getByRole('link',{name:'Open Tracking',exact:true}).getAttribute('href'))!,page.url()).pathname.split('/').at(-1)).toBe(shipmentId);
  expect(checked(await pair.service.from('provider_shipments').select('assigned_vehicle_id,assigned_driver_user_id,tracking_mode').eq('id',shipmentId).single())).toEqual({assigned_vehicle_id:pair.vehicleId,assigned_driver_user_id:pair.actorId,tracking_mode:'LOCATION_AND_STATUS'});
  await Promise.all([
    page.waitForURL(new RegExp(`/app/provider-shipments/${shipmentId}$`),{waitUntil:'domcontentloaded'}),
    page.getByRole('link',{name:'Open Tracking'}).click()
  ]);
  await auditOpenTrackingProgress(page);await expect(page.getByLabel('Going to pickup')).toBeChecked();
  const statusUpdate=page.waitForResponse((response:any)=>response.url().includes('/status')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Save Going to pickup'}).click();
  expect((await statusUpdate).status()).toBe(303);
  await expect(page.getByText('Tracking status updated.')).toBeVisible({timeout:30_000});
  const location=checked(await pair.service.from('provider_shipment_events').select('location_lat,location_lng,location_precision_km').eq('shipment_id',shipmentId).eq('location_source','DEVICE_OBSCURED').order('created_at',{ascending:false}).limit(1).single());
  expect([1,3,5,10,20]).toContain(location.location_precision_km);expect(location.location_lat).not.toBe(9.03);expect(location.location_lng).not.toBe(38.76);
  await page.goto('/track');
  await page.getByLabel('Email',{exact:true}).fill(ownerEmail);

  const requestedAt=Date.now();
  await page.getByRole('button',{name:'Email me a code'}).click();
  await page.getByLabel('6-digit email code').fill(await localMailpitNumericCode(ownerEmail,requestedAt,'Your Loadgistic tracking sign-in code'));
  const unlock=page.waitForResponse((response:any)=>new URL(response.url()).pathname==='/api/tracking/unlock'&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Open tracking'}).click();
  expect((await unlock).status()).toBe(200);
  await page.waitForURL(new RegExp(`/track/${shipmentId}$`),{timeout:30000});
  const reportedArea=page.locator('.tracking-reported-area');await expect(reportedArea).toContainText('Reported approximate area',{timeout:30000});await expect(reportedArea).toHaveAttribute('data-location-radius-km',String(location.location_precision_km));
  await expect(page.locator('.tracking-location-map .leaflet-container')).toBeVisible();
  await expect(page.getByText('Vehicle circle shows an approximate location, not exact GPS.',{exact:true})).toBeVisible();
  await expect(page.locator('.timeline')).toContainText('Going to pickup');
  }finally{await removeSmokeShipment(pair.service,shipmentId);}
});

test('Driver Home stays focused on capacity and keeps Tracking in navigation',async({page,context}:{page:any;context:any})=>{
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:9.07,longitude:38.76});
  // Shipment creation has its own visible workflow above. This case starts
  // with an assigned shipment and exercises Home/Account/Tracking navigation.
  const pair=await fixtureDrivingVehicle('driver@loadgistic.local');
  const place=async(name:string)=>checked(await pair.service.from('place_catalog').select('id').eq('normalized_name',name).limit(1).single()).id;
  const created=await createProviderShipment(pair.actor,{vehicleId:pair.vehicleId,originPlaceRef:await place('addis ababa'),passingPlaceRef:await place('dire dawa'),destinationPlaceRef:await place('bishoftu'),cargoSummary:'Fabricated window frames',customerEmail:`home-${randomUUID()}@example.test`,expectedDeliveryDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),trackingMode:'STATUS_ONLY'});
  const shipmentId=created.id;
  try{
  expect(checked(await pair.service.from('provider_shipments').select('assigned_vehicle_id,assigned_driver_user_id,tracking_mode').eq('id',shipmentId).single())).toEqual({assigned_vehicle_id:pair.vehicleId,assigned_driver_user_id:pair.actorId,tracking_mode:'STATUS_ONLY'});
  const trackingCode=created.code;
  await login(page,'driver@loadgistic.local');
  await expect(page.getByRole('heading',{name:'Capacity management',exact:true})).toHaveCount(1);
  await expect(page.getByRole('heading',{name:'Capacity',exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Truck availability'})).toHaveCount(0);
  await expect(page.getByText('Verify before you commit.')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Tracking now'})).toHaveCount(0);
  await expect(page.locator('.driver-active-tracking')).toHaveCount(0);
  await expect(page.getByText(trackingCode)).toHaveCount(0);
  if((page.viewportSize()?.width||0)<=760){
    const mobileNav=page.getByRole('navigation',{name:'Mobile navigation'});
    await expect(mobileNav.getByRole('link')).toHaveCount(3);
    for(const label of ['Home','Network','Tracking'])await expect(mobileNav.getByRole('link',{name:label,exact:true})).toBeVisible();
    await expect(mobileNav.getByRole('link',{name:'Capacity',exact:true})).toHaveCount(0);
    await expect(mobileNav.getByRole('link',{name:'Fleet',exact:true})).toHaveCount(0);
    await mobileNav.getByRole('button',{name:'More',exact:true}).click();
    const more=page.getByRole('dialog',{name:'More navigation'});
    await expect(more.getByRole('link',{name:'Account',exact:true})).toBeVisible();
    await expect(more.getByRole('link',{name:'Support',exact:true})).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/app\/more$/,{waitUntil:'domcontentloaded'}),
      more.getByRole('link',{name:'Account',exact:true}).click()
    ]);
    await expect(page.getByRole('heading',{name:'Account',exact:true})).toBeVisible({timeout:30_000});
    await expect(page.getByRole('form',{name:'Account details'})).toHaveCount(0);
    await expect(page.getByRole('navigation',{name:'Account sections'}).getByRole('link',{name:'Transporter profile',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Edit details',exact:true}).click();
    const accountTask=page.getByRole('dialog',{name:'Account details',exact:true});await expect(accountTask.getByRole('form',{name:'Account details'})).toBeVisible();
    await accountTask.getByRole('button',{name:'Close editor',exact:true}).click();
    await expect(page.locator('.workspace-menu-grid')).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Log out'})).toBeVisible();
    await page.goto('/app/home',{waitUntil:'domcontentloaded'});
  }
  const primaryNavigation=(page.viewportSize()?.width||0)<=760
    ?page.getByRole('navigation',{name:'Mobile navigation'})
    :page.getByRole('navigation',{name:'Site navigation'});
  await Promise.all([
    page.waitForURL(/\/app\/provider-shipments$/,{waitUntil:'domcontentloaded'}),
    primaryNavigation.getByRole('link',{name:'Tracking',exact:true}).click()
  ]);
  await expect(page.getByText('Keep brokers and customers informed with private shipment updates.')).toBeVisible();
  }finally{await removeSmokeShipment(pair.service,shipmentId);}
});

test('capacity summary keeps the map visible and Driver refresh persists location',async({page,context}:{page:any;context:any})=>{
  test.setTimeout(120_000);
  const service=localAuditService(),actor=await auditProvider(service,'summary-location');let vehicleId='';
  try{
  vehicleId=(await createProviderVehicle(actor,{useBasis:'OWNED',make:'Summary editor',model:'Assigned truck',plate:`CSUM-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false})).id;
  await auditAssignAndPublishSelfDrivenVehicle(service,actor,vehicleId);
  const places=checked(await service.from('place_catalog').select('id,normalized_name').in('normalized_name',['addis ababa','adama']));
  const routePlaces=['addis ababa','adama'].map(name=>{const place=places.find((row:{normalized_name:string})=>row.normalized_name===name);expect(place).toBeTruthy();return {placeRef:place.id};});
  await publishProviderCapacity(actor,{vehicleId,status:'EMPTY',acceptedLoads:'BOTH',availabilityGeometry:'ROUTE',visibility:'PRIVATE',locationSource:'DEVICE_OBSCURED',approximateLat:9.03,approximateLng:38.76,locationPrecisionKm:20,currentRoutePlaces:routePlaces});
  const workspace=await getProviderCapacityWorkspace(actor),vehicle=workspace.vehicles[0];
  expect(workspace.vehicles).toHaveLength(1);expect(vehicle.assigned_driver.id).toBe(actor.id);
  const scope={vehicleId:vehicle.id,expectedDriverId:actor.id};
  await addProviderRegularCapacity(actor,{...scope,geometry:'ROUTE',routePlaces,areaCenterPlaceRef:'',areaBoundaryPlaces:[]});
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:9.07,longitude:38.76});
  const automaticLocationSave=page.waitForResponse((response:any)=>response.url().endsWith('/api/capacity/location')&&response.request().method()==='POST');
  await login(page,actor.email);
  expect((await automaticLocationSave).ok()).toBe(true);
  await expect(page.getByTestId('capacity-location-state')).toHaveCount(0);
  const summary=page.getByTestId('capacity-summary');
  await expect(summary).toBeVisible();
  await expect(summary.locator('.leaflet-container')).toBeVisible();
  await expect(summary.locator('.capacity-setting-truck-marker')).toBeVisible();
  await expect(summary.locator('.capacity-setting-truck-label')).toContainText('Vehicle area');
  await expect(summary.locator('.capacity-summary-map-header')).toBeVisible();
  await expect(summary.getByRole('navigation',{name:'Edit capacity signals'})).toBeVisible();
  await expect(summary.locator('.capacity-map-key')).toContainText('Preferred corridor');
  await expect(summary.getByRole('region',{name:'Approximate vehicle location controls'})).toBeVisible();
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
  const availabilityControl=page.getByRole('button',{name:/^Edit planned capacity:/});
  const availabilityText=await availabilityControl.getAttribute('aria-label');
  const emptyAvailability=Boolean(availabilityText?.includes('Empty'));
  const expectedCapacityColor=emptyAvailability?'#155eef':'#667085';
  await expect(summary.locator(`path[stroke="${expectedCapacityColor}"]`).first()).toBeVisible();
  await expect(summary.locator('.capacity-setting-truck-marker-halo')).toHaveAttribute('stroke',expectedCapacityColor);
  await expect(summary.locator('path[stroke="#7846a7"]').first()).toBeVisible();
  await expect(summary.locator('.capacity-map-key')).toContainText(emptyAvailability?'Empty vehicle marker':'Partial vehicle marker');
  await summary.locator('.capacity-radius-action').click();
  const privacyDialog=page.getByRole('dialog',{name:'Approximate location',exact:true});
  await privacyDialog.getByRole('button',{name:'Use my phone',exact:true}).click();
  const privacy=privacyDialog.getByLabel('Shared location accuracy');
  const currentPrivacy=await privacy.inputValue();
  const nextPrivacy=currentPrivacy==='5'?'10':'5';
  const privacySave=page.waitForResponse((response:any)=>response.url().endsWith('/api/capacity/location')&&response.request().method()==='POST');
  await privacy.selectOption(nextPrivacy);
  await privacyDialog.getByRole('button',{name:'Save location'}).click();
  expect((await privacySave).ok()).toBe(true);
  await expect(privacyDialog).toHaveCount(0);
  await expect(summary.locator('.capacity-radius-action')).toHaveText(`${nextPrivacy} km`);
  await expect(page.getByTestId('capacity-form')).toHaveCount(0);
  const save=page.waitForResponse((response:any)=>response.url().endsWith('/api/capacity/location')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Refresh vehicle location'}).click();
  const saved=await save;
  expect(saved.ok()).toBe(true);
  await expect(page.getByTestId('capacity-location-state')).toContainText('Approximate vehicle location saved');
  await expect(page.getByTestId('capacity-location-state')).toHaveCount(0,{timeout:6_000});
  await expect(page.getByTestId('capacity-form')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Availability'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Available by radius or corridor'})).toHaveCount(0);
  await expect(summary).toContainText('just now');
  await expect(summary).not.toContainText('Next trip');
  await expect(summary).toContainText('Preferred corridor');
  await expect(page.locator('.capacity-market-planning')).toHaveCount(0);
  await page.getByRole('button',{name:/^Edit preferred corridor:/}).click();
  const planningEditor=page.getByTestId('capacity-planning-editor');
  await expect(planningEditor).toBeVisible();
  await expect(planningEditor.getByRole('button',{name:/^Preferred corridor Both directions$/})).toHaveAttribute('aria-pressed','true');
  await expect(planningEditor.getByText('Route cities',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close editor'}).click();
  await page.getByRole('button',{name:/^Edit planned capacity:/}).click();
  await expect(page.getByRole('heading',{name:'Availability'})).toBeVisible();
  await expect(page.getByRole('group',{name:'Load type'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Where is this vehicle available?'})).toBeVisible();
  await page.getByRole('button',{name:'Partial',exact:true}).click();
  await expect(page.getByLabel(/Space available/i)).toHaveCount(0);
  await expect(page.locator('input[name="availablePercent"]')).toHaveCount(0);
  await expect(page.getByText(/Confirm the actual fit directly/i)).toBeVisible();
  await expect(page.getByRole('heading',{name:'Available by radius or corridor'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Approximate current location'})).toHaveCount(0);
  await page.goto('/app/capacity');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading',{name:'The visibility you need to serve your customers reliably',level:1})).toHaveCount(1);
  await expect(page.locator('.map-workspace-heading')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'List',exact:true})).toHaveCount(0);
  await expect(page.locator('.public-capacity-map')).toBeVisible();
  }finally{
    const routeIds=checked(await service.from('profile_routes').select('id').eq('provider_profile_id',actor.provider_profile_id));
    const capacityIds=vehicleId?checked(await service.from('capacities').select('id').eq('vehicle_id',vehicleId)):[];
    const ids=[vehicleId,...routeIds.map((row:{id:string})=>row.id),...capacityIds.map((row:{id:string})=>row.id)].filter(Boolean);
    if(ids.length)checked(await service.from('audit_logs').delete().in('entity_id',ids));
    checked(await service.from('profile_routes').delete().eq('provider_profile_id',actor.provider_profile_id));
    if(vehicleId){checked(await service.from('capacities').delete().eq('vehicle_id',vehicleId));checked(await auditDeleteVehicles(service,'id',vehicleId));}
    checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));
  }
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
