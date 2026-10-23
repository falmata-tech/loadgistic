import {test,expect} from './browser-test';
import {localAuditService,auditIdentity} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {localMailpitNumericCode} from './mailpit-helper';
import {chmodSync,mkdirSync,writeFileSync} from 'node:fs';

test.use({channel:'chrome',trace:'off',video:'off',screenshot:'off'});

test('read-only admin GPS desktop and phone review',async({page},info)=>{
 test.skip(info.project.name!=='desktop-chromium');
 test.setTimeout(120000);
 const evidenceDirectory='.local/telematics/browser/admin-gps-review';
 mkdirSync(evidenceDirectory,{recursive:true,mode:0o700});
 const evidence={widths:[] as number[],domainWrites:0,errors:[] as string[],demoOption:false,spareFixture:false,providerReadback:false};
 page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname.startsWith('/api/admin/telematics/'))evidence.domainWrites++;});
 page.on('pageerror',error=>evidence.errors.push(error.message));
 const admin=await auditIdentity(localAuditService(),'admin@loadgistic.local');
 const logout=await localSupportLogin(page,admin.id);
 async function capture(name:string){const path=`${evidenceDirectory}/${name}`;await page.screenshot({path,fullPage:true,animations:'disabled'});chmodSync(path,0o600);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 try{
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:900});
   await page.goto('/admin/devices');
   await expect(page.getByRole('heading',{name:'Fleet GPS devices'})).toBeVisible();
   await expect(page.getByText('Search by provider name to add or review GPS devices.')).toBeVisible();
   await expect(page.getByRole('navigation',{name:'Transport providers'})).toHaveCount(0);
   await capture(`gps-admin-list-${width}.png`);
   await page.getByRole('textbox',{name:'Find transport provider'}).fill('BlueLine');
   await page.getByRole('button',{name:'Search'}).click();
   await expect(page).toHaveURL(/q=BlueLine/);
   await expect(page.getByRole('navigation',{name:'Transport providers'}).getByRole('link').first()).toBeVisible({timeout:20000});
   const provider=page.getByRole('navigation',{name:'Transport providers'}).getByRole('link').first();
   if(await provider.count()){
    await provider.click();
    await expect(page).toHaveURL(/owner=6727b198-d771-436a-9f1f-7bf27b8cea2f/,{timeout:30000});
    await expect(page.getByRole('heading',{name:'BlueLine Transport PLC'})).toBeVisible({timeout:30000});
    await capture(`gps-admin-readback-${width}.png`);
    evidence.providerReadback=true;
   }
   await page.getByRole('button',{name:'Add GPS device'}).click();
   const dialog=page.getByRole('dialog',{name:'Add GPS device'});
   await expect(dialog.getByLabel('Demo GPS fixture')).toBeVisible();
   const spareOption=dialog.getByRole('option',{name:/Demo GPS for Truck 02/});
   const available=await spareOption.count()===1;
   if(available)await dialog.getByLabel('Demo GPS fixture').selectOption('990000000000013');
   else await expect(dialog.getByText(/^(All Demo GPS devices for this provider have already been added\.|No ready Demo GPS fixture is available for this provider\.)$/)).toBeVisible();
   const demoOption=dialog.getByRole('option',{name:'Demo GPS device'});
   if(available)await expect(demoOption).toHaveCount(1);
   await expect(dialog.getByRole('option',{name:'Physical GPS tracker'})).toHaveCount(0);
   if(!available)await expect(dialog.getByRole('button',{name:'Add GPS device'})).toBeDisabled();
   evidence.demoOption=await demoOption.count()===1;
   evidence.spareFixture=available;
   await capture(`gps-admin-form-${width}.png`);
   await dialog.getByRole('button',{name:'Cancel'}).click();
   evidence.widths.push(width);
  }
  expect(evidence.domainWrites).toBe(0);
  expect(evidence.errors).toEqual([]);
 }finally{
  await logout();
  writeFileSync(`${evidenceDirectory}/evidence.json`,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
 }
});

test('guarded local Admin Demo intake and provider web assignment',async({page},info)=>{
 test.skip(info.project.name!=='desktop-chromium'||process.env.LOADGISTIC_RUN_SPARE_INTAKE!=='1');
 test.setTimeout(120000);
 const service=localAuditService(),ownerOrganizationId='6727b198-d771-436a-9f1f-7bf27b8cea2f';
 const spareImei='990000000000013',truckId='76bea7fa-03b2-42f0-af51-fff05c62cbc7';
 const existing=await service.from('telematics_devices').select('id,organization_id,synthetic,label').eq('imei',spareImei).maybeSingle();
 expect(existing.error).toBeNull();
 if(existing.data)expect(existing.data).toMatchObject({organization_id:ownerOrganizationId,synthetic:true,label:'Demo GPS for Truck 02'});
 const assigned=await service.from('telematics_device_assignments').select('id').eq('vehicle_id',truckId).is('ended_at',null);
 expect(assigned.error).toBeNull();expect(assigned.data).toHaveLength(0);
 const admin=await auditIdentity(service,'admin@loadgistic.local');
 let logout=await localSupportLogin(page,admin.id);
 const evidenceDirectory='.local/telematics/browser/admin-gps-intake';
 mkdirSync(evidenceDirectory,{recursive:true,mode:0o700});
 try{
  await page.goto('/admin/devices');
  await page.getByRole('textbox',{name:'Find transport provider'}).fill('BlueLine');
  await page.getByRole('button',{name:'Search'}).click();
  await expect(page.getByRole('navigation',{name:'Transport providers'}).getByRole('link').first()).toBeVisible({timeout:20000});
  await page.getByRole('navigation',{name:'Transport providers'}).getByRole('link').first().click();
  await expect(page.getByRole('heading',{name:'BlueLine Transport PLC'})).toBeVisible();
  if(!existing.data){
   await page.getByRole('button',{name:'Add GPS device'}).click();
   const dialog=page.getByRole('dialog',{name:'Add GPS device'});
   await dialog.getByLabel('Demo GPS fixture').selectOption(spareImei);
   const saved=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/admin/telematics/devices'&&response.request().method()==='POST');
   await dialog.getByRole('button',{name:'Add GPS device'}).click();
   expect((await saved).status()).toBe(200);
  }
  await expect(page.getByText('Demo GPS 02',{exact:true})).toBeVisible({timeout:20000});
  const adminImage=`${evidenceDirectory}/admin-added-390.png`;
  await page.setViewportSize({width:390,height:900});await page.screenshot({path:adminImage,fullPage:true});chmodSync(adminImage,0o600);
  const linked=await service.from('telematics_devices').select('id,organization_id,provider_profile_id,synthetic,model_profile,gateway_device_id,last_seen_at').eq('imei',spareImei).single();
  expect(linked.error).toBeNull();expect(linked.data).toMatchObject({organization_id:ownerOrganizationId,provider_profile_id:null,synthetic:true,model_profile:'SYNTHETIC_GT06',last_seen_at:null});
  await logout();await page.context().clearCookies();
  const provider=await auditIdentity(service,'transporter@loadgistic.local');logout=await localSupportLogin(page,provider.id);
  await page.goto('/app/fleet?view=devices');
  const fleet=page.getByRole('region',{name:'GPS devices'});
  await expect(fleet.getByText('Demo GPS 02')).toBeVisible({timeout:20000});
  const row=fleet.locator('article').filter({hasText:'Demo GPS 02'}).first();
  await expect(row.getByText('Not assigned to a vehicle')).toBeVisible();
  await row.getByRole('button',{name:'View device'}).click();
  await page.getByRole('button',{name:'Change assignment'}).click();
  const assignment=page.getByRole('dialog',{name:'Assigned vehicle'});
  await assignment.getByRole('combobox',{name:'Assigned vehicle'}).selectOption(truckId);
  await assignment.getByRole('button',{name:'Save assignment'}).click();
  await expect(assignment).toHaveCount(0,{timeout:20000});
  const current=await service.from('telematics_device_assignments').select('vehicle_id,device_id').eq('device_id',linked.data!.id).is('ended_at',null).single();
  expect(current.error).toBeNull();expect(current.data?.vehicle_id).toBe(truckId);
  const unchangedSource=await service.from('telematics_location_sources').select('source').eq('vehicle_id',truckId).single();
  expect(unchangedSource.error).toBeNull();expect(unchangedSource.data?.source).toBe('MANUAL');
  await expect(page.getByText('Demo GPS device').first()).toBeVisible();
  const providerImage=`${evidenceDirectory}/provider-assigned-390.png`;
  await page.screenshot({path:providerImage,fullPage:true});chmodSync(providerImage,0o600);
  await page.getByRole('button',{name:'Edit location source'}).click();
  const source=page.getByRole('dialog',{name:'Location source'});
  await source.getByRole('radio',{name:'GPS device'}).check();
  await source.getByRole('button',{name:'Save location source'}).click();
  await expect(source).toHaveCount(0,{timeout:20000});
  const savedSource=await service.from('telematics_location_sources').select('source').eq('vehicle_id',truckId).single();
  expect(savedSource.error).toBeNull();expect(savedSource.data?.source).toBe('GPS');
 }finally{await logout();}
});

test('read-only saved spare phone layout and GPS report',async({page},info)=>{
 test.skip(info.project.name!=='desktop-chromium'||process.env.LOADGISTIC_RUN_SPARE_REVIEW!=='1');
 test.setTimeout(120000);
 const service=localAuditService(),directory='.local/telematics/browser/admin-gps-intake';
 mkdirSync(directory,{recursive:true,mode:0o700});
 const provider=await auditIdentity(service,'transporter@loadgistic.local');const logout=await localSupportLogin(page,provider.id);
 try{
  for(const width of [390,320]){
   await page.setViewportSize({width,height:900});await page.goto('/app/fleet?view=devices');
   const workspace=page.getByRole('region',{name:'GPS devices'});
   const row=workspace.locator('article').filter({hasText:'Demo GPS 02'}).first();
   await expect(row).toBeVisible({timeout:20000});await row.getByRole('button',{name:'View device'}).click();
   await expect(page.getByRole('heading',{name:'Demo GPS 02'})).toBeVisible();
   await expect(page.getByText('Not reported yet')).toHaveCount(0);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const headerClear=await page.getByRole('heading',{name:'Demo GPS 02'}).evaluate(node=>{
    const header=node.closest('header');const connection=header?.querySelector('[class*=connection]');
    return Boolean(connection&&node.getBoundingClientRect().bottom<=connection.getBoundingClientRect().top+2);
   });
   expect(headerClear).toBe(true);
   const top=`${directory}/provider-report-${width}-top.png`;await page.screenshot({path:top});chmodSync(top,0o600);
   await page.getByText('Shared location accuracy').first().scrollIntoViewIfNeeded();
   const clearNav=await page.getByText('Shared location accuracy').first().evaluate(node=>{
    const nav=document.querySelector('.mobile-nav');return Boolean(nav&&node.getBoundingClientRect().bottom<nav.getBoundingClientRect().top);
   });
   expect(clearNav).toBe(true);
   const bottom=`${directory}/provider-report-${width}-bottom.png`;await page.screenshot({path:bottom});chmodSync(bottom,0o600);
   await page.getByRole('button',{name:'Device commands'}).click();
   await expect(page.getByText('Commands are unavailable for this Demo GPS device. It reports simulated locations only.')).toBeVisible();
   await expect(page.getByRole('button',{name:'Request location'})).toHaveCount(0);
   const commands=`${directory}/provider-commands-${width}.png`;await page.screenshot({path:commands});chmodSync(commands,0o600);
  }
 }finally{await logout();}
});

test('Expo Web provider reads the saved spare, assignment, source and command limit',async({browser},info)=>{
 test.skip(info.project.name!=='desktop-chromium'||process.env.LOADGISTIC_RUN_SPARE_EXPO!=='1');
 test.setTimeout(120000);
 const service=localAuditService();
 const provider=await auditIdentity(service,'transporter@loadgistic.local');
 const auth=await service.auth.admin.getUserById(provider.id);
 expect(auth.error).toBeNull();
 const email=auth.data.user?.email;
 expect(email).toBeTruthy();
 const context=await browser.newContext({baseURL:'http://localhost:8084',viewport:{width:390,height:844},isMobile:true,hasTouch:true,extraHTTPHeaders:{'x-forwarded-for':'127.0.0.245'}});
 const page=await context.newPage();
 const directory='.local/telematics/browser/admin-gps-intake';mkdirSync(directory,{recursive:true,mode:0o700});
 try{
  await page.goto('/account');
  await page.getByLabel('Email',{exact:true}).fill(email!);
  const since=Date.now();await page.getByRole('button',{name:'Send code',exact:true}).click();
  await page.getByLabel('Sign-in code',{exact:true}).fill(await localMailpitNumericCode(email!,since,['Your Loadgistic signup code','Your Loadgistic sign-in code']));
  const verify=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/auth/verify'&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();expect((await verify).status()).toBe(200);
  await expect(page.getByRole('tab',{name:'Home',exact:true}).filter({visible:true})).toBeVisible();
  const fleet=page.getByRole('tab',{name:'Fleet',exact:true}).filter({visible:true});
  if(await fleet.count())await fleet.click();
  await page.getByRole('tab',{name:'GPS devices',exact:true}).filter({visible:true}).click();
  const devices=page.getByRole('region',{name:'GPS devices',exact:true}).filter({visible:true});
  await expect(devices.getByRole('button',{name:'View GPS device: Demo GPS 02'})).toBeVisible({timeout:20000});
  await devices.getByRole('button',{name:'View GPS device: Demo GPS 02'}).click();
  await expect(page.getByText('Demo GPS device',{exact:true}).first()).toBeVisible();
  await expect(page.getByRole('button',{name:/LG-TRK-4841B152BB/})).toBeVisible();
  const image=`${directory}/provider-expo-web-390.png`;await page.screenshot({path:image});chmodSync(image,0o600);
  await page.getByRole('tab',{name:'Location source',exact:true}).click();
  await expect(page.getByText('GPS device',{exact:true}).first()).toBeVisible();
  await page.getByRole('tab',{name:'Commands',exact:true}).click();
  await expect(page.getByText('Commands are unavailable for this Demo GPS device. It reports simulated locations only.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Request location'})).toHaveCount(0);
  const commandImage=`${directory}/provider-expo-web-commands-390.png`;await page.screenshot({path:commandImage});chmodSync(commandImage,0o600);
 }finally{await context.close();}
});

test('guarded Expo Web provider reassigns only the saved Demo spare',async({browser},info)=>{
 test.skip(info.project.name!=='desktop-chromium'||process.env.LOADGISTIC_RUN_SPARE_EXPO_ASSIGN!=='1');
 test.setTimeout(180000);
 const service=localAuditService(),spareImei='990000000000013',truckId='76bea7fa-03b2-42f0-af51-fff05c62cbc7';
 const device=await service.from('telematics_devices').select('id,organization_id,synthetic,model_profile,revision').eq('imei',spareImei).single();
 expect(device.error).toBeNull();expect(device.data).toMatchObject({organization_id:'6727b198-d771-436a-9f1f-7bf27b8cea2f',synthetic:true,model_profile:'SYNTHETIC_GT06'});
 const assignment=await service.from('telematics_device_assignments').select('vehicle_id').eq('device_id',device.data!.id).is('ended_at',null).single();
 expect(assignment.error).toBeNull();expect(assignment.data?.vehicle_id).toBe(truckId);
 const source=await service.from('telematics_location_sources').select('source,revision').eq('vehicle_id',truckId).single();
 expect(source.error).toBeNull();expect(source.data?.source).toBe('GPS');
 const moving=await service.from('telematics_devices').select('id,revision').eq('imei','990000000000001').single();
 expect(moving.error).toBeNull();
 const provider=await auditIdentity(service,'transporter@loadgistic.local');
 const auth=await service.auth.admin.getUserById(provider.id);expect(auth.error).toBeNull();const email=auth.data.user?.email;expect(email).toBeTruthy();
 const context=await browser.newContext({baseURL:'http://localhost:8084',viewport:{width:390,height:844},isMobile:true,hasTouch:true,extraHTTPHeaders:{'x-forwarded-for':'127.0.0.246'}});
 const page=await context.newPage();let detached=false;
 try{
  await page.goto('/account');await page.getByLabel('Email',{exact:true}).fill(email!);
  const since=Date.now();await page.getByRole('button',{name:'Send code',exact:true}).click();
  await page.getByLabel('Sign-in code',{exact:true}).fill(await localMailpitNumericCode(email!,since,['Your Loadgistic signup code','Your Loadgistic sign-in code']));
  const verified=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/auth/verify'&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();expect((await verified).status()).toBe(200);
  await expect(page.getByRole('tab',{name:'Home',exact:true}).filter({visible:true})).toBeVisible();
  const fleet=page.getByRole('tab',{name:'Fleet',exact:true}).filter({visible:true});if(await fleet.count())await fleet.click();
  await page.getByRole('tab',{name:'GPS devices',exact:true}).filter({visible:true}).click();
  const workspace=page.getByRole('region',{name:'GPS devices',exact:true}).filter({visible:true});
  await expect(workspace.getByRole('button',{name:'View GPS device: Demo GPS 02'})).toBeVisible({timeout:20000});
  await workspace.getByRole('button',{name:'View GPS device: Demo GPS 02'}).click();
  await page.getByRole('button',{name:/LG-TRK-4841B152BB/}).click();
  await page.getByRole('radio',{name:'Not assigned to a vehicle'}).click();
  const unassign=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/fleet/devices'&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Save assignment'}).click();expect((await unassign).status()).toBe(200);detached=true;
  await expect(page.getByRole('button',{name:'Not assigned to a vehicle'})).toBeVisible({timeout:20000});
  const afterDetach=await service.from('telematics_device_assignments').select('vehicle_id').eq('device_id',device.data!.id).is('ended_at',null);
  expect(afterDetach.error).toBeNull();expect(afterDetach.data).toHaveLength(0);
  await page.getByRole('button',{name:'Not assigned to a vehicle'}).click();
  await page.getByRole('radio',{name:/LG-TRK-4841B152BB/}).click();
  const reassign=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/fleet/devices'&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Save assignment'}).click();expect((await reassign).status()).toBe(200);detached=false;
  await expect(page.getByRole('button',{name:/LG-TRK-4841B152BB/})).toBeVisible({timeout:20000});
  const final=await service.from('telematics_device_assignments').select('vehicle_id').eq('device_id',device.data!.id).is('ended_at',null).single();
  expect(final.error).toBeNull();expect(final.data?.vehicle_id).toBe(truckId);
  const finalSource=await service.from('telematics_location_sources').select('source,revision').eq('vehicle_id',truckId).single();
  expect(finalSource.error).toBeNull();expect(finalSource.data).toEqual(source.data);
  const movingFinal=await service.from('telematics_devices').select('id,revision').eq('imei','990000000000001').single();
  expect(movingFinal.error).toBeNull();expect(movingFinal.data).toEqual(moving.data);
  const path='.local/telematics/browser/admin-gps-intake/provider-expo-web-reassigned-390.png';await page.screenshot({path});chmodSync(path,0o600);
 }finally{
  if(detached){
   const revision=await service.from('telematics_devices').select('revision').eq('id',device.data!.id).single();
   expect(revision.error).toBeNull();
   const restore=await service.rpc('assign_telematics_device',{actor_user_id:provider.id,command:{deviceId:device.data!.id,vehicleId:truckId,expectedRevision:revision.data!.revision}});
   expect(restore.error).toBeNull();
  }
  await context.close();
 }
});

test('private Capacity map labels the saved spare GPS fix as Demo without exposing IMEI',async({page},info)=>{
 test.skip(info.project.name!=='desktop-chromium'||process.env.LOADGISTIC_RUN_SPARE_MAP!=='1');
 test.setTimeout(120000);
 const service=localAuditService(),truck='76bea7fa-03b2-42f0-af51-fff05c62cbc7';
 const capacity=await service.from('capacities').select('id,visibility,location_source,demo_epoch').eq('vehicle_id',truck).order('updated_at',{ascending:false}).limit(1).single();
 expect(capacity.error).toBeNull();expect(capacity.data).toMatchObject({visibility:'PRIVATE',location_source:'TELEMATICS',demo_epoch:1});
 const grants=await service.from('capacity_access_grants').select('recipient_email,expires_at').eq('vehicle_id',truck).eq('audience_type','EMAIL').is('revoked_at',null);
 expect(grants.error).toBeNull();
 const recipient=grants.data?.find((row:{recipient_email:string|null;expires_at:string|null})=>row.recipient_email?.endsWith('@example.test')&&(!row.expires_at||Date.parse(row.expires_at)>Date.now()))?.recipient_email;
 expect(recipient).toBeTruthy();
 const query=new URLSearchParams({truck:capacity.data!.id});
 const open=await page.request.get('/api/public/capacity?'+query);
 expect(open.status()).toBe(200);
 expect((await open.json()).items.some((item:{id:string})=>item.id===capacity.data!.id)).toBe(false);
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?view=private');await page.getByLabel('Email',{exact:true}).fill(recipient!);
 const since=Date.now();await page.getByRole('button',{name:'Continue with email',exact:true}).click();
 await page.getByLabel('6-digit email code',{exact:true}).fill(await localMailpitNumericCode(recipient!,since,'Your Private capacity code'));
 const verified=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/shared-capacity/access'&&response.request().method()==='POST');
 await page.getByRole('button',{name:'View shared signals',exact:true}).click();
 expect((await verified).status()).toBe(200);
 await expect(page.getByRole('region',{name:'Privately shared vehicle capacity'})).toBeVisible({timeout:20000});
 const shared=await page.request.get('/api/shared-capacity?'+query);
 expect(shared.status()).toBe(200);
 const rows=(await shared.json()).items as Array<{id:string;location_source:string;location_is_demo:boolean}>;
 const item=rows.find(row=>row.id===capacity.data!.id);
 expect(item).toMatchObject({location_source:'TELEMATICS',location_is_demo:true});
 expect(JSON.stringify(item)).not.toContain('990000000000013');
 query.set('view','private');await page.goto('/?'+query);
 const badge=page.locator('.capacity-truck-map-marker.selected [title="GPS device"]');
 await expect(badge).toBeVisible({timeout:20000});
 await expect(page.locator('.capacity-truck-map-marker.selected')).toHaveAttribute('title',/Demo location/);
 expect(await page.locator('body').innerText()).not.toContain('990000000000013');
 const path='.local/telematics/browser/admin-gps-intake/private-spare-gps-demo-map-390.png';await page.screenshot({path});chmodSync(path,0o600);
});
