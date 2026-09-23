import {test,expect} from '@playwright/test';
import {localAuditService,checked,auditProvider} from './audit-helpers';
import {localMailpitNumericCode} from './mailpit-helper';
import {createProviderVehicle} from '../../src/lib/fleet.js';
import {createProviderShipment} from '../../src/lib/provider-tracking.js';

async function invitationCode(email:string,since:number){
  for(let attempt=0;attempt<60;attempt++){
    const inbox=await (await fetch('http://127.0.0.1:55324/api/v1/messages')).json();
    const message=(inbox.messages||[]).find((item:any)=>item.Subject==='Your Loadgistic tracking access'&&Date.parse(item.Created)>=since-2000&&item.To?.some((to:any)=>to.Address===email));
    if(message){
      const detail=await (await fetch(`http://127.0.0.1:55324/api/v1/message/${encodeURIComponent(message.ID)}`)).json();
      const code=String(detail.Text||'').match(/LG-[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}/)?.[0];
      if(code)return code;
    }
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw new Error('The newly added synthetic recipient did not receive its Tracking invitation.');
}

test('added Tracking party saves inline, receives invitation and OTP, and loses guest access when revoked',async({page,browser}:{page:any;browser:any},info:any)=>{
  test.setTimeout(150000);
  const service=localAuditService();let actor:any;let vehicleId='';let shipmentId='';let guest:any;
  try{
    actor=await auditProvider(service,'party-audit');
    vehicleId=(await createProviderVehicle(actor,{make:'Toyota',model:'Party test',plate:`TEST-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false})).id;
    const origin=checked(await service.from('place_catalog').select('id').eq('normalized_name','addis ababa').limit(1).single());
    const destination=checked(await service.from('place_catalog').select('id').eq('normalized_name','adama').limit(1).single());
    shipmentId=(await createProviderShipment(actor,{vehicleId,originPlaceRef:origin.id,destinationPlaceRef:destination.id,cargoSummary:'Tracking party verification',customerEmail:`owner-${actor.suffix}@example.test`,trackingMode:'STATUS_ONLY'})).id;
    await page.goto('/login');const login=page.getByTestId('email-code-request-form');await login.getByLabel('Email',{exact:true}).fill(actor.email);const loginAt=Date.now();
    await login.getByRole('button',{name:'Email me a code'}).click();await expect(page.getByTestId('email-code-form')).toBeVisible();
    await page.getByLabel('Six-digit code',{exact:true}).fill(await localMailpitNumericCode(actor.email,loginAt,'Your Loadgistic sign-in code'));await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.waitForURL(/\/app\/home/);await expect(page.locator('.app-main')).toBeVisible();await page.goto(`/app/provider-shipments/${shipmentId}`);
    const form=page.getByRole('form',{name:'Add tracking party'});const email=`party-${actor.suffix}@example.test`;
    await form.getByLabel('Add tracking party').fill(email);const addedAt=Date.now();
    const saved=page.waitForResponse((r:any)=>r.url().endsWith(`/api/provider-shipments/${shipmentId}/recipients`)&&r.request().method()==='POST',{timeout:20000});
    await form.getByRole('button',{name:'Add and email access'}).click();const response=await saved;expect(response.status()).toBe(200);expect(await response.json()).toEqual({ok:true});
    await expect(form.getByRole('status')).toHaveText('Tracking party added. Access email is queued.');await expect(form.getByRole('button')).toBeEnabled();await expect(form.getByLabel('Add tracking party')).toHaveValue('');
    const recipient=checked(await service.from('provider_tracking_recipients').select('id,revoked_at').eq('shipment_id',shipmentId).eq('recipient_email',email).single());expect(recipient.revoked_at).toBeNull();
    await expect(page.locator('.tracking-party-row').filter({hasText:email})).toBeVisible();
    await form.screenshot({path:info.outputPath('tracking-party-saved.png')});
    // A duplicate is a recoverable inline error, not a second recipient or stuck spinner.
    await form.getByLabel('Add tracking party').fill(email);await form.getByRole('button',{name:'Add and email access'}).click();
    await expect(form.getByRole('alert')).toContainText('already has access');await expect(form.getByRole('button')).toBeEnabled();await expect(form.getByLabel('Add tracking party')).toHaveValue(email);
    const code=await invitationCode(email,addedAt);
    guest=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize()!,isMobile:Boolean(info.project.use.isMobile),hasTouch:Boolean(info.project.use.hasTouch),extraHTTPHeaders:{'x-forwarded-for':'127.0.0.246'}});
    const unauthenticated=await guest.request.post(`/api/provider-shipments/${shipmentId}/recipients`,{headers:{origin:info.project.use.baseURL,accept:'application/json'},form:{action:'ADD',email:`denied-${actor.suffix}@example.test`}});expect(unauthenticated.status()).toBe(401);
    const customer=await guest.newPage();await customer.goto('/track');await customer.getByLabel('Approved email').fill(email);await customer.getByLabel('Tracking code',{exact:true}).fill(code);
    const requested=Date.now();await customer.getByRole('button',{name:'Email me a code'}).click();await customer.getByLabel('One-time code').fill(await localMailpitNumericCode(email,requested,'Your shipment Tracking code'));
    await customer.getByRole('button',{name:'Open tracking'}).click();await expect(customer.getByText('Private shipment tracking')).toBeVisible();await expect(customer.getByRole('heading',{name:/Track LGX-/})).toBeVisible();
    expect(new URL(customer.url()).pathname).toBe(`/track/${shipmentId}`);
    // No account was provisioned for this account-free Tracking recipient.
    expect(checked(await service.from('profiles').select('id').eq('email',email))).toHaveLength(0);
    const stranger=await guest.request.post('/api/tracking/otp',{headers:{origin:info.project.use.baseURL},form:{email:`unapproved-${actor.suffix}@example.test`,trackingCode:code}});expect(stranger.status()).toBe(200);
    expect(checked(await service.from('access_email_deliveries').select('id').eq('recipient_email',`unapproved-${actor.suffix}@example.test`))).toHaveLength(0);
    await page.locator('.tracking-party-row').filter({hasText:email}).getByRole('button',{name:'Revoke'}).click();await expect(page.getByText('Tracking access revoked.',{exact:true})).toBeVisible();
    await customer.reload();await expect(customer.getByText('Private shipment tracking')).toHaveCount(0);await expect(customer.getByRole('heading',{name:/Track LGX-/})).toHaveCount(0);
    expect(checked(await service.from('provider_tracking_recipients').select('revoked_at').eq('id',recipient.id).single()).revoked_at).not.toBeNull();
  }finally{
    if(guest)await guest.close();
    if(shipmentId){checked(await service.from('access_email_deliveries').delete().eq('entity_id',shipmentId));checked(await service.from('audit_logs').delete().eq('entity_id',shipmentId));checked(await service.from('provider_shipments').delete().eq('id',shipmentId));}
    if(vehicleId){checked(await service.from('audit_logs').delete().eq('entity_id',vehicleId));checked(await service.from('vehicles').delete().eq('id',vehicleId));}
    if(actor){checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));}
  }
});
