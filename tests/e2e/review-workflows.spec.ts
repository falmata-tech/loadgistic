import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {localAuditService,auditProvider,auditLogin,checked} from './audit-helpers';
import {createProviderShipment} from '../../src/lib/provider-tracking.js';

test.use({extraHTTPHeaders:{'x-forwarded-for':'127.0.0.245'}});
async function adminBrowser(browser:any,page:any,info:any){
  const context=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize(),isMobile:Boolean(info.project.use.isMobile),extraHTTPHeaders:{'x-forwarded-for':'127.0.0.246'}});
  const admin=await context.newPage();await auditLogin(admin,'admin@loadgistic.local');return {context,page:admin};
}
async function cleanProvider(service:any,actor:any,extraIds:string[]=[]){
  const requests=checked(await service.from('verification_requests').select('id,storage_path').eq('submitted_by',actor.id));
  for(const row of requests){
    const match=/^supabase:\/\/verification\/(.+)$/.exec(row.storage_path);
    if(match)checked(await service.storage.from('verification').remove([match[1]]));
  }
  const ids=[actor.id,actor.provider_profile_id,...requests.map((r:any)=>r.id),...extraIds];
  checked(await service.from('audit_logs').delete().in('entity_id',ids));
  checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));
  checked(await service.from('verification_requests').delete().eq('submitted_by',actor.id));
  checked(await service.from('provider_shipments').delete().eq('provider_profile_id',actor.provider_profile_id));
  checked(await service.from('vehicles').delete().eq('provider_profile_id',actor.provider_profile_id));
  checked(await service.auth.admin.deleteUser(actor.id));
}
async function openReview(page:any,tab:string,id:string,filter:string,status='PENDING'){
  await page.goto(`/admin/reviews?tab=${tab}&status=${status}${filter?`&q=${encodeURIComponent(filter)}`:''}&page=999999`);
  const route=tab==='documents'?'verifications':tab==='payments'?'payment-proofs':'ratings';
  const form=page.locator(`form[action="/api/admin/${route}/${id}"]`);
  const row=page.locator('details.admin-review-row').filter({has:form});
  await row.locator('summary').click();await expect(form).toBeVisible();return {form,row};
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
  test.setTimeout(180000);const service=localAuditService();const actor=await auditProvider(service,'review-doc');
  const vehicles:string[]=[];let admin:any;let guest:any;
  const marker=`review-doc-${actor.suffix}`;const bytes=readFileSync('public/icon-192.png');
  try{
    for(const model of ['Approved first','Needs approval'])vehicles.push(checked(await service.rpc('create_provider_vehicle',{actor_user_id:actor.id,command:{make:'Audit',model,plate:`TEST-${randomUUID().slice(0,8)}`,cargo_configuration:'Mini Box Truck'}})).id);
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
      await page.getByLabel('Permission expires',{exact:true}).fill('2099-01-01');
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
    await expect(admin.page.locator('.admin-review-row form')).toHaveCount(0);await admin.page.screenshot({path:info.outputPath('reviewed-documents.png'),fullPage:true});
  }finally{await admin?.context.close().catch(()=>{});await guest?.close().catch(()=>{});await cleanProvider(service,actor,vehicles);}
});

test('payment review updates only its synthetic plan and keeps the filtered queue',async({page,browser}:{page:any;browser:any},info:any)=>{
  test.setTimeout(120000);const service=localAuditService();const actor=await auditProvider(service,'review-payment');const proofId=randomUUID();let admin:any;
  const marker=`review-payment-${actor.suffix}`;
  try{
    const subscription=checked(await service.from('subscriptions').select('id').eq('provider_profile_id',actor.provider_profile_id).single());
    checked(await service.from('payment_proofs').insert({id:proofId,subscription_id:subscription.id,amount_minor:125050,reference:marker,status:'PENDING'}));
    await auditLogin(page,actor.email);await deniedReview(page,`/api/admin/payment-proofs/${proofId}`,{status:'APPROVED'});
    expect(checked(await service.from('payment_proofs').select('status').eq('id',proofId).single()).status).toBe('PENDING');
    admin=await adminBrowser(browser,page,info);
    for(const [before,button,after] of [['PENDING','More info','MORE_INFO'],['MORE_INFO','Paid · 30 days','APPROVED']]){
      const {form,row}=await openReview(admin.page,'payments',proofId,marker,before);await expect(row.getByText('No file attached.',{exact:true})).toBeVisible();await expect(row.locator('summary')).toContainText('ETB 1,250.50');
      await form.getByRole('button',{name:button,exact:true}).click();expectContext(admin.page,'payments',marker,before);await expect(admin.page.locator('.alert.success')).toBeVisible();
      expect(checked(await service.from('payment_proofs').select('status').eq('id',proofId).single()).status).toBe(after);
    }
    const plan=checked(await service.from('subscriptions').select('status,ends_at').eq('id',subscription.id).single());expect(plan.status).toBe('ACTIVE');expect(new Date(plan.ends_at).getTime()-Date.now()).toBeGreaterThan(29*86400000);
    const denied=await deniedReview(admin.page,`/api/admin/payment-proofs/${proofId}`,{status:'REJECTED',returnTo:'https://example.invalid/steal'});
    expect(new URL(denied.headers().location).pathname).toBe('/admin/reviews');expect(new URL(denied.headers().location).hostname).toBe('127.0.0.1');
    expect(checked(await service.from('subscriptions').select('ends_at').eq('id',subscription.id).single()).ends_at).toBe(plan.ends_at);
    await admin.page.goto(`/admin/reviews?tab=payments&status=APPROVED&q=${marker}&page=1.5`);await expect(admin.page.locator('.admin-review-row')).toHaveCount(1);await expect(admin.page.locator('.admin-review-row form')).toHaveCount(0);
    await admin.page.screenshot({path:info.outputPath('reviewed-payment.png'),fullPage:true});
  }finally{await admin?.context.close().catch(()=>{});await cleanProvider(service,actor,[proofId]);}
});

test('rating decisions preserve publication rules, require authority and retain their queue',async({page,browser}:{page:any;browser:any},info:any)=>{
  test.setTimeout(120000);const service=localAuditService();const actor=await auditProvider(service,'review-rating');const ids:string[]=[];let admin:any;
  try{
    const vehicle=checked(await service.rpc('create_provider_vehicle',{actor_user_id:actor.id,command:{make:'Audit',model:'Rating review',plate:`TEST-${actor.suffix}`,cargo_configuration:'Mini Box Truck'}}));ids.push(vehicle.id);
    const origin=checked(await service.from('place_catalog').select('id').eq('normalized_name','addis ababa').limit(1).single());const destination=checked(await service.from('place_catalog').select('id').eq('normalized_name','adama').limit(1).single());
    await auditLogin(page,actor.email);admin=await adminBrowser(browser,page,info);
    for(const resolution of ['UPHELD','REMOVED']){
      const shipment=await createProviderShipment(actor,{vehicleId:vehicle.id,originPlaceRef:origin.id,destinationPlaceRef:destination.id,cargoSummary:`Synthetic review ${actor.suffix}`,customerEmail:`rating-${randomUUID()}@example.test`,trackingMode:'STATUS_ONLY'});ids.push(shipment.id);
      checked(await service.from('provider_shipments').update({operational_status:'COMPLETED'}).eq('id',shipment.id));
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
  }finally{await admin?.context.close().catch(()=>{});await cleanProvider(service,actor,ids);}
});
