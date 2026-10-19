import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {expect as baseExpect,test} from './browser-test';
import {auditDeleteVehicles,checked,localAuditService} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {localMailpitNumericCode} from './mailpit-helper';

const expect=baseExpect.configure({timeout:30_000});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test('Transport Provider publishes one unreviewed truck, manages document review and unlocks additional trucks with an exact Trust review',async({page,browser},info)=>{
 test.setTimeout(420_000);
 page.setDefaultTimeout(20_000);page.setDefaultNavigationTimeout(30_000);
 function boundActions(context:import('playwright-core').BrowserContext){context.setDefaultTimeout(20_000);context.setDefaultNavigationTimeout(30_000);}
 const service=localAuditService(),nonce=randomUUID().slice(0,8),email=`provider-owner-${nonce}@loadgistic.local`,employeeEmail=`provider-employee-${nonce}@loadgistic.local`;
 const owned={ownerId:'',providerId:'',trustId:'',employeeId:'',outsiderId:'',outsiderProviderId:'',truckIds:[] as string[],requestIds:[] as string[],authorityIds:[] as string[],paths:[] as string[]};
 let stage='SETUP',complete=false,cleaned=false,cleanupStage='NOT_STARTED',primaryStage='';
 let primaryFailure:unknown=null,cleanupFailure:unknown=null;
 const assignments:Record<string,{managerCount?:number;redirectError?:string|null;pairMatches?:boolean;canManageCapacity?:boolean;canManageTracking?:boolean}>={};
 const nativeNavigation:Array<{label:string;path:string;mapTotal:number;mapVisible:number;boxes:Array<{x:number;y:number;width:number;height:number}|null>;pairMatches:boolean;pageErrorCount:number;unhandledRejectionCount:number;abortCount:number;fatalOverlayVisible:boolean}>=[];
 function safeFailure(error:unknown,at:string){
  const value=(error&&typeof error==='object'?error:{}) as {name?:unknown;message?:unknown;code?:unknown;stack?:unknown;cause?:unknown};
  const cause=(value.cause&&typeof value.cause==='object'?value.cause:value) as {message?:unknown;code?:unknown};
  const constraint=String(cause.message||'').match(/constraint "([a-z0-9_]{1,80})"/)?.[1]||null;
  const location=String(value.stack||'').match(/provider-owner-fleet\.spec\.ts:(\d+):(\d+)/);
  return {stage:at,name:typeof value.name==='string'&&/^[A-Za-z]{1,40}$/.test(value.name)?value.name:'Error',
   code:typeof cause.code==='string'&&/^[A-Z0-9_]{2,40}$/.test(cause.code)?cause.code:null,constraint,
   location:location?{line:Number(location[1]),column:Number(location[2])}:null,strictLocator:/strict mode violation/i.test(String(value.message||''))};
 }
 function cleanupChecked<T>(result:{data:T;error:unknown}):T{if(result.error)throw new Error('PROVIDER_FIXTURE_CLEANUP_FAILED',{cause:result.error});return result.data;}
 const evidence=()=>writeFileSync(info.outputPath('provider-owner-fleet-checks.json'),JSON.stringify({stage,complete,cleaned,cleanupStage,assignments,nativeNavigation,
  primaryFailure:primaryFailure?safeFailure(primaryFailure,primaryStage):null,cleanupFailure:cleanupFailure?safeFailure(cleanupFailure,cleanupStage):null},null,2),{mode:0o600});
 const manifest=()=>writeFileSync(info.outputPath('provider-owner-fleet-owned.json'),JSON.stringify({...owned,paths:undefined},null,2),{mode:0o600});
 const context=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize()||undefined,isMobile:Boolean(info.project.use.isMobile),hasTouch:Boolean(info.project.use.hasTouch),extraHTTPHeaders:{'x-forwarded-for':'127.0.0.243'}});
 boundActions(context);
 const staff=await context.newPage();
 const employeeContext=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize()||undefined,isMobile:Boolean(info.project.use.isMobile),hasTouch:Boolean(info.project.use.hasTouch),extraHTTPHeaders:{'x-forwarded-for':'127.0.0.244'}});
 boundActions(employeeContext);
 const employee=await employeeContext.newPage();
 const outsiderContext=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize()||undefined,isMobile:Boolean(info.project.use.isMobile),hasTouch:Boolean(info.project.use.hasTouch),extraHTTPHeaders:{'x-forwarded-for':'127.0.0.246'}});
 boundActions(outsiderContext);
 const outsider=await outsiderContext.newPage();
 let nativeContext:import('playwright-core').BrowserContext|null=null;
 async function checkpoint(next:string){stage=next;evidence();manifest();}
 async function openOwnTruck(id:string){await page.goto(`/app/fleet/${id}?view=details`);await expect(page.getByRole('region',{name:'Truck publication'})).toBeVisible();}
 async function addTruck(basis:'OWNED'|'FINANCED',model:string){
  await page.goto('/app/fleet/new');await expect(page.getByRole('heading',{name:'Add truck',exact:true})).toBeVisible();
  await page.getByRole('radio',{name:basis==='OWNED'?'I own this truck':'I am buying this truck through financing',exact:true}).check();
  await page.getByLabel('Make',{exact:true}).fill('Isuzu');await page.getByLabel('Model',{exact:true}).fill(model);await page.getByLabel('Vehicle configuration',{exact:true}).selectOption('Mini Box Truck');await page.getByLabel('Plate number',{exact:true}).fill(`LOCAL-${nonce}-${owned.truckIds.length+1}`);
  await page.getByRole('button',{name:'Add truck',exact:true}).click();await expect(page).toHaveURL(/\/app\/fleet\/[0-9a-f-]+(?:\?.*)?$/);
  const id=new URL(page.url()).pathname.split('/').at(-1)!;expect(id).toMatch(uuid);owned.truckIds.push(id);manifest();
  const saved=checked(await service.from('vehicles').select('publication_status,use_basis,provider_profile_id').eq('id',id).single());expect(saved).toMatchObject({publication_status:'DRAFT',use_basis:basis,provider_profile_id:owned.providerId});
  await expect(page.getByRole('button',{name:'Go live',exact:true})).toBeEnabled();return id;
 }
 async function assign(driverId:string,truckId:string){
  const key=driverId===owned.ownerId?'owner':'employee';await checkpoint(key==='owner'?'ASSIGN_OWNER':'ASSIGN_EMPLOYEE');assignments[key]={};
  await page.goto('/app/fleet');const manager=await openFleetDriver(page,{id:driverId},true);
  assignments[key].managerCount=await manager.count();evidence();
  await manager.getByRole('combobox',{name:'Truck',exact:true}).selectOption(truckId);
  if(driverId!==owned.ownerId){await manager.getByLabel('Capacity updates',{exact:true}).check();await manager.getByLabel('Tracking updates',{exact:true}).check();}
  await checkpoint('PERMISSION_SAVE');await manager.getByRole('button',{name:'Save driver',exact:true}).click();
  const redirect=new URL(page.url()).searchParams.get('error');assignments[key].redirectError=redirect
   ?(redirect==='You do not have permission to perform that action.'?'FORBIDDEN':/active.*tracking|tracking.*active/i.test(redirect)?'ACTIVE_TRACKING':'UNRECOGNIZED_REDIRECT_ERROR'):null;
  const saved=checked(await service.from('driver_vehicle_assignments').select('driver_user_id').eq('vehicle_id',truckId).eq('active',true));assignments[key].pairMatches=saved.length===1&&saved[0].driver_user_id===driverId;
  if(key==='employee'){const permissions=checked(await service.from('driver_permissions').select('can_manage_capacity,can_manage_tracking').eq('user_id',driverId).single());assignments[key].canManageCapacity=permissions.can_manage_capacity;assignments[key].canManageTracking=permissions.can_manage_tracking;}
  evidence();await expect(page.locator('.alert.success')).toBeVisible();expect(assignments[key].pairMatches).toBe(true);
 }
 async function openReview(name=`Ownership ${nonce}`){
  await staff.goto('/admin/reviews');await staff.getByLabel('Search Documents',{exact:true}).fill(name);await staff.getByRole('combobox',{name:'Status',exact:true}).selectOption('ALL');await staff.getByRole('button',{name:'Apply',exact:true}).click();
  const row=staff.locator('.admin-review-row').filter({has:staff.getByText(name,{exact:true})});await expect(row).toHaveCount(1);return row;
 }
 async function openDocuments(truckId:string,edit=true){
  await openOwnTruck(truckId);await page.getByRole('link',{name:'Documents',exact:true}).click();if(!edit)return page.locator('#truck-documents');await page.getByRole('button',{name:'Submit verification',exact:true}).click();return page.getByRole('dialog',{name:'Submit verification',exact:true});
 }
 async function submitProof(truckId:string,name:string){
  const documents=await openDocuments(truckId);await documents.locator('select[name="verificationType"]').selectOption('VEHICLE_OWNERSHIP');await documents.getByLabel('Document name',{exact:true}).fill(name);
  await documents.locator('input[name="file"]').setInputFiles({name:'synthetic-ownership.png',mimeType:'image/png',buffer:readFileSync('public/icon-192.png')});await documents.getByRole('button',{name:'Submit for review',exact:true}).click();await expect(page.locator('.alert.success')).toBeVisible();
  const request=checked(await service.from('verification_requests').select('id,storage_path,status').eq('submitted_by',owned.ownerId).eq('subject_id',truckId).eq('document_name',name).single());owned.requestIds.push(request.id);owned.paths.push(request.storage_path.replace('supabase://verification/',''));manifest();expect(request.status).toBe('PENDING');return request;
 }
 async function seeHistory(truckId:string,name:string,status:'PENDING'|'REJECTED'|'APPROVED',note?:string){
  const documents=await openDocuments(truckId,false);
  const row=documents.locator('.request-history-row').filter({has:page.getByText(name,{exact:true})});await expect(row).toHaveCount(1);await expect(row.locator(`.status.${status.toLowerCase()}`)).toBeVisible();if(note)await expect(row.getByText(note,{exact:true})).toBeVisible();return documents;
 }
 async function seePending(truckId:string,name:string){
  await seeHistory(truckId,name,'PENDING');await page.getByRole('button',{name:'Submit verification',exact:true}).click();const documents=page.getByRole('dialog',{name:'Submit verification',exact:true});await expect(documents.getByText('Documents already awaiting review are excluded from the choices below. Check Request history for updates.',{exact:true})).toBeVisible();await expect(documents.locator('select[name="verificationType"] option[value="VEHICLE_OWNERSHIP"]')).toHaveCount(0);return documents;
 }
 async function deniedReview(actor:import('playwright-core').Page,path:string,form:Record<string,string>){
  const response=await actor.request.post(path,{form,headers:{origin:'http://127.0.0.1:3100'},maxRedirects:0});expect(response.status()).toBe(303);expect(new URL(response.headers().location).searchParams.get('error')).toBe('You do not have permission to perform that action.');
 }
 async function approveProof(name:string,note:string){
  const row=await openReview(name);await row.getByRole('button',{name:'Review document',exact:true}).click();await row.getByLabel('Review note',{exact:true}).fill(note);await row.getByRole('button',{name:'Approve',exact:true}).click();await expect(staff.locator('.alert.success')).toBeVisible();
 }
 async function confirmRelationship(name:string){
  const row=await openReview(name);await row.getByRole('button',{name:'Truck relationship',exact:true}).click();await row.getByLabel('What this document confirms',{exact:true}).selectOption('OWNERSHIP');await row.getByLabel('What you checked',{exact:true}).fill('Synthetic ownership proof matched to named provider and exact truck');await row.getByLabel('I checked this document against the named provider and this truck.',{exact:true}).check();await row.getByRole('button',{name:'Confirm relationship',exact:true}).click();await expect(staff.locator('.alert.success')).toBeVisible();
 }
 try{
  await checkpoint('SIGNUP');await page.goto('/login');const since=Date.now();await page.getByTestId('email-code-request-form').getByLabel('Email',{exact:true}).fill(email);await page.getByRole('button',{name:'Email me a code',exact:true}).click();await expect(page.getByTestId('email-code-form')).toBeVisible();
  await checkpoint('SIGNUP_CODE');
  const code=await localMailpitNumericCode(email,since,['Your Loadgistic signup code','Your Loadgistic sign-in code']);await page.getByLabel('Six-digit code',{exact:true}).fill(code);await page.getByRole('button',{name:'Continue',exact:true}).click();
  await checkpoint('SIGNUP_DETAILS');
  const setup=page.getByTestId('provider-details-form');await expect(setup).toBeVisible();owned.ownerId=checked(await service.from('profiles').select('id').eq('email',email).single()).id;manifest();await expect(setup.getByRole('radio')).toHaveCount(0);await setup.getByLabel('First name',{exact:true}).fill('Provider');await setup.getByLabel('Last / father name',{exact:true}).fill('Private family');await setup.getByLabel('Account phone',{exact:true}).fill('+251900000011');
  await checkpoint('SIGNUP_DRIVING');
  const driving=setup.getByRole('checkbox',{name:/^I drive a truck/});await setup.locator('label.rich-toggle').click();await expect(driving).toBeChecked();
  await checkpoint('SIGNUP_SUBMIT');await setup.getByRole('button',{name:'Create transporter workspace',exact:true}).click();await expect(page).toHaveURL(/\/app\/home$/);
  await checkpoint('SIGNUP_TERMS');
  await page.getByLabel('I agree to the Terms and content rules.',{exact:true}).check();await page.getByRole('button',{name:'Accept and continue',exact:true}).click();await expect(page.getByRole('heading',{name:'Before you share',exact:true})).toHaveCount(0);
  await checkpoint('SIGNUP_HOME');
  owned.providerId=checked(await service.from('provider_profiles').select('id').eq('user_id',owned.ownerId).single()).id;manifest();
  await expect(page.locator('.driver-map-summary')).toBeVisible();await expect(page.getByText('Choose the truck you drive in Fleet.',{exact:true})).toBeVisible();
  await checkpoint('TWO_DRAFTS');const first=await addTruck('OWNED','Provider first'),second=await addTruck('FINANCED','Provider second');
  const noImplicitAssignment=checked(await service.from('driver_vehicle_assignments').select('id').in('vehicle_id',owned.truckIds).eq('active',true));expect(noImplicitAssignment).toHaveLength(0);
  await page.goto('/app/fleet');await expect(page.locator('.fleet-truck-row')).toHaveCount(2);await page.screenshot({path:info.outputPath('provider-two-drafts.png'),fullPage:true});
  await checkpoint('SELF_ASSIGNMENT');await assign(owned.ownerId,first);await page.goto('/app/home');await expect(page.getByTestId('capacity-summary')).toBeVisible();await expect(page.locator('.capacity-truck-bar')).toContainText('Provider first');await expect(page.locator('.capacity-truck-bar')).not.toContainText('Provider second');
  await checkpoint('EMPLOYEE');await page.goto('/app/fleet/drivers/new');await page.getByLabel('Driver name',{exact:true}).fill(`Employee ${nonce}`);await page.getByLabel('Email',{exact:true}).fill(employeeEmail);await page.getByLabel('Contact phone',{exact:true}).fill('+251900000022');await page.getByRole('button',{name:'Add driver',exact:true}).click();await expect(page.locator('.alert.success')).toBeVisible();
  owned.employeeId=checked(await service.from('profiles').select('id').eq('email',employeeEmail).single()).id;manifest();
  expect(checked(await service.auth.admin.getUserById(owned.employeeId)).user.email_confirmed_at).toBeFalsy();await assign(owned.employeeId,second);
  // An employed driver can be assigned before verifying email, but accepts the
  // content rules only after their real first sign-in verifies that email.
  await checkpoint('EMPLOYEE_LOGIN');await employee.goto('/login');await employee.getByTestId('email-code-request-form').getByLabel('Email',{exact:true}).fill(employeeEmail);const employeeSince=Date.now();
  await employee.getByRole('button',{name:'Email me a code',exact:true}).click();await expect(employee.getByTestId('email-code-form')).toBeVisible();
  await employee.getByLabel('Six-digit code',{exact:true}).fill(await localMailpitNumericCode(employeeEmail,employeeSince,['Your Loadgistic signup code','Your Loadgistic sign-in code']));await employee.getByRole('button',{name:'Continue',exact:true}).click();
  await checkpoint('EMPLOYEE_TERMS');await expect(employee.getByRole('heading',{name:'Before you share',exact:true})).toBeVisible();await employee.getByLabel('I agree to the Terms and content rules.',{exact:true}).check();await employee.getByRole('button',{name:'Accept and continue',exact:true}).click();await expect(employee.getByRole('heading',{name:'Before you share',exact:true})).toHaveCount(0);
  await checkpoint('EMPLOYEE_HOME');await employee.goto('/app/fleet/new');await expect(employee).toHaveURL(/\/app\/home$/);await expect(employee.getByRole('link',{name:'Add truck',exact:true})).toHaveCount(0);await expect(employee.getByRole('link',{name:'Add driver',exact:true})).toHaveCount(0);
  await checkpoint('FIRST_UNREVIEWED_LIVE');await openOwnTruck(first);await page.getByRole('button',{name:'Go live',exact:true}).click();await expect(page.locator('.alert.success')).toBeVisible();
  expect(checked(await service.from('vehicles').select('publication_status').eq('id',first).single()).publication_status).toBe('LIVE');await expect(page.getByText('Not yet verified. Confirm details directly.',{exact:true})).toBeVisible();
  await openOwnTruck(second);await expect(page.getByRole('button',{name:'Go live',exact:true})).toBeDisabled();await expect(page.getByText('Publish more trucks',{exact:true}).first()).toBeVisible();
  await checkpoint('DOCUMENT_SUBMISSION');const request=await submitProof(first,`Ownership ${nonce}`);await seePending(first,`Ownership ${nonce}`);await page.screenshot({path:info.outputPath('provider-document-waiting.png'),fullPage:true});
  owned.outsiderId=checked(await service.auth.admin.createUser({email:`provider-outsider-${nonce}@loadgistic.local`,email_confirm:true,app_metadata:{fixture_source:'loadgistic'}})).user.id;manifest();checked(await service.from('profiles').update({role:'DRIVER',active:true,full_name:'Synthetic unrelated provider',drives_truck:false}).eq('id',owned.outsiderId));
  owned.outsiderProviderId=checked(await service.from('provider_profiles').insert({user_id:owned.outsiderId,business_name:'Synthetic unrelated provider',handle:`provider-outsider-${nonce}`}).select('id').single()).id;manifest();await localSupportLogin(outsider,owned.outsiderId);
  for(const actor of [employee,outsider]){await deniedReview(actor,`/api/admin/verifications/${request.id}`,{status:'APPROVED',note:'Unauthorized synthetic attempt',returnTo:'/admin/reviews?tab=documents'});expect((await actor.request.get(`/api/files/verification/${request.id}`)).status()).toBe(404);}
  expect(checked(await service.from('verification_requests').select('status,reviewed_by').eq('id',request.id).single())).toMatchObject({status:'PENDING',reviewed_by:null});
  await checkpoint('CREATE_TRUST_IDENTITY');owned.trustId=checked(await service.auth.admin.createUser({email:`provider-trust-${nonce}@loadgistic.local`,email_confirm:true,app_metadata:{fixture_source:'loadgistic'}})).user.id;manifest();
  await checkpoint('TRUST_PERMISSION_UPDATE');checked(await service.from('profiles').update({role:'SUPPORT',active:true,full_name:'Synthetic Trust reviewer'}).eq('id',owned.trustId));
  checked(await service.from('support_agent_profiles').insert({user_id:owned.trustId,active:true,available:false,can_manage_support:false,can_manage_brokerage:false,can_manage_customers:false,can_manage_operations:false,can_manage_trust:true,can_manage_featured:false,can_manage_billing:false}));
  await checkpoint('TRUST_LOGIN');await localSupportLogin(staff,owned.trustId);
  await checkpoint('REJECT_AND_RESUBMIT');const rejectedName=`Second ownership ${nonce}`,rejectNote='Synthetic proof names another truck. Upload the proof for this truck.';
  const rejected=await submitProof(second,rejectedName);await seePending(second,rejectedName);let row=await openReview(rejectedName);await row.getByRole('button',{name:'Review document',exact:true}).click();await row.getByLabel('Review note',{exact:true}).fill(rejectNote);await row.getByRole('button',{name:'Reject',exact:true}).click();await expect(staff.locator('.alert.success')).toBeVisible();
  expect(checked(await service.from('verification_requests').select('status,review_note').eq('id',rejected.id).single())).toMatchObject({status:'REJECTED',review_note:rejectNote});await seeHistory(second,rejectedName,'REJECTED',rejectNote);await page.screenshot({path:info.outputPath('provider-document-rejected.png'),fullPage:true});
  const correctedName=`Second ownership corrected ${nonce}`,corrected=await submitProof(second,correctedName);expect(corrected.id).not.toBe(rejected.id);expect(corrected.storage_path).not.toBe(rejected.storage_path);await seePending(second,correctedName);await approveProof(correctedName,'Synthetic replacement source reviewed; exact relationship remains unconfirmed.');await seeHistory(second,correctedName,'APPROVED','Synthetic replacement source reviewed; exact relationship remains unconfirmed.');
  expect(checked(await service.from('verification_requests').select('status,review_note').eq('id',rejected.id).single())).toMatchObject({status:'REJECTED',review_note:rejectNote});expect(checked(await service.from('provider_vehicle_authority_reviews').select('id').eq('source_request_id',corrected.id))).toHaveLength(0);
  await checkpoint('GENERIC_APPROVAL_IS_NOT_RELATIONSHIP');row=await openReview();const bytes=await staff.request.get(`/api/files/verification/${request.id}`);expect(bytes.status()).toBe(200);expect(await bytes.body()).toEqual(readFileSync('public/icon-192.png'));await row.getByRole('button',{name:'Review document',exact:true}).click();await row.getByLabel('Review note',{exact:true}).fill('Synthetic document approval; relationship checked separately');await row.getByRole('button',{name:'Approve',exact:true}).click();await expect(staff.locator('.alert.success')).toBeVisible();await seeHistory(first,`Ownership ${nonce}`,'APPROVED','Synthetic document approval; relationship checked separately');
  row=await openReview();const contextRevision=await row.locator('input[name="contextRevision"]').inputValue();for(const actor of [employee,outsider])await deniedReview(actor,`/api/admin/verifications/${request.id}/authority`,{action:'CONFIRM',factKind:'OWNERSHIP',reviewNote:'Unauthorized synthetic relationship attempt',confirmed:'1',contextRevision,returnTo:'/admin/reviews?tab=documents'});
  expect(checked(await service.from('provider_vehicle_authority_reviews').select('id').eq('source_request_id',request.id))).toHaveLength(0);await openOwnTruck(second);await expect(page.getByRole('button',{name:'Go live',exact:true})).toBeDisabled();
  await checkpoint('EXPLICIT_RELATIONSHIP');await confirmRelationship(`Ownership ${nonce}`);owned.authorityIds=checked(await service.from('provider_vehicle_authority_reviews').select('id').eq('source_request_id',request.id)).map((item:{id:string})=>item.id);manifest();expect(owned.authorityIds).toHaveLength(1);
  await checkpoint('ADDITIONAL_GO_LIVE');await openOwnTruck(second);await expect(page.getByRole('button',{name:'Go live',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Go live',exact:true}).click();await expect(page.locator('.alert.success')).toBeVisible();expect(checked(await service.from('vehicles').select('publication_status').eq('id',second).single()).publication_status).toBe('LIVE');
  await expect(page.getByText('Not yet verified. Confirm details directly.',{exact:true})).toBeVisible();await openOwnTruck(first);await expect(page.getByText('Ownership verified',{exact:true}).first()).toBeVisible();await page.screenshot({path:info.outputPath('provider-reviewed-live.png'),fullPage:true});
  await checkpoint('REVOKE_AND_REPLACE_SOURCE');row=await openReview();await row.getByLabel('Reason for revocation',{exact:true}).fill('Synthetic ownership review withdrawn for a new source check');await row.getByRole('button',{name:'Revoke relationship review',exact:true}).click();await expect(staff.locator('.alert.success')).toBeVisible();
  expect(checked(await service.from('provider_vehicle_authority_reviews').select('revoked_at').eq('id',owned.authorityIds[0]).single()).revoked_at).not.toBeNull();expect(checked(await service.from('verification_requests').select('status').eq('id',request.id).single()).status).toBe('APPROVED');
  const replacementName=`Ownership replacement ${nonce}`,replacement=await submitProof(first,replacementName);expect(replacement.id).not.toBe(request.id);expect(replacement.storage_path).not.toBe(request.storage_path);await seePending(first,replacementName);
  // A complete duplicate upload must also fail at the command boundary, even
  // though the normal visible form correctly omits that pending category.
  const duplicate=await page.request.post('/api/verifications',{multipart:{subjectType:'VEHICLE',subjectId:first,verificationType:'VEHICLE_OWNERSHIP',documentName:`Duplicate ownership ${nonce}`,returnTo:`/app/fleet/${first}`,file:{name:'synthetic-duplicate.png',mimeType:'image/png',buffer:readFileSync('public/icon-192.png')}},headers:{origin:'http://127.0.0.1:3100'},maxRedirects:0});expect(duplicate.status()).toBe(303);expect(new URL(duplicate.headers().location).searchParams.get('error')).toBe('This verification already has a pending or approved request.');expect(checked(await service.from('verification_requests').select('id').eq('submitted_by',owned.ownerId).eq('subject_id',first).eq('status','PENDING'))).toHaveLength(1);
  await approveProof(replacementName,'Synthetic replacement proof reviewed; new exact relationship needs confirmation.');await seeHistory(first,replacementName,'APPROVED','Synthetic replacement proof reviewed; new exact relationship needs confirmation.');await confirmRelationship(replacementName);
  owned.authorityIds=checked(await service.from('provider_vehicle_authority_reviews').select('id').in('source_request_id',owned.requestIds)).map((item:{id:string})=>item.id);manifest();expect(owned.authorityIds).toHaveLength(2);await openOwnTruck(first);await expect(page.getByText('Ownership verified',{exact:true}).first()).toBeVisible();await seeHistory(first,`Ownership ${nonce}`,'APPROVED','Synthetic document approval; relationship checked separately');
  const retained=await page.request.get(`/api/files/verification/${request.id}`);expect(retained.status()).toBe(200);expect(await retained.body()).toEqual(readFileSync('public/icon-192.png'));await page.screenshot({path:info.outputPath('provider-document-replacement-approved.png'),fullPage:true});
  await checkpoint('HOME_AND_WORKSPACE');await page.goto('/app/home');await expect(page.locator('.capacity-truck-bar')).toContainText('Provider first');await page.getByRole('link',{name:'Marketplace',exact:true}).click();await expect(page).toHaveURL(/\/$/);await page.getByRole('link',{name:'My workspace',exact:true}).click();await expect(page).toHaveURL(/\/app\/home$/);await expect(page.locator('.capacity-truck-bar')).toContainText('Provider first');await page.screenshot({path:info.outputPath('provider-driving-home.png'),fullPage:true});
  if(info.project.name==='mobile-chromium'){
   await checkpoint('EXPO_OWNER_LOGIN');nativeContext=await browser.newContext({baseURL:'http://localhost:8084',viewport:{width:390,height:844},isMobile:true,hasTouch:true,permissions:['geolocation'],geolocation:{latitude:9.03,longitude:38.76},extraHTTPHeaders:{'x-forwarded-for':'127.0.0.245'}});boundActions(nativeContext);const native=await nativeContext.newPage();
   const nativePageErrors:Array<{abort:boolean}>=[];
   native.on('pageerror',error=>nativePageErrors.push({abort:error.name==='AbortError'||/signal is aborted|abortTile|raster.*abort/i.test(error.message)}));
   await native.addInitScript(()=>{
    const target=window as unknown as {__loadgisticFleetRejections:Array<{abort:boolean}>};target.__loadgisticFleetRejections=[];
    window.addEventListener('unhandledrejection',event=>{const reason=event.reason as unknown,value=reason&&typeof reason==='object'?reason as {name?:unknown;message?:unknown}:{};
     target.__loadgisticFleetRejections.push({abort:value.name==='AbortError'||/signal is aborted|abortTile|raster.*abort/i.test(String(value.message||''))});});
   });
   async function captureNative(label:string){
    const maps=native.getByTestId('driver-home-map'),visibleMaps=maps.filter({visible:true});
    const boxes=await Promise.all((await maps.all()).map(map=>map.boundingBox()));
    const current=checked(await service.from('driver_vehicle_assignments').select('vehicle_id').eq('driver_user_id',owned.ownerId).eq('active',true)) as Array<{vehicle_id:string}>;
    const rejections=await native.evaluate(()=>(window as unknown as {__loadgisticFleetRejections?:Array<{abort:boolean}>}).__loadgisticFleetRejections||[]);
    nativeNavigation.push({label,path:new URL(native.url()).pathname,mapTotal:await maps.count(),mapVisible:await visibleMaps.count(),boxes,pairMatches:current.length===1&&current[0].vehicle_id===first,
     pageErrorCount:nativePageErrors.length,unhandledRejectionCount:rejections.length,abortCount:nativePageErrors.filter(error=>error.abort).length+rejections.filter(error=>error.abort).length,
     fatalOverlayVisible:await native.getByText('Uncaught Error',{exact:true}).isVisible().catch(()=>false)});evidence();
   }
   async function expectNativeHome(){
    await expect(native).toHaveURL(/\/account$/);await expect(native.getByTestId('driver-home-map').filter({visible:true})).toHaveCount(1);
    await expect(native.getByText('Isuzu Provider first',{exact:true}).filter({visible:true})).toHaveCount(1);
    const current=checked(await service.from('driver_vehicle_assignments').select('vehicle_id').eq('driver_user_id',owned.ownerId).eq('active',true)) as Array<{vehicle_id:string}>;expect(current).toEqual([{vehicle_id:first}]);
   }
   await native.goto('/account');await native.getByLabel('Email',{exact:true}).fill(email);const requested=Date.now();await native.getByRole('button',{name:'Send code',exact:true}).click();await expect(native.getByLabel('Sign-in code',{exact:true})).toBeVisible();await native.getByLabel('Sign-in code',{exact:true}).fill(await localMailpitNumericCode(email,requested,['Your Loadgistic sign-in code','Your Loadgistic signup code']));await native.getByRole('button',{name:'Sign in',exact:true}).click();await expectNativeHome();await captureNative('INITIAL_HOME');
   await checkpoint('EXPO_FLEET');await native.getByRole('tab',{name:'Fleet',exact:true}).click();await expect(native).toHaveURL(/\/fleet$/);await expect(native.getByRole('button',{name:'Move to draft',exact:true})).toHaveCount(2);await expect(native.getByText('Ownership verified',{exact:true})).toBeVisible();await expect(native.getByText('Not yet verified. Confirm details directly.',{exact:true})).toBeVisible();
   await native.getByRole('button',{name:'Add truck',exact:true}).click();await native.getByRole('button',{name:'I rent it or have permission to use it',exact:true}).click();await native.getByLabel('Make',{exact:true}).fill('Isuzu');await native.getByLabel('Model',{exact:true}).fill('Provider mobile');await native.getByLabel('Plate',{exact:true}).fill(`LOCAL-${nonce}-3`);await native.getByRole('button',{name:'Choose truck configuration',exact:true}).click();await native.getByRole('button',{name:'Mini Box Truck',exact:true}).last().click();
   const created=native.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/fleet'&&response.request().method()==='POST');await native.getByRole('button',{name:'Add truck',exact:true}).click();const response=await created;expect(response.status()).toBe(200);const third=(await response.json()).id;expect(third).toMatch(uuid);owned.truckIds.push(third);manifest();expect(checked(await service.from('vehicles').select('publication_status,use_basis').eq('id',third).single())).toMatchObject({publication_status:'DRAFT',use_basis:'PERMISSION'});expect(checked(await service.from('driver_vehicle_assignments').select('id').eq('vehicle_id',third).eq('active',true))).toHaveLength(0);
   await expect(native.getByRole('button',{name:'Go live',exact:true})).toBeEnabled();await native.screenshot({path:info.outputPath('provider-expo-fleet.png')});
   await checkpoint('EXPO_RETURN_HOME');await native.getByRole('tab',{name:'Home',exact:true}).click();await captureNative('BEFORE_RETURN_HOME_ASSERTIONS');
   try{await expectNativeHome();}catch(error){await captureNative('RETURN_HOME_FAILURE');throw error;}await captureNative('AFTER_RETURN_HOME_ASSERTIONS');
   await checkpoint('EXPO_SWITCH_AREAS');await native.getByRole('tab',{name:'Marketplace',exact:true}).click();await expect(native).toHaveURL('http://localhost:8084/');await native.getByRole('tab',{name:'My workspace',exact:true}).click();await expectNativeHome();await captureNative('RETURN_WORKSPACE');await native.screenshot({path:info.outputPath('provider-expo-driving-home.png')});
  }
  complete=true;await checkpoint('COMPLETE');
 }catch(error){primaryFailure=error;primaryStage=stage;throw error;}finally{
  try{
  // Exact per-run ownership only; retained production histories never use this cleanup.
  cleanupStage='VERIFY_SYNTHETIC_IDENTITIES';
  if(!owned.ownerId)owned.ownerId=cleanupChecked<{id:string}|null>(await service.from('profiles').select('id').eq('email',email).maybeSingle())?.id||'';
  if(!owned.employeeId)owned.employeeId=cleanupChecked<{id:string}|null>(await service.from('profiles').select('id').eq('email',employeeEmail).maybeSingle())?.id||'';
  const expectedIdentities=[[owned.ownerId,email],[owned.employeeId,employeeEmail],[owned.trustId,`provider-trust-${nonce}@loadgistic.local`],[owned.outsiderId,`provider-outsider-${nonce}@loadgistic.local`]].filter(([id])=>Boolean(id));
  for(const [id,expectedEmail] of expectedIdentities){
   if(!uuid.test(id))throw Error('INVALID_OWNED_FIXTURE_ID');
   const identity=cleanupChecked<{user:{email?:string}|null}>(await service.auth.admin.getUserById(id)).user;
   if(identity?.email!==expectedEmail)throw Error('FIXTURE_IDENTITY_NOT_PROVEN');
  }
  const actors=expectedIdentities.map(([id])=>id);
  let employeeRowIds:string[]=[];
  if(actors.length){
   if(cleanupChecked<Array<{id:string}>>(await service.from('provider_shipments').select('id').in('assigned_driver_user_id',actors).limit(1)).length
    ||cleanupChecked<Array<{id:string}>>(await service.from('shipments').select('id').in('created_by',actors).limit(1)).length
    ||cleanupChecked<Array<{id:string}>>(await service.from('support_conversations').select('id').in('customer_user_id',actors).limit(1)).length)
   throw Error('FIXTURE_HAS_UNEXPECTED_CUSTOMER_LINKS');
  }
  if(owned.ownerId){
   const provider=cleanupChecked<{id:string}|null>(await service.from('provider_profiles').select('id').eq('user_id',owned.ownerId).maybeSingle());
   if(owned.providerId&&provider?.id!==owned.providerId)throw Error('FIXTURE_PROVIDER_OWNERSHIP_NOT_PROVEN');owned.providerId=provider?.id||'';
   if(owned.providerId){
    if(cleanupChecked<Array<{id:string}>>(await service.from('provider_shipments').select('id').eq('provider_profile_id',owned.providerId).limit(1)).length
     ||cleanupChecked<Array<{id:string}>>(await service.from('shipments').select('id').eq('provider_profile_id',owned.providerId).limit(1)).length
     ||cleanupChecked<Array<{id:string}>>(await service.from('fleet_driver_invitations').select('id').eq('provider_profile_id',owned.providerId).limit(1)).length)
    throw Error('FIXTURE_HAS_UNEXPECTED_CUSTOMER_LINKS');
    const trucks=cleanupChecked<Array<{id:string}>>(await service.from('vehicles').select('id').eq('provider_profile_id',owned.providerId));owned.truckIds=[...new Set([...owned.truckIds,...trucks.map((item:{id:string})=>item.id)])];
    const drivers=cleanupChecked<Array<{id:string;user_id:string|null;name:string}>>(await service.from('drivers').select('id,user_id,name').eq('provider_profile_id',owned.providerId));
    if(drivers.some((item:{user_id:string|null;name:string})=>item.user_id!==owned.employeeId||item.name!==`Employee ${nonce}`))throw Error('FIXTURE_EMPLOYEE_OWNERSHIP_NOT_PROVEN');
    employeeRowIds=drivers.map((item:{id:string})=>item.id);
   }
   const requests=cleanupChecked<Array<{id:string;storage_path:string;subject_type:string;subject_id:string}>>(await service.from('verification_requests').select('id,storage_path,subject_type,subject_id').eq('submitted_by',owned.ownerId));
   if(requests.some((item:{subject_type:string;subject_id:string;storage_path:string})=>item.subject_type!=='VEHICLE'||!owned.truckIds.includes(item.subject_id)||!item.storage_path.startsWith('supabase://verification/verification/')))throw Error('FIXTURE_DOCUMENT_OWNERSHIP_NOT_PROVEN');
   owned.requestIds=[...new Set([...owned.requestIds,...requests.map((item:{id:string})=>item.id)])];
   cleanupStage='REMOVE_OWNED_DOCUMENTS';
   const paths=[...new Set(requests.map((item:{storage_path:string})=>item.storage_path.replace('supabase://verification/','')))];if(paths.length)cleanupChecked(await service.storage.from('verification').remove(paths));
   if(owned.requestIds.length)cleanupChecked(await service.from('verification_requests').delete().in('id',owned.requestIds).eq('submitted_by',owned.ownerId));
   cleanupStage='REMOVE_OWNED_TRUCKS';
   if(owned.providerId){if(owned.truckIds.length)cleanupChecked(await service.from('driver_vehicle_assignments').delete().in('vehicle_id',owned.truckIds));cleanupChecked(await service.from('capacities').delete().eq('provider_profile_id',owned.providerId));cleanupChecked(await auditDeleteVehicles(service,'provider_profile_id',owned.providerId));}
   // Auth deletion retains drivers.user_id as null; remove these proven
   // disposable children first, otherwise their employer FK blocks the owner.
   cleanupStage='REMOVE_OWNED_EMPLOYEE_ROWS';
   if(owned.providerId&&employeeRowIds.length)cleanupChecked(await service.from('drivers').delete().in('id',employeeRowIds).eq('provider_profile_id',owned.providerId));
  }
  cleanupStage='REMOVE_OWNED_SIGNUP_AND_AUDIT';
  const entities=[...owned.requestIds,...owned.authorityIds,...owned.truckIds];if(actors.length){cleanupChecked(await service.from('provider_signup_intents').delete().in('auth_user_id',actors));cleanupChecked(await service.from('audit_logs').delete().in('actor_user_id',actors));}if(entities.length)cleanupChecked(await service.from('audit_logs').delete().in('entity_id',entities));
  cleanupStage='REMOVE_OWNED_AUTH_IDENTITIES';for(const id of [owned.employeeId,owned.ownerId,owned.trustId,owned.outsiderId].filter(Boolean))cleanupChecked(await service.auth.admin.deleteUser(id));
  cleanupStage='VERIFY_CLEANUP';
  if(owned.truckIds.length)expect(checked(await service.from('vehicles').select('id').in('id',owned.truckIds))).toHaveLength(0);if(owned.requestIds.length)expect(checked(await service.from('verification_requests').select('id').in('id',owned.requestIds))).toHaveLength(0);
  if(owned.requestIds.length)expect(checked(await service.from('provider_vehicle_authority_reviews').select('id').in('source_request_id',owned.requestIds))).toHaveLength(0);
  if(owned.outsiderProviderId)expect(checked(await service.from('provider_profiles').select('id').eq('id',owned.outsiderProviderId))).toHaveLength(0);
  if(actors.length)expect(cleanupChecked(await service.from('profiles').select('id').in('id',actors))).toHaveLength(0);
  if(owned.providerId)expect(cleanupChecked(await service.from('provider_profiles').select('id').eq('id',owned.providerId))).toHaveLength(0);
  cleaned=true;cleanupStage='COMPLETE';
  }catch(error){cleanupFailure=error;info.annotations.push({type:'cleanup-failure',description:JSON.stringify(safeFailure(error,cleanupStage))});if(!primaryFailure)throw error;}finally{
   evidence();manifest();
   await Promise.allSettled([context.close(),employeeContext.close(),outsiderContext.close(),...(nativeContext?[nativeContext.close()]:[])]);
  }
 }
});
import {openFleetDriver} from './fleet-task-helpers';
