import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {localAuditService,checked,auditProvider,auditDeleteVehicles} from './audit-helpers';
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
 test.setTimeout(180000);const service=localAuditService(),subject=await auditProvider(service,'play-erase'),other=await auditProvider(service,'play-kept'),staff=await admin(service);let adminContext:any;
 const file=`driver-portrait/2026-10-09/${randomUUID()}.jpg`;const bytes=await sharp(readFileSync('public/icon-192.png')).jpeg().toBuffer();
 try{
  checked(await service.storage.from('provider-profile').upload(file,bytes,{contentType:'image/jpeg'}));
  checked(await service.from('driver_portrait_uploads').insert({user_id:subject.id,file_path:`supabase://provider-profile/${file}`,size_bytes:bytes.length,state:'ACTIVE',upload_finished:true}));
  await page.goto('/delete-account');await page.getByLabel('Account email',{exact:true}).fill(subject.email);
  const started=Date.now();await page.getByRole('button',{name:'Verify email to request deletion',exact:true}).click();
  await expect(page.getByLabel('Email verification code',{exact:true})).toBeVisible();
  const code=await localMailpitNumericCode(subject.email,started,['Your Loadgistic sign-in code','Your Loadgistic login code','Confirm Your Signup','Magic Link']);
  await page.getByLabel('Email verification code',{exact:true}).fill(code);
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Submit deletion request',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Deletion request received',exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:'Deletion request received',exact:true})).toBeVisible();
  await page.screenshot({path:'.local/play-policy-deletion-receipt-phone.png'});
  const request=checked(await service.from('account_deletion_requests').select('id,status').eq('subject_user_id',subject.id).single());expect(request.status).toBe('REQUESTED');
  adminContext=await browser.newContext({baseURL:info.project.use.baseURL});const control=await adminContext.newPage();await localSupportLogin(control,staff.id);await control.goto('/admin/privacy');
  const card=control.locator('section[data-request-id="'+request.id+'"]');
  await card.getByRole('checkbox').check();await card.getByLabel('Type DELETE to confirm').fill('DELETE');await card.getByRole('button',{name:'Process deletion request',exact:true}).click();
  await expect(control.getByText('Deletion completed.',{exact:true})).toBeVisible();
  expect(checked(await service.from('profiles').select('email,active,full_name').eq('id',subject.id).single()).full_name).toBe('Deleted account');
  expect(checked(await service.auth.admin.getUserById(subject.id)).user.email).not.toBe(subject.email);
  expect((await service.storage.from('provider-profile').download(file)).error).not.toBeNull();
  expect(checked(await service.from('profiles').select('active').eq('id',other.id).single()).active).toBe(true);
  await page.getByRole('button',{name:'Check request status',exact:true}).click();await expect(page.getByRole('heading',{name:'Deletion completed',exact:true})).toBeVisible();
  const denied=await page.request.post('/api/admin/privacy/'+request.id,{form:{reviewed:'yes',confirmation:'DELETE'},maxRedirects:0});expect(new URL(denied.headers().location).searchParams.has('error')).toBe(true);
 }finally{await adminContext?.close();await service.storage.from('provider-profile').remove([file]);await remove(service,subject);await remove(service,other);await remove(service,staff);}
});

test('Play public reporting reaches moderation, hide and restore are effective, and viewer block is reversible',async({page,browser}:{page:any;browser:any},info:any)=>{
 test.setTimeout(150000);const service=localAuditService(),subject=await auditProvider(service,'play-content'),staff=await admin(service);let adminContext:any;
 const handle=`play-content-${subject.suffix}`;
 try{
  checked(await service.from('company_pages').update({published:true,about:'Synthetic road-freight profile for the policy workflow.'}).eq('provider_profile_id',subject.provider_profile_id));
  await page.goto('/providers/'+handle);await page.getByRole('button',{name:'Report content',exact:true}).click();
  await page.getByLabel('Tell us what needs attention',{exact:true}).fill('Synthetic report to verify the moderation workflow.');await Promise.all([page.waitForResponse((r:any)=>r.url().endsWith('/api/mobile/public/content-report'),{timeout:25000}),page.getByRole('button',{name:'Send report',exact:true}).click()]);
  await expect(page.getByText('Report received. Our team will review the content.',{exact:true})).toBeVisible();await page.screenshot({path:'.local/play-policy-report-phone.png'});await page.getByRole('button',{name:'Close',exact:true}).click();
  const report=checked(await service.from('content_reports').select('id,status').eq('provider_profile_id',subject.provider_profile_id).single());expect(report.status).toBe('PENDING');
  adminContext=await browser.newContext({baseURL:info.project.use.baseURL});const control=await adminContext.newPage();await localSupportLogin(control,staff.id);await control.goto('/admin/reviews/content');
  const response=await control.request.post('/api/admin/content/'+report.id,{form:{decision:'HIDE',note:'Synthetic content investigation completed.'},maxRedirects:0});expect(new URL(response.headers().location).searchParams.has('success')).toBe(true);
  expect((await page.request.get('/api/mobile/public/providers/'+handle)).status()).toBe(404);
  expect(checked(await service.from('provider_profiles').select('content_hidden,public_visibility').eq('id',subject.provider_profile_id).single()).public_visibility).toBe('PRIVATE');
  const restore=await control.request.post('/api/admin/content/'+report.id,{form:{decision:'RESTORE',note:'Synthetic replacement content checked.'},maxRedirects:0});expect(new URL(restore.headers().location).searchParams.has('success')).toBe(true);
  await page.goto('/providers/'+handle);await page.getByRole('button',{name:'Block transporter',exact:true}).click();await expect(page.getByRole('heading',{name:'Transporter blocked',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Transporter blocked',exact:true})).toBeVisible();
  await page.goto('/privacy');await page.getByRole('button',{name:'Unblock transporter',exact:true}).click();await expect(page.getByText('No blocked transporters.',{exact:true})).toBeVisible();await page.goto('/providers/'+handle);await expect(page.getByRole('heading',{name:'About this transporter',exact:true})).toBeVisible();
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
  const points=checked(await service.from('capacities').select('current_route_points_json').eq('availability_geometry','ROUTE').limit(1).single()).current_route_points_json;
  checked(await service.rpc('refresh_provider_capacity_location',{actor_user_id:actor.id,command:{vehicle_id:truck,approximate_lat:41.8,approximate_lng:-87.6,location_precision_km:20}}));
  checked(await service.rpc('publish_provider_capacity',{actor_user_id:actor.id,command:{vehicle_id:truck,status:'EMPTY',accepted_loads:'BOTH',availability_geometry:'ROUTE',location_source:'PRESERVE_DRIVER',current_route_places:points,sharing_mode:'PRIVATE'}}));
  checked(await service.rpc('grant_private_capacity_access',{actor_user_id:actor.id,target_vehicle_id:truck,normalized_recipient_email:'synthetic@review.invalid',recipient_digest:capacityDigest}));
  const shipment=randomUUID();checked(await service.rpc('create_provider_tracking_with_recipients',{actor_user_id:actor.id,command:{id:shipment,code:'LGX-'+shipment.replaceAll('-','').slice(0,8).toUpperCase(),vehicle_id:truck,origin_place_ref:points[0].place_ref,destination_place_ref:points[1].place_ref,cargo_summary:'Synthetic reviewer shipment',customer_email:'synthetic@review.invalid',customer_email_digest:trackingDigest,expected_delivery_date:new Date(Date.now()+2*86400000).toISOString().slice(0,10),tracking_mode:'LOCATION_AND_STATUS',tracking_code_hash:(randomUUID()+randomUUID()).replaceAll('-',''),review_code_hash:(randomUUID()+randomUUID()).replaceAll('-','')}}));
  await page.goto('http://localhost:8084/visitor-tracking');await page.getByRole('button',{name:'Open demo shipment tracking',exact:true}).click();await expect(page.getByText('Your shipments',{exact:true})).toBeVisible({timeout:20000});await expect(page.getByRole('link',{name:'View updates',exact:true})).toBeVisible({timeout:20000});await page.screenshot({path:'.local/play-policy-native-review-tracking.png'});
  await page.goto('http://localhost:8084/privacy');await page.getByRole('button',{name:'How location sharing works',exact:true}).click();await expect(page.getByText('Location during your shipment',{exact:true})).toBeVisible();await page.screenshot({path:'.local/play-policy-location-disclosure-phone.png'});await page.getByRole('button',{name:'Close',exact:true}).click();
  const login=await page.request.post('http://127.0.0.1:3100/api/mobile/review-access',{data:{email:actor.email,password}});expect(login.status()).toBe(200);const session=await login.json();
  const grant=await page.request.post('http://127.0.0.1:3100/api/mobile/review-access/visitor',{headers:{authorization:'Bearer '+session.accessToken},data:{scope:'capacity'}});expect(grant.status()).toBe(200);const wire=await grant.json();const signals=await page.request.get('http://127.0.0.1:3100/api/mobile/visitor/capacity/signals',{headers:{authorization:'Bearer '+wire.token}});expect(signals.status()).toBe(200);const privateData=await signals.json();expect(JSON.stringify(privateData)).toContain(truck);
  checked(await service.from('app_review_accounts').update({enabled:false}).eq('user_id',actor.id));
  expect((await page.request.get('http://127.0.0.1:3100/api/mobile/visitor/capacity/signals',{headers:{authorization:'Bearer '+wire.token}})).status()).toBe(401);
  expect((await page.request.get('http://127.0.0.1:3100/api/mobile/session',{headers:{authorization:'Bearer '+session.accessToken}})).status()).toBe(403);
 }finally{await page.goto('about:blank');await remove(service,actor);await remove(service,ordinary);}
});

test('Play normal mobile signup requires account-bound consent and preserves the one-truck location/capacity workflow',async({page}:{page:any})=>{
 test.setTimeout(150000);const service=localAuditService(),email=`play-mobile-signup-${randomUUID()}@loadgistic.local`;let actor:any,session:any;
 const call=async(path:string,body?:unknown,token?:string)=>page.request.fetch('/api/mobile/'+path,{method:body===undefined?'GET':'POST',headers:{...(token?{authorization:'Bearer '+token}:{})},...(body===undefined?{}:{data:body})});
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
  expect((await call('fleet',{...input,plate:'PLAY-'+randomUUID().slice(0,8)},session.accessToken)).status()).toBe(409);
  expect((await call('fleet',{action:'ADD_DRIVER',name:'Synthetic other driver',email:'synthetic-other@example.test',phone:'+12025550102'},session.accessToken)).status()).toBe(403);
  expect((await call('capacity',{action:'LOCATION',vehicleId,approximateLat:41.8,approximateLng:-87.6,locationPrecisionKm:20},session.accessToken)).status()).toBe(200);
  expect((await call('capacity',{action:'PUBLISH',vehicleId,status:'EMPTY',acceptedLoads:'BOTH',availabilityGeometry:'ROUTE',currentRoutePlaces:[{placeRef:'builtin:addis ababa'},{placeRef:'builtin:adama'}],capacityAreaCenterPlaceRef:'',capacityAreaBoundaryPlaces:[],acceptsMultiPick:false,acceptsMultiDrop:false},session.accessToken)).status()).toBe(200);
  const result=await call('capacity',undefined,session.accessToken);expect(result.status()).toBe(200);const saved=(await result.json()).vehicles.find((v:any)=>v.id===vehicleId);expect(saved.canLocate).toBe(true);expect(saved.current).toMatchObject({status:'EMPTY',acceptedLoads:'BOTH',visibility:'PRIVATE'});expect(saved.location.coordinate[1]).toBeGreaterThan(40);
  const fleet=await call('fleet',undefined,session.accessToken);expect(fleet.status()).toBe(200);expect(await fleet.json()).toMatchObject({singleTruck:true,canAddTruck:false,canManageDrivers:false});
 }finally{if(session)await call('auth/logout',{accessToken:session.accessToken,refreshToken:session.refreshToken});if(!actor){const row=checked(await service.from('profiles').select('id').eq('email',email).maybeSingle());if(row)actor={id:row.id,provider_profile_id:null};}if(actor)await remove(service,actor);}
});
