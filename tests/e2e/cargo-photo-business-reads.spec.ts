import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import type {BrowserContext,Page} from 'playwright-core';
import {test,expect} from './browser-test';
import {acceptAuditContentPolicy,auditDeleteVehicles,auditFleetProvider,checked,localAuditService} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {createProviderVehicle,updateFleetDriverAccess} from '../../src/lib/fleet.js';
import {setProviderVehiclePublication} from '../../src/lib/provider-authority.js';
import {publishProviderCapacity} from '../../src/lib/provider-capacity.js';

// Each run creates its own local people, workspace, vehicle and private Storage
// object; no managed demo or hosted data is used.
test.use({headless:true,trace:'off',video:'off',screenshot:'only-on-failure'});
const web='http://127.0.0.1:3100';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const photoPath=/^supabase:\/\/capacity-photo\/(capacity\/\d{4}-\d{2}-\d{2}\/[a-f0-9-]{36}\.jpg)$/;
type Owned={providerId:string;organizationId:string;driverId:string;vehicleId:string;ownerId:string;staffId:string;workspaceId:string;connectionId:string;grantId:string;photoId:string};

async function deleteExactBroker(db:ReturnType<typeof localAuditService>,owned:Owned,nonce:string){
 if(!owned.workspaceId)return;
 if(process.env.NEXT_PUBLIC_SUPABASE_URL!== 'http://127.0.0.1:55321'||!/^photo-broker-[0-9a-f]{8}$/.test(`photo-broker-${nonce}`))throw Error('LOCAL_PHOTO_FIXTURE_REQUIRED');
 for(const id of [owned.workspaceId,owned.ownerId,owned.staffId,owned.providerId,owned.organizationId,owned.vehicleId])
  if(id&&!uuid.test(id))throw Error('INVALID_PHOTO_FIXTURE_ID');
 const connections=checked(await db.from('account_connections').select('id,requester_id,requested_by,recipient_id')
  .eq('recipient_id',owned.workspaceId));
 if(connections.length>1||connections.some((row:{id:string;requester_id:string;requested_by:string;recipient_id:string})=>
  row.requester_id!==owned.organizationId||row.requested_by!==owned.providerId||row.recipient_id!==owned.workspaceId||
  Boolean(owned.connectionId&&row.id!==owned.connectionId)))throw Error('PHOTO_CONNECTION_SCOPE_CHANGED');
 if(connections[0])owned.connectionId=connections[0].id;
 const grants=checked(await db.from('account_capacity_grants').select('id,connection_id,vehicle_id,recipient_id')
  .eq('recipient_id',owned.workspaceId));
 if(grants.length>1||grants.some((row:{id:string;connection_id:string;vehicle_id:string;recipient_id:string})=>
  row.connection_id!==owned.connectionId||row.vehicle_id!==owned.vehicleId||row.recipient_id!==owned.workspaceId||
  Boolean(owned.grantId&&row.id!==owned.grantId)))throw Error('PHOTO_GRANT_SCOPE_CHANGED');
 if(grants[0])owned.grantId=grants[0].id;
 for(const id of [owned.connectionId,owned.grantId])if(id&&!uuid.test(id))throw Error('INVALID_PHOTO_FIXTURE_ID');
 const sql=`begin; set local lock_timeout='5s'; set local statement_timeout='20s';
 do $cleanup$ declare w uuid:='${owned.workspaceId}'; c uuid:=nullif('${owned.connectionId}','')::uuid;
 g uuid:=nullif('${owned.grantId}','')::uuid; v uuid:=nullif('${owned.vehicleId}','')::uuid;
 begin
  perform 1 from public.business_workspaces where id=w and handle='photo-broker-${nonce}' and name='Photo broker ${nonce}' for update;
  if not found then raise exception 'EXACT_PHOTO_WORKSPACE_REQUIRED'; end if;
  if not exists(select 1 from public.business_workspace_members where workspace_id=w and user_id='${owned.ownerId}'::uuid and role='OWNER')
   or exists(select 1 from public.business_workspace_members where workspace_id=w and user_id not in('${owned.ownerId}'::uuid,'${owned.staffId}'::uuid))
  then raise exception 'PHOTO_MEMBERS_CHANGED'; end if;
  if exists(select 1 from public.account_connections where (requester_id=w or recipient_id=w) and id is distinct from c)
   or exists(select 1 from public.account_capacity_grants where recipient_id=w and id is distinct from g)
   or exists(select 1 from public.tracking_sharing_controls where business_workspace_id=w)
  then raise exception 'PHOTO_WORKSPACE_REFERENCED'; end if;
  if g is not null then
   delete from public.audit_logs where entity_id=g;
   delete from public.account_capacity_grants where id=g and connection_id=c and vehicle_id=v and recipient_id=w;
   if not found then raise exception 'EXACT_PHOTO_GRANT_REQUIRED'; end if;
  end if;
  if c is not null then
   delete from public.audit_logs where entity_id=c;
   delete from public.account_connections where id=c and requester_id='${owned.organizationId}'::uuid and recipient_id=w;
   if not found then raise exception 'EXACT_PHOTO_CONNECTION_REQUIRED'; end if;
  end if;
  delete from public.business_workspace_selections where workspace_id=w;
  delete from public.business_workspace_audit where workspace_id=w;
  delete from public.business_workspace_invitations where workspace_id=w;
  delete from public.business_workspace_members where workspace_id=w;
  delete from public.business_workspaces where id=w and handle='photo-broker-${nonce}';
  if not found then raise exception 'EXACT_PHOTO_WORKSPACE_DELETE_REQUIRED'; end if;
 end $cleanup$; commit;`;
 execFileSync('docker',['exec','supabase_db_loadgistic-local','psql','-X','-q','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-c',sql],{timeout:25_000,stdio:'pipe'});
}

async function deleteExactPhotos(db:ReturnType<typeof localAuditService>,owned:Owned){
 if(!owned.vehicleId)return;
 if(!uuid.test(owned.vehicleId))throw Error('INVALID_PHOTO_FIXTURE_ID');
 const rows=checked(await db.from('cargo_space_photos').select('id,vehicle_id,uploaded_by,storage_path').eq('vehicle_id',owned.vehicleId));
 if(rows.length&&!uuid.test(owned.driverId))throw Error('PHOTO_DRIVER_SCOPE_UNKNOWN');
 if(rows.length>2||rows.some((row:{id:string;vehicle_id:string;uploaded_by:string;storage_path:string})=>
  !uuid.test(row.id)||row.vehicle_id!==owned.vehicleId||row.uploaded_by!==owned.driverId||!photoPath.test(row.storage_path)||
  Boolean(owned.photoId&&row.id!==owned.photoId)))throw Error('PHOTO_STORAGE_SCOPE_CHANGED');
 for(const row of rows){
  const key=photoPath.exec(row.storage_path)![1];
  const existing=await db.storage.from('capacity-photo').exists(key);
  if(existing.data===true)checked(await db.storage.from('capacity-photo').remove([key]));
  else if(existing.error&&!['400','404'].includes(String(existing.error.status)))throw Error('PHOTO_STORAGE_EXISTENCE_UNKNOWN');
  const gone=await db.storage.from('capacity-photo').exists(key);
  if(gone.data!==false||gone.error&&!['400','404'].includes(String(gone.error.status)))throw Error('PHOTO_STORAGE_CLEANUP_UNVERIFIED');
 }
 const requests=checked(await db.from('cargo_space_photo_requests').select('id,workspace_id,requested_by').eq('vehicle_id',owned.vehicleId));
 if(requests.some((row:{id:string;workspace_id:string;requested_by:string})=>
  !uuid.test(row.id)||row.workspace_id!==owned.workspaceId||![owned.ownerId,owned.staffId].includes(row.requested_by)))
  throw Error('PHOTO_REQUEST_SCOPE_CHANGED');
 if(requests.length)checked(await db.from('cargo_space_photo_requests').delete().eq('vehicle_id',owned.vehicleId).eq('workspace_id',owned.workspaceId));
 checked(await db.from('cargo_space_photos').delete().eq('vehicle_id',owned.vehicleId));
 expect(checked(await db.from('cargo_space_photos').select('id').eq('vehicle_id',owned.vehicleId))).toHaveLength(0);
}

function verifyExactCleanup(owned:Owned){
 if(process.env.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:55321')throw Error('LOCAL_PHOTO_READBACK_REQUIRED');
 for(const id of Object.values(owned))if(id&&!uuid.test(id))throw Error('INVALID_PHOTO_FIXTURE_ID');
 const id=(value:string)=>`nullif('${value}','')::uuid`;
 const people=`array[${[owned.ownerId,owned.staffId,owned.driverId,owned.providerId].filter(Boolean).map(value=>`'${value}'::uuid`).join(',')}]::uuid[]`;
 const sql=`select jsonb_build_object(
  'workspace',(select count(*) from public.business_workspaces where id=${id(owned.workspaceId)}),
  'connection',(select count(*) from public.account_connections where id=${id(owned.connectionId)}),
  'grant',(select count(*) from public.account_capacity_grants where id=${id(owned.grantId)}),
  'vehicle',(select count(*) from public.vehicles where id=${id(owned.vehicleId)}),
  'photo',(select count(*) from public.cargo_space_photos where id=${id(owned.photoId)}),
  'photo_requests',(select count(*) from public.cargo_space_photo_requests where vehicle_id=${id(owned.vehicleId)}),
  'profiles',(select count(*) from public.profiles where id=any(${people})),
  'auth_users',(select count(*) from auth.users where id=any(${people})),
  'organization',(select count(*) from public.organizations where id=${id(owned.organizationId)}))::text;`;
 const raw=execFileSync('docker',['exec','supabase_db_loadgistic-local','psql','-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-c',sql],
  {timeout:20_000,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
 const counts=JSON.parse(raw) as Record<string,number>;
 expect(Object.keys(counts)).toHaveLength(9);
 expect(Object.values(counts)).toEqual(Array(9).fill(0));
}

async function openPrivatePhoto(page:Page,workspaceId:string,vehicleId:string,photoId:string){
 const capacity=await page.request.get(`/api/business-workspaces/${workspaceId}/capacity`);
 expect(capacity.status()).toBe(200);
 const item=(await capacity.json() as {items:{id:string;vehicle_id:string}[]}).items.find(item=>item.vehicle_id===vehicleId);
 expect(item?.id).toMatch(uuid);
 await page.goto(`/?view=private&truck=${item!.id}`,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Vehicle details',exact:true}).click();
 const sheet=page.locator('.truck-inspection');await expect(sheet).toBeVisible();
 const panel=sheet.locator('details.cargo-photo-panel');await expect(panel).toBeVisible();
 await panel.locator('summary').click();
 await panel.getByRole('button',{name:'Open photo',exact:true}).click();
 const image=panel.getByRole('img',{name:'Cargo space photo'});
 await expect(image).toHaveAttribute('src',`/api/business-workspaces/${workspaceId}/capacity/photos/${photoId}`);
 await expect.poll(()=>image.evaluate((element:HTMLImageElement)=>element.complete&&element.naturalWidth>0)).toBe(true);
}

test('broker owner and permitted staff can read a private cargo photo until vehicle access is revoked',async({browser,request},info)=>{
 test.skip(info.project.name!=='desktop-chromium','One serialized browser run uses explicit phone-sized owner and staff contexts.');
 test.setTimeout(240_000);
 const db=localAuditService(),nonce=randomUUID().slice(0,8),started=Date.now();
 const owned:Owned={providerId:'',organizationId:'',driverId:'',vehicleId:'',ownerId:'',staffId:'',workspaceId:'',connectionId:'',grantId:'',photoId:''};
 const contexts:BrowserContext[]=[];let primary:unknown=null,cleanup:unknown=null;
 const manifest=()=>writeFileSync(info.outputPath('cargo-photo-owned.json'),JSON.stringify({nonce,stage,owned},null,2),{mode:0o600});
 let stage='SETUP';manifest();
 const phone=async()=>{const context=await browser.newContext({baseURL:web,viewport:{width:390,height:844},isMobile:true,hasTouch:true,
  extraHTTPHeaders:{'x-forwarded-for':`127.0.0.${240+contexts.length}`}});contexts.push(context);return context.newPage();};
 try{
  const provider=await auditFleetProvider(db,'photo-read');owned.providerId=provider.id;owned.organizationId=provider.organization_id;manifest();
  owned.ownerId=checked(await db.auth.admin.createUser({email:`photo-owner-${nonce}@loadgistic.local`,email_confirm:true})).user.id;manifest();
  checked(await db.from('profiles').update({role:'SHIPPER',active:true,first_name:'Photo owner',full_name:'Photo owner'}).eq('id',owned.ownerId));
  owned.staffId=checked(await db.auth.admin.createUser({email:`photo-staff-${nonce}@loadgistic.local`,email_confirm:true})).user.id;manifest();
  checked(await db.from('profiles').update({role:'SHIPPER',active:true,first_name:'Photo staff',full_name:'Photo staff'}).eq('id',owned.staffId));
  for(const id of [owned.ownerId,owned.staffId])checked(await db.rpc('accept_content_policy',{actor_user_id:id,policy_version:'2026-10-09'}));
  const workspace=checked(await db.rpc('business_workspace_create',{actor_user_id:owned.ownerId,
   command:{name:`Photo broker ${nonce}`,handle:`photo-broker-${nonce}`,kind:'BROKER'}}));
  owned.workspaceId=workspace.id;manifest();
  const invited=checked(await db.rpc('business_workspace_command',{actor_user_id:owned.ownerId,target_workspace_id:owned.workspaceId,
   command:{action:'INVITE',expectedVersion:workspace.version,email:`photo-staff-${nonce}@loadgistic.local`,role:'STAFF',capacity:true,tracking:false}}));
  checked(await db.rpc('business_workspace_accept_invitation',{actor_user_id:owned.staffId,invitation_id:invited.invitationId}));
  checked(await db.from('company_pages').update({published:true}).eq('organization_id',owned.organizationId));
  const vehicle=await createProviderVehicle(provider,{useBasis:'OWNED',make:'Isuzu',model:'Photo test',plate:`PIC-${nonce}`,
   cargoConfiguration:'Mini Box Truck',trailerInterchangeable:false});owned.vehicleId=vehicle.id;manifest();
  owned.driverId=checked(await db.auth.admin.createUser({email:`photo-driver-${nonce}@loadgistic.local`,email_confirm:true})).user.id;manifest();
  checked(await db.from('profiles').update({role:'DRIVER',active:true,first_name:'Photo driver',full_name:'Photo driver'}).eq('id',owned.driverId));
  checked(await db.from('organization_members').insert({organization_id:owned.organizationId,user_id:owned.driverId,membership_role:'DRIVER'}));
  checked(await db.from('drivers').insert({organization_id:owned.organizationId,user_id:owned.driverId,name:'Photo driver'}));
  await acceptAuditContentPolicy(db,owned.driverId);
  await updateFleetDriverAccess(provider,owned.driverId,{vehicleId:owned.vehicleId,canManageCapacity:true,canManageTracking:true});
  await setProviderVehiclePublication(provider,owned.vehicleId,'LIVE');
  const place=async(name:string)=>checked(await db.from('place_catalog').select('id').eq('normalized_name',name).limit(1).single()).id as string;
  await publishProviderCapacity({id:owned.driverId,role:'DRIVER',driver_kind:'COMPANY',organization_id:owned.organizationId},{vehicleId:owned.vehicleId,status:'EMPTY',acceptedLoads:'BOTH',availabilityGeometry:'ROUTE',
   visibility:'PRIVATE',locationSource:'DEVICE_OBSCURED',approximateLat:9.03,approximateLng:38.76,locationPrecisionKm:10,
   currentRoutePlaces:[await place('addis ababa'),await place('adama')].map(placeRef=>({placeRef}))});
  owned.connectionId=checked(await db.rpc('request_account_connection',{actor_user_id:owned.providerId,
   target_kind:'BUSINESS',target_id:owned.workspaceId})).id;manifest();
  checked(await db.rpc('decide_account_connection',{actor_user_id:owned.ownerId,target_connection_id:owned.connectionId,decision:'ACCEPT'}));
  owned.grantId=checked(await db.rpc('grant_account_capacity_access',{actor_user_id:owned.providerId,
   target_connection_id:owned.connectionId,target_vehicle_id:owned.vehicleId})).id;manifest();

  stage='DRIVER_UPLOAD';manifest();
  const driverPage=await phone();await localSupportLogin(driverPage,owned.driverId);
  const upload=await driverPage.request.post('/api/capacity/cargo-space-photos',{multipart:{
   command:JSON.stringify({vehicleId:owned.vehicleId,source:'UPLOAD'}),
   file:{name:'synthetic-cargo.png',mimeType:'image/png',buffer:readFileSync('public/icon-192.png')}
  }});
  expect(upload.status()).toBe(201);
  owned.photoId=(await upload.json() as {photo:{id:string}}).photo.id;manifest();expect(owned.photoId).toMatch(uuid);
  const photo=checked(await db.from('cargo_space_photos').select('storage_path,uploaded_by,state,created_at')
   .eq('id',owned.photoId).single());
  expect(photo.uploaded_by).toBe(owned.driverId);expect(photo.state).toBe('ACTIVE');
  expect(photoPath.test(photo.storage_path)).toBe(true);expect(new Date(photo.created_at).getTime()).toBeGreaterThanOrEqual(started-5000);
  const filePath=`/api/business-workspaces/${owned.workspaceId}/capacity/photos/${owned.photoId}`;
  const anonymous=await request.get(filePath);expect([401,403,404]).toContain(anonymous.status());
  expect(anonymous.headers()['cache-control']).toMatch(/no-store/i);
  await driverPage.context().close();

  for(const [role,userId] of [['OWNER',owned.ownerId],['STAFF',owned.staffId]] as const){
   stage=`${role}_READ`;manifest();
   const page=await phone();await localSupportLogin(page,userId);
   const summary=await page.request.get(`/api/business-workspaces/${owned.workspaceId}/capacity/photos?vehicleId=${owned.vehicleId}`);
   expect(summary.status()).toBe(200);
   expect((await summary.json() as {photo:{id:string;contentPath:string}}).photo).toMatchObject({id:owned.photoId,contentPath:filePath});
   const bytes=await page.request.get(filePath);expect(bytes.status()).toBe(200);
   expect(bytes.headers()['content-type']).toMatch(/^image\/jpeg/);
   expect(bytes.headers()['cache-control']).toMatch(/no-store/i);
   expect((await bytes.body()).length).toBeGreaterThan(0);
   await openPrivatePhoto(page,owned.workspaceId,owned.vehicleId,owned.photoId);
  }

  stage='REVOKE_AND_DENY';manifest();
  checked(await db.rpc('revoke_account_capacity_access',{actor_user_id:owned.providerId,target_grant_id:owned.grantId,expected_revision:1}));
  for(const context of contexts.slice(1)){
   const response=await context.request.get(filePath);
   expect([403,404]).toContain(response.status());expect(response.headers()['cache-control']).toMatch(/no-store/i);
   const summary=await context.request.get(`/api/business-workspaces/${owned.workspaceId}/capacity/photos?vehicleId=${owned.vehicleId}`);
   expect([403,404]).toContain(summary.status());
  }
 }catch(error){primary=error;}
 finally{
  await Promise.allSettled(contexts.map(context=>context.close()));
  test.setTimeout(info.timeout+60_000);
  stage='CLEANUP';manifest();
  try{
   await deleteExactPhotos(db,owned);
   await deleteExactBroker(db,owned,nonce);
   if(owned.vehicleId){
    const capacities=checked(await db.from('capacities').select('id').eq('vehicle_id',owned.vehicleId));
    for(const capacity of capacities)checked(await db.from('audit_logs').delete().eq('entity_id',capacity.id));
    checked(await db.from('audit_logs').delete().eq('entity_id',owned.vehicleId));
    checked(await db.from('capacities').delete().eq('vehicle_id',owned.vehicleId));
    checked(await db.from('telematics_location_sources').delete().eq('vehicle_id',owned.vehicleId));
    checked(await db.from('driver_vehicle_assignments').delete().eq('vehicle_id',owned.vehicleId));
    checked(await auditDeleteVehicles(db,'id',owned.vehicleId));
   }
   if(owned.driverId){
    checked(await db.from('drivers').delete().eq('user_id',owned.driverId));
    checked(await db.from('organization_members').delete().eq('user_id',owned.driverId).eq('organization_id',owned.organizationId));
   }
   if(owned.organizationId){
    checked(await db.from('company_pages').delete().eq('organization_id',owned.organizationId));
    if(owned.providerId)checked(await db.from('organization_members').delete().eq('user_id',owned.providerId).eq('organization_id',owned.organizationId));
    checked(await db.from('audit_logs').delete().eq('organization_id',owned.organizationId));
    checked(await db.from('organizations').delete().eq('id',owned.organizationId));
   }
   for(const id of [owned.ownerId,owned.staffId,owned.driverId,owned.providerId].filter(Boolean)){
    checked(await db.from('audit_logs').delete().eq('actor_user_id',id));checked(await db.auth.admin.deleteUser(id));
   }
   verifyExactCleanup(owned);
   stage='CLEAN';manifest();
  }catch(error){cleanup=error;stage='CLEANUP_FAILED';manifest();}
 }
 if(primary||cleanup)throw new AggregateError([primary,cleanup].filter(Boolean),'CARGO_PHOTO_BUSINESS_READS_FAILED');
});
