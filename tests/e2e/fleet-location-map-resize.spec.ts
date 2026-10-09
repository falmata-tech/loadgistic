import {auditDeleteVehicles} from './audit-helpers';
import {test,expect} from '@playwright/test';
import {auditLogin,auditProvider,localAuditService,checked} from './audit-helpers';

test('truck location remains in view after owner map container resizes',async({page,context}:{page:any;context:any},info:any)=>{
 test.setTimeout(90000);
 await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:9.03,longitude:38.76});
 const service=localAuditService(),actor=await auditProvider(service,'map-resize');let vehicleId='';
 try{
 const created=checked(await service.rpc('create_provider_vehicle',{actor_user_id:actor.id,command:{use_basis:'OWNED',make:'Resize test',model:'Mini',plate:`RESIZE-${actor.suffix}`,cargo_configuration:'Mini Box Truck'}}));vehicleId=created.id;
 checked(await service.rpc('refresh_provider_capacity_location',{actor_user_id:actor.id,command:{vehicle_id:vehicleId,approximate_lat:9.03,approximate_lng:38.76,location_precision_km:40}}));
 await auditLogin(page,actor.email);await page.goto(`/app/fleet/${vehicleId}`);
 await page.getByRole('button',{name:'Edit current capacity: Not set',exact:true}).click();
 const firstCapacity=page.getByRole('dialog',{name:'Current capacity',exact:true});
 await firstCapacity.getByRole('button',{name:'Capacity route',exact:true}).click();
 for(const [label,name] of [['City 1','Addis Ababa'],['City 2','Sebeta']]){
  await firstCapacity.getByRole('combobox',{name:label,exact:true}).fill(name);
  await firstCapacity.getByRole('option',{name:new RegExp(`^${name}, Ethiopia`)}).first().click();
 }
 const saved=page.waitForResponse((response:any)=>response.url().endsWith('/api/capacity')&&response.request().method()==='POST');
 await firstCapacity.getByRole('button',{name:'Save',exact:true}).click();expect(await (await saved).json()).toMatchObject({ok:true});
 await expect(firstCapacity).toHaveCount(0);await expect(page.getByRole('button',{name:'Edit current capacity: Empty',exact:true})).toBeEnabled({timeout:15000});
 const map=page.getByTestId('capacity-summary').locator('.leaflet-container');await expect(map).toBeVisible();
 const marker=map.locator('.capacity-setting-truck-marker');await expect(marker).toBeVisible();
 async function inView(){
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))));
  await expect.poll(async()=>{const host=await map.boundingBox(),point=await marker.boundingBox();return Boolean(host&&point&&point.x>=host.x&&point.x+point.width<=host.x+host.width&&point.y>=host.y&&point.y+point.height<=host.y+host.height);},{timeout:10000}).toBe(true);
 }
 await inView();
 const original=page.viewportSize()!;
 await page.setViewportSize({width:1000,height:800});await inView();
 await page.setViewportSize({width:320,height:700});await inView();
 await page.setViewportSize({width:1200,height:800});await inView();
 // Layout-only resize: no browser resize event to repair Leaflet's cached size.
 await page.locator('.fleet-truck-capacity-workspace').evaluate((host:HTMLElement)=>{host.style.width='320px';});
 await inView();
 await page.locator('.fleet-truck-capacity-workspace').evaluate((host:HTMLElement)=>host.style.removeProperty('width'));
 await page.setViewportSize(original);await inView();
 await map.screenshot({path:info.outputPath('truck-location-after-resize.png')});
 // Opening a dialog must preserve the existing view, including the chosen zoom.
 const relative=async()=>{const point=(await marker.boundingBox())!,host=(await map.boundingBox())!;return {x:point.x-host.x,y:point.y-host.y};};
 const before=await relative();
 await page.getByRole('button',{name:/^Edit current capacity:/}).click();
 const dialog=page.getByRole('dialog',{name:'Current capacity',exact:true});await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).toHaveCount(0);
 await inView();const after=await relative();expect(Math.abs(after!.x-before!.x)).toBeLessThan(2);expect(Math.abs(after!.y-before!.y)).toBeLessThan(2);
 }finally{
  checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));
  if(vehicleId){checked(await service.from('capacities').delete().eq('vehicle_id',vehicleId));checked(await auditDeleteVehicles(service,'id',vehicleId));}
  checked(await service.auth.admin.deleteUser(actor.id));
 }

});
