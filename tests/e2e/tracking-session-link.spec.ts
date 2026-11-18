import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {test,expect} from './browser-test';
import type {Response as PlaywrightResponse} from 'playwright-core';
import {auditDeleteVehicles,auditLogin,auditOpenTrackingProgress,auditProvider,checked,localAuditService} from './audit-helpers';
import {registeredTrackingOwner,cleanupTrackingOwnerFixtures,openTrackingFixtureLink} from './tracking-session-fixtures';
import {chooseDate} from './date-picker-helper';
import {createProviderVehicle,updateFleetDriverAccess} from '../../src/lib/fleet.js';
import {getProviderTrackingWorkspace} from '../../src/lib/provider-tracking.js';

test.use({actionTimeout:15_000,trace:'off',screenshot:'off'});

const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
// Same bounded local-Postgres cleanup pattern as business-runtime-parity. No
// private-table REST grants or application cleanup bypass are introduced.
const databaseContainer=process.env.LOADGISTIC_LOCAL_DB_CONTAINER||'supabase_db_loadgistic-local';
function localDatabase(){
 if(process.env.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:55321'||!/^supabase_db_loadgistic-(?:local|review-[0-9]{8})$/.test(databaseContainer))throw Error('EXACT_LOCAL_TRACKING_DATABASE_REQUIRED');
 try{
  const ports=JSON.parse(execFileSync('docker',['inspect','--format','{{json .NetworkSettings.Ports}}',databaseContainer],{timeout:5000,stdio:'pipe',encoding:'utf8',maxBuffer:16384}));
  const mappings=ports?.['5432/tcp'];
  if(!Array.isArray(mappings)||mappings.length<1||mappings.length>2||new Set(mappings.map(item=>item.HostIp)).size!==mappings.length
   ||!mappings.every(item=>item.HostPort==='55322'&&['127.0.0.1','::1','0.0.0.0','::'].includes(item.HostIp)))throw Error();
 }catch{throw Error('EXACT_LOCAL_TRACKING_DATABASE_REQUIRED');}
 return databaseContainer;
}
function cleanupBroker(workspaceId:string,ownerId:string,handle:string,sessionId:string,providerId:string,vehicleId:string){
 if(!uuid.test(workspaceId)||!uuid.test(ownerId)||!/^tracking-link-[0-9a-f]{8}$/.test(handle)
  ||[sessionId,providerId,vehicleId].some(value=>value&&!uuid.test(value)))throw Error('EXACT_LOCAL_TRACKING_WORKSPACE_REQUIRED');
 const container=localDatabase();
 const sql=`begin;set local lock_timeout='5s';set local statement_timeout='10s';do $cleanup$
 declare s public.tracking_sessions%rowtype;n integer;
 begin
  if not exists(select 1 from public.business_workspaces where id='${workspaceId}' and handle='${handle}' and name='Tracking link ${handle.slice(-8)}')
   or not exists(select 1 from public.business_workspace_members where workspace_id='${workspaceId}' and user_id='${ownerId}' and role='OWNER')
   or exists(select 1 from public.business_workspace_members where workspace_id='${workspaceId}' and user_id<>'${ownerId}')
   or not exists(select 1 from auth.users where id='${ownerId}' and raw_app_meta_data->>'fixture_source'='loadgistic' and raw_app_meta_data->>'fixture_key'like'tracking-owner-%')
   or exists(select 1 from public.account_connections where requester_id='${workspaceId}' or recipient_id='${workspaceId}')
   or exists(select 1 from public.tracking_sharing_controls where business_workspace_id='${workspaceId}')
   then raise exception 'TRACKING_LINK_WORKSPACE_SCOPE_CHANGED';end if;
  -- Reconcile saved state even when connect committed before its response could
  -- be parsed. A foreign or second session is never silently deleted.
  if(select count(*)from public.tracking_sessions where workspace_id='${workspaceId}')>1 then raise exception 'TRACKING_LINK_SESSION_SCOPE_CHANGED';end if;
  select *into s from public.tracking_sessions where workspace_id='${workspaceId}' for update;
  if found then
   if s.created_by is distinct from '${ownerId}'::uuid or s.cargo_summary is distinct from 'Synthetic broker load ${handle.slice(-8)}'
    or(nullif('${sessionId}','')is not null and s.id is distinct from nullif('${sessionId}','')::uuid)
    then raise exception 'TRACKING_LINK_SESSION_SCOPE_CHANGED';end if;
   if s.state='CONNECTED'and s.shipment_id is not null then
    if not exists(select 1 from public.provider_shipments where id=s.shipment_id and assigned_vehicle_id=nullif('${vehicleId}','')::uuid
     and assigned_driver_user_id=nullif('${providerId}','')::uuid and created_by=nullif('${providerId}','')::uuid and cargo_summary=s.cargo_summary)
     then raise exception 'TRACKING_LINK_CONNECTED_SCOPE_CHANGED';end if;
    delete from public.audit_logs where entity_id=s.shipment_id;
    delete from public.provider_shipments where id=s.shipment_id;
   elsif s.state='PENDING_PROVIDER'and s.shipment_id is null then
    delete from public.tracking_sessions where id=s.id;
   else raise exception 'TRACKING_LINK_SESSION_SCOPE_CHANGED';end if;
   delete from public.audit_logs where entity_id=s.id;
  end if;
  delete from public.business_workspace_selections where workspace_id='${workspaceId}';
  delete from public.business_workspace_audit where workspace_id='${workspaceId}';
  delete from public.business_workspace_members where workspace_id='${workspaceId}';
  delete from public.business_workspaces where id='${workspaceId}' and handle='${handle}';
  get diagnostics n=row_count;if n<>1 then raise exception 'TRACKING_LINK_WORKSPACE_DELETE_COUNT';end if;
 end $cleanup$;commit;`;
 try{execFileSync('docker',['exec',container,'psql','-X','-q','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-c',sql],{timeout:15_000,stdio:'pipe'});}
 catch{throw Error('EXACT_LOCAL_TRACKING_WORKSPACE_CLEANUP_FAILED');}
}

let cleanupOwned:(()=>Promise<void>)|undefined;

test('broker creates a pending load and shares link/code before a provider connects the agreed vehicle',async({page,browser},info)=>{
 test.setTimeout(150_000);
 const service=localAuditService(),nonce=randomUUID().slice(0,8),handle=`tracking-link-${nonce}`;
 let ownerId='',workspaceId='',sessionId='',shipmentId='',vehicleId='',provider:any,guestContext:any,providerContext:any;
 const began=Date.now();let lastStage='LOCAL_TARGET';
 const mark=(stage:'LOCAL_TARGET'|'OWNER_SETUP'|'PROVIDER_SETUP'|'BROKER_SIGN_IN'|'BROKER_FORM'|'BROKER_CREATE'|'BROKER_ISSUE_LINK'|'GUEST_PENDING_OPEN'|'PROVIDER_SIGN_IN'|'PROVIDER_OPEN_LINK'|'PROVIDER_CONNECT'|'GUEST_CONNECTED_REFRESH'|'GUEST_RELOAD'|'PROVIDER_STATUS'|'VIEWER_STATUS'|'WORKFLOW_COMPLETE'|'CLEANUP_CONTEXTS'|'CLEANUP_DATABASE'|'CLEANUP_AUTH'|'CLEANUP_COMPLETE')=>{lastStage=stage;console.log('CI_TRACKING_LINK_STAGE '+JSON.stringify({stage,elapsedMs:Date.now()-began}));};
 // One afterEach owns the whole cleanup chain. A timed-out body cannot race a
 // second owner-delete hook ahead of its still-running workspace cleanup.
 cleanupOwned=async()=>{
  mark('CLEANUP_CONTEXTS');await Promise.allSettled([guestContext?.close(),providerContext?.close()]);
  mark('CLEANUP_DATABASE');if(workspaceId)cleanupBroker(workspaceId,ownerId,handle,sessionId,provider?.id||'',vehicleId);
  if(vehicleId){checked(await service.from('audit_logs').delete().eq('entity_id',vehicleId));checked(await auditDeleteVehicles(service,'id',vehicleId));}
  mark('CLEANUP_AUTH');if(provider){checked(await service.from('audit_logs').delete().eq('actor_user_id',provider.id));checked(await service.auth.admin.deleteUser(provider.id));}
  await cleanupTrackingOwnerFixtures();mark('CLEANUP_COMPLETE');
 };
 try{
  mark('LOCAL_TARGET');localDatabase();mark('OWNER_SETUP');
  const owner=await registeredTrackingOwner(service,`tracking-link-${nonce}@example.test`);ownerId=owner.id;
  workspaceId=checked(await service.rpc('business_workspace_create',{actor_user_id:ownerId,command:{name:`Tracking link ${nonce}`,handle,kind:'BROKER'}})).id;
  mark('PROVIDER_SETUP');provider=await auditProvider(service,'tracking-link');
  const vehicle=await createProviderVehicle(provider,{useBasis:'OWNED',make:'Toyota',model:'Link journey',plate:`LINK-${nonce}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false});vehicleId=vehicle.id;
  expect(vehicle).toMatchObject({active:true,publication_status:'DRAFT'});
  checked(await service.from('company_pages').update({published:true}).eq('provider_profile_id',provider.provider_profile_id));
  checked(await service.rpc('set_provider_driving_mode',{actor_user_id:provider.id,requested_drives_truck:true}));
  await updateFleetDriverAccess(provider,provider.id,{vehicleId,canManageCapacity:true,canManageTracking:true});
  expect(checked(await service.rpc('capacity_active_driver_id',{target_vehicle_id:vehicleId}))).toBe(provider.id);
  // The installed workspace/create guards require active authorized vehicles
  // and the current driver, independently of public Capacity Go Live.
  expect((await getProviderTrackingWorkspace(provider)).vehicles.map((item:{id:string})=>item.id)).toEqual([vehicleId]);
  checked(await service.rpc('set_provider_vehicle_publication',{actor_user_id:provider.id,target_vehicle_id:vehicleId,requested_state:'LIVE'}));
  const truckNumber=checked(await service.from('vehicles').select('platform_number').eq('id',vehicleId).single()).platform_number;
  mark('BROKER_SIGN_IN');await auditLogin(page,owner.email,'/app/business/tracking');
  mark('BROKER_FORM');await page.getByRole('button',{name:'Create Tracking session',exact:true}).click();
  for(const [label,query,option]of[['Pickup city','Addis',/Addis Ababa, Ethiopia/i],['Passing through city','Adama',/Adama, Ethiopia/i],['Delivery city','Dire',/Dire Dawa, Ethiopia/i]]as const){
   await page.getByRole('combobox',{name:label,exact:true}).fill(query);
   await page.getByRole('option',{name:option}).first().click();
  }
  await page.getByLabel('Cargo',{exact:true}).fill(`Synthetic broker load ${nonce}`);
  await chooseDate(page,'Expected delivery',new Date(Date.now()+2*86400000).toISOString().slice(0,10));
  mark('BROKER_CREATE');const created=page.waitForResponse((response:PlaywrightResponse)=>new URL(response.url()).pathname==='/api/tracking/sessions'&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Create Tracking session',exact:true}).click();
  const createdResponse=await created;expect(createdResponse.status()).toBe(201);const pending=(await createdResponse.json()).data;sessionId=pending.id;
  expect(pending.state).toBe('PENDING_PROVIDER');expect(pending.shipmentId).toBeNull();expect(pending.tracking).toBeNull();expect(pending.route).toHaveLength(3);
  await expect(page.getByText('Waiting for a Transport Provider to connect. No vehicle location is shared yet.',{exact:true})).toBeVisible();
  mark('BROKER_ISSUE_LINK');const issued=page.waitForResponse((response:PlaywrightResponse)=>new URL(response.url()).pathname===`/api/tracking/sessions/${sessionId}/links`&&response.request().method()==='POST');
  await page.getByRole('checkbox',{name:'Include approximate location when the provider has enabled it.',exact:true}).check();
  await page.getByRole('button',{name:'Create Tracking link',exact:true}).click();const issuedResponse=await issued;expect(issuedResponse.status()).toBe(201);const link=(await issuedResponse.json()).data.link;
  await expect(page.getByLabel('Tracking link',{exact:true})).toHaveValue(link.url);await expect(page.getByLabel('Tracking code',{exact:true})).toHaveValue(link.code);
  await page.getByLabel('Truck number, driver or provider').fill(truckNumber);
  const picker=page.locator('section').filter({has:page.getByRole('heading',{name:'Request a vehicle',exact:true})}).last();
  await picker.getByRole('button',{name:'Search',exact:true}).click();
  await picker.getByRole('button',{name:/^Request tracking/}).click();
  await expect(picker.getByText(/Requested vehicle/)).toBeVisible();
  const options={baseURL:info.project.use.baseURL,viewport:page.viewportSize()!,isMobile:Boolean(info.project.use.isMobile),hasTouch:Boolean(info.project.use.hasTouch)};
  mark('GUEST_PENDING_OPEN');guestContext=await browser.newContext(options);const guest=await guestContext.newPage(),shared=await openTrackingFixtureLink(guest,link);
  expect(shared.id).toBe(sessionId);expect(shared.state).toBe('PENDING_PROVIDER');expect(shared.tracking).toBeNull();await expect(guest.locator('.tracking-truck-marker')).toHaveCount(0);
  mark('PROVIDER_SIGN_IN');providerContext=await browser.newContext({...options,geolocation:{latitude:9.031234,longitude:38.741234,accuracy:3}});
  await providerContext.grantPermissions(['geolocation'],{origin:new URL(info.project.use.baseURL!).origin});
  const driver=await providerContext.newPage();
  const inbox=driver.waitForResponse((r:PlaywrightResponse)=>new URL(r.url()).pathname==='/api/tracking/requests'&&r.request().postDataJSON()?.action==='INBOX',{timeout:45000});
  await auditLogin(driver,provider.email,'/app/provider-shipments');
  mark('PROVIDER_OPEN_LINK');
  expect((await inbox).status()).toBe(200);
  const requestRow=driver.locator('article').filter({hasText:pending.reference});
  await expect(requestRow).toContainText(truckNumber);
  await expect(driver.getByLabel('Tracking code',{exact:true})).toHaveCount(0);
  await requestRow.getByRole('checkbox',{name:'Status and approximate location'}).check();
  mark('PROVIDER_CONNECT');
  const accepted=driver.waitForResponse((r:PlaywrightResponse)=>new URL(r.url()).pathname==='/api/tracking/requests'&&r.request().postDataJSON()?.action==='ACCEPT');
  await requestRow.getByRole('button',{name:'Accept tracking request'}).click();
  const reply=await accepted;expect(reply.status()).toBe(200);shipmentId=(await reply.json()).data.shipmentId;
  expect(shipmentId).toMatch(uuid);
  expect(checked(await service.from('provider_shipments').select('assigned_vehicle_id,assigned_driver_user_id').eq('id',shipmentId).single())).toMatchObject({assigned_vehicle_id:vehicleId,assigned_driver_user_id:provider.id});
  mark('GUEST_CONNECTED_REFRESH');await guest.bringToFront();const refresh=guest.waitForResponse((response:PlaywrightResponse)=>new URL(response.url()).pathname===`/api/tracking/sessions/${sessionId}`);
  await guest.getByRole('button',{name:'Refresh updates',exact:true}).click();expect((await refresh).status()).toBe(200);
  await expect(guest.getByText('Waiting for a Transport Provider to connect. No vehicle location is shared yet.',{exact:true})).toHaveCount(0);
  await expect(guest.getByRole('heading',{name:'Shipment progress',exact:true})).toBeVisible();
  await expect(guest.getByRole('button',{name:'Approve unloading',exact:true})).toHaveCount(0);await expect(guest.getByRole('button',{name:'Open proof',exact:true})).toHaveCount(0);
  mark('GUEST_RELOAD');await guest.reload();await expect(guest.getByRole('button',{name:'Close Tracking',exact:true})).toBeVisible();
  await driver.bringToFront();
  const openTracking=driver.getByRole('link',{name:'Open Tracking',exact:true});
  await expect(openTracking).toHaveAttribute('href',`/app/provider-shipments/${shipmentId}`);
  await openTracking.click();
  await expect(driver.getByRole('heading',{name:`Synthetic broker load ${nonce}`,exact:true})).toBeVisible({timeout:15000});
  await expect(driver.locator('.tracking-control-panel')).toBeVisible();
  await expect(driver.getByRole('button',{name:'Add partner',exact:true})).toHaveCount(0);
  mark('PROVIDER_STATUS');
  await auditOpenTrackingProgress(driver);
  await driver.locator('input[name=nextStatus][value=TO_PICKUP]').check();
  const statusPost=driver.waitForResponse((r:PlaywrightResponse)=>r.request().method()==='POST'&&new URL(r.url()).pathname===`/api/provider-shipments/${shipmentId}/status`,{timeout:45000});
  await driver.getByRole('button',{name:'Save Going to pickup',exact:true}).click();
  const saved=await statusPost;
  expect(saved.status()).toBe(303);
  const destination=new URL(saved.headers().location,driver.url());
  expect(destination.pathname).toBe(`/app/provider-shipments/${shipmentId}`);
  expect(destination.searchParams.has('success')).toBe(true);
  await expect(driver.locator('.alert.success')).toBeVisible({timeout:20000});
  expect(checked(await service.from('provider_shipments').select('operational_status').eq('id',shipmentId).single()).operational_status).toBe('TO_PICKUP');
  mark('VIEWER_STATUS');
  await guest.bringToFront();
  await guest.getByRole('button',{name:'Refresh updates',exact:true}).click();
  const guestTimeline=guest.locator('section').filter({has:guest.getByRole('heading',{name:'Shipment progress',exact:true})}).last();
  await expect(guestTimeline.locator('strong').filter({hasText:/^Going to pickup$/})).toBeVisible();
  await page.bringToFront();
  const details=page.locator('section[aria-busy]').filter({has:page.getByRole('heading',{name:pending.reference,exact:true})});
  await details.getByRole('button',{name:'Refresh Tracking',exact:true}).click();
  const brokerTimeline=details.locator('section').filter({has:page.getByRole('heading',{name:'Shipment progress',exact:true})});
  await expect(brokerTimeline.locator('strong').filter({hasText:/^Going to pickup$/})).toBeVisible();
  mark('WORKFLOW_COMPLETE');
 }catch(error){console.log('CI_TRACKING_LINK_FAILURE '+JSON.stringify({stage:lastStage,elapsedMs:Date.now()-began}));throw error;}
});

test.afterEach(async()=>{const cleanup=cleanupOwned;cleanupOwned=undefined;await cleanup?.();});
