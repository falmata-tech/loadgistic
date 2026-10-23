import {test,expect} from './browser-test';
import type {Page,Locator} from 'playwright-core';
import {auditFleetProvider,auditFleetDriver,auditLogin,auditDeleteVehicles,checked,localAuditService} from './audit-helpers';
import {localMailpitNumericCode} from './mailpit-helper';
import {createProviderVehicle} from '../../src/lib/fleet.js';
import {addProviderRegularCapacity,publishProviderCapacity,refreshProviderCapacityLocation} from '../../src/lib/provider-capacity.js';
import {localFleetPublication} from './provider-publication-helper';
import sharp from 'sharp';

// Ordinary UI/Auth and the real local managed commands. Test-owned fixtures and
// snapshots prove pair isolation; this is Expo web evidence, not Android evidence.
test.use({trace:'off',screenshot:'off'});
const preview='http://localhost:8084';
type PlaceRow={id:string;name:string;longitude:number;latitude:number};
type Pair={vehicleId:string;driverId:string};
async function fixture(prefix:string){
 const db=localAuditService(),owner=await auditFleetProvider(db,prefix),vehicles:string[]=[],drivers:string[]=[];
 const publication=localFleetPublication(db,owner);
 const rows:PlaceRow[]=checked(await db.from('place_catalog').select('id,name,longitude,latitude').in('normalized_name',['addis ababa','adama','dire dawa']));
 const city=(name:string)=>{const row=rows.find(row=>row.name===name);if(!row)throw Error('LOCAL_REGULAR_PLACES_REQUIRED');return row;};
 const places=[city('Addis Ababa'),city('Adama'),city('Dire Dawa')],route=places.slice(0,2).map(row=>({placeRef:row.id,label:row.name}));
 let legacyId='';
 const cleanup=async()=>{
  await publication.cleanup();
  const routeIds: {id:string}[]=checked(await db.from('profile_routes').select('id').eq('organization_id',owner.organization_id));
  const capacityIds:{id:string}[]=vehicles.length?checked(await db.from('capacities').select('id').in('vehicle_id',vehicles)):[];
  const entityIds=[...vehicles,...routeIds.map(row=>row.id),...capacityIds.map(row=>row.id)];
  if(entityIds.length)checked(await db.from('audit_logs').delete().in('entity_id',entityIds));
  checked(await db.from('profile_routes').delete().eq('organization_id',owner.organization_id));
  if(vehicles.length){checked(await db.from('capacities').delete().in('vehicle_id',vehicles));checked(await auditDeleteVehicles(db,'id',vehicles));}
  for(const id of [...drivers,owner.id]){checked(await db.from('audit_logs').delete().eq('actor_user_id',id));checked(await db.auth.admin.deleteUser(id));}
  checked(await db.from('organizations').delete().eq('id',owner.organization_id));
 };
 try{
  const pairs:Pair[]=[];
  for(const suffix of ['A','B']){
   const truck=await createProviderVehicle(owner,{useBasis:'OWNED',make:'Route fleet',model:`Truck ${suffix}`,plate:`REG-${owner.suffix}-${suffix}`,cargoConfiguration:'Cargo van',trailerInterchangeable:false});vehicles.push(truck.id);
   const driver=await auditFleetDriver(db,owner,truck.id);drivers.push(driver.id);pairs.push({vehicleId:truck.id,driverId:driver.id});await publication.publish(truck.id);
   await refreshProviderCapacityLocation(driver,{vehicleId:truck.id,approximateLat:9.03,approximateLng:38.74,locationPrecisionKm:20});
   await publishProviderCapacity(owner,{vehicleId:truck.id,status:'EMPTY',acceptedLoads:'BOTH',availabilityGeometry:'ROUTE',visibility:'PRIVATE',locationSource:'PRESERVE_DRIVER',currentRoutePlaces:route});
  }
  const [a,b]=pairs;
  await addProviderRegularCapacity(owner,{vehicleId:b.vehicleId,expectedDriverId:b.driverId,geometry:'ROUTE',routePlaces:[...route].reverse(),areaCenterPlaceRef:'',areaBoundaryPlaces:[]});
  legacyId=checked(await db.from('profile_routes').insert({organization_id:owner.organization_id,origin:'Preserved old origin',destination:'Preserved old destination',geometry:'ROUTE',route_points_json:route,created_by:owner.id}).select('id').single()).id;
  const legacy=checked(await db.from('profile_routes').select('*').eq('id',legacyId).single()),other=checked(await db.from('profile_routes').select('*').eq('assigned_vehicle_id',b.vehicleId).single());
  const capacity=checked(await db.from('capacities').select('*').in('vehicle_id',vehicles).order('vehicle_id'));
  return{owner,a,b,places,cleanup,async ownRoute(){return checked(await db.from('profile_routes').select('*').eq('assigned_vehicle_id',a.vehicleId).eq('assigned_driver_user_id',a.driverId).maybeSingle());},async preserved(){expect(checked(await db.from('profile_routes').select('*').eq('id',legacyId).single())).toEqual(legacy);expect(checked(await db.from('profile_routes').select('*').eq('assigned_vehicle_id',b.vehicleId).single())).toEqual(other);expect(checked(await db.from('capacities').select('*').in('vehicle_id',vehicles).order('vehicle_id'))).toEqual(capacity);}};
 }catch(error){await cleanup();throw error;}
}
async function webChoose(dialog:Locator,index:number,name:string){
 await dialog.getByRole('combobox',{name:`Route city ${index}`,exact:true}).fill(name);
 await dialog.getByRole('option',{name:new RegExp(`^${name},`)}).first().click();
}
async function webSave(page:Page,dialog:Locator,remove=false){
 const pending=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/capacity/corridors'&&response.request().method()==='POST');
 await dialog.getByRole('button',{name:remove?'Remove regular service':'Save',exact:true}).click();const response=await pending;expect(response.ok()).toBe(true);expect(await response.json()).toEqual({ok:true});return response.request().postData()||'';
}
async function openWeb(page:Page,pair:Pair,hasRoute:boolean){
 await page.goto(`/app/fleet/${pair.vehicleId}`);const action=page.getByRole('button',{name:`Edit regular service: ${hasRoute?'Route':'None'}`,exact:true});await expect(action).toBeEnabled({timeout:30_000});await action.click();
 const dialog=page.getByRole('dialog',{name:'Regular service',exact:true});await expect(dialog).toBeVisible();await expect(dialog.locator('#regular-service-form input[name="vehicleId"]')).toHaveValue(pair.vehicleId);await expect(dialog.locator('#regular-service-form input[name="expectedDriverId"]')).toHaveValue(pair.driverId);if(hasRoute){const removal=dialog.locator('form:has(input[name="action"][value="REMOVE"])');await expect(removal.locator('input[name="vehicleId"]')).toHaveValue(pair.vehicleId);await expect(removal.locator('input[name="expectedDriverId"]')).toHaveValue(pair.driverId);}return dialog;
}
test('web scoped regular routes save update remove and discard drafts across two assigned trucks',async({page},info)=>{
 test.setTimeout(150_000);const data=await fixture(`web-regular-${info.project.name.includes('mobile')?'phone':'desktop'}`),errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
 try{
  await auditLogin(page,data.owner.email);let dialog=await openWeb(page,data.a,false);await expect(dialog.getByRole('combobox').first()).toHaveValue('');await expect(dialog.getByRole('button',{name:'Remove regular service',exact:true})).toHaveCount(0);
  await webChoose(dialog,1,'Addis Ababa');await webChoose(dialog,2,'Dire Dawa');await webSave(page,dialog);await expect(dialog).toHaveCount(0);let own=await data.ownRoute();expect(own.assigned_vehicle_id).toBe(data.a.vehicleId);expect(own.assigned_driver_user_id).toBe(data.a.driverId);expect(own.route_points_json.map((row:{label:string})=>row.label.split(',')[0])).toEqual(['Addis Ababa','Dire Dawa']);await data.preserved();
  dialog=await openWeb(page,data.a,true);await webChoose(dialog,2,'Adama');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  dialog=await openWeb(page,data.b,true);await expect(dialog.getByRole('combobox',{name:'Route city 1',exact:true})).toHaveValue(/Adama/);await expect(dialog.getByRole('combobox',{name:'Route city 2',exact:true})).toHaveValue(/Addis Ababa/);await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  dialog=await openWeb(page,data.a,true);await expect(dialog.getByRole('combobox',{name:'Route city 2',exact:true})).toHaveValue(/Dire Dawa/);await webChoose(dialog,2,'Adama');
  if(info.project.name.includes('mobile'))await page.setViewportSize({width:320,height:640});await expect(dialog.getByRole('button',{name:'Save',exact:true})).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const box=await dialog.boundingBox();expect(box!.height).toBeLessThan(page.viewportSize()!.height);await page.screenshot({path:info.outputPath('web-selected-truck-regular-editor.png'),scale:'css'});
  await webSave(page,dialog);await expect(dialog).toHaveCount(0);own=await data.ownRoute();expect(own.route_points_json.map((row:{label:string})=>row.label.split(',')[0])).toEqual(['Addis Ababa','Adama']);await data.preserved();
  dialog=await openWeb(page,data.a,true);await webSave(page,dialog,true);await expect(dialog.getByRole('button',{name:'Remove regular service',exact:true})).toHaveCount(0);expect(await data.ownRoute()).toBeNull();await data.preserved();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('button',{name:'Edit regular service: None',exact:true})).toBeVisible();await page.screenshot({path:info.outputPath('web-removed-truck-regular-map.png'),scale:'css'});expect(errors).toEqual([]);
 }finally{await data.cleanup();}
});
async function nativeChoose(page:Page,index:number,name:string){
 await page.getByText(`Route city ${index}`,{exact:true}).locator('..').getByRole('button').click();await page.getByLabel('Search cities',{exact:true}).fill(name);await page.getByRole('button',{name:new RegExp(`^${name},`)}).first().click();await expect(page.getByLabel('Search cities',{exact:true})).toHaveCount(0);
}
async function nativeSave(page:Page,remove=false){
 const pending=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/regular-service'&&response.request().method()==='POST');await page.getByRole('button',{name:remove?'Remove':'Save regular service',exact:true}).click();const response=await pending;expect(response.ok()).toBe(true);expect(await response.json()).toEqual({ok:true});return response.request().postDataJSON() as {vehicleId:string;expectedDriverId:string};
}
async function paintedNativePreview(page:Page){
 const canvas=page.locator('.maplibregl-canvas:visible').last();await canvas.scrollIntoViewIfNeeded();
 await expect.poll(async()=>{const box=await canvas.boundingBox();if(!box)return false;const top=Math.max(box.y,115),bottom=Math.min(box.y+box.height,page.viewportSize()!.height-80),left=Math.max(box.x,0),right=Math.min(box.x+box.width,page.viewportSize()!.width);if(bottom-top<40||right-left<40)return false;const stats=await sharp(await page.screenshot({clip:{x:left+(right-left)*.15,y:top+(bottom-top)*.2,width:(right-left)*.7,height:(bottom-top)*.4}})).stats();return stats.channels.slice(0,3).some(channel=>channel.mean<248&&channel.stdev>4);},{timeout:30_000,message:'The real coverage basemap must paint before route review captures.'}).toBe(true);
}
test('Expo selected fleet Usual routes saves updates removes without changing another truck or current capacity',async({page},info)=>{
 test.skip(info.project.name!=='mobile-chromium','One actual390px Expo fleet workflow.');test.setTimeout(180_000);const data=await fixture('native-regular'),errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
 try{
  await page.setViewportSize({width:390,height:844});await page.goto(preview+'/account');await page.getByLabel('Email',{exact:true}).fill(data.owner.email);const since=Date.now();await page.getByRole('button',{name:'Send code',exact:true}).click();await page.getByLabel('Sign-in code',{exact:true}).fill(await localMailpitNumericCode(data.owner.email,since,'Your Loadgistic sign-in code'));await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('tab',{name:'Home',exact:true})).toBeVisible({timeout:30_000});
  const fleet=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/fleet'&&response.request().method()==='GET');await page.goto(preview+'/fleet');const payload=await (await fleet).json();
  const vehicle=(id:string)=>{const item=payload.vehicles.find((row:{id:string})=>row.id===id) as {make:string;model:string;plate:string}|undefined;expect(item).toBeDefined();return page.getByRole('button',{name:`Manage vehicle: ${item!.make} ${item!.model} · ${item!.plate}`,exact:true});};
  const openVehicle=async(id:string)=>{await vehicle(id).click();await expect(page.getByRole('button',{name:'Back to vehicles',exact:true})).toBeVisible();await expect(page.getByRole('tab',{name:'Capacity',exact:true})).toBeVisible();};
  const backToVehicles=async()=>{await page.getByRole('button',{name:'Back to vehicles',exact:true}).click();};
  const reopenRoutes=async()=>{await expect(page.getByRole('button',{name:'Manage usual routes',exact:true})).toBeVisible();await page.getByRole('button',{name:'Manage usual routes',exact:true}).click();};
  await openVehicle(data.a.vehicleId);
  const scoped=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/mobile/regular-service'&&url.searchParams.get('vehicleId')===data.a.vehicleId&&url.searchParams.get('expectedDriverId')===data.a.driverId;});await page.getByRole('button',{name:'Manage usual routes',exact:true}).click();expect((await scoped).ok()).toBe(true);await expect(page.getByRole('button',{name:'Save regular service',exact:true})).toBeVisible({timeout:30_000});await expect(page.getByRole('button',{name:'Remove regular service',exact:true})).toHaveCount(0);
  await nativeChoose(page,1,'Addis Ababa');await nativeChoose(page,2,'Dire Dawa');expect(await nativeSave(page)).toMatchObject({vehicleId:data.a.vehicleId,expectedDriverId:data.a.driverId});await reopenRoutes();await expect(page.getByRole('button',{name:'Edit regular service',exact:true})).toBeVisible();expect((await data.ownRoute()).route_points_json.map((row:{label:string})=>row.label.split(',')[0])).toEqual(['Addis Ababa','Dire Dawa']);await data.preserved();
  await page.getByRole('button',{name:'Edit regular service',exact:true}).click();await nativeChoose(page,2,'Adama');await page.getByRole('button',{name:'Cancel changes',exact:true}).click();await page.getByRole('button',{name:'Close capacity editor',exact:true}).click();await backToVehicles();
  await openVehicle(data.b.vehicleId);await page.getByRole('button',{name:'Manage usual routes',exact:true}).click();await expect(page.getByRole('button',{name:'Edit regular service',exact:true})).toBeVisible();await page.getByRole('button',{name:'Edit regular service',exact:true}).click();await expect(page.getByText('Route city 1',{exact:true}).locator('..').getByRole('button')).toHaveText(/Adama/);await expect(page.getByText('Route city 2',{exact:true}).locator('..').getByRole('button')).toHaveText(/Addis Ababa/);await page.getByRole('button',{name:'Cancel changes',exact:true}).click();await page.getByRole('button',{name:'Close capacity editor',exact:true}).click();await backToVehicles();
  await openVehicle(data.a.vehicleId);await page.getByRole('button',{name:'Manage usual routes',exact:true}).click();await page.getByRole('button',{name:'Edit regular service',exact:true}).click();await expect(page.getByText('Route city 2',{exact:true}).locator('..').getByRole('button')).toHaveText(/Dire Dawa/);await nativeChoose(page,2,'Adama');await paintedNativePreview(page);await page.getByText('Route city 1',{exact:true}).scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('native-selected-truck-usual-routes-390.png'),scale:'css'});
  expect(await nativeSave(page)).toMatchObject({vehicleId:data.a.vehicleId,expectedDriverId:data.a.driverId});await reopenRoutes();await expect(page.getByRole('button',{name:'Edit regular service',exact:true})).toBeVisible();expect((await data.ownRoute()).route_points_json.map((row:{label:string})=>row.label.split(',')[0])).toEqual(['Addis Ababa','Adama']);await data.preserved();await expect(page.getByRole('button',{name:'Remove regular service',exact:true})).toBeEnabled();await paintedNativePreview(page);await page.getByRole('button',{name:'Edit regular service',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('native-saved-truck-usual-routes-390.png'),scale:'css'});
  await page.getByRole('button',{name:'Remove regular service',exact:true}).click();await expect(page.getByText('Current vehicle availability will stay as published.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Keep service',exact:true}).click();expect(await data.ownRoute()).not.toBeNull();await page.getByRole('button',{name:'Remove regular service',exact:true}).click();await expect(page.getByRole('button',{name:'Remove',exact:true})).toBeEnabled();await paintedNativePreview(page);await page.getByRole('button',{name:'Remove',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('native-confirm-remove-truck-usual-routes-390.png'),scale:'css'});expect(await nativeSave(page,true)).toMatchObject({vehicleId:data.a.vehicleId,expectedDriverId:data.a.driverId});await reopenRoutes();await expect(page.getByRole('button',{name:'Save regular service',exact:true})).toBeVisible();expect(await data.ownRoute()).toBeNull();await data.preserved();await page.screenshot({path:info.outputPath('native-removed-truck-usual-routes-390.png'),scale:'css'});expect(errors).toEqual([]);
 }finally{await data.cleanup();}
});
