import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import type {Page} from 'playwright-core';
import {test,expect as baseExpect} from './browser-test';
import {auditFleetProvider,auditDeleteVehicles,checked as checkedResult,localAuditService} from './audit-helpers';
import {chooseDate} from './date-picker-helper';
import {localMailpitNumericCode} from './mailpit-helper';
import {calendarDay} from '../../src/lib/date-calendar';

// Actual local Auth, UI date selection, Storage and review commands. These are
// synthetic test records, not installed Android or hosted-release evidence.
test.use({trace:'off',screenshot:'off',actionTimeout:20_000,navigationTimeout:30_000});
const expect=baseExpect.configure({timeout:30_000});
const preview='http://localhost:8084';
const bytes=readFileSync('public/icon-192.png');
const digest=(value:Buffer)=>createHash('sha256').update(value).digest('hex');
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
type SafeFailure={code:string|null;status:number|null;name:string|null;constraint:string|null};
function safeFailure(value:unknown):SafeFailure{
 const error=value&&typeof value==='object'?value as Record<string,unknown>:{};
 const identifier=(item:unknown)=>typeof item==='string'&&/^[A-Za-z0-9_]{1,96}$/.test(item)?item:null;
 return {code:identifier(error.code),status:typeof error.status==='number'&&Number.isInteger(error.status)&&error.status>=100&&error.status<=599?error.status:null,name:identifier(error.name),constraint:identifier(error.constraint)};
}

async function webLogin(page:Page,email:string,expectedLanding:'/app/home/vehicles'|'/admin/reviews'='/app/home/vehicles'){
 await page.goto('/login');await page.getByTestId('email-code-request-form').getByLabel('Email',{exact:true}).fill(email);const since=Date.now();await page.getByRole('button',{name:'Email me a code',exact:true}).click();await expect(page.getByTestId('email-code-form')).toBeVisible();
 await page.getByLabel('Six-digit code',{exact:true}).fill(await localMailpitNumericCode(email,since,['Your Loadgistic sign-in code','Your Loadgistic signup code']));
 // Trust-only Support finishes its /support redirect at the Review Center.
 const landed=page.waitForURL(url=>url.pathname===expectedLanding,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Continue',exact:true}).click();await landed;
 await expect(page.getByTestId('email-code-form')).toHaveCount(0);
 if(expectedLanding==='/admin/reviews')await expect(page.getByRole('heading',{name:'Review Center',exact:true})).toBeVisible();
 else await expect(page.locator('.app-main')).toBeVisible();
}
async function openVehicleDocumentsAfterLogin(page:Page,truck:string){
 const target=`/app/fleet/${truck}?view=documents`;
 try{await page.goto(target,{waitUntil:'domcontentloaded'});}
 catch(error){
  // The sign-in page can finish its own client redirect just as this direct
  // navigation begins. Retry that cancelled navigation once, then assert the
  // vehicle form rather than treating an aborted request as a product failure.
  if(!(error instanceof Error)||!error.message.includes('net::ERR_ABORTED'))throw error;
  await page.waitForLoadState('domcontentloaded');
  if(new URL(page.url()).pathname!==`/app/fleet/${truck}`)await page.goto(target,{waitUntil:'domcontentloaded'});
 }
 await expect(page).toHaveURL(new RegExp(`/app/fleet/${truck}\\?view=documents$`));
 await expect(page.getByRole('button',{name:'Submit verification',exact:true})).toBeVisible();
}
async function nativeLogin(page:Page,email:string){
 await page.goto(preview+'/account');await page.getByLabel('Email',{exact:true}).fill(email);const since=Date.now();await page.getByRole('button',{name:'Send code',exact:true}).click();await expect(page.getByLabel('Sign-in code',{exact:true})).toBeVisible();
 await page.getByLabel('Sign-in code',{exact:true}).fill(await localMailpitNumericCode(email,since,['Your Loadgistic sign-in code','Your Loadgistic signup code']));await page.getByRole('button',{name:'Sign in',exact:true}).last().click();await expect(page.getByLabel('Sign-in code',{exact:true})).toHaveCount(0);
 await expect(page).toHaveURL(preview+'/account?tab=vehicles');
 await expect(page.getByRole('tab',{name:'Manage vehicles',exact:true})).toHaveAttribute('aria-selected','true');
}
async function chooseNativeDate(page:Page,label:string,date:string){
 await page.getByRole('button',{name:new RegExp('^'+escape(label)+':')}).click();const choice=page.getByRole('button',{name:new RegExp('^'+escape(calendarDay(date,'en').label)+'(?:,|$)')});
 for(let week=0;week<20;week++){
  if(await choice.count()){await expect(choice).toBeEnabled();await choice.click();await expect(page.getByRole('button',{name:'Next week',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:label+': '+calendarDay(date,'en').label,exact:true})).toBeVisible();return;}
  await page.getByRole('button',{name:'Next week',exact:true}).click();
 }
 throw Error('Synthetic native date did not appear in the bounded calendar navigation.');
}

test('operating-licence expiry and financed-holder review persist, and Expo permission upload opens its authorized private image',async({page,browser,context},info)=>{
 test.setTimeout(360_000);await context.setExtraHTTPHeaders({'x-forwarded-for':'127.0.0.247'});
 function boundActions(target:import('playwright-core').BrowserContext){target.setDefaultTimeout(20_000);target.setDefaultNavigationTimeout(30_000);}boundActions(context);
 const service=localAuditService(),nonce=randomUUID().slice(0,8),expiry=new Date(Date.now()+35*86_400_000).toISOString().slice(0,10);
 const actors:Array<Awaited<ReturnType<typeof auditFleetProvider>>>=[],trucks:string[]=[],requests:string[]=[],reviews:string[]=[];let trustId='',stage='SETUP',cleanupStage='NOT_STARTED',completed=false,cleaned=false,workflowFailed=false,cleanupFailed=false,inCleanup=false,workflowError:SafeFailure|null=null,cleanupError:SafeFailure|null=null;
 const evidence=()=>{writeFileSync(info.outputPath('provider-authority-expiry-checks.json'),JSON.stringify({stage,completed,cleaned,workflowFailed,workflowError,cleanupFailed,cleanupStage,cleanupError},null,2),{mode:0o600});writeFileSync(info.outputPath('provider-authority-expiry-owned.json'),JSON.stringify({stage,completed,cleaned,actorIds:actors.map(actor=>actor.id),organizationIds:actors.map(actor=>actor.organization_id),trustId,trucks,requests,reviews},null,2),{mode:0o600});};
 function checked(result:Parameters<typeof checkedResult>[0]){if(result.error){if(inCleanup)cleanupError=safeFailure(result.error);else workflowError=safeFailure(result.error);evidence();throw Error('Synthetic fixture command failed at '+(inCleanup?cleanupStage:stage)+'.');}return checkedResult(result);}
 function cleanupCheckpoint(value:string){cleanupStage=value;evidence();}
 const staffContext=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize()||undefined,isMobile:Boolean(info.project.use.isMobile),hasTouch:Boolean(info.project.use.hasTouch),extraHTTPHeaders:{'x-forwarded-for':'127.0.0.248'}});boundActions(staffContext);const staff=await staffContext.newPage();
 let nativeContext:import('playwright-core').BrowserContext|null=null;
 async function checkpoint(value:string){stage=value;evidence();}
 async function makeTruck(actor:typeof actors[number],basis:'FINANCED'|'PERMISSION'){
  const truck=checked(await service.rpc('create_provider_vehicle',{actor_user_id:actor.id,command:{use_basis:basis,make:'Synthetic',model:'Expiry '+basis,plate:`EXPIRY-${nonce}-${trucks.length}`,cargo_configuration:'Mini Box Truck'}})).id;trucks.push(truck);evidence();return truck;
 }
 async function storedRequest(actorId:string,truckId:string,name:string){
  const request=checked(await service.from('verification_requests').select('id,subject_type,subject_id,related_vehicle_id,verification_type,status,expires_on,storage_path').eq('submitted_by',actorId).eq('subject_id',truckId).eq('document_name',name).single());requests.push(request.id);evidence();return request;
 }
 async function reviewRow(name:string){
  await staff.goto(`/admin/reviews?tab=documents&status=ALL&q=${encodeURIComponent(name)}`,{waitUntil:'domcontentloaded'});const row=staff.locator('.admin-review-row').filter({has:staff.getByText(name,{exact:true})});await expect(row).toHaveCount(1);await expect(row).toBeVisible();return row;
 }
 try{
  const owner=await auditFleetProvider(service,'expiry-web');actors.push(owner);evidence();const truck=await makeTruck(owner,'FINANCED');
  await checkpoint('WEB_LOGIN');await webLogin(page,owner.email);
  await checkpoint('WEB_DOCUMENT_FORM');await openVehicleDocumentsAfterLogin(page,truck);await page.getByRole('button',{name:'Submit verification',exact:true}).click();await page.getByLabel('Verification type',{exact:true}).selectOption('VEHICLE_OPERATING_LICENSE');await expect(page.locator('input[name="relatedVehicleId"]')).toHaveValue(truck);
  await checkpoint('WEB_LICENCE_EXPIRY');await chooseDate(page,'Licence expires',expiry);
  await checkpoint('WEB_LICENCE_UPLOAD');await page.getByLabel('Document name',{exact:true}).fill(`Financed licence ${nonce}`);await page.locator('input[name="file"]').setInputFiles({name:'synthetic-financed-licence.png',mimeType:'image/png',buffer:bytes});await page.getByRole('button',{name:'Submit for review',exact:true}).click();await expect(page.locator('.alert.success')).toBeVisible();
  const licence=await storedRequest(owner.id,truck,`Financed licence ${nonce}`);expect(licence).toMatchObject({subject_type:'VEHICLE',subject_id:truck,related_vehicle_id:truck,verification_type:'VEHICLE_OPERATING_LICENSE',expires_on:expiry,status:'PENDING'});
  await checkpoint('WEB_LICENCE_PENDING');await expect(page.locator('.request-history-row').filter({hasText:`Financed licence ${nonce}`}).locator('.status.pending')).toBeVisible();await page.screenshot({path:info.outputPath('provider-licence-pending.png'),fullPage:true});
  await checkpoint('CREATE_TRUST_IDENTITY');trustId=checked(await service.auth.admin.createUser({email:`expiry-trust-${nonce}@loadgistic.local`,email_confirm:true,app_metadata:{fixture_source:'loadgistic'}})).user.id;evidence();
  await checkpoint('TRUST_PROFILE_UPDATE');checked(await service.from('profiles').update({active:true,role:'SUPPORT',full_name:'Synthetic expiry reviewer'}).eq('id',trustId));
  await checkpoint('TRUST_PERMISSION_UPDATE');checked(await service.from('support_agent_profiles').insert({user_id:trustId,active:true,available:false,can_manage_support:false,can_manage_brokerage:false,can_manage_customers:false,can_manage_operations:false,can_manage_featured:false,can_manage_billing:false,can_manage_trust:true}));
  await checkpoint('TRUST_LOGIN');await webLogin(staff,`expiry-trust-${nonce}@loadgistic.local`,'/admin/reviews');
  await checkpoint('TRUST_PRIVATE_FILE');let row=await reviewRow(`Financed licence ${nonce}`);const source=await staff.request.get(`/api/files/verification/${licence.id}`);expect(source.status()).toBe(200);expect(digest(await source.body())).toBe(digest(bytes));
  await checkpoint('TRUST_DOCUMENT_APPROVAL');await row.getByRole('button',{name:'Review document',exact:true}).click();await row.getByLabel('Review note',{exact:true}).fill('Synthetic operating licence source reviewed for the named truck.');await row.getByRole('button',{name:'Approve',exact:true}).click();await expect(staff.locator('.alert.success')).toBeVisible();
  await checkpoint('TRUST_RELATIONSHIP_FORM');row=await reviewRow(`Financed licence ${nonce}`);await row.getByRole('button',{name:'Vehicle relationship',exact:true}).click();await row.getByLabel('What this document confirms',{exact:true}).selectOption('OPERATING_LICENCE');await row.getByLabel('Vehicle purchase',{exact:true}).selectOption('FINANCED');
  await checkpoint('TRUST_RELATIONSHIP_EXPIRY');await chooseDate(staff,'Valid until',expiry);
  await checkpoint('TRUST_RELATIONSHIP_CONFIRM');await row.getByLabel('What you checked',{exact:true}).fill('Synthetic financed purchase and operating licence match this provider and truck.');
  const confirmation=row.getByRole('checkbox',{name:'I checked this document against the named provider and this vehicle.',exact:true}),confirmationLabel=confirmation.locator('..');await expect(confirmation).not.toBeChecked();
  if(info.project.name==='mobile-chromium'){
   const controlBounds=await confirmation.boundingBox(),labelBounds=await confirmationLabel.boundingBox();expect(controlBounds).not.toBeNull();expect(labelBounds).not.toBeNull();expect(controlBounds!.width).toBeGreaterThan(0);expect(controlBounds!.height).toBeGreaterThan(0);expect(controlBounds!.width).toBeLessThanOrEqual(24);expect(controlBounds!.height).toBeLessThanOrEqual(24);expect(labelBounds!.height).toBeGreaterThanOrEqual(44);
  }
  await confirmationLabel.click();await expect(confirmation).toBeChecked();await row.getByRole('region',{name:'Vehicle relationship review',exact:true}).screenshot({path:info.outputPath('provider-trust-licence-ready-to-confirm.png')});await row.getByRole('button',{name:'Confirm relationship',exact:true}).click();await expect(staff.locator('.alert.success')).toBeVisible();
  const reviewed=checked(await service.from('provider_vehicle_authority_reviews').select('id,fact_kind,holder_basis,expires_on,vehicle_id,source_request_id').eq('source_request_id',licence.id).single());reviews.push(reviewed.id);evidence();expect(reviewed).toMatchObject({fact_kind:'OPERATING_LICENCE',holder_basis:'FINANCED',expires_on:expiry,vehicle_id:truck,source_request_id:licence.id});
  await checkpoint('WEB_FINANCED_BADGE');await page.goto(`/app/fleet/${truck}`,{waitUntil:'domcontentloaded'});
  const detailsReady=page.waitForURL(url=>url.pathname===`/app/fleet/${truck}`&&url.searchParams.get('view')==='details',{waitUntil:'domcontentloaded'});
  await page.getByRole('navigation',{name:'Vehicle',exact:true}).getByRole('link',{name:'Vehicle details',exact:true}).click();await detailsReady;
  await expect(page.getByText('Financed · licence reviewed',{exact:true})).toBeVisible();await expect(page.getByText('Ownership verified',{exact:true})).toHaveCount(0);const financedSummary=page.locator('summary').filter({has:page.getByText('Financed · licence reviewed',{exact:true})});await financedSummary.click();await expect(financedSummary.locator('..').getByText('Expires '+expiry,{exact:true})).toBeVisible();await page.screenshot({path:info.outputPath('provider-financed-licence-reviewed.png'),fullPage:true});
  if(info.project.name==='mobile-chromium'){
   await checkpoint('EXPO_SETUP');const nativeOwner=await auditFleetProvider(service,'expiry-native');actors.push(nativeOwner);evidence();const nativeTruck=await makeTruck(nativeOwner,'PERMISSION'),permissionName=`Native permission ${nonce}`;
   nativeContext=await browser.newContext({baseURL:preview,viewport:{width:390,height:844},isMobile:true,hasTouch:true,extraHTTPHeaders:{'x-forwarded-for':'127.0.0.249'}});boundActions(nativeContext);const native=await nativeContext.newPage();await checkpoint('EXPO_LOGIN');await nativeLogin(native,nativeOwner.email);
   await checkpoint('EXPO_DOCUMENT_FORM');const fleetLoaded=native.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/fleet'&&response.request().method()==='GET');await native.goto(preview+'/fleet',{waitUntil:'domcontentloaded'});expect((await fleetLoaded).status()).toBe(200);await native.getByRole('button',{name:new RegExp('^Manage vehicle: .*'+escape(`EXPIRY-${nonce}-1`)+'$')}).click();await native.getByRole('tab',{name:'Documents',exact:true}).click();await native.getByRole('button',{name:'Submit a document',exact:true}).click();await native.getByRole('radio',{name:'Permission to use vehicle',exact:true}).click();
   await checkpoint('EXPO_PERMISSION_EXPIRY');await chooseNativeDate(native,'Permission expires',expiry);await native.getByLabel('Document name (optional)',{exact:true}).fill(permissionName);
   await checkpoint('EXPO_FILE_PICKER');const chooser=native.waitForEvent('filechooser');await native.getByRole('button',{name:'Choose file',exact:true}).click();await (await chooser).setFiles({name:'synthetic-native-permission.png',mimeType:'image/png',buffer:bytes});await expect(native.getByText('synthetic-native-permission.png',{exact:true})).toBeVisible();
   await checkpoint('EXPO_PERMISSION_SUBMIT');const submitted=native.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/verification'&&response.request().method()==='POST');await native.getByRole('button',{name:'Send for review',exact:true}).click();expect((await submitted).status()).toBe(200);
   await checkpoint('EXPO_PENDING');const permission=await storedRequest(nativeOwner.id,nativeTruck,permissionName);expect(permission).toMatchObject({subject_type:'VEHICLE',subject_id:nativeTruck,related_vehicle_id:nativeTruck,verification_type:'VEHICLE_AUTHORIZATION',expires_on:expiry,status:'PENDING'});await expect(native.getByText(permissionName+' · Awaiting review',{exact:true})).toBeVisible();
   await checkpoint('EXPO_PRIVATE_IMAGE');const loaded=native.waitForResponse(response=>new URL(response.url()).pathname===`/api/mobile/verification/${permission.id}`);await native.getByRole('button',{name:'Open '+permissionName,exact:true}).click();const file=await loaded;expect(file.status()).toBe(200);const data=await file.json();expect(data.mimeType).toBe('image/png');expect(digest(Buffer.from(data.base64,'base64'))).toBe(digest(bytes));
   const image=native.getByRole('img',{name:'Submitted document',exact:true});await expect(image).toBeVisible();await expect.poll(()=>image.evaluate(element=>{const picture=element instanceof HTMLImageElement?element:element.querySelector('img');return Boolean(picture?.complete&&picture.naturalWidth>0);})).toBe(true);await native.screenshot({path:info.outputPath('provider-native-permission-private-image.png')});
   await checkpoint('EXPO_PRIVATE_IMAGE_CLOSE');await native.getByRole('button',{name:'Close document',exact:true}).click();await expect(image).toHaveCount(0);await expect(native.getByText(permissionName+' · Awaiting review',{exact:true})).toBeVisible();
   expect((await page.request.get(`/api/mobile/verification/${permission.id}`)).status()).toBe(401);expect(checked(await service.from('provider_vehicle_authority_reviews').select('id').eq('source_request_id',permission.id))).toHaveLength(0);
  }
  completed=true;await checkpoint('COMPLETE');
 }catch(error){workflowFailed=true;workflowError??=safeFailure(error);evidence();throw error;
 }finally{
  inCleanup=true;
  try{
  const actorIds=actors.map(actor=>actor.id);
  if(actorIds.length){
   cleanupCheckpoint('LOOKUP_SOURCES');
   const sources:Array<{id:string;storage_path:string}>=checked(await service.from('verification_requests').select('id,storage_path').in('submitted_by',actorIds));for(const item of sources){if(!requests.includes(item.id))requests.push(item.id);}
   cleanupCheckpoint('REMOVE_FILES');const paths=sources.map(item=>{const match=/^supabase:\/\/verification\/(verification\/\d{4}-\d{2}-\d{2}\/[a-f0-9-]+\.png)$/.exec(item.storage_path);if(!match)throw Error('Unexpected synthetic verification file scope.');return match[1];});if(paths.length)checked(await service.storage.from('verification').remove(paths));
   cleanupCheckpoint('DELETE_SOURCES');
   checked(await service.from('verification_requests').delete().in('submitted_by',actorIds));
   for(const actor of actors){cleanupCheckpoint('DELETE_TRUCKS');checked(await auditDeleteVehicles(service,'organization_id',actor.organization_id));}
  }
  const actorScope=[...actorIds,trustId].filter(Boolean),organizationScope=actors.map(actor=>actor.organization_id),entityScope=[...trucks,...requests,...reviews,...organizationScope];
  cleanupCheckpoint('DELETE_AUDIT');if(actorScope.length)checked(await service.from('audit_logs').delete().in('actor_user_id',actorScope));if(entityScope.length)checked(await service.from('audit_logs').delete().in('entity_id',entityScope));if(organizationScope.length)checked(await service.from('audit_logs').delete().in('organization_id',organizationScope));
  cleanupCheckpoint('DELETE_ORGANIZATIONS');for(const id of organizationScope)checked(await service.from('organizations').delete().eq('id',id));
  cleanupCheckpoint('DELETE_SIGNUP_INTENTS');if(actorScope.length)checked(await service.from('provider_signup_intents').delete().in('auth_user_id',actorScope));
  cleanupCheckpoint('DELETE_TRUST_PROFILE');if(trustId)checked(await service.from('support_agent_profiles').delete().eq('user_id',trustId));
  cleanupCheckpoint('DELETE_AUTH');for(const id of actorScope)checked(await service.auth.admin.deleteUser(id));
  cleanupCheckpoint('CONFIRM_EMPTY');
  if(trucks.length)expect(checked(await service.from('vehicles').select('id').in('id',trucks))).toHaveLength(0);if(requests.length){expect(checked(await service.from('verification_requests').select('id').in('id',requests))).toHaveLength(0);expect(checked(await service.from('provider_vehicle_authority_reviews').select('id').in('source_request_id',requests))).toHaveLength(0);}
  cleaned=true;cleanupStage='COMPLETE';
  }catch(error){cleanupFailed=true;cleanupError??=safeFailure(error);if(!workflowFailed)throw error;
  }finally{evidence();await Promise.allSettled([staffContext.close(),...(nativeContext?[nativeContext.close()]:[])]);}
 }
});
