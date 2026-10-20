import {test,expect} from './browser-test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {localAuditService,checked,auditProvider,auditDeleteVehicles} from './audit-helpers';
import {updateFleetDriverAccess} from '../../src/lib/fleet.js';
import {localSupportLogin} from './provider-support-helper';
import {localMailpitNumericCode} from './mailpit-helper';

// Local synthetic identities only. Never record credentials, sessions or inboxes.
test.use({trace:'off',screenshot:'off'});
async function admin(service:any){const email=`play-admin-${randomUUID()}@example.test`;const id=checked(await service.auth.admin.createUser({email,email_confirm:true})).user.id;checked(await service.from('profiles').update({role:'ADMIN',active:true,full_name:'Synthetic privacy administrator'}).eq('id',id));return {id,email};}
async function remove(service:any,actor:any){
 const requests=checked(await service.from('account_deletion_requests').select('id').eq('subject_user_id',actor.id));
 for(const r of requests)checked(await service.from('account_erasure_files').delete().eq('request_id',r.id));
 checked(await service.from('account_deletion_requests').delete().eq('subject_user_id',actor.id));
 checked(await service.from('app_review_accounts').delete().eq('user_id',actor.id));
 if(actor.provider_profile_id){
  const shipments=checked(await service.from('provider_shipments').select('id').eq('provider_profile_id',actor.provider_profile_id));
  for(const s of shipments){checked(await service.from('provider_tracking_recipients').delete().eq('shipment_id',s.id));checked(await service.from('provider_shipment_events').delete().eq('shipment_id',s.id));checked(await service.from('provider_shipments').delete().eq('id',s.id));}
  checked(await service.from('content_reports').delete().eq('provider_profile_id',actor.provider_profile_id));
  checked(await service.from('driver_vehicle_assignments').delete().eq('driver_user_id',actor.id));
  const trucks=checked(await service.from('vehicles').select('id').eq('provider_profile_id',actor.provider_profile_id));
  for(const truck of trucks){checked(await service.from('capacity_access_grants').delete().eq('vehicle_id',truck.id));checked(await service.from('capacities').delete().eq('vehicle_id',truck.id));}
  checked(await auditDeleteVehicles(service,'provider_profile_id',actor.provider_profile_id));
 }
 checked(await service.from('user_policy_acceptances').delete().eq('user_id',actor.id));
 checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));
 checked(await service.auth.admin.deleteUser(actor.id));
}

test('Play deletion verifies the inbox, persists its receipt, erases real storage and Auth, and preserves other accounts',async({page,browser}:{page:any;browser:any},info:any)=>{
 test.setTimeout(180000);const service=localAuditService();let subject:Awaited<ReturnType<typeof auditProvider>>|undefined,other:Awaited<ReturnType<typeof auditProvider>>|undefined,staff:Awaited<ReturnType<typeof admin>>|undefined,adminContext:any,logout:(()=>Promise<unknown>)|undefined,stage='FIXTURES';
 const file=`driver-portrait/2026-10-09/${randomUUID()}.jpg`;
 try{
  subject=await auditProvider(service,'play-erase');other=await auditProvider(service,'play-kept');staff=await admin(service);
  const bytes=await sharp(readFileSync('public/icon-192.png')).jpeg().toBuffer();
  checked(await service.storage.from('provider-profile').upload(file,bytes,{contentType:'image/jpeg'}));
  checked(await service.from('driver_portrait_uploads').insert({user_id:subject.id,file_path:`supabase://provider-profile/${file}`,size_bytes:bytes.length,state:'ACTIVE',upload_finished:true}));
  stage='INBOX_PAGE';
  await page.goto('/delete-account');await page.getByLabel('Account email',{exact:true}).fill(subject.email);
  stage='INBOX_REQUEST';
  const started=Date.now();await page.getByRole('button',{name:'Verify email to request deletion',exact:true}).click();
  stage='INBOX_CODE_FIELD';
  await expect(page.getByLabel('Email verification code',{exact:true})).toBeVisible();
  stage='INBOX_CODE_DELIVERY';
  const code=await localMailpitNumericCode(subject.email,started,['Your Loadgistic sign-in code','Your Loadgistic login code','Confirm Your Signup','Magic Link']);
  stage='INBOX_CODE_ENTRY';
  await page.getByLabel('Email verification code',{exact:true}).fill(code);
  stage='PERSISTED_DELETION_RECEIPT';
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Submit deletion request',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Deletion request received',exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:'Deletion request received',exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('play-policy-deletion-receipt.png')});
  const request=checked(await service.from('account_deletion_requests').select('id,status').eq('subject_user_id',subject.id).single());expect(request.status).toBe('REQUESTED');
  stage='ADMIN_PROCESS_DELETION';
  adminContext=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize(),isMobile:Boolean(info.project.use.isMobile),hasTouch:Boolean(info.project.use.hasTouch)});const control=await adminContext.newPage();logout=await localSupportLogin(control,staff.id);await control.goto('/admin/privacy');
  const card=control.locator('section[data-request-id="'+request.id+'"]');
  await card.getByRole('button',{name:'Process deletion request',exact:true}).click();const deletion=card.getByRole('dialog',{name:'Process deletion request',exact:true});await deletion.getByRole('checkbox').check();await deletion.getByLabel('Type DELETE to confirm').fill('DELETE');await deletion.getByRole('button',{name:'Process deletion request',exact:true}).click();
  await expect(control.getByText('Deletion completed.',{exact:true})).toBeVisible();
  stage='STORAGE_AUTH_AND_ACCOUNT_ISOLATION';
  expect(checked(await service.from('profiles').select('email,active,full_name').eq('id',subject.id).single()).full_name).toBe('Deleted account');
  expect(checked(await service.auth.admin.getUserById(subject.id)).user.email).not.toBe(subject.email);
  expect((await service.storage.from('provider-profile').download(file)).error).not.toBeNull();
  expect(checked(await service.from('profiles').select('active').eq('id',other.id).single()).active).toBe(true);
  stage='COMPLETED_RECEIPT';
  await page.getByRole('button',{name:'Check request status',exact:true}).click();await expect(page.getByRole('heading',{name:'Deletion completed',exact:true})).toBeVisible();
  stage='GUEST_PROCESS_DENIAL';
  const denied=await page.request.post('/api/admin/privacy/'+request.id,{form:{reviewed:'yes',confirmation:'DELETE'},maxRedirects:0});expect(new URL(denied.headers().location).searchParams.has('error')).toBe(true);
 }catch{throw Error('PLAY_DELETION_WORKFLOW_FAILED: '+stage);}
 finally{
  let cleanupFailures=0;
  async function clean(operation:()=>Promise<unknown>){try{await operation();}catch{cleanupFailures++;}}
  if(logout)await clean(logout);if(adminContext)await clean(()=>adminContext.close());
  let fileRemoved=false;
  await clean(async()=>{
   checked(await service.storage.from('provider-profile').remove([file]));
   expect(checked(await service.storage.from('provider-profile').list('driver-portrait/2026-10-09',{search:file.split('/').at(-1),limit:1}))).toHaveLength(0);
   fileRemoved=true;
  });
  // A pre-processing failure can leave this exact portrait row. Preserve its
  // reference and subject identity if deleting its acknowledged file fails.
  const subjectId=subject?.id;
  if(subjectId&&fileRemoved)await clean(async()=>checked(await service.from('driver_portrait_uploads').delete().eq('user_id',subjectId).eq('file_path',`supabase://provider-profile/${file}`)));
  const actors=[subject,other,staff].filter((actor):actor is NonNullable<typeof actor>=>Boolean(actor));
  for(const actor of actors)if(actor!==subject||fileRemoved)await clean(()=>remove(service,actor));
  const userIds=actors.map(actor=>actor.id),providerIds=[subject?.provider_profile_id,other?.provider_profile_id].filter(Boolean);
  if(userIds.length){
   await clean(async()=>expect(checked(await service.from('profiles').select('id').in('id',userIds))).toHaveLength(0));
   await clean(async()=>expect(checked(await service.from('account_deletion_requests').select('id').in('subject_user_id',userIds))).toHaveLength(0));
   await clean(async()=>expect(checked(await service.from('driver_portrait_uploads').select('id').in('user_id',userIds))).toHaveLength(0));
   for(const id of userIds)await clean(async()=>expect((await service.auth.admin.getUserById(id)).error?.status).toBe(404));
  }
  if(providerIds.length)await clean(async()=>expect(checked(await service.from('provider_profiles').select('id').in('id',providerIds))).toHaveLength(0));
  if(cleanupFailures)throw Error('PLAY_DELETION_WORKFLOW_FAILED: EXACT_CLEANUP');
 }
});

test('Play public reporting reaches moderation, hide and restore are effective, and viewer block is reversible',async({page,browser}:{page:any;browser:any},info:any)=>{
 test.setTimeout(150000);const service=localAuditService(),subject=await auditProvider(service,'play-content'),staff=await admin(service);let adminContext:any;
 const phase=(value:string)=>console.log('PLAY_PUBLIC_REPORT_STAGE '+value);
 const handle=`play-content-${subject.suffix}`;
 try{
  phase('PUBLISH_PROFILE');
  checked(await service.from('company_pages').update({published:true,about:'Synthetic road-freight profile for the policy workflow.'}).eq('provider_profile_id',subject.provider_profile_id));
  phase('NAVIGATE_PROFILE');
  await page.goto('/providers/'+handle,{waitUntil:'domcontentloaded'});
  phase('OPEN_REPORT');
  const reportButton=page.getByRole('button',{name:'Report content',exact:true});
  const originalViewport=page.viewportSize();
  if(info.project.name==='desktop-chromium'&&originalViewport){
   await page.setViewportSize({width:1920,height:900});
   await reportButton.scrollIntoViewIfNeeded();
   await page.screenshot({path:'.local/ci-ui-20261019/report-actions-wide-desktop.png'});
   await page.setViewportSize(originalViewport);
  }
  await reportButton.scrollIntoViewIfNeeded();
  await page.screenshot({path:`.local/ci-ui-20261019/report-actions-${info.project.name}.png`});
  await reportButton.click({timeout:15000});
  phase('SEND_REPORT');
  await page.getByLabel('Tell us what needs attention',{exact:true}).fill('Synthetic report to verify the moderation workflow.');await Promise.all([page.waitForResponse((r:any)=>r.url().endsWith('/api/mobile/public/content-report'),{timeout:25000}),page.getByRole('button',{name:'Send report',exact:true}).click()]);
  await expect(page.getByText('Report received. Our team will review the content.',{exact:true})).toBeVisible();await page.screenshot({path:'.local/play-policy-report-phone.png'});await page.getByRole('button',{name:'Close',exact:true}).click();
  phase('ADMIN_HIDE');
  const report=checked(await service.from('content_reports').select('id,status').eq('provider_profile_id',subject.provider_profile_id).single());expect(report.status).toBe('PENDING');
  adminContext=await browser.newContext({baseURL:info.project.use.baseURL});const control=await adminContext.newPage();await localSupportLogin(control,staff.id);await control.goto('/admin/reviews/content');
  const response=await control.request.post('/api/admin/content/'+report.id,{form:{decision:'HIDE',note:'Synthetic content investigation completed.'},maxRedirects:0});expect(new URL(response.headers().location).searchParams.has('success')).toBe(true);
  expect((await page.request.get('/api/mobile/public/providers/'+handle)).status()).toBe(404);
  expect(checked(await service.from('provider_profiles').select('content_hidden,public_visibility').eq('id',subject.provider_profile_id).single()).public_visibility).toBe('PRIVATE');
  phase('ADMIN_RESTORE');
  const restore=await control.request.post('/api/admin/content/'+report.id,{form:{decision:'RESTORE',note:'Synthetic replacement content checked.'},maxRedirects:0});expect(new URL(restore.headers().location).searchParams.has('success')).toBe(true);
  phase('BLOCK');
  await page.goto('/providers/'+handle);await page.getByRole('button',{name:'Block transporter',exact:true}).click();await expect(page.getByRole('heading',{name:'Transporter blocked',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Transporter blocked',exact:true})).toBeVisible();
  phase('UNBLOCK');
  await page.goto('/privacy');await page.getByRole('button',{name:'Unblock transporter',exact:true}).click();await expect(page.getByText('No blocked transporters.',{exact:true})).toBeVisible();await page.goto('/providers/'+handle);await expect(page.getByRole('heading',{name:'Transporter blocked',exact:true})).not.toBeVisible();await expect(page.getByRole('button',{name:'Report content',exact:true})).toBeVisible();
  phase('COMPLETE');
 }finally{await adminContext?.close();await remove(service,subject);await remove(service,staff);}
});

test('Play native reviewer uses normal login and accepted terms; private guest scopes revoke and ordinary accounts are denied',async({page}:{page:any})=>{
 test.setTimeout(180000);const service=localAuditService(),actor=await auditProvider(service,'play-review',{contentPolicyAccepted:false}),ordinary=await auditProvider(service,'play-normal');const password=randomUUID()+randomUUID();const trackingDigest=(randomUUID()+randomUUID()).replaceAll('-',''),capacityDigest=(randomUUID()+randomUUID()).replaceAll('-','');
 try{
  checked(await service.auth.admin.updateUserById(actor.id,{password,app_metadata:{loadgistic_review:true}}));
  checked(await service.from('provider_profiles').update({review_workspace:true}).eq('id',actor.provider_profile_id));
  checked(await service.from('app_review_accounts').insert({user_id:actor.id,provider_profile_id:actor.provider_profile_id,expected_role:'DRIVER',tracking_digest:trackingDigest,capacity_digest:capacityDigest}));
  const normalPassword=randomUUID()+randomUUID();checked(await service.auth.admin.updateUserById(ordinary.id,{password:normalPassword}));
  expect((await page.request.post('/api/mobile/review-access',{data:{email:ordinary.email,password:normalPassword}})).status()).toBe(401);
  await page.goto('http://localhost:8084/review-access');await page.getByLabel('Review account email',{exact:true}).fill(actor.email);await page.getByLabel('Review account password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByText('Before you share',{exact:true})).toBeVisible({timeout:60000});await page.screenshot({path:'.local/play-policy-native-content-consent-phone.png'});expect(checked(await service.from('user_policy_acceptances').select('user_id').eq('user_id',actor.id))).toHaveLength(0);
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Accept and continue',exact:true}).click();await expect(page.getByText('Before you share',{exact:true})).not.toBeVisible();expect(checked(await service.from('user_policy_acceptances').select('user_id').eq('user_id',actor.id))).toHaveLength(1);
  checked(await service.from('company_pages').update({published:true}).eq('provider_profile_id',actor.provider_profile_id));
  const truck=checked(await service.rpc('create_provider_vehicle',{actor_user_id:actor.id,command:{make:'Review',model:'Synthetic truck',plate:'PLAY-'+actor.suffix,cargo_configuration:'Mini Box Truck',use_basis:'OWNED'}})).id;
  expect(checked(await service.rpc('set_provider_driving_mode',{actor_user_id:actor.id,requested_drives_truck:true}))).toBe(true);
  await updateFleetDriverAccess(actor,actor.id,{vehicleId:truck,canManageCapacity:true,canManageTracking:true});
  expect(checked(await service.rpc('set_provider_vehicle_publication',{actor_user_id:actor.id,target_vehicle_id:truck,requested_state:'LIVE'}))).toMatchObject({vehicleId:truck,state:'LIVE'});
  const placeId=async(name:string)=>checked(await service.from('place_catalog').select('id').eq('normalized_name',name).limit(1).single()).id;
  const points=[{place_ref:await placeId('addis ababa')},{place_ref:await placeId('adama')},{place_ref:await placeId('dire dawa')}];
  checked(await service.rpc('refresh_provider_capacity_location',{actor_user_id:actor.id,command:{vehicle_id:truck,approximate_lat:41.8,approximate_lng:-87.6,location_precision_km:20}}));
  checked(await service.rpc('publish_provider_capacity',{actor_user_id:actor.id,command:{vehicle_id:truck,status:'EMPTY',accepted_loads:'BOTH',availability_geometry:'ROUTE',location_source:'PRESERVE_DRIVER',current_route_places:points,sharing_mode:'PRIVATE'}}));
  checked(await service.rpc('grant_private_capacity_access',{actor_user_id:actor.id,target_vehicle_id:truck,normalized_recipient_email:'synthetic@review.invalid',recipient_digest:capacityDigest}));
  const shipment=randomUUID();checked(await service.rpc('create_provider_tracking_with_recipients',{actor_user_id:actor.id,command:{id:shipment,code:'LGX-'+shipment.replaceAll('-','').slice(0,8).toUpperCase(),vehicle_id:truck,origin_place_ref:points[0].place_ref,passing_place_ref:points[1].place_ref,destination_place_ref:points[2].place_ref,cargo_summary:'Synthetic reviewer shipment',customer_email:'synthetic@review.invalid',customer_email_digest:trackingDigest,expected_delivery_date:new Date(Date.now()+2*86400000).toISOString().slice(0,10),tracking_mode:'LOCATION_AND_STATUS',tracking_code_hash:(randomUUID()+randomUUID()).replaceAll('-',''),review_code_hash:(randomUUID()+randomUUID()).replaceAll('-','')}}));
  await page.goto('http://localhost:8084/visitor-tracking');await page.getByRole('button',{name:'Open demo shipment tracking',exact:true}).click();await expect(page.getByText('Your shipments',{exact:true})).toBeVisible({timeout:20000});await expect(page.getByRole('link',{name:'View updates',exact:true})).toBeVisible({timeout:20000});await page.screenshot({path:'.local/play-policy-native-review-tracking.png'});
  await page.goto('http://localhost:8084/privacy');await page.getByRole('button',{name:'How location sharing works',exact:true}).click();await expect(page.getByText('Location during your shipment',{exact:true})).toBeVisible();await page.screenshot({path:'.local/play-policy-location-disclosure-phone.png'});await page.getByRole('button',{name:'Close',exact:true}).click();
  const login=await page.request.post('http://127.0.0.1:3100/api/mobile/review-access',{data:{email:actor.email,password}});expect(login.status()).toBe(200);const session=await login.json();
  const grant=await page.request.post('http://127.0.0.1:3100/api/mobile/review-access/visitor',{headers:{authorization:'Bearer '+session.accessToken},data:{scope:'capacity'}});expect(grant.status()).toBe(200);const wire=await grant.json();const signals=await page.request.get('http://127.0.0.1:3100/api/mobile/visitor/capacity/signals',{headers:{authorization:'Bearer '+wire.token}});expect(signals.status()).toBe(200);const privateData=await signals.json();expect(JSON.stringify(privateData)).toContain(truck);
  checked(await service.from('app_review_accounts').update({enabled:false}).eq('user_id',actor.id));
  expect((await page.request.get('http://127.0.0.1:3100/api/mobile/visitor/capacity/signals',{headers:{authorization:'Bearer '+wire.token}})).status()).toBe(401);
  expect((await page.request.get('http://127.0.0.1:3100/api/mobile/session',{headers:{authorization:'Bearer '+session.accessToken}})).status()).toBe(403);
 }finally{await page.goto('about:blank');await remove(service,actor);await remove(service,ordinary);}
});

test('Play normal mobile signup requires account-bound consent and explicitly publishes one of two Draft vehicles',async({page}:{page:any})=>{
 test.setTimeout(150000);const service=localAuditService(),email=`play-mobile-signup-${randomUUID()}@loadgistic.local`;let actor:any,session:any;
 // This synthetic workflow owns its local IP bucket; it must not inherit the
 // preceding shard's unrelated sign-in attempts or weaken production limits.
 const call=async(path:string,body?:unknown,token?:string)=>page.request.fetch('/api/mobile/'+path,{method:body===undefined?'GET':'POST',headers:{'x-forwarded-for':'127.0.0.230',...(token?{authorization:'Bearer '+token}:{})},...(body===undefined?{}:{data:body})});
 try{
  const requestedAt=Date.now(),request=await call('auth/request',{email});expect(request.status()).toBe(200);const handoff=(await request.json()).handoff;
  const code=await localMailpitNumericCode(email,requestedAt,['Your Loadgistic sign-in code','Your Loadgistic signup code']);const verified=await call('auth/verify',{handoff,code});expect(verified.status()).toBe(200);session=await verified.json();expect(session.state).toBe('ONBOARDING');actor={id:session.user.id,provider_profile_id:null};
  const signup={name:'Synthetic mobile driver',businessName:'Synthetic mobile transport',phone:'+12025550101',applicationType:'SELF_MANAGED_DRIVER'};
  const blocked=await call('onboarding',signup,session.accessToken);expect(blocked.status()).toBe(403);expect((await blocked.json()).error.code).toBe('POLICY_REQUIRED');
  const policy=await call('account/policy',undefined,session.accessToken);expect(policy.status()).toBe(200);expect((await policy.json()).accepted).toBe(false);
  expect((await call('account/policy',{version:'2026-10-09',accepted:true,actorId:randomUUID()},session.accessToken)).status()).toBe(400);
  expect(checked(await service.from('user_policy_acceptances').select('user_id').eq('user_id',actor.id))).toHaveLength(0);
  expect((await call('account/policy',{version:'2026-10-09',accepted:true,actorId:actor.id},session.accessToken)).status()).toBe(200);
  expect((await call('onboarding',signup,session.accessToken)).status()).toBe(200);const refreshed=await call('auth/refresh',{refreshToken:session.refreshToken});expect(refreshed.status()).toBe(200);session=await refreshed.json();expect(session.state).toBe('ACTIVE');actor.provider_profile_id=checked(await service.from('provider_profiles').select('id').eq('user_id',actor.id).single()).id;
  const input={action:'ADD_TRUCK',make:'Synthetic',model:'Mobile driver',plate:'PLAY-'+randomUUID().slice(0,8),cargoConfiguration:'Pickup truck',useBasis:'PERMISSION'};
  const truck=await call('fleet',input,session.accessToken);expect(truck.status()).toBe(200);const vehicleId=(await truck.json()).id;
  const second=await call('fleet',{...input,plate:'PLAY-'+randomUUID().slice(0,8),useBasis:'OWNED'},session.accessToken);expect(second.status()).toBe(200);const secondId=(await second.json()).id;
  expect(checked(await service.from('vehicles').select('id,publication_status').in('id',[vehicleId,secondId]).order('id'))).toEqual([
    {id:[vehicleId,secondId].sort()[0],publication_status:'DRAFT'},
    {id:[vehicleId,secondId].sort()[1],publication_status:'DRAFT'}
  ]);
  expect((await call('account/driving-mode',{drivesTruck:true},session.accessToken)).status()).toBe(200);
  expect((await call('fleet',{action:'ASSIGN_DRIVER',driverId:actor.id,vehicleId,canManageCapacity:true,canManageTracking:true},session.accessToken)).status()).toBe(200);
  expect((await call('fleet/publication',{vehicleId,state:'LIVE'},session.accessToken)).status()).toBe(200);
  const deniedSecond=await call('fleet/publication',{vehicleId:secondId,state:'LIVE'},session.accessToken);expect(deniedSecond.status()).toBe(409);expect((await deniedSecond.json()).error.code).toBe('PROVIDER_VERIFICATION_REQUIRED');
  expect(checked(await service.from('vehicles').select('publication_status').eq('id',secondId).single()).publication_status).toBe('DRAFT');
  expect((await call('capacity',{action:'LOCATION',vehicleId,approximateLat:41.8,approximateLng:-87.6,locationPrecisionKm:20},session.accessToken)).status()).toBe(200);
  expect((await call('capacity',{action:'PUBLISH',vehicleId,status:'EMPTY',acceptedLoads:'BOTH',availabilityGeometry:'ROUTE',currentRoutePlaces:[{placeRef:'builtin:addis ababa'},{placeRef:'builtin:adama'}],capacityAreaCenterPlaceRef:'',capacityAreaBoundaryPlaces:[],acceptsMultiPick:false,acceptsMultiDrop:false},session.accessToken)).status()).toBe(200);
  const result=await call('capacity',undefined,session.accessToken);expect(result.status()).toBe(200);const saved=(await result.json()).vehicles.find((v:any)=>v.id===vehicleId);expect(saved.canLocate).toBe(true);expect(saved.current).toMatchObject({status:'EMPTY',acceptedLoads:'BOTH',visibility:'PRIVATE'});expect(saved.location.coordinate[1]).toBeGreaterThan(40);
  const fleet=await call('fleet',undefined,session.accessToken);expect(fleet.status()).toBe(200);const savedFleet=await fleet.json();expect(savedFleet).toMatchObject({singleTruck:false,canAddTruck:true,canManageDrivers:true});
  expect(savedFleet.vehicles).toEqual(expect.arrayContaining([
    expect.objectContaining({id:vehicleId,publicationState:'LIVE'}),
    expect.objectContaining({id:secondId,publicationState:'DRAFT'})
  ]));
 }finally{if(session)await call('auth/logout',{accessToken:session.accessToken,refreshToken:session.refreshToken});if(!actor){const row=checked(await service.from('profiles').select('id').eq('email',email).maybeSingle());if(row)actor={id:row.id,provider_profile_id:null};}if(actor)await remove(service,actor);}
});
