import {chooseTruckConfiguration,chooseCapacityOptions} from './capacity-drawer-helper';
import {test,expect} from './browser-test';
import {openCapacityFilters as openDrawer,openCapacityFilterDialog,closeCapacityFilters} from './capacity-drawer-helper';

test.use({extraHTTPHeaders:{'x-forwarded-for':'127.0.0.247'}});
async function drag(page:any,mobile:boolean,x:number,y:number,dx:number){
  if(mobile){
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let step=1;step<=8;step++){
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*step/8,y}]});
      await page.evaluate(()=>new Promise(requestAnimationFrame));
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  }else{
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y,{steps:8});await page.mouse.up();
  }
}
async function expectDomOrder(container:any,selectors:string[]){
  const ordered=await container.evaluate((root:any,queries:string[])=>{
    const nodes=queries.map(query=>root.querySelector(query));
    return nodes.every((node,index)=>node&&(!index||Boolean(nodes[index-1].compareDocumentPosition(node)&Node.DOCUMENT_POSITION_FOLLOWING)));
  },selectors);
  expect(ordered,`Expected this screen order: ${selectors.join(' → ')}`).toBe(true);
}
async function exercise(page:any,info:any,path:string,api:string){
  page.setDefaultTimeout(15000);
  const windows:string[]=[];
  page.on('request',(r:any)=>{const u=new URL(r.url());if(u.pathname===api&&u.searchParams.has('viewport'))windows.push(u.searchParams.get('viewport')!);});
  await page.goto(path);await expect(page.locator('.leaflet-container')).toBeVisible();
  const mobile=info.project.name.includes('mobile');
  await expect(page.getByRole('button',{name:'Search transporters',exact:true})).toBeVisible();
  await expect(page.getByRole('complementary',{name:'Transporter search'})).toBeHidden();
  await page.locator('.leaflet-container').evaluate((el:any)=>{el.__drawerMapIdentity=true;});
  const drawer=await openDrawer(page);
  const dialog=await openCapacityFilterDialog(page);
  expect(await dialog.locator('[data-filter-section]').evaluateAll((sections:HTMLElement[])=>sections.map(section=>section.dataset.filterSection))).toEqual(['vehicle','availability','location','more']);
  await expectDomOrder(dialog.locator('[data-filter-section="vehicle"] .capacity-primary-selects'),['.capacity-configuration-picker legend','[data-filter-group="status"] legend']);
  await expectDomOrder(dialog.locator('[data-filter-section="location"] .capacity-truck-location-filter'),['#capacity-truck-city','#capacity-near-enabled','[data-filter-group="locationSource"]']);
  await expect(dialog.locator('[data-filter-section] > summary > svg')).toHaveCount(8);
  await expect(dialog.locator('[data-filter-section="vehicle"] > summary')).toContainText('Vehicle');
  await expect(dialog.locator('[data-filter-section="location"] > summary')).toContainText('Vehicle location');
  await expect(dialog.locator('[data-filter-section="availability"]')).toHaveAttribute('open','');
  await expect(dialog.locator('[data-filter-section="location"]')).not.toHaveAttribute('open','');
  await expect(dialog.locator('[data-filter-section="more"]')).not.toHaveAttribute('open','');
  await expect(dialog.getByRole('group',{name:'Load status',exact:true})).toBeVisible();
  await expect(dialog.getByRole('group',{name:'Location source',exact:true})).toBeHidden();
  await dialog.evaluate((element:HTMLElement)=>{element.scrollTop=0;});
  await page.screenshot({path:info.outputPath(`${path==='/'?'open':'private'}-filter-groups.png`),scale:'css'});
  const routeSection=dialog.locator('[data-query-shape="ROUTE"]');
  await dialog.getByRole('button',{name:'Route',exact:true}).click();
  await expectDomOrder(routeSection,['#capacity-route-origin','#capacity-route-destination','#capacity-origin-radius','#capacity-destination-radius','#capacity-route-direction']);
  await dialog.getByRole('button',{name:'Area',exact:true}).click();
  await dialog.locator('[data-filter-section="location"] > summary').click();
  await expect(dialog.locator('[data-filter-group="loadType"]')).toHaveCount(0);
  await chooseCapacityOptions(dialog,'status',['EMPTY']);
  await chooseTruckConfiguration(dialog,'Mini Box Truck');
  await dialog.getByLabel('In or near a city',{exact:true}).fill('Addis Ababa');
  await dialog.locator('#capacity-truck-city-results .place-result').first().click();
  const city=await dialog.locator('input[name="truckCityPlaceRef"]').inputValue();expect(city).toBeTruthy();
  await dialog.locator('#capacity-truck-location-radius').selectOption('25');
  await dialog.getByRole('button',{name:'Route',exact:true}).click();
  await dialog.getByLabel('Origin (optional)',{exact:true}).fill('Addis Ababa');
  await dialog.locator('#capacity-route-origin-results .place-result').first().click();
  const originRadius=dialog.locator('#capacity-origin-radius');
  expect(await originRadius.locator('option').evaluateAll((options:any[])=>options.map(option=>option.value))).toEqual(['10','25','50','100','200']);
  await expect(originRadius).toHaveValue('50');await originRadius.selectOption('25');
  await dialog.getByLabel('Destination (optional)',{exact:true}).fill('Adama');
  await dialog.locator('#capacity-route-destination-results .place-result').first().click();
  const destinationRadius=dialog.locator('#capacity-destination-radius');
  expect(await destinationRadius.locator('option').evaluateAll((options:any[])=>options.map(option=>option.value))).toEqual(['10','25','50','100','200']);
  await expect(destinationRadius).toHaveValue('50');await destinationRadius.selectOption('100');
  await expect(drawer.getByLabel('Load status',{exact:true})).toHaveCount(0);
  await chooseCapacityOptions(dialog,'locationSource',['MOBILE']);
  await dialog.getByRole('combobox',{name:'Direction',exact:true}).selectOption('EITHER');
  if(path==='/'){
    await dialog.locator('[data-filter-section="more"] summary').click();
    await expectDomOrder(dialog.locator('[data-filter-section="more"]'),['[data-filter-group="freshness"]','[data-filter-group="stopOption"]','.capacity-document-filters']);
    const reviewed=dialog.getByRole('group',{name:'Reviewed documents',exact:true});
    for(const label of ['Company or owner','Driver documents','Vehicle documents'])await expect(reviewed).toContainText(label);
    await reviewed.getByLabel('Business License',{exact:true}).check();
  }
  await page.screenshot({path:info.outputPath(`${path==='/'?'open':'private'}-more-filters.png`),scale:'css'});
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button',{name:/^Vehicle filters/})).toBeFocused();
  await closeCapacityFilters(page);
  await expect(page.locator('.ethiopia-map-label')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Search transporters',exact:true})).toBeFocused();
  await expect(page.locator('#capacity-filter-drawer')).toHaveAttribute('inert','');
  await expect.poll(()=>windows.length).toBeGreaterThan(0);
  await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:15000});
  const before=windows.at(-1);
  const map=await page.locator('.leaflet-container').boundingBox();
  await drag(page,mobile,map.x+map.width*.65,map.y+map.height*.4,-75);
  await expect.poll(()=>windows.at(-1)).not.toBe(before);
  await page.screenshot({path:info.outputPath(`${path==='/'?'open':'private'}-map.png`),scale:'css'});
  await openDrawer(page);await expect(dialog.locator('input[type="hidden"][name="status"]')).toHaveValue('EMPTY');
  await expect(dialog.getByLabel('In or near a city',{exact:true})).not.toHaveValue('');
  await drawer.evaluate(async(element:HTMLElement)=>{await Promise.all(element.getAnimations().map(animation=>animation.finished));});
  await drawer.locator('.capacity-drawer-heading').scrollIntoViewIfNeeded();
  const heading=await drawer.locator('.capacity-drawer-heading').boundingBox();
  await drag(page,mobile,heading.x+heading.width*.6,heading.y+heading.height/2,-90);
  await expect(page.getByRole('button',{name:'Search transporters',exact:true})).toBeVisible();
  await drawer.evaluate(async(element:HTMLElement)=>{await Promise.all(element.getAnimations().map(animation=>animation.finished));});
  await page.getByRole('button',{name:'Search transporters',exact:true}).scrollIntoViewIfNeeded();
  const handle=await page.getByRole('button',{name:'Search transporters',exact:true}).boundingBox();
  await drag(page,mobile,handle.x+10,handle.y+20,90);
  await expect(drawer).toBeVisible();
  expect(await page.locator('.leaflet-container').evaluate((el:any)=>el.__drawerMapIdentity)).toBe(true);
  await page.emulateMedia({reducedMotion:'reduce'});expect(await drawer.evaluate((el:any)=>getComputedStyle(el).transitionDuration)).toBe('0s');
  await drawer.locator('.capacity-drawer-scroll').evaluate((el:any)=>{el.scrollTop=0;});
  await openCapacityFilterDialog(page);await dialog.getByRole('button',{name:'Show vehicles'}).scrollIntoViewIfNeeded();
  const submit=await dialog.getByRole('button',{name:'Show vehicles'}).boundingBox();
  expect(await page.evaluate(({x,y}:any)=>Boolean(document.elementFromPoint(x,y)?.closest('.capacity-filter-actions')),{x:submit.x+submit.width-8,y:submit.y+submit.height/2})).toBe(true);
  await page.screenshot({path:info.outputPath(`${path==='/'?'open':'private'}-drawer.png`),scale:'css'});
  await dialog.getByRole('button',{name:'Show vehicles'}).click();
  await expect(page).toHaveURL((url:URL)=>url.pathname==='/'&&url.searchParams.has('truckCityPlaceRef')&&(path==='/'||url.searchParams.get('view')==='private'));
  const url=new URL(page.url());expect(url.pathname).toBe('/');if(path!=='/')expect(url.searchParams.get('view')).toBe('private');expect(url.searchParams.getAll('q')).toHaveLength(0);
  for(const [name,value] of [['status','EMPTY'],['vehicleCategory','Mini Box Truck'],['locationSource','MOBILE'],['directionMode','EITHER'],['truckLocationRadiusKm','25'],['truckCityPlaceRef',city],['originRadiusKm','25'],['destinationRadiusKm','100']])expect(url.searchParams.get(name)).toBe(value);
  if(path==='/')expect(url.searchParams.get('ownerDocs')).toBe('BUSINESS_LICENSE');
  expect(url.searchParams.has('loadType')).toBe(false);
  expect(url.searchParams.get('originPlaceRef')).toBeTruthy();expect(url.searchParams.has('nearLat')).toBe(false);
  const result=await page.request.get(`${api}?${url.searchParams}`);expect(result.status()).toBe(200);const body=await result.json();expect(body.filterError).toBeFalsy();if(api==='/api/shared-capacity')expect(body.items).toHaveLength(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await openCapacityFilterDialog(page);
  await expect(dialog.locator('input[type="hidden"][name="locationSource"]')).toHaveValue('MOBILE');
  if(path==='/')await expect(dialog.locator('input[type="hidden"][name="ownerDocs"]')).toHaveValue('BUSINESS_LICENSE');
  await dialog.getByRole('link',{name:'Clear',exact:true}).click();await expect(page).toHaveURL(new RegExp(`${path==='/'?'/$':'/\\?view=private$'}`));
  await openDrawer(page);
  await expect(dialog.locator('input[type="hidden"][name="status"]')).toHaveValue('');
  if(path==='/')await expect(dialog.locator('input[type="hidden"][name="ownerDocs"]')).toHaveValue('');
  await expect(dialog.locator('.capacity-configuration-picker [data-clear-options]')).toHaveAttribute('aria-pressed','true');
  await expect(dialog.getByLabel('In or near a city',{exact:true})).toHaveValue('');
  await expect(dialog.locator('input[name="truckCityPlaceRef"]')).toHaveValue('');
  await expect(page.getByRole('dialog',{name:'Vehicle filters',exact:true})).not.toBeVisible();
  await expect(page.getByTestId('capacity-feed-state')).toHaveCount(0,{timeout:20000});
}

test('Open capacity drawer keeps drafts, map gestures and combined filters',async({page}:{page:any},info:any)=>{
  test.setTimeout(120000);await exercise(page,info,'/','/api/public/capacity');
  expect((await page.request.get('/api/shared-capacity')).status()).toBe(410);
});

test('private Capacity entry has no email-code drawer',async({page}:{page:any})=>{
 await page.goto('/shared-capacity');
 await expect(page).toHaveURL(/\/login\?from=shared-capacity/);
 await expect(page.getByLabel('6-digit email code')).toHaveCount(0);
 expect((await page.request.get('/api/shared-capacity')).status()).toBe(410);
});

test('Area and Route query drafts stay editable but only the applied shape reaches the map',async({page})=>{
 await page.goto('/');const dialog=await openCapacityFilterDialog(page);
 await expect(dialog.getByRole('button',{name:'Area',exact:true})).toHaveAttribute('aria-pressed','true');
 await dialog.getByRole('combobox',{name:'Area',exact:true}).fill('Addis Ababa');
 const choices=dialog.locator('#capacity-area-city-results');await expect(choices).toBeVisible();
 expect(await choices.evaluate((list:HTMLElement)=>({position:getComputedStyle(list).position,insideSection:list.getBoundingClientRect().bottom<=list.closest('[data-filter-section]')!.getBoundingClientRect().bottom}))).toEqual({position:'relative',insideSection:true});
 await dialog.getByRole('option',{name:/^Addis Ababa, Ethiopia/i}).first().click();
 await expect(dialog.locator('#capacity-area-radius')).toHaveValue('50');
 const areaRef=await dialog.locator('input[name="currentAreaPlaceRef"]').inputValue();expect(areaRef).toBeTruthy();
 await dialog.getByRole('button',{name:'Route',exact:true}).click();
 await dialog.getByRole('combobox',{name:'Origin (optional)',exact:true}).fill('Adama');
 await dialog.locator('#capacity-route-origin-results .place-result').first().click();
 const originRef=await dialog.locator('input[name="originPlaceRef"]').inputValue();expect(originRef).toBeTruthy();
 await dialog.getByRole('button',{name:'Area',exact:true}).click();
 await expect(dialog.getByRole('combobox',{name:'Area',exact:true})).toHaveValue(/Addis Ababa/);
 await expect(dialog.locator('[data-query-shape="ROUTE"]')).toHaveAttribute('disabled','');
 await expect(dialog.locator('[data-query-shape="ROUTE"]')).toBeHidden();
 await dialog.getByRole('button',{name:'Route',exact:true}).click();
 await expect(dialog.getByRole('combobox',{name:'Origin (optional)',exact:true})).toHaveValue(/Adama/);
 await dialog.getByRole('button',{name:'Area',exact:true}).click();
 await chooseCapacityOptions(dialog,'stopOption',['MULTI_PICK']);
 await dialog.getByRole('button',{name:'Show vehicles',exact:true}).click();
 await expect(page).toHaveURL(url=>url.searchParams.get('currentAreaPlaceRef')===areaRef&&url.searchParams.get('currentAreaRadiusKm')==='50'&&!url.searchParams.has('originPlaceRef')&&!url.searchParams.has('destinationPlaceRef')&&!url.searchParams.has('directionMode')&&url.searchParams.get('stopOption')==='MULTI_PICK');
 const query=new URL(page.url()).searchParams;expect(query.has('availabilityGeometry')).toBe(false);expect(query.has('preferredOnly')).toBe(false);
 const response=await page.request.get(`/api/public/capacity?${query}`);expect(response.ok()).toBe(true);expect((await response.json()).filterError).toBeFalsy();
 await openCapacityFilterDialog(page);await expect(dialog.getByRole('combobox',{name:'Area',exact:true})).toHaveValue(/Addis Ababa/);await expect(dialog.locator('input[name="currentAreaPlaceRef"]')).toHaveValue(areaRef);await expect(dialog.getByRole('button',{name:'Area',exact:true})).toHaveAttribute('aria-pressed','true');
});
