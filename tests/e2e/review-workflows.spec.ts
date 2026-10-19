import {auditDeleteVehicles} from './audit-helpers';
import {chooseDate} from './date-picker-helper';
import {test,expect} from './browser-test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {localAuditService,auditProvider,auditFleetProvider,auditLogin,auditProof,auditTrackingOwnerLogin,checked} from './audit-helpers';
import {createProviderShipment,updateProviderShipmentStatus} from '../../src/lib/provider-tracking.js';
import {localSupportLogin} from './provider-support-helper';
import type {Page,BrowserContext} from 'playwright-core';

test.use({extraHTTPHeaders:{'x-forwarded-for':'127.0.0.245'}});
async function adminBrowser(browser:any,page:any,info:any){
  const context=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize(),isMobile:Boolean(info.project.use.isMobile),extraHTTPHeaders:{'x-forwarded-for':'127.0.0.246'}});
  const admin=await context.newPage();await auditLogin(admin,'admin@loadgistic.local');return {context,page:admin};
}
async function cleanProvider(service:any,actor:any,extraIds:string[]=[],proofs:Array<{shipmentId:string;path:string}>=[]){
  if(proofs.length>10)throw Error('REVIEW_PROOF_CLEANUP_SCOPE_INVALID');
  if(proofs.length){
    const scope=actor.organization_id?'provider_organization_id':'provider_profile_id',scopeId=actor.organization_id||actor.provider_profile_id;
    const owned=checked(await service.from('provider_shipments').select('id').eq(scope,scopeId).in('id',[...new Set(proofs.map(file=>file.shipmentId))]));
    const ownedIds=new Set(owned.map((shipment:{id:string})=>shipment.id)),paths=new Set<string>();
    for(const file of proofs){
      const prefix=`supabase://shipment-proof/tracking-proof/${file.shipmentId}/`;
      if(!ownedIds.has(file.shipmentId)||!extraIds.includes(file.shipmentId)||!file.path.startsWith(prefix)||!/^[0-9a-f-]{36}\.png$/.test(file.path.slice(prefix.length)))throw Error('REVIEW_PROOF_CLEANUP_SCOPE_INVALID');
      paths.add(file.path.slice('supabase://shipment-proof/'.length));
    }
    // Only acknowledged auditProof paths in this run's manifest are removed.
    // Older unidentified test objects are neither discovered nor deleted.
    checked(await service.storage.from('shipment-proof').remove([...paths]));
  }
  const requests=checked(await service.from('verification_requests').select('id,storage_path').eq('submitted_by',actor.id));
  for(const row of requests){
    const match=/^supabase:\/\/verification\/(.+)$/.exec(row.storage_path);
    if(match)checked(await service.storage.from('verification').remove([match[1]]));
  }
  const ids=[actor.id,actor.organization_id||actor.provider_profile_id,...requests.map((r:any)=>r.id),...extraIds].filter(Boolean);
  checked(await service.from('audit_logs').delete().in('entity_id',ids));
  checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));
  checked(await service.from('verification_requests').delete().eq('submitted_by',actor.id));
  const scope=actor.organization_id?'provider_organization_id':'provider_profile_id',vehicleScope=actor.organization_id?'organization_id':'provider_profile_id',scopeId=actor.organization_id||actor.provider_profile_id;
  checked(await service.from('provider_shipments').delete().eq(scope,scopeId));
  checked(await auditDeleteVehicles(service,vehicleScope,scopeId));
  if(actor.organization_id)checked(await service.from('organizations').delete().eq('id',actor.organization_id));
  checked(await service.auth.admin.deleteUser(actor.id));
}
async function openReview(page:any,tab:string,id:string,filter:string,status='PENDING'){
  let stage='QUEUE_NAVIGATION';
  try{
    await page.goto(`/admin/reviews?tab=${tab}&status=${status}${filter?`&q=${encodeURIComponent(filter)}`:''}&page=999999`);
    const route=tab==='documents'?'verifications':tab==='payments'?'payment-proofs':'ratings';
    const form=page.locator(`form[action="/api/admin/${route}/${id}"]`);
    let row;
    if(tab==='documents')row=page.locator('.admin-review-row').filter({has:page.locator(`a[href="/api/files/verification/${id}"]`)});
    else if(tab==='ratings'){
      const db=localAuditService(),review=checked(await db.from('provider_reviews').select('shipment_id').eq('id',id).single()),shipment=checked(await db.from('provider_shipments').select('code').eq('id',review.shipment_id).single());
      row=page.locator('.admin-review-row').filter({has:page.locator(`a[href="/admin/operations?view=TRACKING&q=${encodeURIComponent(shipment.code)}"]`)});
    }else row=page.locator('details.admin-review-row').filter({has:form});
    stage='EXACT_REVIEW_ROW';await expect(row).toHaveCount(1);
    stage='REVIEW_TASK';await row.getByRole('button',{name:tab==='documents'?'Review document':'Review rating',exact:true}).click();
    stage='VISIBLE_REVIEW_ACTIONS';await expect(form).toBeVisible();return {form,row};
  }catch{
    // Keep request/cookie diagnostics out of failure output.
    throw Error('REVIEW_WORKFLOW_FAILED: '+stage);
  }
}
function expectContext(page:any,tab:string,filter:string,status:string){
  const url=new URL(page.url());expect(url.pathname).toBe('/admin/reviews');expect(url.searchParams.get('tab')).toBe(tab);
  expect(url.searchParams.get('status')).toBe(status);expect(url.searchParams.get('page')).toBe('1');
  if(filter)expect(url.searchParams.get('q')).toBe(filter);
}
async function deniedReview(page:any,path:string,form:any){
  const response=await page.request.post(path,{form,headers:{origin:'http://127.0.0.1:3100'},maxRedirects:0});
  expect(response.status()).toBe(303);expect(new URL(response.headers().location).searchParams.has('error')).toBe(true);return response;
}

test('document reviews persist notes and context; each truck excludes its pending or approved permission',async({page,browser}:{page:any;browser:any},info:any)=>{
  test.setTimeout(180000);const service=localAuditService();const actor=await auditFleetProvider(service,'review-doc');
  const vehicles:string[]=[];let admin:any;let guest:any;
  const marker=`review-doc-${actor.suffix}`;const bytes=readFileSync('public/icon-192.png');
  try{
    for(const model of ['Approved first','Needs approval'])vehicles.push(checked(await service.rpc('create_provider_vehicle',{actor_user_id:actor.id,command:{use_basis:'OWNED',make:'Audit',model,plate:`TEST-${randomUUID().slice(0,8)}`,cargo_configuration:'Mini Box Truck'}})).id);
    await auditLogin(page,actor.email);admin=await adminBrowser(browser,page,info);guest=await browser.newContext({baseURL:info.project.use.baseURL});
    for(let index=0;index<2;index++){
      if(index===0){
        let releaseScripts=()=>{};
        const scriptsReady=new Promise<void>(resolve=>{releaseScripts=resolve;});
        const pattern='**/_next/static/**/*.js';
        await page.route(pattern,async(route:any)=>{await scriptsReady;await route.continue();});
        try{
          await page.goto(`/app/verification?truck=${vehicles[index]}`,{waitUntil:'commit'});
          await expect(page.getByLabel('Verification type',{exact:true})).toBeDisabled();
          await expect(page.getByLabel('Profile, driver, or truck',{exact:true})).toBeDisabled();
        }finally{releaseScripts();}
      }else await page.goto(`/app/verification?truck=${vehicles[index]}`);
      await page.getByLabel('Verification type',{exact:true}).selectOption('VEHICLE_AUTHORIZATION');
      await expect(page.getByLabel('Verification type',{exact:true})).toHaveValue('VEHICLE_AUTHORIZATION');
      await expect(page.getByLabel('Profile, driver, or truck',{exact:true})).toHaveValue(`VEHICLE:${vehicles[index]}`);
      await expect(page.locator('input[name=relatedVehicleId]')).toHaveValue(vehicles[index]);
      await chooseDate(page,'Permission expires',new Date(Date.now()+60*86400000).toISOString().slice(0,10));
      await page.getByLabel('Document name',{exact:true}).fill(`${marker}-${index}`);
      await page.getByLabel('Verification document',{exact:true}).setInputFiles({name:'synthetic-authorization.png',mimeType:'image/png',buffer:bytes});
      await page.getByRole('button',{name:'Submit for review',exact:true}).click();await expect(page.getByText('Verification submitted for review.',{exact:true})).toBeVisible();
      const stored=checked(await service.from('verification_requests').select('id,status').eq('submitted_by',actor.id).eq('related_vehicle_id',vehicles[index]).single());
      await deniedReview(page,`/api/admin/verifications/${stored.id}`,{status:'APPROVED'});
      expect(checked(await service.from('verification_requests').select('status').eq('id',stored.id).single()).status).toBe('PENDING');
      await page.reload();
      await expect(page.getByText('Documents already awaiting review are excluded from the choices below. Check Request history for updates.')).toBeVisible();
      await page.goto(`/app/verification?truck=${vehicles[index]}`);
      await expect(page.getByLabel('Verification type',{exact:true})).toBeEnabled();
      await expect(page.getByLabel('Verification type',{exact:true}).locator('option[value=VEHICLE_AUTHORIZATION]')).toHaveCount(0);
      await expect(page.getByLabel('Verification type',{exact:true}).locator('option[value=VEHICLE_OWNERSHIP]')).toHaveCount(1);
      await page.screenshot({path:info.outputPath(`pending-document-${index}.png`),fullPage:true});
      let review=await openReview(admin.page,'documents',stored.id,marker);
      const file=review.row.getByRole('link',{name:'Open private document'});const href=await file.getAttribute('href');
      const popupPromise=admin.page.waitForEvent('popup');await file.click();const popup=await popupPromise;await popup.waitForLoadState();await popup.close();
      const response=await admin.page.request.get(href);expect(response.status()).toBe(200);expect((await response.body()).equals(bytes)).toBe(true);
      expect((await guest.request.get(href)).status()).toBe(401);
      if(index===1){
        await review.form.getByLabel('Review note').fill('Please confirm the truck details.');await review.form.getByRole('button',{name:'More info',exact:true}).click();
        expectContext(admin.page,'documents',marker,'PENDING');
        expect(checked(await service.from('verification_requests').select('status,review_note').eq('id',stored.id).single())).toMatchObject({status:'MORE_INFO',review_note:'Please confirm the truck details.'});
        review=await openReview(admin.page,'documents',stored.id,marker,'MORE_INFO');
      }
      await review.form.getByLabel('Review note').fill('Authorization checked for this truck.');await review.form.getByRole('button',{name:'Approve',exact:true}).click();
      expectContext(admin.page,'documents',marker,index===1?'MORE_INFO':'PENDING');await expect(admin.page.locator('.alert.success')).toBeVisible();
      expect(checked(await service.from('verification_requests').select('status,review_note').eq('id',stored.id).single())).toMatchObject({status:'APPROVED',review_note:'Authorization checked for this truck.'});
      await deniedReview(admin.page,`/api/admin/verifications/${stored.id}`,{status:'REJECTED',returnTo:`/admin/reviews?tab=documents&status=APPROVED&q=${marker}&page=1`});
      expect(checked(await service.from('verification_requests').select('status').eq('id',stored.id).single()).status).toBe('APPROVED');
    }
    await admin.page.goto(`/admin/reviews?tab=documents&status=APPROVED&q=${marker}`);await expect(admin.page.locator('.admin-review-row')).toHaveCount(2);
    await expect(admin.page.locator('.admin-review-row .verification-review-actions')).toHaveCount(0);await admin.page.screenshot({path:info.outputPath('reviewed-documents.png'),fullPage:true});
  }finally{await admin?.context.close().catch(()=>{});await guest?.close().catch(()=>{});await cleanProvider(service,actor,vehicles);}
});

test('retired payment review cannot mutate retained proof or subscription history',async({page,browser}:{page:any;browser:any},info:any)=>{
 const service=localAuditService(),actor=await auditProvider(service,'review-payment'),proofId=randomUUID();let admin:any;
 try{
  const subscription=checked(await service.from('subscriptions').select('*').eq('provider_profile_id',actor.provider_profile_id).single());
  checked(await service.from('payment_proofs').insert({id:proofId,subscription_id:subscription.id,amount_minor:125050,reference:`review-payment-${actor.suffix}`,status:'PENDING'}));
  await auditLogin(page,actor.email);expect((await page.request.post(`/api/admin/payment-proofs/${proofId}`,{form:{status:'APPROVED'}})).status()).toBe(403);
  admin=await adminBrowser(browser,page,info);const denied=await admin.page.request.post(`/api/admin/payment-proofs/${proofId}`,{form:{status:'APPROVED'}});
  expect(denied.status()).toBe(410);expect((await denied.json()).error).toBe('Platform payment plans are not offered.');
  expect(checked(await service.from('payment_proofs').select('status').eq('id',proofId).single()).status).toBe('PENDING');
  expect(checked(await service.from('subscriptions').select('*').eq('id',subscription.id).single())).toEqual(subscription);
  await admin.page.goto('/admin/reviews');await expect(admin.page.getByRole('link',{name:'Payments',exact:true})).toHaveCount(0);
  await admin.page.screenshot({path:info.outputPath('payment-review-retired.png')});
 }finally{await admin?.context.close().catch(()=>{});checked(await service.from('payment_proofs').delete().eq('id',proofId));await cleanProvider(service,actor,[proofId]);}
});

test('rating decisions preserve publication rules, require authority and retain their queue',async({page,browser}:{page:any;browser:any},info:any)=>{
  test.setTimeout(120000);const service=localAuditService();const actor=await auditProvider(service,'review-rating');const ids:string[]=[],proofs:Array<{shipmentId:string;path:string}>=[];let admin:any;
  try{
    const vehicle=checked(await service.rpc('create_provider_vehicle',{actor_user_id:actor.id,command:{use_basis:'OWNED',make:'Audit',model:'Rating review',plate:`TEST-${actor.suffix}`,cargo_configuration:'Mini Box Truck'}}));ids.push(vehicle.id);
    const origin=checked(await service.from('place_catalog').select('id').eq('normalized_name','addis ababa').limit(1).single());const destination=checked(await service.from('place_catalog').select('id').eq('normalized_name','adama').limit(1).single());
    await auditLogin(page,actor.email);admin=await adminBrowser(browser,page,info);
    for(const resolution of ['UPHELD','REMOVED']){
      const ownerEmail=`rating-${randomUUID()}@example.test`;
      const shipment=await createProviderShipment(actor,{expectedDeliveryDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),vehicleId:vehicle.id,originPlaceRef:origin.id,destinationPlaceRef:destination.id,passingPlaceRef:checked(await service.from('place_catalog').select('id').eq('normalized_name','dire dawa').limit(1).single()).id,cargoSummary:`Synthetic review ${actor.suffix}`,customerEmail:ownerEmail,trackingMode:'STATUS_ONLY'});ids.push(shipment.id);
      const proof=await auditProof(service,shipment.id);
      proofs.push({shipmentId:shipment.id,path:proof.path});
      await updateProviderShipmentStatus(actor,shipment.id,'LOADING','Synthetic loading',proof);
      await updateProviderShipmentStatus(actor,shipment.id,'IN_TRANSIT','Synthetic transit');
      await updateProviderShipmentStatus(actor,shipment.id,'UNLOADING','Synthetic unloading',proof);
      const ownerContext=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize(),extraHTTPHeaders:{'x-forwarded-for':'127.0.0.247'}});
      try{const owner=await ownerContext.newPage();await auditTrackingOwnerLogin(owner,ownerEmail);await owner.getByRole('button',{name:'Approve unloading',exact:true}).click();}finally{await ownerContext.close();}
      const reviewId=randomUUID();ids.push(reviewId);checked(await service.from('provider_reviews').insert({id:reviewId,shipment_id:shipment.id,provider_profile_id:actor.provider_profile_id,rating:2,note:'Synthetic review evidence',status:'PUBLISHED',dispute_status:'PENDING',dispute_reason:'Please inspect this synthetic review.'}));
      await deniedReview(page,`/api/admin/ratings/${reviewId}`,{status:resolution,reviewNote:'Provider cannot moderate.'});
      expect(checked(await service.from('provider_reviews').select('status,dispute_status').eq('id',reviewId).single())).toMatchObject({status:'PUBLISHED',dispute_status:'PENDING'});
      const {form}=await openReview(admin.page,'ratings',reviewId,'');await form.getByLabel('Decision note').fill('Reviewed the shipment and customer evidence.');
      await form.getByRole('button',{name:resolution==='UPHELD'?'Uphold review':'Remove review',exact:true}).click();expectContext(admin.page,'ratings','','PENDING');await expect(admin.page.locator('.alert.success')).toBeVisible();
      const reviewed=checked(await service.from('provider_reviews').select('status,dispute_status,review_note').eq('id',reviewId).single());expect(reviewed).toMatchObject({status:resolution==='UPHELD'?'PUBLISHED':'REMOVED',dispute_status:resolution,review_note:'Reviewed the shipment and customer evidence.'});
      await deniedReview(admin.page,`/api/admin/ratings/${reviewId}`,{status:resolution==='UPHELD'?'REMOVED':'UPHELD',reviewNote:'Cannot replay terminal decision.'});
      expect(checked(await service.from('provider_reviews').select('status,dispute_status,review_note').eq('id',reviewId).single())).toEqual(reviewed);
    }
    await admin.page.goto('/admin/reviews?tab=ratings&status=REMOVED');await admin.page.screenshot({path:info.outputPath('reviewed-rating.png'),fullPage:true});
  }finally{await admin?.context.close().catch(()=>{});await cleanProvider(service,actor,ids,proofs);}
});

// FEAT-REV-001 / FEAT-PLY-001 / NR-43. Run against the reviewed143 catalogue.
// Completed Tracking rows are a synthetic setup for this moderation scenario;
// this case does not claim to exercise Tracking creation, proof or OTP flows.
test('independent content holds survive rating decisions and revoked Trust cannot restore them',async({page,browser},info)=>{
  test.setTimeout(180000);
  const service=localAuditService(),suffix=randomUUID().slice(0,8),handle=`moderation-ui-${suffix}`;
  const contexts:BrowserContext[]=[],signouts:Array<()=>Promise<unknown>>=[],shipmentIds:string[]=[],reviewIds=[randomUUID(),randomUUID(),randomUUID()],reportIds:string[]=[];
  let providerUserId='',providerId='',trustId='',truckId='',stage='FIXTURES';
  const noteA=`Synthetic held review A ${suffix}`,noteB=`Synthetic held review B ${suffix}`,controlNote=`Synthetic unchanged control ${suffix}`;
  async function publicProjection(a:boolean,b:boolean,count:number,average:number){
    const response=await page.request.get(`/api/mobile/public/providers/${handle}`);expect(response.status()).toBe(200);
    const data=await response.json();expect(data.reviewCount).toBe(count);expect(data.averageRating).toBe(average);
    expect(data.reviews.some((review:{id:string})=>review.id===reviewIds[0])).toBe(a);
    expect(data.reviews.some((review:{id:string})=>review.id===reviewIds[1])).toBe(b);
    expect(data.reviews.some((review:{id:string})=>review.id===reviewIds[2])).toBe(true);
    const document=await page.goto(`/providers/${handle}`,{waitUntil:'domcontentloaded'});expect(document?.status()).toBe(200);
    await expect(page.locator('.provider-review-list').getByText(noteA,{exact:true})).toHaveCount(a?1:0);
    await expect(page.locator('.provider-review-list').getByText(noteB,{exact:true})).toHaveCount(b?1:0);
    await expect(page.locator('.provider-review-list').getByText(controlNote,{exact:true})).toHaveCount(1);
    await expect(page.locator('.provider-hero-facts')).toContainText(`${average} · ${count} verified shipment reviews`);
  }
  async function contentForm(control:Page,id:string){
    await control.goto('/admin/reviews/content?page=999999');
    const form=control.locator(`form[action="/api/admin/content/${id}"]`),record=checked(await service.from('content_reports').select('detail').eq('id',id).single()),row=control.locator('section').filter({has:control.getByText(record.detail,{exact:true})});
    // Keep the test bounded without assuming the exact report is on page one.
    for(let n=0;n<10&&!await row.count();n++){
      const next=control.getByRole('link',{name:'Next',exact:true});if(!await next.count())break;await next.click();
    }
    await expect(row).toHaveCount(1);await row.getByRole('button',{name:'Review report',exact:true}).click();await expect(form).toHaveCount(1);return form;
  }
  async function contentDecision(control:Page,id:string,decision:'HIDE'|'RESTORE'){
    const form=await contentForm(control,id);await form.getByLabel('Decision note',{exact:true}).fill('Synthetic content decision for the moderation workflow.');
    const saved=control.waitForResponse(response=>new URL(response.url()).pathname===`/api/admin/content/${id}`&&response.request().method()==='POST');
    await form.getByRole('button',{name:decision==='HIDE'?'Hide reported content':'Restore reviewed content',exact:true}).click();
    expect((await saved).status()).toBe(303);await expect(control.locator('.alert.success')).toBeVisible();
    expect(checked(await service.from('content_reports').select('status').eq('id',id).single()).status).toBe(decision==='HIDE'?'HIDDEN':'RESTORED');
  }
  async function ratingDecision(control:Page,id:string,resolution:'UPHELD'|'REMOVED'){
    const {form}=await openReview(control,'ratings',id,'');await form.getByLabel('Decision note',{exact:true}).fill('Synthetic rating decision retains its independent restrictions.');
    await form.getByRole('button',{name:resolution==='UPHELD'?'Uphold review':'Remove review',exact:true}).click();
    await expect(control.locator('.alert.success')).toBeVisible();
    expect(checked(await service.from('provider_reviews').select('dispute_status').eq('id',id).single()).dispute_status).toBe(resolution);
  }
  async function report(reviewId:string){
    const id=checked(await service.rpc('submit_content_report',{provider_handle:handle,visitor_digest:(randomUUID()+randomUUID()).replaceAll('-',''),report_category:'REVIEW',report_detail:'Synthetic independent content restriction.',target_review_id:reviewId}));
    reportIds.push(id);return id;
  }
  try{
    providerUserId=checked(await service.auth.admin.createUser({email:`moderation-provider-${suffix}@example.test`,email_confirm:true})).user.id;
    checked(await service.from('profiles').update({role:'DRIVER',active:true,full_name:'Synthetic moderation provider'}).eq('id',providerUserId));
    providerId=checked(await service.from('provider_profiles').insert({user_id:providerUserId,business_name:'Synthetic moderation provider',handle,public_visibility:'PUBLIC'}).select('id').single()).id;
    checked(await service.from('company_pages').insert({provider_profile_id:providerId,published:true}));
    truckId=checked(await service.from('vehicles').insert({provider_profile_id:providerId,label:'Synthetic moderation truck',make:'Synthetic',model:'Moderation',category:'LIGHT',cargo_configuration:'Pickup truck',active:true,use_basis:'OWNED'}).select('id').single()).id;
    const places=checked(await service.from('place_catalog').select('id,name,latitude,longitude').order('id').limit(2));expect(places).toHaveLength(2);
    for(let i=0;i<3;i++){
      const id=randomUUID();shipmentIds.push(id);
      checked(await service.from('provider_shipments').insert({id,code:`MU-${id.slice(0,12)}`,provider_profile_id:providerId,assigned_vehicle_id:truckId,assigned_driver_user_id:providerUserId,origin:places[0].name,origin_place_ref:places[0].id,origin_lat:places[0].latitude,origin_lng:places[0].longitude,destination:places[1].name,destination_place_ref:places[1].id,destination_lat:places[1].latitude,destination_lng:places[1].longitude,cargo_summary:'Synthetic completed moderation fixture',shipper_email:`moderation-owner-${suffix}@example.test`,receiver_email:`moderation-owner-${suffix}@example.test`,operational_status:'COMPLETED',completed_at:new Date().toISOString(),created_by:providerUserId}));
      checked(await service.from('provider_reviews').insert({id:reviewIds[i],shipment_id:id,provider_profile_id:providerId,rating:i===2?5:2,note:[noteA,noteB,controlNote][i],status:'PUBLISHED',...(i<2?{dispute_status:'PENDING',dispute_reason:'Synthetic pending rating dispute.'}:{})}));
    }
    trustId=checked(await service.auth.admin.createUser({email:`moderation-trust-${suffix}@example.test`,email_confirm:true})).user.id;
    checked(await service.from('profiles').update({role:'SUPPORT',active:true,full_name:'Synthetic Trust reviewer'}).eq('id',trustId));
    // Exact paused staff fixture; no provisioning/availability command may route
    // another local conversation while preparing a moderation test.
    checked(await service.from('support_agent_profiles').insert({user_id:trustId,active:true,available:false,can_manage_support:false,can_manage_trust:true}));
    const admin=checked(await service.from('profiles').select('id').eq('role','ADMIN').eq('active',true).limit(1).single());
    const staffViewport={baseURL:info.project.use.baseURL,viewport:page.viewportSize()!,isMobile:Boolean(info.project.use.isMobile),hasTouch:Boolean(info.project.use.hasTouch)};
    const trustContext=await browser.newContext(staffViewport);contexts.push(trustContext);
    const control=await trustContext.newPage();signouts.push(await localSupportLogin(control,trustId));
    const adminContext=await browser.newContext(staffViewport);contexts.push(adminContext);
    const owner=await adminContext.newPage();signouts.push(await localSupportLogin(owner,admin.id));
    const controlBefore=checked(await service.from('provider_reviews').select('*').eq('id',reviewIds[2]).single());
    stage='INITIAL_PUBLIC_PROJECTION';await publicProjection(true,true,3,3);
    const first=await report(reviewIds[0]),second=await report(reviewIds[0]);
    stage='TWO_CONTENT_HOLDS';await contentDecision(control,first,'HIDE');await contentDecision(control,second,'HIDE');await publicProjection(false,true,2,3.5);
    stage='UPHOLD_WITH_CONTENT_HOLDS';await ratingDecision(control,reviewIds[0],'UPHELD');await publicProjection(false,true,2,3.5);
    stage='ONE_CONTENT_RESTORE';await contentDecision(control,first,'RESTORE');await publicProjection(false,true,2,3.5);
    expect(checked(await service.from('content_reports').select('status').eq('id',second).single()).status).toBe('HIDDEN');
    stage='FINAL_CONTENT_RESTORE';await contentDecision(control,second,'RESTORE');await publicProjection(true,true,3,3);
    expect(checked(await service.from('provider_reviews').select('dispute_status').eq('id',reviewIds[0]).single()).dispute_status).toBe('UPHELD');
    const third=await report(reviewIds[1]);
    stage='REMOVE_WITH_CONTENT_HOLD';await contentDecision(control,third,'HIDE');await ratingDecision(control,reviewIds[1],'REMOVED');await publicProjection(true,false,2,3.5);
    stage='REVOKED_TRUST_STALE_FORM';const stale=await contentForm(control,third);await stale.getByLabel('Decision note',{exact:true}).fill('Synthetic stale Trust attempt must remain denied.');
    checked(await service.from('support_agent_profiles').update({can_manage_trust:false}).eq('user_id',trustId));
    const denied=control.waitForResponse(response=>new URL(response.url()).pathname===`/api/admin/content/${third}`&&response.request().method()==='POST');
    await stale.getByRole('button',{name:'Restore reviewed content',exact:true}).click();const rejected=await denied;expect(rejected.status()).toBe(303);expect(new URL(rejected.headers().location).searchParams.has('error')).toBe(true);
    expect(checked(await service.from('content_reports').select('status').eq('id',third).single()).status).toBe('HIDDEN');await publicProjection(true,false,2,3.5);
    stage='OWNER_RESTORE_PRESERVES_RATING_REMOVAL';await contentDecision(owner,third,'RESTORE');await publicProjection(true,false,2,3.5);
    expect(checked(await service.from('provider_reviews').select('status,dispute_status').eq('id',reviewIds[1]).single())).toEqual({status:'REMOVED',dispute_status:'REMOVED'});
    expect(checked(await service.from('provider_reviews').select('*').eq('id',reviewIds[2]).single())).toEqual(controlBefore);
  }catch{throw Error('REVIEW_MODERATION_CONFLICT_FAILED: '+stage);}
  finally{
    let cleanupFailures=0;
    async function clean(operation:()=>Promise<unknown>){try{await operation();}catch{cleanupFailures++;}}
    for(const signout of signouts)await clean(signout);
    for(const context of contexts)await clean(()=>context.close());
    if(providerId)await clean(async()=>checked(await service.from('content_reports').delete().eq('provider_profile_id',providerId)));
    await clean(async()=>checked(await service.from('provider_reviews').delete().in('id',reviewIds)));
    if(shipmentIds.length)await clean(async()=>checked(await service.from('provider_shipments').delete().in('id',shipmentIds)));
    if(truckId)await clean(async()=>checked(await auditDeleteVehicles(service,'id',truckId)));
    const entities=[providerUserId,providerId,trustId,truckId,...shipmentIds,...reviewIds,...reportIds].filter(Boolean);
    if(entities.length)await clean(async()=>checked(await service.from('audit_logs').delete().in('entity_id',entities)));
    for(const id of [providerUserId,trustId].filter(Boolean)){
      await clean(async()=>checked(await service.from('audit_logs').delete().eq('actor_user_id',id)));
      await clean(async()=>checked(await service.auth.admin.deleteUser(id)));
    }
    if(providerId)await clean(async()=>expect(checked(await service.from('content_reports').select('id').eq('provider_profile_id',providerId))).toHaveLength(0));
    if(providerId)await clean(async()=>expect(checked(await service.from('provider_profiles').select('id').eq('id',providerId))).toHaveLength(0));
    if(providerId)await clean(async()=>expect(checked(await service.from('company_pages').select('id').eq('provider_profile_id',providerId))).toHaveLength(0));
    if(trustId)await clean(async()=>expect(checked(await service.from('support_agent_profiles').select('user_id').eq('user_id',trustId))).toHaveLength(0));
    if(shipmentIds.length)await clean(async()=>expect(checked(await service.from('provider_shipments').select('id').in('id',shipmentIds))).toHaveLength(0));
    await clean(async()=>expect(checked(await service.from('provider_reviews').select('id').in('id',reviewIds))).toHaveLength(0));
    if(truckId)await clean(async()=>expect(checked(await service.from('vehicles').select('id').eq('id',truckId))).toHaveLength(0));
    for(const id of [providerUserId,trustId].filter(Boolean))await clean(async()=>expect(checked(await service.from('profiles').select('id').eq('id',id))).toHaveLength(0));
    if(cleanupFailures)throw Error('REVIEW_MODERATION_CONFLICT_FAILED: EXACT_CLEANUP');
  }
});
