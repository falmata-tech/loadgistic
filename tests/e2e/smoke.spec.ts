import { test, expect } from '@playwright/test';

async function login(page:any,email:string){
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Loadgistic123!');
  await page.getByRole('button',{name:'Log in'}).click();
  await expect(page).toHaveURL(/\/app\/home/);
}

async function choosePlace(page:any,label:string,query:string,option:RegExp){
  const input=page.getByLabel(label);
  await input.fill(query);
  await expect(page.getByRole('option',{name:option}).first()).toBeVisible();
  await page.getByRole('option',{name:option}).first().click();
}

test('public entry makes capacity immediately usable without an account',async({page}:{page:any})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Find a truck already moving your way.'})).toBeVisible();
  await expect(page.getByRole('searchbox',{name:'Search'})).toBeVisible();
  await expect(page.locator('.public-map-shell').getByRole('searchbox',{name:'Search capacity'})).toBeVisible();
  await page.getByRole('button',{name:'Filters'}).click();
  const filterDialog=page.getByRole('dialog',{name:'Capacity filters'});
  await expect(filterDialog).toBeVisible();
  await expect(filterDialog.getByLabel('Availability')).toBeVisible();
  await expect(filterDialog.getByLabel('Available by')).toBeVisible();
  await filterDialog.getByRole('button',{name:'Close filters'}).click();
  await expect(filterDialog).toBeHidden();
  await expect(page.getByRole('button',{name:'Map',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.public-capacity-map')).toBeVisible();
  await expect(page.getByText('No account required.')).toBeVisible();
  await expect(page.getByRole('button',{name:/location/i})).toBeVisible();
  await page.goto('/capacity?q=Fuso');
  await expect(page).toHaveURL(/\?q=Fuso$/);
  await expect(page.getByRole('searchbox',{name:'Search'})).toHaveValue('Fuso');
});

test('capacity list continues loading and every card reaches a provider page',async({page}:{page:any})=>{
  await page.goto('/capacity');
  await page.getByRole('button',{name:'List',exact:true}).click();
  const loadMore=page.getByRole('button',{name:'Load more capacity'});
  if(await loadMore.isVisible())await loadMore.click();
  await expect.poll(()=>page.locator('.public-capacity-card').count()).toBeGreaterThan(14);
  const card=page.locator('.public-capacity-card').first();
  await expect(card.getByText(/Current radius|Current corridor/).first()).toBeVisible();
  await expect(card.getByText(/regular corridors?/).first()).toBeVisible();
  const visibleCorridors=card.getByTestId('visible-regular-corridors');
  await expect(visibleCorridors).toBeVisible();
  await expect(visibleCorridors.locator('.corridor-signal-row')).toHaveCount(2);
  await expect(visibleCorridors.locator('.corridor-signal-row').first()).toContainText('↔');
  await expect(card.locator('details.corridor-signals')).toHaveCount(0);
  const listColumns=await page.locator('.public-capacity-grid').evaluate((element:any)=>getComputedStyle(element).gridTemplateColumns.split(' ').length);
  expect(listColumns).toBe((page.viewportSize()?.width||0)>900?2:1);
  await expect(card.getByText(/Next trip/)).toHaveCount(0);
  await card.getByRole('link',{name:'Provider details'}).click();
  await expect(page).toHaveURL(/\/@[a-z0-9-]+$/);
  await expect(page.getByRole('heading',{name:'Trucks available now'})).toBeVisible();
});

test('map clusters dense capacity and opens the selected full card',async({page}:{page:any})=>{
  await page.goto('/capacity');
  await page.getByRole('button',{name:'Map',exact:true}).click();
  await expect(page.locator('.public-capacity-map')).toBeVisible();
  await expect(page.locator('.capacity-map-cluster,.capacity-truck-map-marker').first()).toBeVisible();
  await expect(page.getByText('Ethiopia freight map')).toBeVisible();
  for(let attempt=0;attempt<4;attempt+=1){
    const cluster=page.locator('.capacity-map-cluster:visible').first();
    if(!await cluster.count())break;
    await cluster.click();
    await page.waitForTimeout(100);
  }
  const visibleVehicleImage=page.locator('.capacity-truck-map-marker.vehicle-image-marker img:visible').first();
  await expect(visibleVehicleImage).toBeVisible();
  await expect(visibleVehicleImage).toHaveAttribute('src',/\/vehicle-configurations\/.+\.jpg$/);
  await expect.poll(async()=>page.locator('.capacity-truck-map-marker.vehicle-image-marker img:visible').evaluateAll((images:any[])=>Math.max(0,...images.map((image:any)=>image.naturalWidth))),{timeout:10000}).toBeGreaterThan(0);
  await page.mouse.move(0,0);
  await expect(page.locator('.capacity-marker-tooltip')).toHaveCount(0);
  const hoveredMarkerBox=await visibleVehicleImage.locator('xpath=../../..').boundingBox();
  await visibleVehicleImage.dispatchEvent('mouseover');
  const hoverSummary=page.locator('.capacity-marker-tooltip');
  await expect(hoverSummary).toBeVisible();
  const hoverSummaryBox=await hoverSummary.boundingBox();
  expect(hoveredMarkerBox&&hoverSummaryBox).toBeTruthy();
  expect(hoverSummaryBox!.y+hoverSummaryBox!.height).toBeLessThanOrEqual(hoveredMarkerBox!.y+6);
  expect(await hoverSummary.evaluate((tooltip:any)=>getComputedStyle(tooltip,'::before').borderTopWidth)).not.toBe('0px');
  await expect(page.locator('.public-map-legend')).toContainText('Empty truck');
  await expect(page.locator('.public-map-legend')).toContainText('Partial capacity');
  await expect(page.locator('.public-map-legend')).toBeVisible();
  await page.getByRole('button',{name:'List',exact:true}).click();
  await page.locator('.public-capacity-card').filter({has:page.locator('.status.yellow')}).first().getByRole('button',{name:'View on map'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.capacity-truck-map-marker.selected')).toHaveCount(1);
  await expect(page.locator('.capacity-truck-map-marker.selected img')).toHaveAttribute('src',/\/vehicle-configurations\/.+\.jpg$/);
  await expect(page.locator('.capacity-truck-map-marker.selected strong')).toHaveText(/\d+% open/);
  const markerShape=await page.locator('.capacity-truck-map-marker.selected').evaluate((element:any)=>({tailWidth:getComputedStyle(element,'::after').borderTopWidth,tailColor:getComputedStyle(element,'::after').borderTopColor,ring:getComputedStyle(element.querySelector('.vehicle-marker-image')).backgroundImage}));
  expect(markerShape.tailWidth).not.toBe('0px');
  expect(markerShape.tailColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(markerShape.ring).toContain('conic-gradient');
  await expect(page.locator('.capacity-truck-map-marker.selected')).toHaveClass(/\bpartial\b/);
  const selectedMarkerFit=await page.locator('.capacity-truck-map-marker.selected').evaluate((element:any)=>{const image=element.querySelector('img').getBoundingClientRect();const label=element.querySelector('strong').getBoundingClientRect();const content=element.querySelector('.vehicle-marker-content').getBoundingClientRect();return {imageWidth:image.width,imageHeight:image.height,labelLeft:label.left,labelRight:label.right,labelTop:label.top,labelBottom:label.bottom,contentLeft:content.left,contentRight:content.right,contentTop:content.top,contentBottom:content.bottom};});
  expect(selectedMarkerFit.imageWidth).toBeGreaterThan(45);
  expect(selectedMarkerFit.imageHeight).toBeGreaterThan(45);
  expect(selectedMarkerFit.labelLeft).toBeGreaterThanOrEqual(selectedMarkerFit.contentLeft);
  expect(selectedMarkerFit.labelRight).toBeLessThanOrEqual(selectedMarkerFit.contentRight);
  expect(selectedMarkerFit.labelTop).toBeGreaterThanOrEqual(selectedMarkerFit.contentTop);
  expect(selectedMarkerFit.labelBottom).toBeLessThanOrEqual(selectedMarkerFit.contentBottom);
  await expect(page.locator('.selected-truck-label')).toHaveCount(0);
  await expect(page.locator('.capacity-map-cluster')).toHaveCount(0);
  await expect(page.locator('.capacity-truck-map-marker:not(.selected)')).toHaveCount(0);
  await expect(page.getByRole('dialog').getByRole('link',{name:'Provider details'})).toBeVisible();
  const publicCall=page.getByRole('dialog').getByRole('link',{name:/Call \+251/});
  await expect(publicCall).toBeVisible();
  await expect(publicCall).toHaveAttribute('href',/^tel:\+251/);
  const sheetMetrics=await page.getByRole('dialog').evaluate((element:any)=>({clientHeight:element.clientHeight,scrollHeight:element.scrollHeight,height:element.getBoundingClientRect().height,viewport:window.innerHeight,overflow:getComputedStyle(element).overflowY}));
  expect(sheetMetrics.scrollHeight).toBeLessThanOrEqual(sheetMetrics.clientHeight+1);
  expect(sheetMetrics.height).toBeLessThan(sheetMetrics.viewport*.8);
  expect(sheetMetrics.overflow).not.toBe('auto');
  await expect(page.getByRole('dialog')).toContainText('Approximate current location');
  await expect(page.locator('.map-location-privacy-circle')).toBeVisible();
  await expect(page.locator('.public-map-legend')).toContainText('Current radius');
  await expect(page.locator('.public-map-legend')).toContainText('Current corridor');
  await expect(page.locator('.public-map-legend')).toContainText(/Two-way regular corridor/i);
  await expect(page.locator('.public-map-legend')).not.toContainText('Next trip');
  const closeCard=page.getByRole('button',{name:'Show all trucks'});
  await expect(closeCard).toBeVisible();
  expect(await closeCard.evaluate((element:any)=>getComputedStyle(element,'::before').content)).toContain('×');
  await closeCard.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.capacity-map-cluster,.capacity-truck-map-marker').first()).toBeVisible();
});

test('visitor location is requested on entry, centers the map, and may be refreshed',async({page,context}:{page:any;context:any})=>{
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:9.03,longitude:38.74});
  await page.goto('/');
  await expect(page.getByTestId('visitor-location-state')).toContainText('Location updated');
  await expect(page.getByRole('button',{name:'Refresh my location'})).toBeVisible();
  await expect(page.locator('.capacity-location-tooltip')).toHaveCount(0);
  await page.locator('.public-viewer-location-marker').dispatchEvent('mouseover');
  await expect(page.locator('.capacity-location-tooltip')).toContainText('Your search location');
  await expect(page.locator('.public-capacity-map')).toBeVisible();
  const mapBox=await page.locator('.public-capacity-map .leaflet-container').boundingBox();
  const viewerMarkerBox=await page.locator('.public-viewer-location-marker').boundingBox();
  expect(mapBox&&viewerMarkerBox).toBeTruthy();
  expect(Math.abs((viewerMarkerBox!.x+viewerMarkerBox!.width/2)-(mapBox!.x+mapBox!.width/2))).toBeLessThan(mapBox!.width*.2);
  expect(Math.abs((viewerMarkerBox!.y+viewerMarkerBox!.height/2)-(mapBox!.y+mapBox!.height/2))).toBeLessThan(mapBox!.height*.2);
  await page.getByRole('button',{name:'List',exact:true}).click();
  await expect(page.getByTestId('possible-distance').first()).toBeVisible();
  await context.setGeolocation({latitude:9.08,longitude:38.78});
  const refresh=page.waitForResponse((response:any)=>response.url().includes('/api/public/capacity?')&&response.request().method()==='GET');
  await page.getByRole('button',{name:'Refresh my location'}).click();
  await refresh;
  await expect(page.getByTestId('visitor-location-state')).toContainText('Location updated');
  await expect(page.getByText('Your exact location stays in this browser.')).toBeVisible();
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

test('public directory presents many fleets and owner-operators as full microsites',async({page}:{page:any})=>{
  await page.goto('/providers');
  await expect(page.getByRole('heading',{name:'Know who you are trusting with the load.'})).toBeVisible();
  await expect(page.locator('.provider-directory-card')).toHaveCount(30);
  await page.locator('.provider-directory-card').first().getByRole('link',{name:'View provider'}).click();
  await expect(page.locator('.provider-handle')).toContainText('/@');
  await expect(page.getByRole('heading',{name:'Document badges'})).toBeVisible();
  await expect(page.getByText(/Check current originals/)).toBeVisible();
});

test('provider edits business facts without designing the Loadgistic microsite',async({page}:{page:any})=>{
  await login(page,'transporter@loadgistic.local');
  await page.goto('/app/company-page');
  await expect(page.getByText('Loadgistic handles the page design.')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Page colors'})).toHaveCount(0);
  await expect(page.getByLabel('YouTube video ID')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Save provider information'})).toBeVisible();
});

test('provider starts Tracking with one stable customer-owner code and ordered status actions',async({page}:{page:any})=>{
  await login(page,'transporter@loadgistic.local');
  await page.goto('/app/provider-shipments/new');
  await page.getByLabel('Truck').selectOption({index:1});
  await page.getByLabel('Cargo summary').fill('Workshop machine parts');
  await choosePlace(page,'Origin','Addis',/Addis Ababa, Ethiopia/i);
  await choosePlace(page,'Destination','Adama',/Adama, Ethiopia/i);
  await page.getByLabel('Customer owner email').fill('owner.e2e@example.test');
  await page.getByRole('button',{name:'Start Tracking'}).click();
  await expect(page.getByText('Tracking started')).toBeVisible();
  const trackingCode=(await page.locator('.party-code-grid article').first().locator('code').textContent())!;
  expect(trackingCode).toMatch(/^LG-[A-F0-9]{4}-[A-F0-9]{4}$/);
  await page.getByRole('link',{name:'Open Tracking'}).click();
  await expect(page.getByRole('heading',{name:/Tracking · LGX-/})).toBeVisible();
  await expect(page.locator('.tracking-action-choice')).toHaveCount(5);
  await expect(page.getByLabel('Photo (optional)')).toBeVisible();
  await page.getByRole('button',{name:'Save Loading'}).click();
  await expect(page.getByText('Tracking status updated.')).toBeVisible();
  await page.getByLabel('En route').check();
  await expect(page.getByLabel('Photo (optional)')).toHaveCount(0);
  await expect(page.getByText(trackingCode)).toBeVisible();
  await page.goto('/track');
  await page.getByLabel('Tracking code').fill(trackingCode);
  await page.getByRole('button',{name:'Open tracking'}).click();
  await expect(page.getByText('Private shipment tracking')).toBeVisible();
  await expect(page.getByRole('heading',{name:/Track LGX-/})).toBeVisible();
});

test('capacity summary keeps the map visible and Driver refresh persists location',async({page,context}:{page:any;context:any})=>{
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:9.07,longitude:38.76});
  const automaticLocationSave=page.waitForResponse((response:any)=>response.url().endsWith('/api/capacity/location')&&response.request().method()==='POST');
  await login(page,'driver@loadgistic.local');
  expect((await automaticLocationSave).ok()).toBe(true);
  await expect(page.getByTestId('capacity-location-state')).toContainText('refreshed automatically');
  await expect(page.getByTestId('capacity-summary')).toBeVisible();
  await expect(page.getByTestId('capacity-summary').locator('.leaflet-container')).toBeVisible();
  await expect(page.getByTestId('capacity-summary').locator('.capacity-setting-truck-marker')).toBeVisible();
  await expect(page.getByTestId('capacity-summary').locator('.capacity-setting-truck-label')).toContainText('Truck area');
  await expect(page.getByTestId('capacity-summary').locator('.capacity-map-key')).toContainText('Two-way regular corridors');
  const privacy=page.getByLabel('Approximate location radius');
  const currentPrivacy=await privacy.inputValue();
  const nextPrivacy=currentPrivacy==='5'?'10':'5';
  const privacySave=page.waitForResponse((response:any)=>response.url().endsWith('/api/capacity/location')&&response.request().method()==='POST');
  await privacy.selectOption(nextPrivacy);
  expect((await privacySave).ok()).toBe(true);
  await expect(page.getByTestId('capacity-summary')).toContainText(`${nextPrivacy} km radius`);
  await expect(page.getByTestId('capacity-form')).toHaveCount(0);
  const save=page.waitForResponse((response:any)=>response.url().endsWith('/api/capacity/location')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Refresh truck location'}).click();
  const saved=await save;
  expect(saved.ok()).toBe(true);
  await expect(page.getByTestId('capacity-location-state')).toContainText('Approximate truck location saved');
  await expect(page.getByTestId('capacity-form')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Capacity now'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Available by radius or corridor'})).toHaveCount(0);
  await expect(page.getByTestId('capacity-summary')).toContainText('just now');
  await expect(page.getByTestId('capacity-summary')).not.toContainText('Next trip');
  await expect(page.getByTestId('capacity-summary')).toContainText('Regular corridors');
  await expect(page.locator('.capacity-market-planning')).toHaveCount(0);
  await page.locator('.recurring-summary-fact button').click();
  await expect(page.getByTestId('recurring-service-editor')).toBeVisible();
  await expect(page.getByTestId('recurring-service-editor')).toContainText('maximum of two regular corridors');
  await page.getByTestId('recurring-service-editor').getByRole('button',{name:'Summary'}).click();
  await page.locator('.capacity-summary-facts > div').first().getByRole('button').click();
  await expect(page.getByRole('heading',{name:'Capacity now'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Available by radius or corridor'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Approximate current location'})).toHaveCount(0);
  const capacityMarketLink=page.locator('a:visible').filter({hasText:/^(Capacity market|Market)$/}).first();
  await expect(capacityMarketLink).toBeVisible();
  await capacityMarketLink.click();
  await expect(page).toHaveURL(/\/app\/capacity$/);
  await expect(page.getByRole('heading',{name:'Capacity market'})).toBeVisible();
  let exitDashboard=page.getByRole('link',{name:'Exit dashboard'});
  if(!await exitDashboard.isVisible()){await page.locator('.mobile-account-menu summary').click();exitDashboard=page.getByRole('link',{name:'Exit dashboard'});}
  await exitDashboard.click();
  await expect(page).toHaveURL(/\/$/);
});

test('retired demand URLs redirect to the public supply market',async({page,request}:{page:any;request:any})=>{
  await page.goto('/app/loads');
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/app/network');
  await expect(page).toHaveURL(/\/$/);
  const response=await request.post('/api/shipments',{form:{title:'retired'}});
  expect(response.status()).toBe(410);
});

test('login page never publishes fixture credentials',async({page}:{page:any})=>{
  await page.goto('/login');
  await expect(page.getByLabel('Email')).toHaveValue('');
  await expect(page.getByLabel('Password')).toHaveValue('');
  await expect(page.getByText('@loadgistic.local')).toHaveCount(0);
  await expect(page.getByText('Loadgistic123!',{exact:false})).toHaveCount(0);
});
