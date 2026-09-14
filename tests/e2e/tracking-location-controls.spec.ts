import {test,expect} from '@playwright/test';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {createProviderShipment,getProviderTrackingWorkspace} from '../../src/lib/provider-tracking.js';
import {localMailpitNumericCode} from './mailpit-helper';
function checked(result:any){expect(result.error).toBeNull();return result.data;}

test('Driver selects Tracking privacy radius with truthful cooldown and foreground-only updates',async({page,browser}:{page:any;browser:any},info:any)=>{
  test.setTimeout(180000);page.setDefaultTimeout(20000);nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
  const endpoint=process.env.NEXT_PUBLIC_SUPABASE_URL||'';const url=new URL(endpoint);
  if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='55321')throw new Error('LOCAL_LOADGISTIC_REQUIRED');
  const service=createClient(endpoint,process.env.SUPABASE_SERVICE_ROLE_KEY||'',{auth:{persistSession:false,autoRefreshToken:false}});
  const actor=checked(await service.from('profiles').select('id,role').eq('email','driver@loadgistic.local').single());
  const workspace=await getProviderTrackingWorkspace(actor);
  const origin=checked(await service.from('place_catalog').select('id').eq('normalized_name','addis ababa').limit(1).single());
  const destination=checked(await service.from('place_catalog').select('id').eq('normalized_name','adama').limit(1).single());
  const email=`location-controls-${randomUUID()}@example.test`;const marker=`Synthetic Tracking location ${randomUUID()}`;
  const shipment=await createProviderShipment(actor,{vehicleId:workspace.vehicles[0].id,originPlaceRef:origin.id,destinationPlaceRef:destination.id,cargoSummary:marker,customerEmail:email,trackingMode:'LOCATION_AND_STATUS'});
  const guest=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize(),extraHTTPHeaders:{'x-forwarded-for':'127.0.0.242'}});
  const captures=path.resolve('artifacts/tracking-location-controls-2026-09-14');mkdirSync(captures,{recursive:true});
  let posts=0;page.on('request',(request:any)=>{if(request.method()==='POST'&&request.url().endsWith(`/api/provider-shipments/${shipment.id}/location`))posts++;});
  try{
    // Synthetic sensor only; requests and SQL persistence use the real local app.
    await page.addInitScript(()=>{
      (window as any).testGps=[];
      Object.defineProperty(navigator.geolocation,'getCurrentPosition',{configurable:true,value:(success:any,failure:any)=>{
        if(localStorage.getItem('test-tracking-gps')==='defer'){(window as any).testGps.push({success,failure});return;}
        success({coords:{latitude:9.031234,longitude:38.741234,accuracy:3}});
      }});
    });
    await page.goto('/login');await page.locator('details.auth-fixture-login>summary').click();
    const form=page.getByTestId('login-form');await form.getByLabel('Email',{exact:true}).fill('driver@loadgistic.local');await form.getByLabel('Password').fill('Loadgistic123!');
    await form.getByRole('button',{name:'Log in',exact:true}).click();await expect(page).toHaveURL(/\/app\/home$/);await expect(page.locator('.app-main')).toBeVisible();
    await page.goto(`/app/provider-shipments/${shipment.id}`);
    const controls=page.locator('.tracking-control-panel');const radius=controls.getByLabel('Location privacy radius');
    await expect(controls).toContainText('No location has been saved yet.');
    await expect(radius).toHaveValue('20');await expect(radius.locator('option')).toHaveText(['1 km','3 km','5 km','10 km','20 km','40 km']);
    await expect(controls).toContainText('updates pause when the phone locks');
    await radius.selectOption('40');await controls.locator('input[name=nextStatus][value=TO_PICKUP]').check();
    await page.evaluate(()=>localStorage.setItem('test-tracking-gps','defer'));
    await controls.getByRole('button',{name:'Save Going to pickup',exact:true}).click();
    await expect(controls.locator('input[name=nextStatus][value=LOADING]')).toBeDisabled();
    await expect(radius).toBeDisabled();await expect(radius).toHaveValue('40');await expect.poll(()=>page.evaluate(()=>(window as any).testGps.length)).toBe(1);
    await page.evaluate(()=>{localStorage.removeItem('test-tracking-gps');(window as any).testGps.shift().success({coords:{latitude:9.031234,longitude:38.741234}});});
    await expect(page.getByText('Tracking status updated.',{exact:true})).toBeVisible({timeout:20000});
    let events=checked(await service.from('provider_shipment_events').select('id,location_lat,location_lng,location_precision_km,location_source').eq('shipment_id',shipment.id).eq('location_source','DEVICE_OBSCURED'));
    expect(events).toHaveLength(1);expect(events[0].location_precision_km).toBe(40);
    await expect(radius).toHaveValue('40');await expect(controls.getByRole('status')).toContainText('Waiting for the next location update');expect(events[0].location_lat).not.toBe(9.031234);expect(events[0].location_lng).not.toBe(38.741234);
    await radius.selectOption('5');await expect(controls.getByRole('status')).toContainText('Waiting for the next location update');
    await expect(controls).toContainText('Last saved radius: 40 km.');
    expect(checked(await service.from('provider_shipment_events').select('id').eq('shipment_id',shipment.id).eq('location_source','DEVICE_OBSCURED'))).toHaveLength(1);
    // Age only this test's event to exercise an accepted refresh without a ten-minute sleep.
    checked(await service.from('provider_shipment_events').update({created_at:new Date(Date.now()-11*60000).toISOString()}).eq('id',events[0].id).eq('shipment_id',shipment.id));
    await controls.getByRole('button',{name:'Update location',exact:true}).click();
    await expect(controls.getByRole('status')).toContainText('Approximate location shared · 5 km');
    await expect(controls).toContainText('Last saved radius: 5 km.');
    events=checked(await service.from('provider_shipment_events').select('id,location_lat,location_lng,location_precision_km').eq('shipment_id',shipment.id).eq('location_source','DEVICE_OBSCURED').order('created_at',{ascending:false}));
    expect(events).toHaveLength(2);expect(events[0].location_precision_km).toBe(5);expect(events[0].location_lat).not.toBe(9.031234);expect(events[0].location_lng).not.toBe(38.741234);
    const before=posts;await controls.getByRole('button',{name:'Update location',exact:true}).click();
    await expect(controls.getByRole('status')).toContainText('Waiting');expect(posts).toBe(before);
    await radius.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(captures,`${info.project.name}-driver-radius.png`),scale:'css'});

    await page.evaluate(()=>localStorage.setItem('test-tracking-gps','defer'));await page.reload();
    await expect(controls.getByRole('status')).toContainText('Finding Driver location');await expect.poll(()=>page.evaluate(()=>(window as any).testGps.length)).toBe(1);
    const hiddenPosts=posts;
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));(window as any).testGps.shift().success({coords:{latitude:9.031234,longitude:38.741234}});});
    await expect(controls.getByRole('status')).toContainText('Location updates paused');expect(posts).toBe(hiddenPosts);
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});
    await expect.poll(()=>page.evaluate(()=>(window as any).testGps.length)).toBe(1);
    await page.evaluate(()=>(window as any).testGps.shift().failure({code:1,PERMISSION_DENIED:1}));
    await expect(controls.getByRole('alert')).toContainText('Allow location for this site');await expect(controls.getByRole('status')).toContainText('Location update failed');
    await page.evaluate(()=>localStorage.removeItem('test-tracking-gps'));await controls.getByRole('button',{name:'Retry location',exact:true}).click();
    await expect(controls.getByRole('status')).toContainText('Waiting');
    expect(checked(await service.from('provider_shipment_events').select('id').eq('shipment_id',shipment.id).eq('location_source','DEVICE_OBSCURED'))).toHaveLength(2);

    const guestPage=await guest.newPage();await guestPage.goto('/track');await guestPage.getByLabel('Approved email').fill(email);await guestPage.getByLabel('Tracking code').fill(shipment.trackingCode);
    const requestedAt=Date.now();await guestPage.getByRole('button',{name:'Email me a code'}).click();
    await guestPage.getByLabel('One-time code').fill(await localMailpitNumericCode(email,requestedAt,'Your shipment Tracking code'));await guestPage.getByRole('button',{name:'Open tracking'}).click();
    await expect(guestPage.getByRole('heading',{name:'Shipment progress'})).toBeVisible({timeout:20000});
    await expect(guestPage.locator('.tracking-mode-banner')).toContainText('pause when it closes or the phone locks');await expect(guestPage.getByLabel('Location privacy radius')).toHaveCount(0);
    await guestPage.locator('.tracking-mode-banner').scrollIntoViewIfNeeded();await guestPage.screenshot({path:path.join(captures,`${info.project.name}-recipient-guidance.png`),scale:'css'});
    // The exact test shipment switches to status-only solely as a rendering fixture.
    checked(await service.from('provider_shipments').update({tracking_mode:'STATUS_ONLY'}).eq('id',shipment.id).eq('cargo_summary',marker));
    await page.reload();await expect(radius).toHaveCount(0);await expect(controls.locator('.automatic-location')).toHaveCount(0);
  }finally{
    checked(await service.from('access_email_deliveries').delete().eq('recipient_email',email).eq('delivery_kind','TRACKING_OTP'));
    checked(await service.from('audit_logs').delete().eq('entity_id',shipment.id).eq('entity_type','provider_shipment'));
    checked(await service.from('provider_shipments').delete().eq('id',shipment.id).eq('cargo_summary',marker));await guest.close();
  }
});
