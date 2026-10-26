import {test,expect} from './browser-test';
import type {Page} from 'playwright-core';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {auditFleetProvider,auditDeleteVehicles,checked,localAuditService} from './audit-helpers';
import {localMailpitNumericCode} from './mailpit-helper';
import {addFleetDriver,inviteFleetDriver} from '../../src/lib/fleet-driver-management';
import {createProviderVehicle,updateFleetDriverAccess} from '../../src/lib/fleet.js';
import {setProviderVehiclePublication} from '../../src/lib/provider-authority.js';
import {createProviderShipment} from '../../src/lib/provider-tracking.js';

test.use({trace:'off',screenshot:'off'});
const preview='http://localhost:8084';
function removeLocalBrokerFixture(workspaceId:string,connectionId:string){
 if(!/^http:\/\/127\.0\.0\.1:55321$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL||''))throw Error('LOCAL_BROKER_CLEANUP_REQUIRED');
 for(const id of [workspaceId,connectionId])if(id&&!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(id))throw Error('INVALID_BROKER_FIXTURE_ID');
 const sql=`begin;
 delete from public.audit_logs where entity_id in(select id from public.account_capacity_grants where connection_id=nullif('${connectionId}','')::uuid);
 delete from public.account_capacity_grants where connection_id=nullif('${connectionId}','')::uuid;
 delete from public.account_connections where id=nullif('${connectionId}','')::uuid;
 delete from public.business_workspace_selections where workspace_id='${workspaceId}'::uuid;
 delete from public.business_workspace_audit where workspace_id='${workspaceId}'::uuid;
 delete from public.business_workspace_invitations where workspace_id='${workspaceId}'::uuid;
 delete from public.business_workspace_members where workspace_id='${workspaceId}'::uuid;
 delete from public.business_workspaces where id='${workspaceId}'::uuid and name='Synthetic broker desk';
 commit;`;
 execFileSync('docker',['exec','supabase_db_loadgistic-local','psql','-X','-q','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-c',sql],{timeout:12000,stdio:'pipe'});
}
async function removeSyntheticUser(db:ReturnType<typeof localAuditService>,id:string){
 let result=await db.auth.admin.deleteUser(id);
 if(result.error?.name==='AuthRetryableFetchError')result=await db.auth.admin.deleteUser(id);
 checked(result);
}
async function openWorkspacePage(page:Page,path:string,apiPath:string){
 const loaded=page.waitForResponse(response=>response.request().method()==='GET'&&new URL(response.url()).pathname===apiPath);
 await page.goto(preview+path,{waitUntil:'domcontentloaded'});expect((await loaded).status()).toBe(200);
}
async function login(page:Page,email:string){
 await page.goto(preview+'/account');await page.getByLabel('Email',{exact:true}).fill(email);
 const since=Date.now();await page.getByRole('button',{name:'Send code',exact:true}).click();
 await expect(page.getByLabel('Sign-in code',{exact:true})).toBeVisible({timeout:30_000});
 await page.getByLabel('Sign-in code',{exact:true}).fill(await localMailpitNumericCode(email,since,['Your Loadgistic sign-in code','Your Loadgistic signup code']));
 await page.getByRole('button',{name:'Sign in',exact:true}).last().click();await expect(page.getByRole('tab',{name:'Manage vehicles',exact:true})).toBeVisible({timeout:30_000});
}

test('Expo confirmations cancel safely and persist fleet, sharing and Tracking changes',async({page,context},info)=>{
 test.skip(info.project.name!=='mobile-chromium','Actual Expo phone preview; installed Android remains separate.');
 test.setTimeout(180_000);await context.setExtraHTTPHeaders({'x-forwarded-for':'127.0.0.229'});
 const db=localAuditService(),nonce=randomUUID(),actor=await auditFleetProvider(db,'native-confirm');
 const owned={ownerId:actor.id,organizationId:actor.organization_id,driverId:'',vehicleId:'',invitationId:'',shipmentId:'',grantId:'',brokerId:'',brokerWorkspaceId:'',connectionId:''};
 const mutations:string[]=[],errors:string[]=[],checks:Record<string,boolean>={};let stage='SETUP',cleanup=false,primaryError:unknown=null,cleanupError:unknown=null;
 const evidence=()=>writeFileSync(info.outputPath('confirmation-evidence.json'),JSON.stringify({stage,checks,cleanup,pageErrors:errors.length,hostedChanges:false},null,2)+'\n',{mode:0o600});
 const manifest=()=>writeFileSync(info.outputPath('confirmation-owned-fixtures.json'),JSON.stringify(owned,null,2)+'\n',{mode:0o600});manifest();
 page.on('pageerror',error=>errors.push(error.name));
 page.on('request',request=>{if(request.method()!=='POST')return;const path=new URL(request.url()).pathname;
  if(!['/api/mobile/fleet','/api/mobile/network','/api/account-vehicle-shares'].includes(path)&&!path.startsWith('/api/mobile/shipments/'))return;
  const body=request.postDataJSON();if(body&&typeof body==='object'&&typeof body.action==='string')mutations.push(body.action);
 });
 async function decide(trigger:()=>Promise<void>,title:string,cancel:string,confirm:string,read:()=>Promise<boolean>,action:string){
  const before=mutations.length,dialog=page.getByTestId('action-confirmation');
  async function open(){
   await trigger();await expect(dialog).toBeVisible();
   // Native Web activates Escape/focus handling after its entrance animation.
   // Require that actual active dialog and paint, not opacity-zero DOM presence.
   await expect(page.getByRole('dialog').filter({has:dialog})).toBeVisible();
   await expect.poll(()=>dialog.evaluate(element=>{
    for(let node:Element|null=element;node;node=node.parentElement){const style=getComputedStyle(node);if(Number(style.opacity)<.99||style.visibility==='hidden')return false;}
    return true;
   })).toBe(true);
  }
  expect(await read()).toBe(false);await open();await expect(dialog.getByText(title,{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await dialog.getByRole('button',{name:cancel,exact:true}).click();await expect(dialog).toHaveCount(0);
  expect(mutations).toHaveLength(before);expect(await read()).toBe(false);
  if(action==='INVITATION'){
   stage='INVITATION_ESCAPE';evidence();await open();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
   expect(mutations).toHaveLength(before);expect(await read()).toBe(false);
   checks.ESCAPE_WITHOUT_MUTATION=true;stage='INVITATION_BACKDROP';evidence();await open();await page.mouse.click(5,5);await expect(dialog).toHaveCount(0);
   expect(mutations).toHaveLength(before);expect(await read()).toBe(false);checks.DISMISS_WITHOUT_MUTATION=true;
  }
  stage=action+'_CONFIRM';evidence();await open();
  if(action==='INVITATION'){
   await page.screenshot({path:info.outputPath('native-confirmation-phone.png'),scale:'css',animations:'disabled'});
  }
  await dialog.getByRole('button',{name:confirm,exact:true}).click();await expect(dialog).toHaveCount(0);
  await expect.poll(read,{timeout:30_000}).toBe(true);expect(mutations.slice(before)).toEqual([action]);checks[action]=true;evidence();
 }
 try{
  checked(await db.from('profiles').update({drives_truck:true}).eq('id',actor.id));
  stage='SETUP_DRIVER';evidence();owned.driverId=await addFleetDriver(actor.id,{name:'Synthetic removable driver',email:`remove-${nonce}@example.test`,phone:'+12025550129'});manifest();
  stage='SETUP_INVITATION';evidence();owned.invitationId=await inviteFleetDriver(actor.id,{name:'Synthetic invitation',email:`invite-${nonce}@example.test`,phone:'+12025550130'});manifest();
  stage='SETUP_TRUCK';evidence();owned.vehicleId=(await createProviderVehicle(actor,{useBasis:'OWNED',make:'Isuzu',model:'Confirmation test',plate:`TEST-${actor.suffix}`,cargoConfiguration:'Mini Box Truck',trailerInterchangeable:false})).id;manifest();
  stage='SETUP_ASSIGNMENT';evidence();await updateFleetDriverAccess(actor,actor.id,{vehicleId:owned.vehicleId,canManageCapacity:true,canManageTracking:true});
  stage='SETUP_PUBLICATION';evidence();await setProviderVehiclePublication(actor,owned.vehicleId,'LIVE');
  stage='SETUP_GRANT';evidence();
  owned.brokerId=checked(await db.auth.admin.createUser({email:`share-${nonce}@example.test`,email_confirm:true})).user.id;manifest();
  checked(await db.from('profiles').update({role:'SHIPPER',active:true,first_name:'Synthetic'}).eq('id',owned.brokerId));
  owned.brokerWorkspaceId=checked(await db.rpc('business_workspace_create',{actor_user_id:owned.brokerId,command:{name:'Synthetic broker desk',handle:`share-${nonce.slice(0,12)}`,kind:'BROKER'}})).id;manifest();
  checked(await db.from('company_pages').update({published:true}).eq('organization_id',actor.organization_id));
  owned.connectionId=checked(await db.rpc('request_account_connection',{actor_user_id:actor.id,target_kind:'BUSINESS',target_id:owned.brokerWorkspaceId})).id;manifest();
  checked(await db.rpc('decide_account_connection',{actor_user_id:owned.brokerId,target_connection_id:owned.connectionId,decision:'ACCEPT'}));
  owned.grantId=checked(await db.rpc('grant_account_capacity_access',{actor_user_id:actor.id,target_connection_id:owned.connectionId,target_vehicle_id:owned.vehicleId})).id;manifest();
  const city=async(name:string)=>checked(await db.from('place_catalog').select('id').eq('normalized_name',name).limit(1).single()).id;
  stage='SETUP_SHIPMENT';evidence();owned.shipmentId=(await createProviderShipment(actor,{vehicleId:owned.vehicleId,originPlaceRef:await city('addis ababa'),passingPlaceRef:await city('adama'),destinationPlaceRef:await city('dire dawa'),expectedDeliveryDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),cargoSummary:'Synthetic confirmation workflow',customerEmail:`customer-${nonce}@example.test`,trackingMode:'STATUS_ONLY'})).id;manifest();
  stage='LOGIN';evidence();await page.setViewportSize({width:390,height:844});await login(page,actor.email);
  stage='INVITATION';evidence();
  await openWorkspacePage(page,'/fleet','/api/mobile/fleet');
  await page.getByRole('tab',{name:'Drivers',exact:true}).click();await expect(page.getByText('Synthetic invitation',{exact:true})).toBeVisible();
  await decide(()=>page.getByRole('button',{name:'Cancel invitation',exact:true}).click(),'Cancel invitation?','Keep invitation','Cancel invitation',async()=>!!checked(await db.from('fleet_driver_invitations').select('cancelled_at').eq('id',owned.invitationId).single()).cancelled_at,'INVITATION');
  stage='REMOVE_DRIVER';evidence();
  await page.getByRole('button',{name:'Manage driver: Synthetic removable driver',exact:true}).click();await page.getByRole('tab',{name:'Contact',exact:true}).click();
  await decide(()=>page.getByRole('button',{name:'Remove driver from fleet',exact:true}).click(),'Remove this driver?','Keep driver','Remove driver',async()=>checked(await db.from('drivers').select('active').eq('user_id',owned.driverId).single()).active===false,'REMOVE_DRIVER');
  expect(checked(await db.from('organization_members').select('id').eq('user_id',owned.driverId).eq('organization_id',actor.organization_id))).toHaveLength(0);
  stage='CAPACITY_ACCESS';evidence();await openWorkspacePage(page,'/network','/api/mobile/network');
  await page.getByRole('tab',{name:'Vehicle sharing',exact:true}).click();
  await page.getByRole('button',{name:'Share with connection',exact:true}).click();
  const contact=page.getByText('Synthetic broker desk',{exact:true}).last();await expect(contact).toBeVisible();
  await decide(()=>contact.locator('..').getByRole('button',{name:'Remove',exact:true}).click(),'Remove capacity access?','Keep access','Remove access',async()=>!!checked(await db.from('account_capacity_grants').select('revoked_at').eq('id',owned.grantId).single()).revoked_at,'REVOKE');
  await expect(contact).toHaveCount(0);
  stage='TRACKING_RECIPIENT';evidence();await openWorkspacePage(page,'/shipment-detail?id='+owned.shipmentId,'/api/mobile/shipments/'+owned.shipmentId);await expect(page.getByTestId('tracking-provider-workspace')).toBeVisible();
  await expect(page.getByRole('button',{name:/^Remove access for /})).toHaveCount(0);
  const recipients=checked(await db.from('provider_tracking_recipients').select('recipient_role,revoked_at').eq('shipment_id',owned.shipmentId));expect(recipients).toEqual([{recipient_role:'OWNER',revoked_at:null}]);checks.PROVIDER_RECIPIENT_REMOVAL_ABSENT=true;
  expect(checked(await db.from('provider_tracking_recipients').select('id').eq('shipment_id',owned.shipmentId).eq('recipient_role','OWNER').is('revoked_at',null))).toHaveLength(1);
  stage='CANCEL_TRACKING';evidence();await openWorkspacePage(page,'/shipment-manage?id='+owned.shipmentId,'/api/mobile/shipments/'+owned.shipmentId+'/recovery');
  await page.getByRole('button',{name:'Cancel tracking',exact:true}).click();await page.getByLabel('Reason for this change',{exact:true}).fill('Synthetic cancellation after testing');
  await decide(()=>page.getByRole('button',{name:'Cancel tracking',exact:true}).click(),'Cancel this tracking?','Keep tracking','Cancel tracking',async()=>checked(await db.from('provider_shipments').select('operational_status').eq('id',owned.shipmentId).single()).operational_status==='CANCELLED','CANCEL');
  expect(checked(await db.from('provider_tracking_recoveries').select('id').eq('shipment_id',owned.shipmentId))).toHaveLength(1);
  expect(checked(await db.from('provider_shipment_events').select('id').eq('shipment_id',owned.shipmentId)).length).toBeGreaterThan(0);
  expect(errors).toEqual([]);stage='COMPLETE';evidence();
 }catch(error){primaryError=error;evidence();}
 finally{
  try{
  await page.goto('about:blank');
  // Reserve cleanup time even if a wrong/stalled browser route used the test
  // budget. It is bounded and never changes the acceptance assertions.
  test.setTimeout(info.timeout+45_000);
  if(owned.shipmentId){checked(await db.from('provider_tracking_recoveries').delete().eq('shipment_id',owned.shipmentId));checked(await db.from('access_email_deliveries').delete().eq('entity_id',owned.shipmentId));checked(await db.from('audit_logs').delete().eq('entity_id',owned.shipmentId));checked(await db.from('provider_shipments').delete().eq('id',owned.shipmentId));}
  if(owned.brokerWorkspaceId)removeLocalBrokerFixture(owned.brokerWorkspaceId,owned.connectionId);
  if(owned.vehicleId){checked(await db.from('audit_logs').delete().eq('entity_id',owned.vehicleId));checked(await auditDeleteVehicles(db,'id',owned.vehicleId));}
  if(owned.brokerId){checked(await db.from('audit_logs').delete().eq('actor_user_id',owned.brokerId));await removeSyntheticUser(db,owned.brokerId);}
  checked(await db.from('audit_logs').delete().eq('actor_user_id',actor.id));
  if(owned.driverId){checked(await db.from('audit_logs').delete().eq('entity_id',owned.driverId));await removeSyntheticUser(db,owned.driverId);}
  if(owned.invitationId)checked(await db.from('fleet_driver_invitations').delete().eq('id',owned.invitationId).eq('invited_by',actor.id));
  await removeSyntheticUser(db,actor.id);checked(await db.from('organizations').delete().eq('id',actor.organization_id));
  cleanup=true;evidence();
  }catch(error){cleanupError=error;}
 }
 if(primaryError||cleanupError)throw new AggregateError([primaryError,cleanupError].filter(Boolean),'MOBILE_CONFIRMATION_FAILED: '+stage);
});
