import {createProviderShipment} from '../../src/lib/provider-tracking.js';
import {registeredTrackingOwner,cleanupTrackingOwnerFixtures} from './tracking-session-fixtures';
import {auditOpenTrackingProgress} from './audit-helpers';
import {auditDeleteVehicles} from './audit-helpers';
import {test,expect} from './browser-test';
import {randomUUID} from 'node:crypto';
import {localAuditService,checked,auditLogin,auditProvider,auditTrackingOwnerLogin} from './audit-helpers';
import {createProviderVehicle,updateFleetDriverAccess} from '../../src/lib/fleet.js';

import {cleanupFixtureProofs} from './tracking-proof-cleanup.mjs';

// A normal account notification never grants anonymous Tracking access.
async function completionNotification(email:string,requestedAt:number,origin:string){
  for(let attempt=0;attempt<40;attempt++){
    const inbox=await (await fetch('http://127.0.0.1:55324/api/v1/messages')).json();
    const message=(inbox.messages||[]).find((item:any)=>item.Subject==='Your Loadgistic delivery record'
      &&new Date(item.Created).getTime()>=requestedAt-2000
      &&item.To?.some((to:any)=>to.Address===email));
    if(message){
      const detail=await (await fetch(`http://127.0.0.1:55324/api/v1/message/${encodeURIComponent(message.ID)}`)).json();
      const text=String(detail.Text||''),target=new URL('/login?from=tracking',origin).toString();
      expect(text).toContain('leave a review');expect(text).toContain('Sign in to your Loadgistic account');
      expect(text.split(/\r?\n/).map((line:string)=>line.trim())).toContain(target);
      expect(String(detail.HTML||'')).toContain(`href="${target}"`);
      expect(String(detail.HTML||'')).toContain('>Open your shipments</a>');
      expect(text).not.toMatch(/LG-RV-|Tracking code|verify this email|six-digit|no new code/i);return target;
    }
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error('Synthetic registered customer did not receive its completion notification.');
}

test.use({actionTimeout:15_000,trace:'off',screenshot:'off'});

test('completed delivery notifies its registered owner and accepts exactly one account review',async({page,browser}:{page:any;browser:any},info:any)=>{
  test.setTimeout(150000);
  const service=localAuditService();let actor:any;let vehicleId='';let shipmentId='';let guest:any;
  try{
    actor=await auditProvider(service,'demo-review');
    const vehicle=await createProviderVehicle(actor,{useBasis:'OWNED',make:'Toyota',model:'Review audit',plate:`TEST-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false});
    vehicleId=vehicle.id;
    expect(checked(await service.rpc('set_provider_driving_mode',{actor_user_id:actor.id,requested_drives_truck:true}))).toBe(true);
    await updateFleetDriverAccess(actor,actor.id,{vehicleId,canManageCapacity:true,canManageTracking:true});
    const origin=checked(await service.from('place_catalog').select('id').eq('normalized_name','addis ababa').limit(1).single());
    const destination=checked(await service.from('place_catalog').select('id').eq('normalized_name','adama').limit(1).single());
    const email=`completion-${randomUUID()}@example.test`;
    await registeredTrackingOwner(service,email);
    const shipment=await createProviderShipment(actor,{expectedDeliveryDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),vehicleId,originPlaceRef:origin.id,destinationPlaceRef:destination.id,passingPlaceRef:checked(await service.from('place_catalog').select('id').eq('normalized_name','dire dawa').limit(1).single()).id,cargoSummary:'Synthetic demo completion',customerEmail:'',trackingMode:'STATUS_ONLY'});
    shipmentId=shipment.id;
    await auditLogin(page,actor.email);await page.goto(`/app/provider-shipments/${shipmentId}`);
    await page.getByLabel('Shipper or broker account email',{exact:true}).fill(email);
    const attachment=page.waitForResponse((r:any)=>new URL(r.url()).pathname==='/api/tracking/sessions/partner'&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Add partner',exact:true}).click();
    expect((await attachment).status()).toBe(200);
    await expect(page.getByText(email,{exact:true}).first()).toBeVisible({timeout:15000});
    await page.reload();
    await expect(page.getByRole('button',{name:'Add partner',exact:true})).toHaveCount(0);
    const completedAfter=Date.now();
    for(const [status,label] of [['TO_PICKUP','Going to pickup'],['LOADING','Loading'],['IN_TRANSIT','En route'],['UNLOADING','Unloading']]){
      await auditOpenTrackingProgress(page);
      await page.locator(`input[name=nextStatus][value=${status}]`).check();
      if(['LOADING','UNLOADING'].includes(status))await page.locator('input[name=proof]').setInputFiles('public/icon-192.png');
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
    await expect(page.locator('input[name=nextStatus][value=COMPLETED]')).toHaveCount(0);
    guest=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize()!,isMobile:Boolean(info.project.use.isMobile),hasTouch:Boolean(info.project.use.hasTouch),extraHTTPHeaders:{'x-forwarded-for':'127.0.0.248'}});
    const customer=await guest.newPage();const ownerSession=await auditTrackingOwnerLogin(customer,email,shipmentId);
    const approval=customer.waitForResponse((response:any)=>{
      const url=new URL(response.url());
      return response.request().method()==='POST'&&url.pathname===`/api/tracking/sessions/${ownerSession.id}/approve`;
    });
    await customer.getByRole('button',{name:'Approve unloading',exact:true}).click();
    const approved=await approval;expect(approved.status()).toBe(200);await approved.finished();
    const handover=checked(await service.from('provider_shipments').select('operational_status,handover_approved_at').eq('id',shipmentId).single());
    expect(handover.operational_status).toBe('COMPLETED');expect(handover.handover_approved_at).toBeTruthy();
    const notificationTarget=await completionNotification(email,completedAfter,new URL(customer.url()).origin);
    expect(notificationTarget).toBe(new URL('/login?from=tracking',customer.url()).toString());
    const ownerListRead=customer.waitForResponse((response:any)=>{
      const url=new URL(response.url());
      return url.pathname==='/api/tracking/sessions'&&url.searchParams.get('page')==='1'&&response.request().method()==='GET';
    },{timeout:30000});
    await customer.goto(notificationTarget,{waitUntil:'domcontentloaded'});
    const ownerList=await ownerListRead;
    expect(ownerList.status()).toBe(200);
    const ownerRows=(await ownerList.json()).data.sessions.filter((row:{id:string})=>row.id===ownerSession.id);
    expect(ownerRows).toHaveLength(1);
    await expect(customer).toHaveURL((url:URL)=>url.pathname==='/app/tracking');
    const savedLoad=customer.getByRole('button').filter({hasText:ownerSession.reference});
    await expect(savedLoad).toHaveCount(1);await savedLoad.click();
    await expect(customer.getByRole('heading',{name:ownerSession.reference,exact:true})).toBeVisible();
    await expect(customer.getByLabel('Review code',{exact:true})).toHaveCount(0);
    await expect(customer.getByLabel('Rating',{exact:true})).toBeVisible({timeout:15000});
    await customer.getByLabel('Rating',{exact:true}).selectOption('4');
    await customer.getByLabel('Comment').fill('Synthetic customer review after delivery.');
    await customer.getByRole('checkbox',{name:'I agree to the Terms and content rules.'}).check();
    const published=customer.waitForResponse((response:any)=>new URL(response.url()).pathname===`/api/tracking/sessions/${ownerSession.id}/review`&&response.request().method()==='POST');
    await customer.getByRole('button',{name:'Publish review'}).click();expect((await published).status()).toBe(200);
    await expect(customer.getByRole('heading',{name:'Your review'})).toBeVisible();
    await expect(customer.getByRole('button',{name:'Publish review'})).toHaveCount(0);
    const reviews=checked(await service.from('provider_reviews').select('rating,status,note').eq('shipment_id',shipmentId));
    expect(reviews).toEqual([{rating:4,status:'PUBLISHED',note:'Synthetic customer review after delivery.'}]);
    const duplicate=await customer.request.post(`/api/tracking/sessions/${ownerSession.id}/review`,{data:{rating:5,note:'Duplicate must be refused',termsAccepted:true}});
    expect(duplicate.status()).toBe(403);expect(checked(await service.from('provider_reviews').select('id').eq('shipment_id',shipmentId))).toHaveLength(1);
    await customer.reload();
    await savedLoad.click();
    await expect(customer.getByRole('heading',{name:'Your review'})).toBeVisible();
    await expect(customer.getByText('Synthetic customer review after delivery.',{exact:true})).toBeVisible();
    await customer.screenshot({path:info.outputPath('customer-published-review.png'),fullPage:true});
  }finally{
    if(guest)await guest.close();
    if(shipmentId){
      await cleanupFixtureProofs(service,{actor,vehicleId,shipmentId});
      checked(await service.from('provider_reviews').delete().eq('shipment_id',shipmentId));
      checked(await service.from('access_email_deliveries').delete().eq('entity_id',shipmentId));
      checked(await service.from('audit_logs').delete().eq('entity_id',shipmentId));
      checked(await service.from('provider_shipments').delete().eq('id',shipmentId));
    }
    if(vehicleId){checked(await service.from('audit_logs').delete().eq('entity_id',vehicleId));checked(await auditDeleteVehicles(service,'id',vehicleId));}
    if(actor){checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));}
  }
});

// Only newly created local SHIPPER fixtures are removed after shipment/proof cleanup.
test.afterEach(async()=>{await cleanupTrackingOwnerFixtures();});
