import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {localAuditService,checked,auditLogin,auditProvider} from './audit-helpers';
import {createProviderVehicle} from '../../src/lib/fleet.js';
import {createProviderShipment} from '../../src/lib/provider-tracking.js';
import {localMailpitNumericCode} from './mailpit-helper';

// Read only this synthetic recipient's completion email; never log its code/body.
async function completionCode(email:string,requestedAt:number){
  for(let attempt=0;attempt<40;attempt++){
    const inbox=await (await fetch('http://127.0.0.1:55324/api/v1/messages')).json();
    const message=(inbox.messages||[]).find((item:any)=>item.Subject==='Your Loadgistic delivery record'
      &&new Date(item.Created).getTime()>=requestedAt-2000
      &&item.To?.some((to:any)=>to.Address===email));
    if(message){
      const detail=await (await fetch(`http://127.0.0.1:55324/api/v1/message/${encodeURIComponent(message.ID)}`)).json();
      const code=String(detail.Text||'').match(/LG-RV-[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}/)?.[0];
      const trackingCode=String(detail.Text||'').match(/LG-[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}/)?.[0];
      if(code&&trackingCode)return {reviewCode:code,trackingCode};
    }
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error('Synthetic customer did not receive a completion email with a review code.');
}

test('completed delivery emails its customer and accepts exactly one visible customer review',async({page,browser}:{page:any;browser:any},info:any)=>{
  test.setTimeout(150000);
  const service=localAuditService();let actor:any;let vehicleId='';let shipmentId='';let guest:any;
  try{
    actor=await auditProvider(service,'demo-review');
    const vehicle=await createProviderVehicle(actor,{make:'Toyota',model:'Review audit',plate:`TEST-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false});
    vehicleId=vehicle.id;
    const origin=checked(await service.from('place_catalog').select('id').eq('normalized_name','addis ababa').limit(1).single());
    const destination=checked(await service.from('place_catalog').select('id').eq('normalized_name','adama').limit(1).single());
    const email=`completion-${randomUUID()}@example.test`;
    const shipment=await createProviderShipment(actor,{vehicleId,originPlaceRef:origin.id,destinationPlaceRef:destination.id,cargoSummary:'Synthetic demo completion',customerEmail:email,trackingMode:'STATUS_ONLY'});
    shipmentId=shipment.id;
    await auditLogin(page,actor.email);await page.goto(`/app/provider-shipments/${shipmentId}`);
    const completedAfter=Date.now();
    for(const [status,label] of [['TO_PICKUP','Going to pickup'],['LOADING','Loading'],['IN_TRANSIT','En route'],['UNLOADING','Unloading'],['COMPLETED','Complete']]){
      await page.locator(`input[name=nextStatus][value=${status}]`).check();
      // Native POST redirects stream the workspace shell before the result.
      // Await this submission's full destination response, not a prior flash.
      const destination=page.waitForResponse((response:any)=>{
        const url=new URL(response.url());
        return response.request().isNavigationRequest()&&url.pathname===`/app/provider-shipments/${shipmentId}`&&url.searchParams.has('success');
      });
      await page.getByRole('button',{name:`Save ${label}`,exact:true}).click();
      const saved=await destination;expect(saved.status()).toBe(200);await saved.finished();
      await expect(page.locator('.alert.success')).toContainText(status==='COMPLETED'?'Tracking complete.':'Tracking status updated.');
      expect(checked(await service.from('provider_shipments').select('operational_status').eq('id',shipmentId).single()).operational_status).toBe(status);
    }
    const {reviewCode,trackingCode}=await completionCode(email,completedAfter);
    guest=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize()!,isMobile:Boolean(info.project.use.isMobile),hasTouch:Boolean(info.project.use.hasTouch),extraHTTPHeaders:{'x-forwarded-for':'127.0.0.248'}});
    const customer=await guest.newPage();await customer.goto('/track');
    await customer.getByLabel('Approved email').fill(email);await customer.getByLabel('Tracking code',{exact:true}).fill(trackingCode);
    const requested=Date.now();await customer.getByRole('button',{name:'Email me a code'}).click();
    await customer.getByLabel('One-time code').fill(await localMailpitNumericCode(email,requested,'Your shipment Tracking code'));
    await customer.getByRole('button',{name:'Open tracking'}).click();
    await expect(customer.getByRole('heading',{name:'Verify your review'})).toBeVisible();
    await customer.getByLabel('Review code',{exact:true}).fill(reviewCode);
    await customer.getByRole('button',{name:'Continue to review'}).click();
    await expect(customer.getByRole('heading',{name:'Review the provider'})).toBeVisible();
    await customer.getByLabel('Rating',{exact:true}).selectOption('4');
    await customer.getByLabel('Comment').fill('Synthetic customer review after delivery.');
    await customer.getByRole('button',{name:'Publish review'}).click();
    await expect(customer.getByText('Your review is published.',{exact:true})).toBeVisible();
    await expect(customer.getByRole('heading',{name:'Your review'})).toBeVisible();
    await expect(customer.getByRole('button',{name:'Publish review'})).toHaveCount(0);
    const reviews=checked(await service.from('provider_reviews').select('rating,status,note').eq('shipment_id',shipmentId));
    expect(reviews).toEqual([{rating:4,status:'PUBLISHED',note:'Synthetic customer review after delivery.'}]);
    await customer.reload();await expect(customer.getByRole('heading',{name:'Your review'})).toBeVisible();
    await customer.screenshot({path:info.outputPath('customer-published-review.png'),fullPage:true});
  }finally{
    if(guest)await guest.close();
    if(shipmentId){
      checked(await service.from('provider_reviews').delete().eq('shipment_id',shipmentId));
      checked(await service.from('access_email_deliveries').delete().eq('entity_id',shipmentId));
      checked(await service.from('audit_logs').delete().eq('entity_id',shipmentId));
      checked(await service.from('provider_shipments').delete().eq('id',shipmentId));
    }
    if(vehicleId){checked(await service.from('audit_logs').delete().eq('entity_id',vehicleId));checked(await service.from('vehicles').delete().eq('id',vehicleId));}
    if(actor){checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));}
  }
});
