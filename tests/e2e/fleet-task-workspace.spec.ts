import {mkdirSync,readFileSync,writeFileSync,chmodSync} from 'node:fs';
import path from 'node:path';
import {test,expect as browserExpect} from './browser-test';
import {localAuditService} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {assertDemoIdentity} from '../../scripts/telematics/demo-manifest.mjs';

const expect=browserExpect.configure({timeout:30000});
test.use({trace:'off',video:'off',screenshot:'off',actionTimeout:30000,navigationTimeout:30000});
test('provider Fleet separates saved trucks, drivers and devices and opens only deliberate editors',async({browser},info)=>{
 test.skip(process.env.LOADGISTIC_TASK_FLEET_REVIEW!=='1','Opt in only for the existing guarded local demo.');
 test.skip(info.project.name!=='desktop-chromium','One serial session checks desktop and phone sizes.');
 test.setTimeout(240000);
 const db=localAuditService(),manifest=JSON.parse(readFileSync('.local/telematics/application-demo-manifest.json','utf8')) as {purpose:string;targets:Array<{ownerId:string;vehicleId:string;deviceId:string}>};
 if(manifest.purpose!=='local-fictional-gps'||manifest.targets.length!==2)throw Error('LOCAL_DEMO_REQUIRED');
 const target=manifest.targets[0],identity=await db.auth.admin.getUserById(target.ownerId);
 if(identity.error||!identity.data.user)throw Error('LOCAL_OWNER_REQUIRED');
 assertDemoIdentity(identity.data.user,'user-transporter');
 const directory=path.resolve(process.env.LOADGISTIC_TASK_FLEET_REVIEW_DIR||'.local/dashboard-task-fleet-20261015');mkdirSync(directory,{recursive:true,mode:0o700});
 const proof={stage:'START',complete:false,pageErrors:0,domainPosts:[] as string[],deviceStatuses:[] as number[],deviceRead:{rpcMs:0,apiMs:0,status:0},captures:[] as string[],viewportFits:[] as boolean[],trucksReadFirst:false,driversReadFirst:false,assignmentDismissed:false,devicesReadFirst:false,sourceDismissed:false,truckDetailsReadFirst:false,documentsReadFirst:false,failure:null as null|{kind:string;path:string;line:number;headings:number}};
 const checkpoint=(stage:string)=>{proof.stage=stage;writeFileSync(path.join(directory,'evidence.json'),JSON.stringify(proof,null,2),{mode:0o600});};
 const context=await browser.newContext({baseURL:'http://127.0.0.1:3100',viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.on('pageerror',()=>proof.pageErrors++);page.on('request',request=>{const url=new URL(request.url());if(request.method()==='POST'&&url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/api/auth/'))proof.domainPosts.push(url.pathname);});
 page.on('response',response=>{if(new URL(response.url()).pathname==='/api/fleet/devices')proof.deviceStatuses.push(response.status());});
 const logout=await localSupportLogin(page,identity.data.user.id);
 async function capture(name:string){
  // A visible heading does not prove that lazy Next images have finished loading.
  // Keep the normal image pipeline and capture only decoded configuration art.
  const images=page.locator('.app-main .page img[src*="vehicle-configurations"]');
  await expect.poll(()=>images.evaluateAll(nodes=>nodes.every(node=>{const image=node as HTMLImageElement;return image.complete&&image.naturalWidth>0;})),{timeout:20000}).toBe(true);
  await images.evaluateAll(nodes=>Promise.all(nodes.map(node=>(node as HTMLImageElement).decode())));
  const file=path.join(directory,name);await page.screenshot({path:file,fullPage:true});chmodSync(file,0o600);proof.captures.push(name);proof.viewportFits.push(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checkpoint(proof.stage);
 }
 const fleetNav=()=>page.getByRole('navigation',{name:'Manage vehicles',exact:true});
 try{
  checkpoint('DEVICE_READ');let started=Date.now();const projection=await db.rpc('telematics_workspace',{actor_user_id:identity.data.user.id,requested_page:1});proof.deviceRead.rpcMs=Date.now()-started;if(projection.error)throw Error('LOCAL_DEVICE_RPC_FAILED');
  const targetDevice=projection.data?.devices?.find((item:{id:string})=>item.id===target.deviceId);expect(targetDevice).toBeTruthy();
  started=Date.now();const deviceRead=await page.request.get('/api/fleet/devices',{timeout:30000});proof.deviceRead.apiMs=Date.now()-started;proof.deviceRead.status=deviceRead.status();expect(deviceRead.status()).toBe(200);checkpoint('DEVICE_READ_READY');
  checkpoint('TRUCK_LIST');await page.goto('/app/fleet');await expect(page).toHaveURL(/\/app\/home\/vehicles/);await expect(fleetNav()).toBeVisible();
  await expect(page.getByRole('link',{name:'Add vehicle',exact:true})).toHaveCount(1);await expect(page.getByRole('link',{name:'Add driver',exact:true})).toHaveCount(0);await expect(page.locator('.app-main .page select,.app-main .page textarea')).toHaveCount(0);proof.trucksReadFirst=true;
  await capture('fleet-trucks-desktop.png');await page.setViewportSize({width:390,height:844});await capture('fleet-trucks-phone.png');
  checkpoint('DRIVER_LIST');await fleetNav().getByRole('link',{name:/^Drivers/}).click();await expect(page.getByRole('link',{name:'Add driver',exact:true})).toHaveCount(1);await expect(page.getByRole('link',{name:'Add vehicle',exact:true})).toHaveCount(0);await expect(page.locator('.app-main .page select,.app-main .page textarea')).toHaveCount(0);proof.driversReadFirst=true;await capture('fleet-drivers-phone.png');
  await page.getByRole('link',{name:'Manage',exact:true}).first().click();await expect(page.getByRole('button',{name:'Edit assignment',exact:true})).toBeVisible();await expect(page.locator('.app-main .page select,.app-main .page textarea')).toHaveCount(0);
  await page.getByRole('button',{name:'Edit assignment',exact:true}).click();const assignment=page.getByRole('dialog',{name:'Assigned vehicle',exact:true});await expect(assignment.getByLabel('Vehicle',{exact:true})).toBeVisible();await capture('fleet-assignment-editor-phone.png');await assignment.getByRole('button',{name:'Cancel',exact:true}).click();await expect(assignment).toHaveCount(0);proof.assignmentDismissed=true;await capture('fleet-driver-detail-phone.png');
  checkpoint('DEVICE_LIST');await fleetNav().getByRole('link',{name:'GPS devices',exact:true}).click();await expect(page).toHaveURL(/\/app\/home\/vehicles\?view=devices/);await expect(page.getByRole('region',{name:'GPS devices'})).toBeVisible();
  const targetDeviceRow=page.getByRole('region',{name:'GPS devices'}).locator('article').filter({hasText:targetDevice.label});
  try{await expect(targetDeviceRow.getByRole('button',{name:'View device',exact:true})).toBeVisible({timeout:30000});}
  catch(error){await page.screenshot({path:path.join(directory,'fleet-devices-failed.png'),fullPage:true});throw error;}
  await expect(page.locator('.app-main .page select,.app-main .page textarea')).toHaveCount(0);proof.devicesReadFirst=true;await capture('fleet-devices-phone.png');
  await targetDeviceRow.getByRole('button',{name:'View device',exact:true}).click();await expect(page.getByRole('button',{name:'Edit location source',exact:true})).toBeVisible();await expect(page.locator('.app-main .page select,.app-main .page textarea')).toHaveCount(0);await capture('fleet-device-summary-phone.png');
  await page.getByRole('button',{name:'Change assignment',exact:true}).click();const gpsAssignment=page.getByRole('dialog',{name:'Assigned vehicle',exact:true});await expect(gpsAssignment.getByLabel('Assigned vehicle',{exact:true})).toBeVisible();await gpsAssignment.getByRole('button',{name:'Cancel',exact:true}).click();await expect(gpsAssignment).toHaveCount(0);
  await page.getByRole('button',{name:'Edit location source',exact:true}).click();const source=page.getByRole('dialog',{name:'Location source',exact:true});await expect(source.getByRole('radio',{name:'GPS device',exact:true})).toBeChecked();await source.getByRole('radio',{name:'Manually entered',exact:true}).check();await source.getByRole('button',{name:'Cancel',exact:true}).click();await expect(source).toHaveCount(0);proof.sourceDismissed=true;
  await page.getByRole('button',{name:'Device commands',exact:true}).click();await expect(page.getByRole('button',{name:'Request location',exact:true})).toBeVisible();await capture('fleet-device-commands-phone.png');
  checkpoint('TRUCK_TASKS');await page.goto('/app/fleet/'+target.vehicleId,{waitUntil:'domcontentloaded'});const summary=page.getByTestId('capacity-summary');await expect(summary).toBeVisible();
  const rail=page.getByRole('navigation',{name:'Edit capacity signals',exact:true});await expect(rail.locator('button,a')).toHaveCount(4);await expect(rail.getByRole('button',{name:/^Edit current coverage:/})).toHaveCount(0);await expect(rail.getByRole('button',{name:/^Edit load preferences:/})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Move to draft',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'Manage driver',exact:true})).toHaveCount(0);
  await capture('fleet-truck-signals-phone.png');
  const expectMapControlsSeparate=async()=>{const actionBounds=await rail.boundingBox(),locationBounds=await page.locator('.capacity-location-dock').boundingBox();expect(actionBounds).not.toBeNull();expect(locationBounds).not.toBeNull();const overlapsX=actionBounds!.x<locationBounds!.x+locationBounds!.width&&actionBounds!.x+actionBounds!.width>locationBounds!.x;const overlapsY=actionBounds!.y<locationBounds!.y+locationBounds!.height&&actionBounds!.y+actionBounds!.height>locationBounds!.y;expect(overlapsX&&overlapsY).toBe(false);};
  await expectMapControlsSeparate();
  await rail.getByRole('button',{name:/^Edit current capacity:/}).click();const capacityDialog=page.getByRole('dialog',{name:'Capacity',exact:true});await expect(capacityDialog.getByRole('button',{name:'Empty',exact:true})).toBeVisible();await expect(capacityDialog.getByRole('button',{name:'Service area',exact:true})).toBeVisible();await expect(capacityDialog.getByRole('button',{name:'Capacity route',exact:true})).toBeVisible();await capacityDialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(summary.locator('.leaflet-container')).toBeVisible();
  await page.setViewportSize({width:320,height:640});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(rail.locator('button,a')).toHaveCount(4);await expectMapControlsSeparate();await capture('fleet-truck-signals-narrow-phone.png');
  await page.setViewportSize({width:1440,height:1000});await capture('fleet-truck-signals-desktop.png');await page.setViewportSize({width:390,height:844});
  await page.getByRole('link',{name:'Vehicle details',exact:true}).click();await expect(page.getByRole('button',{name:'Edit vehicle details',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Move to draft',exact:true})).toBeVisible();await expect(page.locator('.app-main .page input:not([type=hidden]),.app-main .page select,.app-main .page textarea')).toHaveCount(0);proof.truckDetailsReadFirst=true;await capture('fleet-truck-details-phone.png');
  await page.getByRole('button',{name:'Edit vehicle details',exact:true}).click();const details=page.getByRole('dialog',{name:'Edit vehicle details',exact:true});await expect(details.getByLabel('Make',{exact:true})).toBeVisible();await details.getByRole('button',{name:'Cancel',exact:true}).click();await expect(details).toHaveCount(0);
  await page.getByRole('link',{name:'Documents',exact:true}).click();await expect(page.getByRole('heading',{name:'Reviewed documents',exact:true})).toBeVisible();await expect(page.locator('.app-main .page input[type=file]')).toHaveCount(0);proof.documentsReadFirst=true;await capture('fleet-truck-documents-phone.png');
  expect(proof.domainPosts).toEqual([]);expect(proof.pageErrors).toBe(0);expect(proof.viewportFits.every(Boolean)).toBe(true);proof.complete=true;checkpoint('COMPLETE');
 }catch(error){const message=error instanceof Error?error.message:'';proof.failure={kind:message.match(/ERR_[A-Z_]+|strict mode violation|toBeVisible|toHaveCount|toEqual|toBe/)?.[0]||'BOUNDED_FAILURE',path:new URL(page.url()).pathname,line:Number((error instanceof Error?error.stack||'':'').match(/fleet-task-workspace\.spec\.ts:(\d+)/)?.[1]||0),headings:await page.getByRole('heading').count()};await capture('failure.png').catch(()=>{});checkpoint(proof.stage);throw Error('FLEET_TASK_REVIEW_FAILED_'+proof.stage+'_'+proof.failure.kind);}
 finally{await logout();await context.close();checkpoint(proof.stage);}
});
