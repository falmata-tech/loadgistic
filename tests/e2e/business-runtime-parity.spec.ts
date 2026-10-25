import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import type {BrowserContext,Page} from 'playwright-core';
import {test,expect as baseExpect} from './browser-test';
import {auditDeleteVehicles,auditFleetProvider,auditTrackingOwnerLogin,checked,localAuditService} from './audit-helpers';
import {localMailpitNumericCode} from './mailpit-helper';
import {chooseCapacityOptions,chooseTruckConfiguration} from './capacity-drawer-helper';
import {createProviderVehicle,updateFleetDriverAccess} from '../../src/lib/fleet.js';
import {setProviderVehiclePublication} from '../../src/lib/provider-authority.js';
import {publishProviderCapacity} from '../../src/lib/provider-capacity.js';
import {createProviderShipment} from '../../src/lib/provider-tracking.js';

// Ordinary disposable accounts prove the real Network path. Play-review
// workspaces are deliberately invisible there and must stay isolated.
test.use({channel:'chrome',headless:false,trace:'off',video:'off',screenshot:'off',actionTimeout:20_000,navigationTimeout:90_000});
test.skip(process.env.LOADGISTIC_RUN_BUSINESS_RUNTIME_PARITY!=='1','Local opt-in requires web and Expo previews.');
const expect=baseExpect.configure({timeout:30_000});
const web='http://127.0.0.1:3100',expo='http://localhost:8084';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
function cleanupLocalBusinessWorkspace(owned:{workspaceId:string;ownerId:string;staffId:string;providerId:string;organizationId:string;connectionId:string;grantId:string;vehicleId:string},handle:string){
 if(process.env.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:55321')throw Error('LOCAL_BUSINESS_FIXTURE_REQUIRED');
 if(!uuid.test(owned.workspaceId)||!uuid.test(owned.ownerId)||!uuid.test(owned.staffId)
  ||!uuid.test(owned.providerId)||!uuid.test(owned.organizationId)
  ||owned.vehicleId&&!uuid.test(owned.vehicleId)||owned.connectionId&&!uuid.test(owned.connectionId)
  ||owned.grantId&&(!uuid.test(owned.grantId)||!uuid.test(owned.vehicleId)||!uuid.test(owned.connectionId))
  ||!/^journey-broker-[0-9a-f]{8}$/.test(handle))throw Error('INVALID_BUSINESS_FIXTURE_SCOPE');
 const connectionDiscovery=`select case when count(*)=0 then ''
  when count(*)=1 and bool_and(requester_id='${owned.organizationId}'::uuid and requested_by='${owned.providerId}'::uuid and recipient_id='${owned.workspaceId}'::uuid)
  then max(id::text) else 'INVALID_SCOPE' end from public.account_connections
  where requester_id='${owned.workspaceId}'::uuid or recipient_id='${owned.workspaceId}'::uuid;`;
 let discoveredConnection='';
 try{discoveredConnection=execFileSync('docker',['exec','supabase_db_loadgistic-local','psql','-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-c',connectionDiscovery],
  {timeout:20_000,stdio:['pipe','pipe','pipe'],encoding:'utf8'}).trim();}
 catch{throw Error('EXACT_LOCAL_CONNECTION_DISCOVERY_FAILED');}
 if(discoveredConnection&&(!uuid.test(discoveredConnection)||owned.connectionId&&owned.connectionId!==discoveredConnection))throw Error('EXACT_SYNTHETIC_CONNECTION_REQUIRED');
 if(discoveredConnection)owned.connectionId=discoveredConnection;
 const exactGrant=owned.connectionId&&owned.vehicleId
  ?`connection_id='${owned.connectionId}'::uuid and vehicle_id='${owned.vehicleId}'::uuid`:'false';
 const discovery=`select case when count(*)=0 then ''
  when count(*)=1 and bool_and(${exactGrant}) then max(id::text)
  else 'INVALID_SCOPE' end from public.account_capacity_grants where recipient_id='${owned.workspaceId}'::uuid;`;
 let discovered='';
 try{discovered=execFileSync('docker',['exec','supabase_db_loadgistic-local','psql','-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-c',discovery],
  {timeout:20_000,stdio:['pipe','pipe','pipe'],encoding:'utf8'}).trim();}
 catch{throw Error('EXACT_LOCAL_GRANT_DISCOVERY_FAILED');}
 if(discovered&&(!uuid.test(discovered)||owned.grantId&&owned.grantId!==discovered))throw Error('EXACT_SYNTHETIC_GRANT_REQUIRED');
 if(discovered)owned.grantId=discovered;
 const sql=`begin;set local lock_timeout='5s';set local statement_timeout='20s';
 do $cleanup$ declare w uuid:='${owned.workspaceId}'; c uuid:=nullif('${owned.connectionId}','')::uuid;
 g uuid:=nullif('${owned.grantId}','')::uuid;v uuid:=nullif('${owned.vehicleId}','')::uuid;removed integer;
 begin
  perform 1 from public.business_workspaces where id=w and handle='${handle}' and name='Journey broker ${handle.slice(-8)}' for update;
  if not found then raise exception 'EXACT_SYNTHETIC_WORKSPACE_REQUIRED';end if;
  if not exists(select 1 from public.business_workspace_members where workspace_id=w and user_id='${owned.ownerId}'::uuid and role='OWNER')
    or exists(select 1 from public.business_workspace_members where workspace_id=w and user_id not in('${owned.ownerId}'::uuid,'${owned.staffId}'::uuid))
  then raise exception 'SYNTHETIC_MEMBERS_CHANGED';end if;
  if exists(select 1 from public.account_connections where (requester_id=w or recipient_id=w) and id is distinct from c)
    or exists(select 1 from public.account_capacity_grants where recipient_id=w and id is distinct from g)
    or exists(select 1 from public.tracking_sharing_controls where business_workspace_id=w)
  then raise exception 'SYNTHETIC_WORKSPACE_STILL_REFERENCED';end if;
  if g is not null then
   perform 1 from public.account_capacity_grants where id=g and connection_id=c and vehicle_id=v and recipient_id=w;
   if not found then raise exception 'EXACT_SYNTHETIC_GRANT_REQUIRED';end if;
   delete from public.audit_logs where entity_id=g;
   delete from public.account_capacity_grants where id=g and connection_id=c and vehicle_id=v and recipient_id=w;
  end if;
  if c is not null then
   perform 1 from public.account_connections where id=c and (requester_id=w or recipient_id=w);
   if not found then raise exception 'EXACT_SYNTHETIC_CONNECTION_REQUIRED';end if;
   delete from public.audit_logs where entity_id=c;
   delete from public.account_connections where id=c and (requester_id=w or recipient_id=w);
  end if;
  delete from public.business_workspace_selections where workspace_id=w;
  delete from public.business_workspace_audit where workspace_id=w;
  delete from public.business_workspace_invitations where workspace_id=w;
  delete from public.business_workspace_members where workspace_id=w;
  delete from public.business_workspaces where id=w and handle='${handle}';
  get diagnostics removed=row_count;if removed<>1 then raise exception 'SYNTHETIC_WORKSPACE_DELETE_COUNT';end if;
 end $cleanup$;commit;`;
 try{execFileSync('docker',['exec','supabase_db_loadgistic-local','psql','-X','-q','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-c',sql],{timeout:20_000,stdio:'pipe'});}
 catch{throw Error('EXACT_LOCAL_WORKSPACE_CLEANUP_FAILED');}
}
async function nativeLogin(page:Page,email:string){
 await page.goto(expo+'/account');
 await page.getByLabel('Email',{exact:true}).fill(email);
 const since=Date.now();await page.getByRole('button',{name:'Send code',exact:true}).click();
 await expect(page.getByLabel('Sign-in code',{exact:true})).toBeVisible();
 await page.getByLabel('Sign-in code',{exact:true}).fill(await localMailpitNumericCode(email,since,['Your Loadgistic sign-in code','Your Loadgistic signup code']));
 const signed=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/auth/verify'&&response.request().method()==='POST');
 await page.getByRole('button',{name:'Sign in',exact:true}).last().click();
 const response=await signed;expect(response.status()).toBe(200);
 const body=await response.json() as {accessToken?:string};
 expect(typeof body.accessToken==='string'&&/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(body.accessToken)).toBe(true);
 return body.accessToken!;
}
async function webLogin(page:Page,email:string,kind:'provider'|'customer'){
 await page.goto('/login',{waitUntil:'domcontentloaded'});
 const form=page.getByTestId('email-code-request-form');
 await form.getByLabel('Email',{exact:true}).fill(email);
 const since=Date.now();await form.getByRole('button',{name:'Email me a code',exact:true}).click({noWaitAfter:true});
 await expect(page.getByTestId('email-code-form')).toBeVisible();
 await page.getByLabel('Six-digit code',{exact:true}).fill(await localMailpitNumericCode(email,since,['Your Loadgistic signup code','Your Loadgistic sign-in code']));
 await page.getByRole('button',{name:'Continue',exact:true}).click({noWaitAfter:true});
 await expect(page).toHaveURL(url=>kind==='customer'
  ?url.pathname==='/'&&url.searchParams.get('view')==='private'
  :url.pathname==='/app/home',{timeout:90_000});
 await page.waitForLoadState('load');
}
async function ensureWebConsent(page:Page){
 const policy=await page.request.get('/api/account/policy');
 expect(policy.status()).toBe(200);
 if(!(await policy.json() as {accepted:boolean}).accepted){
  const consent=page.locator('dialog').filter({hasText:'Before you share'});
  await expect(consent).toBeVisible();
  await consent.getByRole('checkbox',{name:'I agree to the Terms and content rules.'}).check();
  await consent.getByRole('button',{name:'Accept and continue'}).click();
  await expect(consent).toBeHidden();
 }
}
async function createCustomer(service:ReturnType<typeof localAuditService>,email:string,firstName:string){
 const id=checked(await service.auth.admin.createUser({email,email_confirm:true})).user.id as string;
 checked(await service.from('profiles').update({role:'SHIPPER',active:true,first_name:firstName,full_name:firstName}).eq('id',id));
 return id;
}

test('broker owner and staff find one connected vehicle and shipment on phone web and Expo',async({browser},info)=>{
 test.skip(info.project.name!=='desktop-chromium','One serialized browser uses explicit phone contexts for both apps.');
 test.setTimeout(600_000);
 const service=localAuditService(),nonce=randomUUID().slice(0,8),ownerEmail=`journey-owner-${nonce}@loadgistic.local`,staffEmail=`journey-staff-${nonce}@loadgistic.local`;
 const owned={providerId:'',organizationId:'',vehicleId:'',ownerId:'',staffId:'',workspaceId:'',invitationId:'',connectionId:'',grantId:'',shipmentId:''};
 const proof={stage:'SETUP',connected:false,grantValid:false,webCapacity:false,nativeCapacity:false,nativeProviderShare:false,webTracking:false,nativeTracking:false,staffRead:false,staffDenied:false,cleaned:false};
 const record=()=>writeFileSync(info.outputPath('business-runtime-parity.json'),JSON.stringify(proof,null,2),{mode:0o600});
 const manifest=()=>writeFileSync(info.outputPath('business-runtime-owned.json'),JSON.stringify(owned,null,2),{mode:0o600});
 const contexts:BrowserContext[]=[];let initialFailure:unknown=null,cleanupFailure:unknown=null;
 const phone=async(baseURL:string)=>{const context=await browser.newContext({baseURL,viewport:{width:390,height:844},isMobile:true,hasTouch:true,extraHTTPHeaders:{'x-forwarded-for':'127.0.0.239'}});contexts.push(context);return context.newPage();};
 const place=async(name:string)=>checked(await service.from('place_catalog').select('id').eq('normalized_name',name).limit(1).single()).id as string;
 try{
  const preview=await fetch(`${expo}/api/mobile/auth/request`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10_000)});
  expect(preview.status).toBe(400);
  expect(preview.headers.get('content-type')).toContain('application/json');
  expect(await preview.json()).toMatchObject({error:{code:'INVALID_INPUT'}});
  proof.stage='SYNTHETIC_IDENTITIES';record();
  const provider=await auditFleetProvider(service,'broker-parity');
  owned.providerId=provider.id;owned.organizationId=provider.organization_id;manifest();
  owned.ownerId=await createCustomer(service,ownerEmail,'Journey owner');manifest();
  owned.staffId=await createCustomer(service,staffEmail,'Journey staff');manifest();
  const workspace=checked(await service.rpc('business_workspace_create',{actor_user_id:owned.ownerId,command:{name:`Journey broker ${nonce}`,handle:`journey-broker-${nonce}`,kind:'BROKER'}}));
  owned.workspaceId=workspace.id;manifest();expect(owned.workspaceId).toMatch(uuid);
  const invited=checked(await service.rpc('business_workspace_command',{actor_user_id:owned.ownerId,target_workspace_id:owned.workspaceId,
   command:{action:'INVITE',expectedVersion:workspace.version,email:staffEmail,role:'STAFF',capacity:true,tracking:true}}));
  owned.invitationId=invited.invitationId;manifest();expect(owned.invitationId).toMatch(uuid);
  checked(await service.rpc('business_workspace_accept_invitation',{actor_user_id:owned.staffId,invitation_id:owned.invitationId}));
  checked(await service.from('company_pages').update({published:true}).eq('organization_id',owned.organizationId));
  const vehicle=await createProviderVehicle(provider,{useBasis:'OWNED',make:'Isuzu',model:'Journey',plate:`JRN-${nonce}`,cargoConfiguration:'Mini Box Truck',trailerInterchangeable:false});
  owned.vehicleId=vehicle.id;manifest();
  expect(checked(await service.rpc('set_provider_driving_mode',{actor_user_id:owned.providerId,requested_drives_truck:true}))).toBe(true);
  await updateFleetDriverAccess(provider,owned.providerId,{vehicleId:owned.vehicleId,canManageCapacity:true,canManageTracking:true});
  await setProviderVehiclePublication(provider,owned.vehicleId,'LIVE');
  const route=[await place('addis ababa'),await place('adama'),await place('dire dawa')];
  await publishProviderCapacity(provider,{vehicleId:owned.vehicleId,status:'EMPTY',acceptedLoads:'BOTH',availabilityGeometry:'ROUTE',
   visibility:'PRIVATE',locationSource:'DEVICE_OBSCURED',approximateLat:9.03,approximateLng:38.76,locationPrecisionKm:10,
   currentRoutePlaces:route.slice(0,2).map(placeRef=>({placeRef}))});
  proof.stage='NETWORK_SHARE';record();
  const providerWeb=await phone(web);await webLogin(providerWeb,provider.email,'provider');
  await providerWeb.goto('/app/network');
  await ensureWebConsent(providerWeb);
  const directoryResult=providerWeb.waitForResponse(response=>{
   const url=new URL(response.url());
   return url.pathname==='/api/account-directory'&&url.searchParams.get('q')===`Journey broker ${nonce}`;
  },{timeout:30_000});
  await providerWeb.getByLabel('Find transport accounts',{exact:true}).fill(`Journey broker ${nonce}`);
  const directoryResponse=await directoryResult;
  expect(directoryResponse.status()).toBe(200);
  expect((await directoryResponse.json()).items.some((item:{id:string})=>item.id===owned.workspaceId)).toBe(true);
  await expect(providerWeb.getByText(`Journey broker ${nonce}`,{exact:true}).first()).toBeVisible({timeout:30_000});
  await providerWeb.getByRole('button',{name:'Request connection',exact:true}).click();
  await expect(providerWeb.getByRole('status').filter({hasText:'Request sent.'})).toContainText('Request sent. Vehicle access begins only after it is shared.');
  owned.connectionId=checked(await service.from('account_connections').select('id').eq('requested_by',owned.providerId).eq('recipient_id',owned.workspaceId).single()).id;manifest();
  const ownerWeb=await phone(web);await webLogin(ownerWeb,ownerEmail,'customer');
  await ownerWeb.goto('/app/network');
  await ensureWebConsent(ownerWeb);
  await ownerWeb.getByRole('tab',{name:'Connections',exact:true}).click();
  await expect(ownerWeb.getByText(`Audit fleet ${provider.suffix}`,{exact:true})).toBeVisible();
  await ownerWeb.getByRole('button',{name:'Accept',exact:true}).click();
  await expect.poll(async()=>checked(await service.from('account_connections').select('status').eq('id',owned.connectionId).single()).status).toBe('ACCEPTED');
  await providerWeb.goto('/app/network?view=vehicles');
  await expect(providerWeb.getByRole('heading',{name:'Isuzu Journey',exact:true})).toBeVisible();
  await providerWeb.getByRole('button',{name:'Share with connection',exact:true}).click();
  const shareVehicle=providerWeb.getByRole('dialog',{name:'Share vehicle'});
  await shareVehicle.getByRole('combobox',{name:'Share with connection'}).selectOption(owned.connectionId);
  const shareResponse=providerWeb.waitForResponse(response=>new URL(response.url()).pathname==='/api/account-vehicle-shares'&&response.request().method()==='POST');
  await shareVehicle.getByRole('button',{name:'Share vehicle',exact:true}).click();
  const response=await shareResponse;
  if(response.status()!==200){
   await expect(shareVehicle.getByRole('alert')).toBeVisible();
   throw Error(`SHARE_VEHICLE_HTTP_${response.status()}: ${await shareVehicle.getByRole('alert').innerText()}`);
  }
  await expect.poll(async()=>{
   const result=await service.from('account_capacity_grants').select('id').eq('connection_id',owned.connectionId).eq('vehicle_id',owned.vehicleId).eq('recipient_id',owned.workspaceId).maybeSingle();
   if(result.error)throw result.error;
   if(result.data){owned.grantId=result.data.id;manifest();}
   return result.data?.id??null;
  }).toMatch(uuid);
  await expect(providerWeb).toHaveURL(/\/app\/network\?view=vehicles/);
  await providerWeb.context().close();
  proof.connected=true;record();
  const shipment=await createProviderShipment(provider,{vehicleId:owned.vehicleId,originPlaceRef:route[0],passingPlaceRef:route[1],
   destinationPlaceRef:route[2],expectedDeliveryDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),
   cargoSummary:`Journey cargo ${nonce}`,customerEmail:ownerEmail,trackingMode:'LOCATION_AND_STATUS'});
  owned.shipmentId=shipment.id;manifest();
  checked(await service.from('provider_shipment_events').insert({shipment_id:owned.shipmentId,status:'CREATED',event_type:'LOCATION',
   location_area:'Journey pickup area',location_lat:9.03,location_lng:38.76,location_precision_km:10,location_source:'DEVICE_OBSCURED',created_by:owned.providerId}));

  proof.stage='TRACKING_ATTACH';record();
  await auditTrackingOwnerLogin(ownerWeb,ownerEmail);
  await ownerWeb.getByRole('button',{name:'Share tracking',exact:true}).click();
  const sharing=ownerWeb.getByRole('dialog',{name:'Share tracking'});
  await expect(sharing.getByText(`Journey broker ${nonce}`,{exact:true})).toBeVisible();
  await sharing.getByRole('button',{name:'Add to this workspace',exact:true}).click();
  await expect(sharing.getByText('Sharing updated.',{exact:true})).toBeVisible();
  expect(checked(await service.from('tracking_sharing_controls').select('business_workspace_id').eq('shipment_id',owned.shipmentId).single()).business_workspace_id).toBe(owned.workspaceId);

  proof.stage='WEB_PHONE';record();
  await ownerWeb.goto('/?view=private');
  await expect(ownerWeb.locator('.leaflet-container')).toBeVisible();
  const privateApi=`/api/business-workspaces/${owned.workspaceId}/capacity`;
  const privateResult=await ownerWeb.request.get(privateApi);expect(privateResult.status()).toBe(200);
  expect((await privateResult.json()).items.some((item:{vehicle_id?:string;id?:string})=>item.vehicle_id===owned.vehicleId||item.id===owned.vehicleId)).toBe(true);
  proof.grantValid=true;record();
  await ownerWeb.getByRole('button',{name:'Search transporters',exact:true}).click();
  const webSearch=ownerWeb.getByRole('complementary',{name:'Transporter search'});
  await webSearch.getByRole('searchbox',{name:'Search transporters'}).fill(`Audit fleet ${provider.suffix}`);
  const webProfile=webSearch.locator('.capacity-result-card').filter({hasText:`Audit fleet ${provider.suffix}`}).first();
  await expect(webProfile).toBeVisible();
  await webProfile.getByRole('link',{name:'Show vehicles on map',exact:true}).click();
  await expect(ownerWeb).toHaveURL(url=>url.searchParams.get('provider')===provider.organization_id||url.searchParams.get('provider')===`broker-parity-${provider.suffix}`);
  await expect(ownerWeb.locator('.capacity-truck-map-marker').first()).toBeVisible();
  await ownerWeb.locator('.capacity-truck-map-marker').first().click();
  await ownerWeb.getByRole('button',{name:'Vehicle details',exact:true}).click();
  await expect(ownerWeb.locator('.truck-inspection')).toBeVisible();
  await ownerWeb.getByRole('button',{name:'Close map signal details'}).click();
  await ownerWeb.getByRole('button',{name:/Vehicle filters/}).click();
  const webFilters=ownerWeb.getByRole('dialog',{name:'Vehicle filters'});
  await chooseCapacityOptions(webFilters,'status',['EMPTY']);
  await chooseTruckConfiguration(webFilters,'Mini Box Truck');
  await webFilters.getByRole('button',{name:'Show vehicles'}).click();
  const filtered=await ownerWeb.request.get(`${privateApi}?status=EMPTY&vehicleCategory=Mini%20Box%20Truck`);
  expect(filtered.status()).toBe(200);
  expect((await filtered.json()).items.some((item:{vehicle_id?:string;id?:string})=>item.vehicle_id===owned.vehicleId||item.id===owned.vehicleId)).toBe(true);
  await ownerWeb.goto('/app/network');await expect(ownerWeb.getByRole('heading',{name:'Network',level:1})).toBeVisible();
  await ownerWeb.getByRole('tab',{name:'Connections'}).click();await expect(ownerWeb.getByText(`Audit fleet ${provider.suffix}`)).toBeVisible();
  await ownerWeb.goto('/app/business/tracking');
  await expect(ownerWeb.getByText(shipment.code,{exact:true})).toBeVisible();
  await ownerWeb.getByRole('link',{name:new RegExp(shipment.code)}).click();
  await expect(ownerWeb).toHaveURL(new RegExp(`/app/business/tracking/${owned.shipmentId}`));
  await expect(ownerWeb.getByText(`Journey cargo ${nonce}`,{exact:true})).toBeVisible();
  proof.webCapacity=true;proof.webTracking=true;record();
  await ownerWeb.context().close();

  proof.stage='EXPO_PHONE';record();
  const ownerExpo=await phone(expo),ownerToken=await nativeLogin(ownerExpo,ownerEmail);
  await ownerExpo.goto('/?view=private');
  await expect(ownerExpo.getByTestId('capacity-map-workspace')).toBeVisible();
  await expect(ownerExpo.getByRole('button',{name:/Isuzu Journey/})).toBeVisible();
  await ownerExpo.getByRole('button',{name:'Search transporters',exact:true}).click();
  await ownerExpo.getByRole('textbox',{name:'Search transporters',exact:true}).fill(`Audit fleet ${provider.suffix}`);
  await expect(ownerExpo.getByText(`Audit fleet ${provider.suffix}`,{exact:true}).first()).toBeVisible();
  await ownerExpo.getByRole('button',{name:'Show vehicles on map',exact:true}).first().click();
  await expect(ownerExpo.getByRole('button',{name:/Isuzu Journey/})).toBeVisible();
  await ownerExpo.getByRole('button',{name:/Isuzu Journey/}).click();
  await ownerExpo.getByRole('button',{name:'Vehicle details',exact:true}).click();
  await expect(ownerExpo.getByRole('heading',{name:'Vehicle details',exact:true})).toBeVisible();
  await ownerExpo.getByRole('button',{name:'Close map signal details'}).last().click();
  await ownerExpo.getByRole('button',{name:'Back to map',exact:true}).click();
  await ownerExpo.getByRole('button',{name:'Vehicle filters',exact:true}).click();
  await ownerExpo.getByRole('checkbox',{name:'Empty vehicle',exact:true}).click();
  await ownerExpo.getByRole('button',{name:'Show vehicles',exact:true}).click();
  await expect(ownerExpo.getByRole('button',{name:/Isuzu Journey/})).toBeVisible();
  await ownerExpo.goto('/directory');
  await ownerExpo.getByRole('tab',{name:'Connections',exact:true}).click();
  await expect(ownerExpo.getByText(`Audit fleet ${provider.suffix}`).filter({visible:true}).first()).toBeVisible();
  await ownerExpo.goto('/business-tracking');await expect(ownerExpo.getByText(`Journey cargo ${nonce}`)).toBeVisible();
  await ownerExpo.getByRole('button',{name:/Addis Ababa.*Dire Dawa/i}).click();
  await ownerExpo.getByRole('button',{name:'Open shipment progress',exact:true}).click();
  await expect(ownerExpo.getByTestId('tracking-native-map-workspace').getByText(`Journey cargo ${nonce}`,{exact:true})).toBeVisible();
  const ownerDetail=await ownerExpo.request.get(`${expo}/api/business-workspaces/${owned.workspaceId}/tracking/${owned.shipmentId}`,{headers:{Authorization:`Bearer ${ownerToken}`}});
  expect(ownerDetail.status()).toBe(200);
  expect((await ownerDetail.json()).canViewLocation).toBe(true);
  proof.nativeCapacity=true;proof.nativeTracking=true;record();
  await ownerExpo.context().close();
  const providerExpo=await phone(expo);await nativeLogin(providerExpo,provider.email);
  await providerExpo.goto('/network');
  await providerExpo.getByRole('tab',{name:'Vehicle sharing',exact:true}).click();
  await expect(providerExpo.getByText(`Journey broker ${nonce}`,{exact:true}).filter({visible:true}).first()).toBeVisible();
  proof.nativeProviderShare=true;record();await providerExpo.context().close();

  proof.stage='STAFF_PERMISSION';record();
  const staffWeb=await phone(web);await webLogin(staffWeb,staffEmail,'customer');
  await staffWeb.goto('/app/business/tracking');
  await ensureWebConsent(staffWeb);
  await expect(staffWeb.getByText(shipment.code,{exact:true})).toBeVisible();
  await staffWeb.goto(`/app/business/tracking/${owned.shipmentId}`);
  await expect(staffWeb.getByText(`Journey cargo ${nonce}`,{exact:true})).toBeVisible();
  await expect(staffWeb.locator('.tracking-truck-marker')).toHaveCount(0);
  const staffExpo=await phone(expo),staffToken=await nativeLogin(staffExpo,staffEmail);
  await staffExpo.goto('/?view=private');
  await expect(staffExpo.getByRole('button',{name:/Isuzu Journey/})).toBeVisible();
  await staffExpo.goto('/business-tracking');
  await expect(staffExpo.getByText(`Journey cargo ${nonce}`)).toBeVisible();
  await staffExpo.getByRole('button',{name:/Addis Ababa.*Dire Dawa/i}).click();
  await staffExpo.getByRole('button',{name:'Open shipment progress',exact:true}).click();
  await expect(staffExpo.getByTestId('tracking-native-map-workspace').getByText(`Journey cargo ${nonce}`,{exact:true})).toBeVisible();
  const staffDetail=await staffExpo.request.get(`${expo}/api/business-workspaces/${owned.workspaceId}/tracking/${owned.shipmentId}`,{headers:{Authorization:`Bearer ${staffToken}`}});
  expect(staffDetail.status()).toBe(200);
  const detail=await staffDetail.json();expect(detail.canViewLocation).toBe(false);expect(detail.location).toBeNull();
  const denied=await staffWeb.request.post(`/api/business-workspaces/${owned.workspaceId}`,{data:{action:'INVITE',expectedVersion:checked(await service.from('business_workspaces').select('version').eq('id',owned.workspaceId).single()).version,
   email:`denied-${nonce}@loadgistic.local`,role:'STAFF',capacity:true,tracking:true}});
  expect(denied.status()).toBe(403);
  proof.staffRead=true;proof.staffDenied=true;record();
  await staffWeb.context().close();await staffExpo.context().close();
 }catch(error){initialFailure=error;record();}
 finally{
  await Promise.allSettled(contexts.map(context=>context.close()));
  test.setTimeout(info.timeout+45_000);
  try{
   proof.stage='CLEANUP';record();
   if(owned.shipmentId){
    checked(await service.from('tracking_sharing_audit').delete().eq('shipment_id',owned.shipmentId));
    checked(await service.from('access_email_deliveries').delete().eq('entity_id',owned.shipmentId));
    checked(await service.from('audit_logs').delete().eq('entity_id',owned.shipmentId));
    checked(await service.from('provider_shipments').delete().eq('id',owned.shipmentId));
   }
   if(owned.workspaceId){cleanupLocalBusinessWorkspace(owned,`journey-broker-${nonce}`);manifest();}
   if(owned.vehicleId){
    checked(await service.from('audit_logs').delete().eq('entity_id',owned.vehicleId));
    checked(await auditDeleteVehicles(service,'id',owned.vehicleId));
   }
   for(const id of [owned.ownerId,owned.staffId,owned.providerId].filter(Boolean)){
    checked(await service.from('audit_logs').delete().eq('actor_user_id',id));
    checked(await service.auth.admin.deleteUser(id));
   }
   if(owned.organizationId)checked(await service.from('organizations').delete().eq('id',owned.organizationId));
   if(owned.vehicleId)expect(checked(await service.from('vehicles').select('id').eq('id',owned.vehicleId))).toHaveLength(0);
   if(owned.connectionId)expect(checked(await service.from('account_connections').select('id').eq('id',owned.connectionId))).toHaveLength(0);
   if(owned.grantId)expect(checked(await service.from('account_capacity_grants').select('id').eq('id',owned.grantId))).toHaveLength(0);
   if(owned.shipmentId)expect(checked(await service.from('provider_shipments').select('id').eq('id',owned.shipmentId))).toHaveLength(0);
   for(const id of [owned.ownerId,owned.staffId,owned.providerId].filter(Boolean))
    expect(checked(await service.from('profiles').select('id').eq('id',id))).toHaveLength(0);
   proof.cleaned=true;proof.stage='COMPLETE';record();
  }catch(error){cleanupFailure=error;record();}
 }
 if(initialFailure||cleanupFailure)throw new AggregateError([initialFailure,cleanupFailure].filter(Boolean),'BUSINESS_RUNTIME_PARITY_FAILED');
});
