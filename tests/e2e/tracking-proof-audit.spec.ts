import {createRegisteredTrackingShipment as createProviderShipment,cleanupTrackingOwnerFixtures,issueTrackingFixtureLink,openTrackingFixtureLink} from './tracking-session-fixtures';
import {auditOpenTrackingProgress} from './audit-helpers';
import {auditIdentity,auditLogin,auditTrackingOwnerLogin,checked,localAuditService} from './audit-helpers';
import {test,expect} from './browser-test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {getProviderTrackingWorkspace} from '../../src/lib/provider-tracking.js';

async function login(page:any,email:string){
 await page.context().clearCookies();await auditLogin(page,email);
}

test.use({actionTimeout:15_000,trace:'off',screenshot:'off'});

test('uploaded Tracking proof opens for provider, admin and registered owner while link guests remain read-only',async({page,browser}:{page:any;browser:any},info:any)=>{
  test.setTimeout(180000);
  const service=localAuditService();
  const actor=await auditIdentity(service,'driver@loadgistic.local');
  const workspace=await getProviderTrackingWorkspace(actor);
  const origin=await service.from('place_catalog').select('id').eq('normalized_name','addis ababa').limit(1).single();
  const destination=await service.from('place_catalog').select('id').eq('normalized_name','adama').limit(1).single();
  const email=`proof-audit-${randomUUID()}@example.test`;
  const marker=`Synthetic proof audit ${randomUUID()}`;
  const shipment=await createProviderShipment(actor,{expectedDeliveryDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),vehicleId:workspace.vehicles[0].id,originPlaceRef:origin.data!.id,destinationPlaceRef:destination.data!.id,passingPlaceRef:checked(await service.from('place_catalog').select('id').eq('normalized_name','dire dawa').limit(1).single()).id,cargoSummary:marker,customerEmail:email,trackingMode:'STATUS_ONLY'});
  const guest=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize(),extraHTTPHeaders:{'x-forwarded-for':'127.0.0.243'}});
  const ownerContext=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize(),extraHTTPHeaders:{'x-forwarded-for':'127.0.0.244'}});
  try{
    await login(page,'driver@loadgistic.local');
    await page.goto(`/app/provider-shipments/${shipment.id}`);
    await auditOpenTrackingProgress(page);
    await page.locator('input[name=nextStatus][value=LOADING]').check();
    const bytes=readFileSync('public/icon-192.png');
    await page.locator('input[name=proof]').setInputFiles({name:'synthetic-proof.png',mimeType:'image/png',buffer:bytes});
    await page.getByRole('button',{name:'Save Loading',exact:true}).click();
    await expect(page.getByText('Tracking status updated.',{exact:true})).toBeVisible({timeout:15000});
    const open=page.getByRole('button',{name:'Open proof',exact:true});
    await expect(open).toBeVisible();await open.click();
    await expect(page.getByRole('dialog',{name:'Shipment proof'}).getByRole('img',{name:'Shipment proof photo'})).toBeVisible();
    await page.getByRole('button',{name:'Close proof'}).click();
    const event=checked(await service.from('provider_shipment_events').select('id').eq('shipment_id',shipment.id).not('proof_storage_path','is',null).single());
    const href=`/api/provider-shipments/${shipment.id}/proofs/${event.id}`;
    const file=await page.request.get(href);
    expect(file.status()).toBe(200);expect((await file.body()).equals(bytes)).toBe(true);
    expect(file.headers()['cache-control']).toContain('no-store');
    expect(file.headers()['x-content-type-options']).toBe('nosniff');
    expect((await guest.request.get(href)).status()).toBe(404);
    await page.screenshot({path:info.outputPath('provider-proof.png')});

    const ownerPage=await ownerContext.newPage(),ownerSession=await auditTrackingOwnerLogin(ownerPage,email,shipment.id);
    await expect(ownerPage.getByRole('button',{name:'Open proof',exact:true})).toBeVisible();
    await ownerPage.getByRole('button',{name:'Open proof',exact:true}).click();
    await expect(ownerPage.getByRole('dialog',{name:'Shipment proof'}).getByRole('img',{name:'Shipment proof photo'})).toBeVisible();
    await ownerPage.getByRole('button',{name:'Close proof'}).click();
    const accountHref=`/api/tracking/sessions/${ownerSession.id}/proof/${event.id}`,ownerFile=await ownerContext.request.get(accountHref);
    expect(ownerFile.status()).toBe(200);expect((await ownerFile.body()).equals(bytes)).toBe(true);
    expect(ownerFile.headers()['content-type']).toContain('image/png');expect(ownerFile.headers()['cache-control']).toContain('no-store');expect(ownerFile.headers()['x-content-type-options']).toBe('nosniff');
    const link=await issueTrackingFixtureLink(ownerPage,ownerSession.id),guestPage=await guest.newPage();
    const shared=await openTrackingFixtureLink(guestPage,link);expect(shared.tracking.events.some((event:any)=>event.hasProof)).toBe(false);
    await expect(guestPage.getByRole('button',{name:'Open proof',exact:true})).toHaveCount(0);
    expect((await guest.request.get(accountHref)).status()).toBe(401);expect((await guest.request.get(href)).status()).toBe(404);
    await guestPage.screenshot({path:info.outputPath('link-guest-no-proof.png')});
    expect((await service.from('provider_tracking_recipients').update({revoked_at:new Date().toISOString()}).eq('shipment_id',shipment.id).eq('recipient_email',email)).error).toBeNull();
    expect((await ownerContext.request.get(accountHref)).status()).toBe(404);
    expect((await guest.request.get(`/api/tracking/sessions/${ownerSession.id}`)).status()).toBe(401);

    await login(guestPage,'transporter@loadgistic.local');
    expect((await guest.request.get(href)).status()).toBe(404);
    await login(guestPage,'admin@loadgistic.local');
    await guestPage.goto(`/admin/operations/tracking/${shipment.id}`);
    await expect(guestPage.getByRole('button',{name:'Open proof',exact:true})).toBeVisible();
    expect((await guest.request.get(href)).status()).toBe(200);
  }finally{
    const rows=await service.from('provider_shipment_events').select('proof_storage_path').eq('shipment_id',shipment.id).not('proof_storage_path','is',null);
    expect(rows.error).toBeNull();
    for(const row of rows.data||[]){
      const match=/^supabase:\/\/shipment-proof\/(.+)$/.exec(row.proof_storage_path);
      if(!match)throw new Error('Test proof cleanup reference invalid');
      expect((await service.storage.from('shipment-proof').remove([match[1]])).error).toBeNull();
    }
    expect((await service.from('access_email_deliveries').delete().eq('recipient_email',email).eq('delivery_kind','TRACKING_OTP')).error).toBeNull();
    expect((await service.from('audit_logs').delete().eq('entity_id',shipment.id).eq('entity_type','provider_shipment')).error).toBeNull();
    expect((await service.from('provider_shipments').delete().eq('id',shipment.id).eq('cargo_summary',marker)).error).toBeNull();
    await guest.close();
    await ownerContext.close();
  }
});

// Only newly created local SHIPPER fixtures are removed after shipment/proof cleanup.
test.afterEach(async()=>{await cleanupTrackingOwnerFixtures();});
