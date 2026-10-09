import {test,expect} from '@playwright/test';
import {auditIdentity,auditLogin} from './audit-helpers';
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
  const actor=await auditIdentity(service,'driver@loadgistic.local');
  const workspace=await getProviderTrackingWorkspace(actor);
  const origin=checked(await service.from('place_catalog').select('id').eq('normalized_name','addis ababa').limit(1).single());
  const destination=checked(await service.from('place_catalog').select('id').eq('normalized_name','adama').limit(1).single());
  const email=`location-controls-${randomUUID()}@example.test`;const marker=`Synthetic Tracking location ${randomUUID()}`;
  const shipment=await createProviderShipment(actor,{expectedDeliveryDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),vehicleId:workspace.vehicles[0].id,originPlaceRef:origin.id,destinationPlaceRef:destination.id,cargoSummary:marker,customerEmail:email,trackingMode:'LOCATION_AND_STATUS'});
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
    await auditLogin(page,'driver@loadgistic.local');
    await page.goto(`/app/provider-shipments/${shipment.id}`);
    const controls=page.locator('.tracking-control-panel'),radius=controls.getByLabel('Location privacy radius');
    await expect(radius.locator('option')).toHaveText(['1 km','3 km','5 km','10 km','20 km']);
    await expect(controls).toContainText('updates pause when the phone locks');
    await expect.poll(async()=>checked(await service.from('provider_shipment_events').select('id').eq('shipment_id',shipment.id).eq('location_source','DEVICE_OBSCURED')).length).toBe(1);
    let events=checked(await service.from('provider_shipment_events').select('id,location_lat,location_lng,location_precision_km').eq('shipment_id',shipment.id).eq('location_source','DEVICE_OBSCURED'));
    expect(events[0].location_precision_km).toBe(20);expect(events[0].location_lat).not.toBe(9.031234);expect(events[0].location_lng).not.toBe(38.741234);
    // Reload starts the automatic reporter, and a recent fix produces a truthful cooldown.
    await page.reload();await expect(controls.getByRole('status')).toContainText('Waiting for the next location update');
    const radiusReply=page.waitForResponse((response:any)=>response.url().endsWith(`/api/provider-shipments/${shipment.id}/location`));
    await radius.selectOption('5');expect(await (await radiusReply).json()).toMatchObject({recorded:false,reason:'THROTTLED'});
    await expect(controls).toContainText('Last saved radius: 20 km.');
    expect(checked(await service.from('provider_shipment_events').select('id').eq('shipment_id',shipment.id).eq('location_source','DEVICE_OBSCURED'))).toHaveLength(1);
    // Age only this synthetic shipment's event rather than sleeping ten minutes.
    checked(await service.from('provider_shipment_events').update({created_at:new Date(Date.now()-11*60000).toISOString()}).eq('shipment_id',shipment.id).eq('location_source','DEVICE_OBSCURED'));
    const savedLocation=page.waitForResponse((response:any)=>response.url().endsWith(`/api/provider-shipments/${shipment.id}/location`));
    await controls.getByRole('button',{name:'Update location',exact:true}).click();expect(await (await savedLocation).json()).toMatchObject({recorded:true});
    await expect(controls.getByRole('status')).toContainText('Approximate location shared · 5 km');
    events=checked(await service.from('provider_shipment_events').select('id,location_lat,location_lng,location_precision_km').eq('shipment_id',shipment.id).eq('location_source','DEVICE_OBSCURED').order('created_at',{ascending:false}));
    expect(events).toHaveLength(2);expect(events[0].location_precision_km).toBe(5);expect(events[0].location_lat).not.toBe(9.031234);expect(events[0].location_lng).not.toBe(38.741234);
    const before=posts;await controls.getByRole('button',{name:'Update location',exact:true}).click();await expect(controls.getByRole('status')).toContainText('Waiting');expect(posts).toBe(before);
    await page.screenshot({path:path.join(captures,`${info.project.name}-driver-radius.png`),scale:'css'});
    await page.evaluate(()=>localStorage.setItem('test-tracking-gps','defer'));await page.reload();
    await expect(controls.getByRole('status')).toContainText('Finding Driver location');await expect.poll(()=>page.evaluate(()=>(window as any).testGps.length)).toBe(1);
    const hiddenPosts=posts;
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));(window as any).testGps.shift().success({coords:{latitude:9.031234,longitude:38.741234}});});
    await expect(controls.getByRole('status')).toContainText('Location updates paused');expect(posts).toBe(hiddenPosts);
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});
    await expect.poll(()=>page.evaluate(()=>(window as any).testGps.length)).toBe(1);
    await page.evaluate(()=>(window as any).testGps.shift().failure({code:1,PERMISSION_DENIED:1}));
    await expect(controls.getByRole('alert')).toContainText('Allow location for this site');await expect(controls.getByRole('status')).toContainText('Location update failed');
    const retryReply=page.waitForResponse((response:any)=>response.url().endsWith(`/api/provider-shipments/${shipment.id}/location`));
    await page.evaluate(()=>localStorage.removeItem('test-tracking-gps'));await controls.getByRole('button',{name:'Retry location',exact:true}).click();
    expect(await (await retryReply).json()).toMatchObject({recorded:false,reason:'THROTTLED'});await expect(controls.getByRole('status')).toContainText('Waiting');
    expect(checked(await service.from('provider_shipment_events').select('id').eq('shipment_id',shipment.id).eq('location_source','DEVICE_OBSCURED'))).toHaveLength(2);
    const guestPage=await guest.newPage();await guestPage.goto('/track');await guestPage.getByLabel('Email',{exact:true}).fill(email);
    const requestedAt=Date.now();await guestPage.getByRole('button',{name:'Email me a code'}).click();
    await guestPage.getByLabel('6-digit email code').fill(await localMailpitNumericCode(email,requestedAt,'Your Loadgistic tracking sign-in code'));await guestPage.getByRole('button',{name:'Open tracking'}).click();
    await expect(guestPage.getByRole('heading',{name:'Shipment progress'})).toBeVisible({timeout:20000});
    await expect(guestPage.locator('.tracking-mode-banner')).toContainText('pause when it closes or the phone locks');await expect(guestPage.getByLabel('Location privacy radius')).toHaveCount(0);
    await guestPage.locator('.tracking-mode-banner').scrollIntoViewIfNeeded();await guestPage.screenshot({path:path.join(captures,`${info.project.name}-recipient-guidance.png`),scale:'css'});
    await expect(page.getByLabel('Status only',{exact:true})).toHaveCount(0);
  }finally{
    checked(await service.from('access_email_deliveries').delete().eq('recipient_email',email).eq('delivery_kind','TRACKING_OTP'));
    checked(await service.from('audit_logs').delete().eq('entity_id',shipment.id).eq('entity_type','provider_shipment'));
    checked(await service.from('provider_shipments').delete().eq('id',shipment.id).eq('cargo_summary',marker));await guest.close();
  }
});
