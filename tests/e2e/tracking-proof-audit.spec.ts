import {test,expect} from '@playwright/test';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createProviderShipment,getProviderTrackingWorkspace} from '../../src/lib/provider-tracking.js';
import {localMailpitNumericCode} from './mailpit-helper';

async function login(page:any,email:string){
  // Each role uses a fresh test-only session; /login redirects signed-in users.
  await page.context().clearCookies();
  await page.goto('/login');await page.locator('details.auth-fixture-login>summary').click();
  const form=page.getByTestId('login-form');
  await form.getByLabel('Email',{exact:true}).fill(email);await form.getByLabel('Password').fill('Loadgistic123!');
  await form.getByRole('button',{name:'Log in'}).click();
  await expect(page).toHaveURL(email==='admin@loadgistic.local'?/\/admin$/:/\/app\/home$/,{timeout:30000});
  await expect(page.locator('.app-main')).toBeVisible({timeout:30000});
  if(email==='admin@loadgistic.local')await expect(page.getByRole('heading',{name:'Administration',exact:true})).toBeVisible({timeout:30000});
}

test('uploaded Tracking proof opens for provider, admin and email-verified guest only',async({page,browser}:{page:any;browser:any},info:any)=>{
  test.setTimeout(180000);
  nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
  const endpoint=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
  if(!['127.0.0.1','localhost'].includes(new URL(endpoint).hostname))throw new Error('REMOTE_PROOF_TEST_REFUSED');
  const service=createClient(endpoint,process.env.SUPABASE_SERVICE_ROLE_KEY||'',{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:actor,error}=await service.from('profiles').select('id,role').eq('email','driver@loadgistic.local').single();
  expect(error).toBeNull();
  const workspace=await getProviderTrackingWorkspace(actor);
  const origin=await service.from('place_catalog').select('id').eq('normalized_name','addis ababa').limit(1).single();
  const destination=await service.from('place_catalog').select('id').eq('normalized_name','adama').limit(1).single();
  const email=`proof-audit-${randomUUID()}@example.test`;
  const marker=`Synthetic proof audit ${randomUUID()}`;
  const shipment=await createProviderShipment(actor,{vehicleId:workspace.vehicles[0].id,originPlaceRef:origin.data!.id,destinationPlaceRef:destination.data!.id,cargoSummary:marker,customerEmail:email,trackingMode:'STATUS_ONLY'});
  const guest=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize(),extraHTTPHeaders:{'x-forwarded-for':'127.0.0.243'}});
  try{
    await login(page,'driver@loadgistic.local');
    await page.goto(`/app/provider-shipments/${shipment.id}`);
    await page.locator('input[name=nextStatus][value=LOADING]').check();
    const bytes=readFileSync('public/icon-192.png');
    await page.locator('input[name=proof]').setInputFiles({name:'synthetic-proof.png',mimeType:'image/png',buffer:bytes});
    await page.getByRole('button',{name:'Save Loading',exact:true}).click();
    await expect(page.getByText('Tracking status updated.',{exact:true})).toBeVisible();
    const link=page.getByRole('link',{name:'Open proof (new tab)'});
    await expect(link).toBeVisible();
    const href=await link.getAttribute('href');
    const file=await page.request.get(href);
    expect(file.status()).toBe(200);expect((await file.body()).equals(bytes)).toBe(true);
    expect(file.headers()['cache-control']).toContain('no-store');
    expect(file.headers()['x-content-type-options']).toBe('nosniff');
    expect((await guest.request.get(href)).status()).toBe(404);
    await page.screenshot({path:info.outputPath('provider-proof.png')});

    const guestPage=await guest.newPage();await guestPage.goto('/track');
    await guestPage.getByLabel('Approved email').fill(email);await guestPage.getByLabel('Tracking code').fill(shipment.trackingCode);
    const requestedAt=Date.now();await guestPage.getByRole('button',{name:'Email me a code'}).click();
    await guestPage.getByLabel('One-time code').fill(await localMailpitNumericCode(email,requestedAt,'Your shipment Tracking code'));
    await guestPage.getByRole('button',{name:'Open tracking'}).click();
    await expect(guestPage.getByRole('heading',{name:'Shipment progress'})).toBeVisible({timeout:30000});
    await expect(guestPage.getByRole('link',{name:'Open proof (new tab)'})).toBeVisible();
    expect((await guest.request.get(href)).status()).toBe(200);
    await guestPage.screenshot({path:info.outputPath('guest-proof.png')});
    expect((await service.from('provider_tracking_recipients').update({revoked_at:new Date().toISOString()}).eq('shipment_id',shipment.id).eq('recipient_email',email)).error).toBeNull();
    expect((await guest.request.get(href)).status()).toBe(404);

    await login(guestPage,'transporter@loadgistic.local');
    expect((await guest.request.get(href)).status()).toBe(404);
    await login(guestPage,'admin@loadgistic.local');
    await guestPage.goto(`/admin/operations/tracking/${shipment.id}`);
    await expect(guestPage.getByRole('link',{name:'Open proof (new tab)'})).toBeVisible();
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
  }
});
