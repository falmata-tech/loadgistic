import {test,expect} from '@playwright/test';
import {localAuditService,checked,auditProvider} from './audit-helpers';
import {localMailpitNumericCode} from './mailpit-helper';
import {createProviderVehicle} from '../../src/lib/fleet.js';
import {createProviderShipment} from '../../src/lib/provider-tracking.js';

test('Tracking shows saved progress, explicit pending choice and problem recovery on desktop and phone',async({page}:{page:any},info:any)=>{
  test.setTimeout(150000);
  const service=localAuditService();let actor:any;let vehicleId='';let shipmentId='';
  try{
    actor=await auditProvider(service,'progress-audit');
    vehicleId=(await createProviderVehicle(actor,{make:'Toyota',model:'Progress test',plate:`TEST-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false})).id;
    const origin=checked(await service.from('place_catalog').select('id').eq('normalized_name','addis ababa').limit(1).single());
    const destination=checked(await service.from('place_catalog').select('id').eq('normalized_name','adama').limit(1).single());
    shipmentId=(await createProviderShipment(actor,{vehicleId,originPlaceRef:origin.id,destinationPlaceRef:destination.id,cargoSummary:'Tracking progress review',customerEmail:`progress-${actor.suffix}@example.test`,trackingMode:'STATUS_ONLY'})).id;
    // Normal email flow works with manual fixture-password login disabled.
    await page.goto('/login');const request=page.getByTestId('email-code-request-form');
    await request.getByLabel('Email',{exact:true}).fill(actor.email);const since=Date.now();
    await request.getByRole('button',{name:'Email me a code'}).click();
    await expect(page.getByTestId('email-code-form')).toBeVisible();
    await page.getByLabel('Six-digit code',{exact:true}).fill(await localMailpitNumericCode(actor.email,since,'Your Loadgistic sign-in code'));
    await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForURL(/\/app\/home/);
    await expect(page.locator('.app-main')).toBeVisible();await page.goto(`/app/provider-shipments/${shipmentId}`);
    const panel=page.locator('.tracking-control-panel');const steps=panel.locator('.tracking-journey li');
    await expect(steps).toHaveCount(5);await expect(steps.nth(0)).toContainText('Next');await expect(steps.nth(1)).toContainText('Or start here');
    await expect(steps.nth(2)).toContainText('Remaining');await expect(steps.nth(2).locator('input')).toHaveCount(0);
    await expect(page.getByRole('radio',{name:/Going to pickup/})).toBeEnabled();
    await page.getByRole('radio',{name:/Going to pickup/}).focus();await expect(page.getByRole('radio',{name:/Going to pickup/})).toBeFocused();
    await panel.screenshot({path:info.outputPath('tracking-ready.png')});
    // Selection must not mutate the saved state.
    await page.getByRole('radio',{name:/Loading/}).check();
    expect(checked(await service.from('provider_shipments').select('operational_status').eq('id',shipmentId).single()).operational_status).toBe('CREATED');
    async function save(label:string,status:string){
      const response=page.waitForResponse((r:any)=>r.request().isNavigationRequest()&&new URL(r.url()).pathname===`/app/provider-shipments/${shipmentId}`&&new URL(r.url()).searchParams.has('success'));
      await page.getByRole('button',{name:`Save ${label}`,exact:true}).click();expect((await response).status()).toBe(200);await (await response).finished();
      await expect(page.locator('.alert.success')).toBeVisible();
      expect(checked(await service.from('provider_shipments').select('operational_status').eq('id',shipmentId).single()).operational_status).toBe(status);
    }
    await save('Loading','LOADING');await expect(steps.nth(0)).toContainText('Not recorded');await expect(steps.nth(1)).toHaveAttribute('aria-current','step');await expect(steps.nth(2)).toContainText('Next');
    await panel.screenshot({path:info.outputPath('tracking-loading.png')});
    await page.getByRole('radio',{name:/Report a problem/}).check();await page.getByLabel('What happened?').fill('Synthetic delay for progress verification.');await save('Problem','ISSUE');
    await expect(panel).toContainText('Choose where the shipment resumes.');await expect(steps.nth(1)).toContainText('previously recorded');await panel.screenshot({path:info.outputPath('tracking-problem.png')});
    for(const [status,label] of [['LOADING','Loading'],['IN_TRANSIT','En route'],['UNLOADING','Unloading'],['COMPLETED','Complete']]){
      await page.locator(`input[name=nextStatus][value=${status}]`).check();await save(label,status);
    }
    await expect(panel.getByRole('heading',{name:'Tracking complete'})).toBeVisible();await expect(panel.locator('input')).toHaveCount(0);await expect(steps.nth(0)).toContainText('Not recorded');await expect(steps.nth(1)).toContainText('Completed');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await panel.screenshot({path:info.outputPath('tracking-complete.png')});
  }finally{
    if(shipmentId){checked(await service.from('access_email_deliveries').delete().eq('entity_id',shipmentId));checked(await service.from('audit_logs').delete().eq('entity_id',shipmentId));checked(await service.from('provider_shipments').delete().eq('id',shipmentId));}
    if(vehicleId){checked(await service.from('audit_logs').delete().eq('entity_id',vehicleId));checked(await service.from('vehicles').delete().eq('id',vehicleId));}
    if(actor){checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));}
  }
});
