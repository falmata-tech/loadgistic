import {test,expect as baseExpect} from './browser-test';
import type {Page,Locator} from 'playwright-core';
import type {TestInfo} from './browser-test';
import type {SupabaseClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {auditFleetProvider,auditFleetDriver,auditDeleteVehicles,auditOpenTrackingProgress,checked,localAuditService} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {createProviderVehicle} from '../../src/lib/fleet.js';
import {addProviderRegularCapacity,publishProviderCapacity,refreshProviderCapacityLocation} from '../../src/lib/provider-capacity.js';
import {createProviderShipment,readProviderTrackingProof,updateProviderShipmentStatus} from '../../src/lib/provider-tracking.js';
import {emailDeliveryStatus} from '../../src/lib/email-provider.js';
import {localFleetPublication} from './provider-publication-helper';

const expect=baseExpect.configure({timeout:20000});
test.use({trace:'off',video:'off',screenshot:'off',actionTimeout:15000,navigationTimeout:30000});
type Owner=Awaited<ReturnType<typeof auditFleetProvider>>;
type Pair={vehicleId:string;driver:Awaited<ReturnType<typeof auditFleetDriver>>};
type Decision='APPROVED'|'RELEASED'|'DISMISSED';
const proofBytes=readFileSync('public/icon-192.png');

// UUID-only ownership survives an interrupted local runner. It contains no
// addresses, recipient digests, OTPs, credentials, messages or private paths.
function fixture(db:SupabaseClient,info:TestInfo){
 let owner:Owner|undefined,publication:ReturnType<typeof localFleetPublication>|undefined;const identities:string[]=[],vehicles:string[]=[],shipments:string[]=[],routes:string[]=[],proofs:{shipmentId:string;objectName:string}[]=[],logouts:Array<()=>Promise<unknown>>=[];
 const manifest=info.outputPath('synthetic-ownership.json');mkdirSync(path.dirname(manifest),{recursive:true});
 function remember(){writeFileSync(manifest,JSON.stringify({organizationId:owner?.organization_id||null,identities,vehicles,shipments,routes,proofObjects:proofs.map(item=>({shipmentId:item.shipmentId,objectId:item.objectName.split('/').at(-1)?.replace('.png','')})),complete:false},null,2)+'\n',{mode:0o600});}
 async function preflight(){
  // The external Playwright worker leaves NODE_ENV unset. Evaluate its loaded
  // local-mail configuration in test mode; do not change either runtime's env.
  expect(emailDeliveryStatus({...process.env,NODE_ENV:'test'}).provider).toBe('mailpit');
  const mailpit=new URL(process.env.LOADGISTIC_LOCAL_MAILPIT_URL||'');expect(['127.0.0.1','localhost']).toContain(mailpit.hostname);expect(mailpit.port).toBe('55324');
  const response=await fetch('http://127.0.0.1:3100/login',{signal:AbortSignal.timeout(15000)});expect(response.ok).toBe(true);await response.body?.cancel();
 }
 async function makeOwner(){owner=await auditFleetProvider(db,'operations-connected');publication=localFleetPublication(db,owner);identities.push(owner.id);remember();return owner;}
 async function staff(operations:boolean){
  const id=checked(await db.auth.admin.createUser({email:`operations-controls-${randomUUID()}@example.test`,email_confirm:true})).user.id;identities.push(id);remember();
  checked(await db.from('profiles').update({role:'SUPPORT',active:true,full_name:'Synthetic Operations reviewer'}).eq('id',id));
  checked(await db.from('support_agent_profiles').insert({user_id:id,active:true,available:false,can_manage_customers:false,can_manage_trust:false,can_manage_billing:false,can_manage_support:false,can_manage_brokerage:false,can_manage_featured:false,can_manage_operations:operations}));return id;
 }
 async function pair(label:string){
  if(!owner)throw Error('SYNTHETIC_OWNER_REQUIRED');
  const truck=await createProviderVehicle(owner,{useBasis:'OWNED',make:'Operations audit',model:label,plate:`OPS-${owner.suffix}-${label}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false});vehicles.push(truck.id);remember();
  const driver=await auditFleetDriver(db,owner,truck.id);identities.push(driver.id);remember();await publication?.publish(truck.id);return {vehicleId:truck.id,driver};
 }
 async function login(page:Page,id:string){logouts.push(await localSupportLogin(page,id));}
 async function proof(shipmentId:string){
  const objectName=`tracking-proof/${shipmentId}/${randomUUID()}.png`;
  checked(await db.storage.from('shipment-proof').upload(objectName,proofBytes,{contentType:'image/png'}));
  proofs.push({shipmentId,objectName});remember();return {path:`supabase://shipment-proof/${objectName}`,originalName:'synthetic-proof.png',mimeType:'image/png'};
 }
 async function cleanup(){
  for(const logout of logouts)await logout();
  // Delete only objects whose exact upload was acknowledged in this fixture.
  for(const proof of proofs){expect(shipments).toContain(proof.shipmentId);expect(proof.objectName).toMatch(new RegExp(`^tracking-proof/${proof.shipmentId}/[a-f0-9-]{36}\\.png$`));checked(await db.storage.from('shipment-proof').remove([proof.objectName]));const remaining:{name:string}[]=checked(await db.storage.from('shipment-proof').list(`tracking-proof/${proof.shipmentId}`));expect(remaining.some(item=>item.name===proof.objectName.split('/').at(-1))).toBe(false);}
  if(shipments.length){
   checked(await db.from('provider_tracking_appeals').delete().in('shipment_id',shipments));
   checked(await db.from('provider_tracking_recoveries').delete().in('shipment_id',shipments));
   checked(await db.from('access_email_deliveries').delete().in('entity_id',shipments));
   checked(await db.from('audit_logs').delete().in('entity_id',shipments));
   checked(await db.from('provider_shipments').delete().in('id',shipments));
   expect(checked(await db.from('provider_shipments').select('id').in('id',shipments))).toEqual([]);
   expect(checked(await db.from('provider_tracking_appeals').select('id').in('shipment_id',shipments))).toEqual([]);
   expect(checked(await db.from('provider_shipment_events').select('id').in('shipment_id',shipments))).toEqual([]);
  }
  if(owner){
   await publication?.cleanup();
   const routeRows:{id:string}[]=checked(await db.from('profile_routes').select('id').eq('organization_id',owner.organization_id));
   const capacityRows:{id:string}[]=vehicles.length?checked(await db.from('capacities').select('id').in('vehicle_id',vehicles)):[];
   const entityIds=[...routes,...routeRows.map(row=>row.id),...vehicles,...capacityRows.map(row=>row.id),...identities,owner.organization_id];
   if(entityIds.length)checked(await db.from('audit_logs').delete().in('entity_id',entityIds));
   checked(await db.from('profile_routes').delete().eq('organization_id',owner.organization_id));
   if(vehicles.length){checked(await db.from('capacities').delete().in('vehicle_id',vehicles));checked(await auditDeleteVehicles(db,'id',vehicles));expect(checked(await db.from('vehicles').select('id').in('id',vehicles))).toEqual([]);expect(checked(await db.from('capacities').select('id').in('vehicle_id',vehicles))).toEqual([]);}
   expect(checked(await db.from('profile_routes').select('id').eq('organization_id',owner.organization_id))).toEqual([]);
  }
  // Permissions may reference an Operations reviewer as updated_by. Remove
  // these exact synthetic child rows before deleting any reviewer identity.
  if(identities.length){checked(await db.from('driver_permissions').delete().in('user_id',identities));expect(checked(await db.from('driver_permissions').select('user_id').in('user_id',identities))).toEqual([]);}
  for(const id of [...identities].reverse()){checked(await db.from('audit_logs').delete().eq('actor_user_id',id));checked(await db.auth.admin.deleteUser(id));expect(checked(await db.from('profiles').select('id').eq('id',id))).toEqual([]);const identity=await db.auth.admin.getUserById(id);expect(identity.data.user).toBeNull();expect(identity.error).not.toBeNull();}
  if(owner){checked(await db.from('organizations').delete().eq('id',owner.organization_id));expect(checked(await db.from('organizations').select('id').eq('id',owner.organization_id))).toEqual([]);}
  writeFileSync(manifest,JSON.stringify({organizationId:owner?.organization_id||null,identities,vehicles,shipments,routes,proofObjectsRemoved:proofs.length,complete:true},null,2)+'\n',{mode:0o600});
 }
 return {preflight,makeOwner,staff,pair,login,proof,cleanup,remember,shipments,routes};
}
function diagnostics(info:TestInfo){
 const file=info.outputPath('operations-diagnostics.json');mkdirSync(path.dirname(file),{recursive:true});let stage='SETUP';
 const evidence:{proofStatus?:number;proofBytesMatch?:boolean}={};
 return {
  phase(value:string){stage=value;writeFileSync(file,JSON.stringify({stage,...evidence},null,2)+'\n');},
  proofStatus(value:number){evidence.proofStatus=value;},
  proofBytesMatch(value:boolean){evidence.proofBytesMatch=value;},
  fail(error:unknown){
   const name=error instanceof Error?error.name:'OTHER',message=error instanceof Error?error.message:'';
   const failureClass=message.includes('strict mode violation')?'MULTIPLE_MATCH':message.includes('toBeVisible')?'VISIBILITY_ASSERTION':message.includes('toHaveValue')?'VALUE_ASSERTION':message.includes('toEqual')?'ROW_STATE_ASSERTION':['Error','TimeoutError','AssertionError','TypeError'].includes(name)?name:'OTHER';
   const failureSite=Number((error instanceof Error?error.stack:'')?.match(/operations-connected-actions\.spec\.ts:(\d+):/)?.[1]||0);
   const knownCode=['TRUCK_NOT_LIVE','PROVIDER_VERIFICATION_REQUIRED','CAPACITY_DRIVER_LOCATION_REQUIRED','TRUCK_DRIVER_CHANGED','INVALID_VEHICLE','INVALID_VEHICLE_USE_BASIS','REGULAR_TRUCK_DRIVER_REQUIRED','TRACKING_DEVICE_LOCATION_REQUIRED','DRIVER_REQUIRED_FOR_CAPACITY'].find(code=>message.includes(code))||null;
   writeFileSync(file,JSON.stringify({stage,failureClass,failureSite,knownCode,...evidence},null,2)+'\n');
   console.log('OPERATIONS_CONTROLS_STAGE '+stage+' '+failureClass+' line '+failureSite+(knownCode?' '+knownCode:''));
   throw Error('OPERATIONS_CONTROLS_FAILED '+stage);
  }
 };
}
async function posted(page:Page,form:Locator,endpoint:string,button:string){
 const pending=page.waitForResponse(response=>new URL(response.url()).pathname===endpoint&&response.request().method()==='POST');
 await form.getByRole('button',{name:button,exact:true}).click();const response=await pending;expect(response.status()).toBe(303);return new URL(response.headers().location,'http://127.0.0.1:3100');
}
async function auditCount(db:SupabaseClient,actor:string,entity:string,action:string){return checked(await db.from('audit_logs').select('id').eq('actor_user_id',actor).eq('entity_id',entity).eq('action',action)).length;}
async function observeProofBlobs(page:Page){
 await page.addInitScript(()=>{
  const blobs=new Map<string,Blob>(),create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
  Object.defineProperty(window,'__loadgisticObservedProofBlobs',{value:blobs,configurable:true});
  // Observe the actual Blob without fetching blob: (connect-src intentionally
  // denies that). Native creation/revocation and app responses stay unchanged.
  URL.createObjectURL=object=>{const url=create(object);if(object instanceof Blob)blobs.set(url,object);return url;};
  URL.revokeObjectURL=url=>{blobs.delete(url);revoke(url);};
 });
}
async function paintedProofBytes(page:Page){
 const image=page.getByRole('img',{name:'Shipment proof photo',exact:true});await expect(image).toBeVisible();
 await expect.poll(()=>image.evaluate(element=>{const image=element as HTMLImageElement;return image.complete&&image.naturalWidth>0;})).toBe(true);
 const bytes=await image.evaluate(async element=>{const image=element as HTMLImageElement,blob=(window as unknown as {__loadgisticObservedProofBlobs:Map<string,Blob>}).__loadgisticObservedProofBlobs?.get(image.src);if(!image.src.startsWith('blob:')||!blob)throw Error('PAINTED_PROOF_BLOB_REQUIRED');return Array.from(new Uint8Array(await blob.arrayBuffer()));});
 return Buffer.from(bytes);
}
async function places(db:SupabaseClient){
 const rows:{id:string;normalized_name:string;name:string}[]=checked(await db.from('place_catalog').select('id,normalized_name,name').in('normalized_name',['addis ababa','adama','dire dawa']));
 const city=(name:string)=>{const row=rows.find(row=>row.normalized_name===name);if(!row)throw Error('SYNTHETIC_PLACES_REQUIRED');return row;};
 return {origin:city('addis ababa'),destination:city('adama'),passing:city('dire dawa')};
}

test('Operations saves Driver permissions, Off Duty and regular-route removal with exact scope and stale-form denial',async({page},info)=>{
 test.setTimeout(180000);const db=localAuditService(),data=fixture(db,info),diag=diagnostics(info),errors:string[]=[],extraPages:Page[]=[];page.on('pageerror',error=>errors.push(error.name));
 try{
  await data.preflight();const owner=await data.makeOwner(),a=await data.pair('First'),b=await data.pair('Other'),operator=await data.staff(true),cities=await places(db);
  const routePlaces=[cities.origin,cities.destination].map(city=>({placeRef:city.id,label:city.name}));
  for(const pair of [a,b]){await refreshProviderCapacityLocation(pair.driver,{vehicleId:pair.vehicleId,approximateLat:9.03,approximateLng:38.74,locationPrecisionKm:20});await publishProviderCapacity(owner,{vehicleId:pair.vehicleId,status:'EMPTY',acceptedLoads:'BOTH',availabilityGeometry:'ROUTE',visibility:'PRIVATE',locationSource:'PRESERVE_DRIVER',currentRoutePlaces:routePlaces});await addProviderRegularCapacity(owner,{vehicleId:pair.vehicleId,expectedDriverId:pair.driver.id,geometry:'ROUTE',routePlaces,areaCenterPlaceRef:'',areaBoundaryPlaces:[]});}
  const capacityA=checked(await db.from('capacities').select('*').eq('vehicle_id',a.vehicleId).eq('market_status','EMPTY').single()),capacityB=checked(await db.from('capacities').select('*').eq('vehicle_id',b.vehicleId).eq('market_status','EMPTY').single());
  const routeA=checked(await db.from('profile_routes').select('*').eq('assigned_vehicle_id',a.vehicleId).single()),routeB=checked(await db.from('profile_routes').select('*').eq('assigned_vehicle_id',b.vehicleId).single());data.routes.push(routeA.id,routeB.id);data.remember();
  const driverB=checked(await db.from('driver_permissions').select('*').eq('user_id',b.driver.id).single()),vehicleA=checked(await db.from('vehicles').select('*').eq('id',a.vehicleId).single());
  diag.phase('PROVIDER_DENIAL');await data.login(page,owner.id);
  for(const [type,id,form] of [['driver_permissions',a.driver.id,{canManageTracking:'on'}],['capacity',capacityA.id,{command:'OFF_DUTY'}],['profile_route',routeA.id,{command:'REMOVE'}]] as const){const response=await page.request.post(`/api/admin/records/${type}/${id}`,{form,maxRedirects:0});expect(response.status()).toBe(303);expect(new URL(response.headers().location,'http://127.0.0.1:3100').searchParams.get('error')).toBe('You do not have permission to perform that action.');}
  expect(checked(await db.from('capacities').select('*').eq('id',capacityA.id).single())).toEqual(capacityA);expect(checked(await db.from('profile_routes').select('*').eq('id',routeA.id).single())).toEqual(routeA);
  diag.phase('DRIVER_PERMISSIONS');await data.login(page,operator);await page.goto(`/admin/operations/drivers/${a.driver.id}`);const permissionForm=page.locator('.admin-record-permissions');await expect(permissionForm).toHaveCount(0);await page.getByRole('button',{name:'Edit permissions',exact:true}).click();await expect(permissionForm).toBeVisible();
  await permissionForm.getByRole('checkbox',{name:'Capacity updates',exact:true}).uncheck();await permissionForm.getByRole('checkbox',{name:'Tracking updates',exact:true}).uncheck();expect((await posted(page,permissionForm,`/api/admin/records/driver_permissions/${a.driver.id}`,'Save permissions')).searchParams.get('success')).toBe('Platform record updated.');await expect(page.getByText('Platform record updated.',{exact:true})).toBeVisible();
  expect(checked(await db.from('driver_permissions').select('can_manage_capacity,can_manage_tracking,updated_by').eq('user_id',a.driver.id).single())).toEqual({can_manage_capacity:false,can_manage_tracking:false,updated_by:operator});expect(checked(await db.from('vehicles').select('*').eq('id',a.vehicleId).single())).toEqual(vehicleA);
  await page.getByRole('button',{name:'Edit permissions',exact:true}).click();await permissionForm.getByRole('checkbox',{name:'Capacity updates',exact:true}).check();await permissionForm.getByRole('checkbox',{name:'Tracking updates',exact:true}).check();await posted(page,permissionForm,`/api/admin/records/driver_permissions/${a.driver.id}`,'Save permissions');await expect(page.getByText('Platform record updated.',{exact:true})).toBeVisible();expect(await auditCount(db,operator,a.driver.id,'DRIVER_PERMISSIONS_UPDATED')).toBe(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.admin-operation-actions').screenshot({path:info.outputPath('saved-driver-permissions.png')});
  diag.phase('CAPACITY_OFF_DUTY');await page.goto(`/admin/operations/capacity/${capacityA.id}`);const offDuty=page.locator(`form[action="/api/admin/records/capacity/${capacityA.id}"]`);await expect(offDuty).toHaveCount(0);await page.getByRole('button',{name:'Set Off Duty',exact:true}).click();await expect(offDuty).toBeVisible();await posted(page,offDuty,`/api/admin/records/capacity/${capacityA.id}`,'Set Off Duty');await expect(page.getByText('Platform record updated.',{exact:true})).toBeVisible();
  expect(checked(await db.from('capacities').select('status,market_status,available_percent,visibility').eq('id',capacityA.id).single())).toEqual({status:'OFF_DUTY',market_status:'OFF_DUTY',available_percent:0,visibility:'PRIVATE'});await expect(page.getByRole('button',{name:'Set Off Duty',exact:true})).toHaveCount(0);expect(await auditCount(db,operator,capacityA.id,'ADMIN_RECORD_MODERATED')).toBe(1);
  diag.phase('ROUTE_REMOVAL');await page.goto(`/admin/operations/routes/${routeA.id}?kind=PROFILE_ROUTE`);const remove=page.locator(`form[action="/api/admin/records/profile_route/${routeA.id}"]`);await expect(remove).toHaveCount(0);await page.getByRole('button',{name:'Remove preferred corridor',exact:true}).click();await expect(remove).toBeVisible();await posted(page,remove,`/api/admin/records/profile_route/${routeA.id}`,'Remove preferred corridor');await expect(page.getByText('Platform record updated.',{exact:true})).toBeVisible();await expect(page).toHaveURL(/\/admin\/operations\?view=ROUTES&success=/);expect(checked(await db.from('profile_routes').select('id').eq('id',routeA.id))).toEqual([]);expect(await auditCount(db,operator,routeA.id,'ADMIN_RECORD_MODERATED')).toBe(1);
  diag.phase('STALE_FORMS');const stalePaths=[`/admin/operations/drivers/${b.driver.id}`,`/admin/operations/capacity/${capacityB.id}`,`/admin/operations/routes/${routeB.id}?kind=PROFILE_ROUTE`];
  for(const [index,url] of stalePaths.entries()){const tab=await page.context().newPage();extraPages.push(tab);await tab.goto(url);await expect(tab.locator('.admin-operation-record-card')).toBeVisible();await tab.getByRole('button',{name:['Edit permissions','Set Off Duty','Remove preferred corridor'][index],exact:true}).click();}
  await extraPages[0].getByRole('checkbox',{name:'Capacity updates',exact:true}).uncheck();
  checked(await db.from('support_agent_profiles').update({can_manage_operations:false}).eq('user_id',operator));
  for(const [index,type,id,button] of [[0,'driver_permissions',b.driver.id,'Save permissions'],[1,'capacity',capacityB.id,'Set Off Duty'],[2,'profile_route',routeB.id,'Remove preferred corridor']] as const){const tab=extraPages[index],form=tab.locator(`form[action="/api/admin/records/${type}/${id}"]`);expect((await posted(tab,form,`/api/admin/records/${type}/${id}`,button)).searchParams.get('error')).toBe('You do not have permission to perform that action.');expect(await auditCount(db,operator,id,type==='driver_permissions'?'DRIVER_PERMISSIONS_UPDATED':'ADMIN_RECORD_MODERATED')).toBe(0);}
  expect(checked(await db.from('driver_permissions').select('*').eq('user_id',b.driver.id).single())).toEqual(driverB);expect(checked(await db.from('capacities').select('*').eq('id',capacityB.id).single())).toEqual(capacityB);expect(checked(await db.from('profile_routes').select('*').eq('id',routeB.id).single())).toEqual(routeB);expect(checked(await db.from('vehicles').select('*').eq('id',a.vehicleId).single())).toEqual(vehicleA);expect(errors).toEqual([]);diag.phase('COMPLETE');
 }catch(error){diag.fail(error);}finally{for(const tab of extraPages)await tab.close().catch(()=>{});try{await data.cleanup();}catch(error){diag.phase('CLEANUP');diag.fail(error);}}
});

test('Operations investigates all three Driver appeal decisions while retaining proofs, history and current authority',async({page},info)=>{
 test.setTimeout(240000);const db=localAuditService(),data=fixture(db,info),diag=diagnostics(info),errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
 try{
  await data.preflight();await observeProofBlobs(page);const owner=await data.makeOwner(),operator=await data.staff(true),fallback=await data.staff(true),cities=await places(db),cases:{shipmentId:string;appealId:string;pair:Pair;decision:Decision;events:unknown[];proofEvents:{id:string;status:string;proof_storage_path:string}[]}[]=[];
  for(const decision of ['APPROVED','RELEASED','DISMISSED'] as const){
   diag.phase('PREPARE_'+decision);const pair=await data.pair(decision);
   const shipment=await createProviderShipment(owner,{expectedDeliveryDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),vehicleId:pair.vehicleId,originPlaceRef:cities.origin.id,destinationPlaceRef:cities.destination.id,passingPlaceRef:cities.passing.id,cargoSummary:'Synthetic Operations handover '+decision,customerEmail:`operations-owner-${randomUUID()}@example.test`,trackingMode:'LOCATION_AND_STATUS'});data.shipments.push(shipment.id);data.remember();
   const location={locationArea:'Around synthetic Addis Ababa',approximateLat:'9.03',approximateLng:'38.74',locationPrecisionKm:'10',locationSource:'DEVICE_OBSCURED'};
   await updateProviderShipmentStatus(pair.driver,shipment.id,'LOADING','Synthetic loading proof',await data.proof(shipment.id));await updateProviderShipmentStatus(pair.driver,shipment.id,'IN_TRANSIT','Synthetic trip',null,location);await updateProviderShipmentStatus(pair.driver,shipment.id,'UNLOADING','Synthetic unloading proof',await data.proof(shipment.id));
   diag.phase('DRIVER_APPEAL_'+decision);await data.login(page,pair.driver.id);await page.goto(`/app/provider-shipments/${shipment.id}`);await auditOpenTrackingProgress(page);const appealForm=page.locator(`form[action="/api/provider-shipments/${shipment.id}/appeal"]`);await expect(appealForm).toBeVisible();await appealForm.getByRole('textbox',{name:'Explain the approval problem',exact:true}).fill('Synthetic driver awaiting the customer unloading decision.');await posted(page,appealForm,`/api/provider-shipments/${shipment.id}/appeal`,'Ask the team to review');await expect(page.getByText('Your appeal is saved. The team can review this shipment and its proof.',{exact:true})).toBeVisible();
   const appeal=checked(await db.from('provider_tracking_appeals').select('id,status,driver_user_id').eq('shipment_id',shipment.id).single());expect(appeal).toMatchObject({status:'OPEN',driver_user_id:pair.driver.id});expect(await auditCount(db,pair.driver.id,shipment.id,'TRACKING_APPEAL_OPENED')).toBe(1);
   const proofEvents=checked(await db.from('provider_shipment_events').select('id,status,proof_storage_path').eq('shipment_id',shipment.id).not('proof_storage_path','is',null).order('id'));expect(proofEvents).toHaveLength(2);
   cases.push({shipmentId:shipment.id,appealId:appeal.id,pair,decision,events:checked(await db.from('provider_shipment_events').select('*').eq('shipment_id',shipment.id).order('id')),proofEvents});
  }
  diag.phase('PROVIDER_APPEAL_DECISION_DENIED');await data.login(page,owner.id);for(const item of cases){const denied=await page.request.post(`/api/admin/tracking-appeals/${item.appealId}`,{form:{decision:item.decision,note:'Provider cannot investigate their own appeal.'},maxRedirects:0});expect(denied.status()).toBe(303);expect(new URL(denied.headers().location,'http://127.0.0.1:3100').searchParams.get('error')).toBe('You do not have permission to perform that action.');expect(await auditCount(db,owner.id,item.shipmentId,'TRACKING_APPEAL_RESOLVED')).toBe(0);}
  for(const [index,item] of cases.entries()){
   const untouched=cases.filter(other=>other!==item),before=await Promise.all(untouched.map(async other=>({shipment:checked(await db.from('provider_shipments').select('*').eq('id',other.shipmentId).single()),appeal:checked(await db.from('provider_tracking_appeals').select('*').eq('id',other.appealId).single())})));
   diag.phase('STAFF_'+item.decision);await data.login(page,operator);await page.goto(`/admin/operations/tracking/${item.shipmentId}`);let form=page.locator(`form[action="/api/admin/tracking-appeals/${item.appealId}"]`);await expect(form).toHaveCount(0);await expect(page.getByRole('button',{name:'Review appeal',exact:true})).toBeVisible();
   diag.phase('PROOF_LOOKUP_'+item.decision);const loadingProof=item.proofEvents.find(event=>event.status==='LOADING');expect(loadingProof).toBeTruthy();const endpoint=`/api/provider-shipments/${item.shipmentId}/proofs/${loadingProof!.id}`;const proofResponse=page.waitForResponse(response=>new URL(response.url()).pathname===endpoint);const timeline=page.locator('.admin-operation-timeline li').filter({has:page.getByText('Loading',{exact:true})});await timeline.getByRole('button',{name:'Open proof',exact:true}).click();const opened=await proofResponse;diag.proofStatus(opened.status());diag.phase('PROOF_RESPONSE_'+item.decision);expect(opened.status()).toBe(200);
   // React development effects can cancel the first response after its headers.
   // Verify the actual painted blob and an authorized served payload instead.
   const proofBytesMatch=(await paintedProofBytes(page)).equals(proofBytes);diag.proofBytesMatch(proofBytesMatch);diag.phase('PROOF_BYTES_'+item.decision);expect(proofBytesMatch).toBe(true);const served=await page.request.get(endpoint);expect(served.status()).toBe(200);expect(Buffer.from(await served.body()).equals(proofBytes)).toBe(true);await page.getByRole('button',{name:'Close proof',exact:true}).click();await page.getByRole('button',{name:'Review appeal',exact:true}).click();await expect(form).toBeVisible();
   diag.phase('STAFF_FORM_'+item.decision);
   await form.getByLabel('Investigation note',{exact:true}).fill('Synthetic investigation confirmed proof and customer contact.');await form.getByRole('combobox',{name:'Decision',exact:true}).selectOption(item.decision);
   let resolvingActor=operator;
   if(index===2){
    diag.phase('STALE_APPEAL_DENIAL');checked(await db.from('support_agent_profiles').update({can_manage_operations:false}).eq('user_id',operator));const appealBefore=checked(await db.from('provider_tracking_appeals').select('*').eq('id',item.appealId).single()),shipmentBefore=checked(await db.from('provider_shipments').select('*').eq('id',item.shipmentId).single());
    expect((await posted(page,form,`/api/admin/tracking-appeals/${item.appealId}`,'Save decision')).searchParams.get('error')).toBe('You do not have permission to perform that action.');expect(checked(await db.from('provider_tracking_appeals').select('*').eq('id',item.appealId).single())).toEqual(appealBefore);expect(checked(await db.from('provider_shipments').select('*').eq('id',item.shipmentId).single())).toEqual(shipmentBefore);expect(await auditCount(db,operator,item.shipmentId,'TRACKING_APPEAL_RESOLVED')).toBe(0);
    resolvingActor=fallback;await data.login(page,fallback);await page.goto(`/admin/operations/tracking/${item.shipmentId}`);form=page.locator(`form[action="/api/admin/tracking-appeals/${item.appealId}"]`);await expect(form).toHaveCount(0);await page.getByRole('button',{name:'Review appeal',exact:true}).click();await expect(form).toBeVisible();await form.getByLabel('Investigation note',{exact:true}).fill('Synthetic investigation confirmed proof and customer contact.');await form.getByRole('combobox',{name:'Decision',exact:true}).selectOption(item.decision);
   }
   diag.phase('SAVE_'+item.decision);await posted(page,form,`/api/admin/tracking-appeals/${item.appealId}`,'Save decision');await expect(page.getByText('The appeal decision is saved.',{exact:true})).toBeVisible();
   const appeal=checked(await db.from('provider_tracking_appeals').select('status,resolved_by,resolved_at,resolution_note').eq('id',item.appealId).single());expect(appeal).toMatchObject({status:item.decision,resolved_by:resolvingActor,resolution_note:'Synthetic investigation confirmed proof and customer contact.'});expect(appeal.resolved_at).toBeTruthy();expect(await auditCount(db,resolvingActor,item.shipmentId,'TRACKING_APPEAL_RESOLVED')).toBe(1);
   const shipment=checked(await db.from('provider_shipments').select('operational_status,handover_approved_at,handover_approval_kind').eq('id',item.shipmentId).single());expect(shipment.operational_status).toBe(item.decision==='APPROVED'?'COMPLETED':item.decision==='RELEASED'?'CANCELLED':'UNLOADING');expect(shipment.handover_approval_kind).toBe(item.decision==='APPROVED'?'STAFF':null);expect(Boolean(shipment.handover_approved_at)).toBe(item.decision==='APPROVED');
   const recipients=checked(await db.from('provider_tracking_recipients').select('revoked_at').eq('shipment_id',item.shipmentId));expect(recipients).toHaveLength(1);expect(recipients.every((row:{revoked_at:string|null})=>Boolean(row.revoked_at))).toBe(item.decision==='RELEASED');
   expect(checked(await db.from('provider_shipment_events').select('id,status,proof_storage_path').eq('shipment_id',item.shipmentId).not('proof_storage_path','is',null).order('id'))).toEqual(item.proofEvents);const currentEvents=checked(await db.from('provider_shipment_events').select('*').eq('shipment_id',item.shipmentId).order('id'));for(const event of item.events)expect(currentEvents).toContainEqual(event);
   expect(checked(await db.from('email_deliveries').select('id').eq('shipment_id',item.shipmentId).eq('delivery_kind','COMPLETION'))).toHaveLength(item.decision==='APPROVED'?1:0);
   diag.phase('REPLAY_'+item.decision);const replay=await page.request.post(`/api/admin/tracking-appeals/${item.appealId}`,{form:{decision:item.decision,note:'A terminal decision cannot be saved twice.'},maxRedirects:0});expect(replay.status()).toBe(303);expect(new URL(replay.headers().location,'http://127.0.0.1:3100').searchParams.get('error')).toBe('This appeal has already been resolved. Refresh its history.');expect(await auditCount(db,resolvingActor,item.shipmentId,'TRACKING_APPEAL_RESOLVED')).toBe(1);
   await page.goto(`/admin/operations/tracking/${item.shipmentId}`);const appealSection=page.locator('section.card').filter({has:page.getByRole('heading',{name:'Unloading appeals',exact:true})});await expect(appealSection).toContainText('Synthetic investigation confirmed proof and customer contact.');await expect(appealSection.getByRole('button',{name:'Save decision',exact:true})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await appealSection.screenshot({path:info.outputPath('saved-appeal-'+item.decision.toLowerCase()+'.png')});
   for(const [otherIndex,other] of untouched.entries()){expect(checked(await db.from('provider_shipments').select('*').eq('id',other.shipmentId).single())).toEqual(before[otherIndex].shipment);expect(checked(await db.from('provider_tracking_appeals').select('*').eq('id',other.appealId).single())).toEqual(before[otherIndex].appeal);}
  }
  expect(errors).toEqual([]);diag.phase('COMPLETE');
 }catch(error){diag.fail(error);}finally{try{await data.cleanup();}catch(error){diag.phase('CLEANUP');diag.fail(error);}}
});

// One bounded diagnosis separates acknowledged Storage bytes, the server adapter
// and browser decoding. Every retained value is a count, boolean or static MIME.
test('Operations single-proof boundary preserves acknowledged bytes',async({page},info)=>{
 test.setTimeout(120000);const db=localAuditService(),data=fixture(db,info),diag=diagnostics(info);
 const report:Record<string,string|number|boolean>={stage:'SETUP',sourceLength:proofBytes.length,sourceIsBuffer:Buffer.isBuffer(proofBytes)};
 const file=info.outputPath('proof-boundary.json');mkdirSync(path.dirname(file),{recursive:true});
 const save=()=>writeFileSync(file,JSON.stringify(report,null,2)+'\n');
 const mime=(value:string|undefined)=>['image/png','image/jpeg','image/webp','application/json','text/html'].includes((value||'').split(';')[0])?(value||'').split(';')[0]:'OTHER';
 try{
  await data.preflight();await observeProofBlobs(page);const owner=await data.makeOwner(),pair=await data.pair('Proof'),operator=await data.staff(true),cities=await places(db);
  const shipment=await createProviderShipment(owner,{expectedDeliveryDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),vehicleId:pair.vehicleId,originPlaceRef:cities.origin.id,destinationPlaceRef:cities.destination.id,passingPlaceRef:cities.passing.id,cargoSummary:'Synthetic single proof boundary',customerEmail:`operations-proof-${randomUUID()}@example.test`,trackingMode:'STATUS_ONLY'});data.shipments.push(shipment.id);data.remember();
  const proof=await data.proof(shipment.id),objectName=proof.path.slice('supabase://shipment-proof/'.length);report.uploadAcknowledged=true;
  const stored=checked(await db.storage.from('shipment-proof').download(objectName));const storedBytes=Buffer.from(await stored.arrayBuffer());report.storageLength=storedBytes.length;report.storageBytesMatch=storedBytes.equals(proofBytes);report.stage='STORAGE';save();
  await updateProviderShipmentStatus(pair.driver,shipment.id,'LOADING','Synthetic single proof',proof);
  const event=checked(await db.from('provider_shipment_events').select('id,proof_storage_path,proof_mime_type').eq('shipment_id',shipment.id).eq('status','LOADING').single());report.pathOwnershipMatches=event.proof_storage_path===proof.path;report.recordMime=mime(event.proof_mime_type);report.stage='STORED_EVENT';save();
  const adapter=await readProviderTrackingProof({id:operator,role:'SUPPORT'},shipment.id,event.id);report.adapterPresent=Boolean(adapter);report.adapterLength=adapter?.bytes?.length||0;report.adapterBytesMatch=Boolean(adapter&&Buffer.from(adapter.bytes).equals(proofBytes));report.adapterMime=mime(adapter?.mimeType);report.stage='ADAPTER';save();
  await data.login(page,operator);await page.goto(`/admin/operations/tracking/${shipment.id}`);const endpoint=`/api/provider-shipments/${shipment.id}/proofs/${event.id}`;
  let browserResponses=0,abortedRequests=0,matchingBodies=0,emptyBodies=0,unavailableBodies=0;const bodyReads:Promise<void>[]=[];
  const responses=(response:import('playwright-core').Response)=>{if(new URL(response.url()).pathname!==endpoint)return;browserResponses++;bodyReads.push((async()=>{try{const body=await response.body();if(!body.length)emptyBodies++;if(Buffer.from(body).equals(proofBytes))matchingBodies++;}catch{unavailableBodies++;}})());};
  const failures=(request:import('playwright-core').Request)=>{if(new URL(request.url()).pathname===endpoint&&/abort|cancel/i.test(request.failure()?.errorText||''))abortedRequests++;};page.on('response',responses);page.on('requestfailed',failures);
  const responsePromise=page.waitForResponse(response=>new URL(response.url()).pathname===endpoint);await page.locator('.admin-operation-timeline').getByRole('button',{name:'Open proof',exact:true}).click();const response=await responsePromise,body=await response.body();report.browserStatus=response.status();report.browserMime=mime(response.headers()['content-type']);report.browserLength=body.length;report.browserBytesMatch=Buffer.from(body).equals(proofBytes);report.stage='BROWSER';save();
  const painted=await paintedProofBytes(page);report.paintedLength=painted.length;report.paintedBytesMatch=painted.equals(proofBytes);await Promise.allSettled(bodyReads);page.off('response',responses);page.off('requestfailed',failures);report.browserResponses=browserResponses;report.abortedRequests=abortedRequests;report.matchingResponseBodies=matchingBodies;report.emptyResponseBodies=emptyBodies;report.unavailableResponseBodies=unavailableBodies;report.stage='PAINTED';save();
  const api=await page.request.get(endpoint),apiBytes=await api.body();report.apiStatus=api.status();report.apiMime=mime(api.headers()['content-type']);report.apiLength=apiBytes.length;report.apiBytesMatch=Buffer.from(apiBytes).equals(proofBytes);report.stage='API';save();
  expect(report.storageBytesMatch).toBe(true);expect(report.pathOwnershipMatches).toBe(true);expect(report.adapterBytesMatch).toBe(true);expect(report.browserStatus).toBe(200);expect(report.paintedBytesMatch).toBe(true);expect(report.apiStatus).toBe(200);expect(report.apiBytesMatch).toBe(true);await page.getByRole('button',{name:'Close proof',exact:true}).click();report.stage='COMPLETE';save();diag.phase('COMPLETE');
 }catch(error){diag.fail(error);}finally{try{await data.cleanup();}catch(error){diag.phase('CLEANUP');diag.fail(error);}}
});
