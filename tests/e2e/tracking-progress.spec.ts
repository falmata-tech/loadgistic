import {auditOpenTrackingProgress} from './audit-helpers';
import {auditDeleteVehicles} from './audit-helpers';
import {test,expect} from './browser-test';
import {readFileSync} from 'node:fs';
import {translateMessage} from '../../src/lib/i18n/core.js';
import {localAuditService,checked,auditProvider,auditTrackingOwnerLogin} from './audit-helpers';
import {localMailpitNumericCode} from './mailpit-helper';
import {createProviderVehicle,updateFleetDriverAccess} from '../../src/lib/fleet.js';
import {createProviderShipment} from '../../src/lib/provider-tracking.js';
import {cleanupFixtureProofs} from './tracking-proof-cleanup.mjs';

test('Tracking shows saved progress, explicit pending choice and problem recovery on desktop and phone',async({page,browser}:{page:any;browser:any},info:any)=>{
  test.setTimeout(150000);
  const service=localAuditService();let actor:any;let vehicleId='';let shipmentId='';let guest:any;
  try{
    actor=await auditProvider(service,'progress-audit');
    vehicleId=(await createProviderVehicle(actor,{useBasis:'OWNED',make:'Toyota',model:'Progress test',plate:`TEST-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false})).id;
    expect(checked(await service.rpc('set_provider_driving_mode',{actor_user_id:actor.id,requested_drives_truck:true}))).toBe(true);
    await updateFleetDriverAccess(actor,actor.id,{vehicleId,canManageCapacity:true,canManageTracking:true});
    const origin=checked(await service.from('place_catalog').select('id').eq('normalized_name','addis ababa').limit(1).single());
    const destination=checked(await service.from('place_catalog').select('id').eq('normalized_name','adama').limit(1).single());
    shipmentId=(await createProviderShipment(actor,{expectedDeliveryDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),vehicleId,originPlaceRef:origin.id,destinationPlaceRef:destination.id,passingPlaceRef:checked(await service.from('place_catalog').select('id').eq('normalized_name','dire dawa').limit(1).single()).id,cargoSummary:'Tracking progress review',customerEmail:`progress-${actor.suffix}@example.test`,trackingMode:'STATUS_ONLY'})).id;
    // Normal email flow works with manual fixture-password login disabled.
    await page.goto('/login');const request=page.getByTestId('email-code-request-form');
    await request.getByLabel('Email',{exact:true}).fill(actor.email);const since=Date.now();
    await request.getByRole('button',{name:'Email me a code'}).click();
    await expect(page.getByTestId('email-code-form')).toBeVisible();
    await page.getByLabel('Six-digit code',{exact:true}).fill(await localMailpitNumericCode(actor.email,since,'Your Loadgistic sign-in code'));
    await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForURL(/\/app\/home/);
    await expect(page.locator('.app-main')).toBeVisible();await page.goto(`/app/provider-shipments/${shipmentId}`);
    await auditOpenTrackingProgress(page);const panel=page.locator('.tracking-control-panel');const steps=panel.locator('.tracking-journey li');
    await expect(steps).toHaveCount(2);await expect(steps.nth(0)).toContainText('Next');await expect(steps.nth(1)).toContainText('Or start here');
    await expect(panel.locator('input[name=nextStatus][value=IN_TRANSIT]')).toHaveCount(0);
    await expect(page.getByRole('radio',{name:/Going to pickup/})).toBeEnabled();
    await page.getByRole('radio',{name:/Going to pickup/}).focus();await expect(page.getByRole('radio',{name:/Going to pickup/})).toBeFocused();
    // Language changes translate whole controls without changing pending state or user notes.
    const language=page.locator('.language-picker select');
    await page.locator('input[name=nextStatus][value=ISSUE]').check();
    await panel.locator('textarea[name=note]').fill('Home <b>Account</b>');
    for(const locale of ['am','om','en']){
      const messages=locale==='en'?{}:JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));
      const t=(key:string,values:Record<string,string|number>={})=>translateMessage(messages,key,values);
      await expect(language).toBeEnabled();await language.selectOption(locale);
      await expect(page.locator('html')).toHaveAttribute('lang',locale);
      await expect(steps.nth(0)).toContainText(t('Going to pickup'));
      await expect(page.getByRole('heading',{level:1})).toContainText(t('Tracking'));
      await expect(panel.locator('textarea[name=note]')).toHaveValue('Home <b>Account</b>');
      await page.locator('input[name=nextStatus][value=ISSUE]').check();
      const note=panel.locator('textarea[name=note]');await note.fill('Home <b>Account</b>');
      await expect(panel.getByRole('button',{name:t('Save {status}',{status:t('Problem')}),exact:true})).toBeEnabled();
      await expect(note).toHaveValue('Home <b>Account</b>');
      await page.locator('input[name=nextStatus][value=TO_PICKUP]').check();
      await expect(panel.locator('.tracking-selection strong')).toHaveText(t('Ready to save: {status}',{status:t('Going to pickup')}));
      await expect(panel.getByRole('button',{name:t('Save {status}',{status:t('Going to pickup')}),exact:true})).toBeEnabled();
      await expect(panel.locator('input[name=note]')).toHaveValue('Going to pickup');
      await panel.screenshot({path:info.outputPath(`tracking-ready-${locale}.png`)});
      await page.locator('input[name=nextStatus][value=ISSUE]').check();
      await panel.locator('textarea[name=note]').fill('Home <b>Account</b>');
    }
    await page.locator('input[name=nextStatus][value=TO_PICKUP]').check();
    await panel.screenshot({path:info.outputPath('tracking-ready.png')});
    // Selection must not mutate the saved state.
    await page.getByRole('radio',{name:/Loading/}).check();
    expect(checked(await service.from('provider_shipments').select('operational_status').eq('id',shipmentId).single()).operational_status).toBe('CREATED');
    async function save(label:string,status:string){
      if(['LOADING','UNLOADING'].includes(status))await page.locator('input[name=proof]').setInputFiles('public/icon-192.png');
      const response=page.waitForResponse((r:any)=>r.request().isNavigationRequest()&&new URL(r.url()).pathname===`/app/provider-shipments/${shipmentId}`&&new URL(r.url()).searchParams.has('success'));
      await page.getByRole('button',{name:`Save ${label}`,exact:true}).click();expect((await response).status()).toBe(200);await (await response).finished();
      await expect(page.locator('.alert.success')).toBeVisible();await auditOpenTrackingProgress(page);
      expect(checked(await service.from('provider_shipments').select('operational_status').eq('id',shipmentId).single()).operational_status).toBe(status);
    }
    await save('Loading','LOADING');await expect(steps).toHaveCount(1);await expect(steps.nth(0)).toContainText('En route');await expect(steps.nth(0)).toContainText('Next');
    await panel.screenshot({path:info.outputPath('tracking-loading.png')});
    await page.getByRole('radio',{name:/Report a problem/}).check();await page.getByLabel('What happened?').fill('Synthetic delay for progress verification.');await save('Problem','ISSUE');
    await expect(page.getByRole('region',{name:'Shipment progress'})).toContainText('Choose where the shipment resumes.');await expect(steps.nth(1)).toContainText('previously recorded');await panel.screenshot({path:info.outputPath('tracking-problem.png')});
    for(const [status,label] of [['LOADING','Loading'],['IN_TRANSIT','En route'],['UNLOADING','Unloading']]){
      await page.locator(`input[name=nextStatus][value=${status}]`).check();await save(label,status);
    }
    await expect(panel.locator('input[name=nextStatus][value=COMPLETED]')).toHaveCount(0);
    guest=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize(),extraHTTPHeaders:{'x-forwarded-for':'127.0.0.247'}});const owner=await guest.newPage();await auditTrackingOwnerLogin(owner,`progress-${actor.suffix}@example.test`);
    await owner.getByRole('button',{name:'Approve unloading',exact:true}).click();await page.reload();
    await expect(page.getByRole('region',{name:'Shipment progress'})).toContainText('Complete');await expect(panel).toHaveCount(0);await expect(page.locator('.tracking-journey li')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Status timeline'})).toBeVisible();expect(await page.locator('time').count()).toBeGreaterThan(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath('tracking-complete.png')});
  }finally{
    await guest?.close();
    if(shipmentId){await cleanupFixtureProofs(service,{actor,vehicleId,shipmentId});checked(await service.from('access_email_deliveries').delete().eq('entity_id',shipmentId));checked(await service.from('audit_logs').delete().eq('entity_id',shipmentId));checked(await service.from('provider_shipments').delete().eq('id',shipmentId));}
    if(vehicleId){checked(await service.from('audit_logs').delete().eq('entity_id',vehicleId));checked(await auditDeleteVehicles(service,'id',vehicleId));}
    if(actor){checked(await service.from('audit_logs').delete().eq('actor_user_id',actor.id));checked(await service.auth.admin.deleteUser(actor.id));}
  }
});
