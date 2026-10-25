import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {test,expect as baseExpect} from './browser-test';
import {auditDeleteVehicles,checked,localAuditService} from './audit-helpers';
import {localMailpitNumericCode} from './mailpit-helper';

test.use({trace:'off',screenshot:'off',video:'off',actionTimeout:20_000,navigationTimeout:30_000});
const expect=baseExpect.configure({timeout:30_000}),preview='http://localhost:8084';
test('Expo owner changes the current truck A to B and keeps the persisted editor and map Home without signing in again',async({browser},info)=>{
 test.setTimeout(180_000);
 const service=localAuditService(),nonce=randomUUID().slice(0,8),email=`native-assignment-${nonce}@loadgistic.local`,ownerName='Synthetic assignment owner';
 let ownerId='',providerId='',stage='SETUP',cleanupStage='NOT_STARTED',complete=false,cleaned=false,failed=false,refreshes=0,holdReload=false,reloadObserved=false;
 const truckIds:string[]=[],evidence=()=>{writeFileSync(info.outputPath('provider-native-assignment-checks.json'),JSON.stringify({stage,cleanupStage,complete,cleaned,failed,refreshes,reloadObserved},null,2),{mode:0o600});writeFileSync(info.outputPath('provider-native-assignment-owned.json'),JSON.stringify({ownerId,providerId,truckIds},null,2),{mode:0o600});};
 const checkpoint=(next:string)=>{stage=next;evidence();};
 const context=await browser.newContext({baseURL:preview,viewport:{width:390,height:844},isMobile:true,hasTouch:true,extraHTTPHeaders:{'x-forwarded-for':'127.0.0.251'}});
 context.setDefaultTimeout(20_000);context.setDefaultNavigationTimeout(30_000);const page=await context.newPage();
 let releaseReload:()=>void=()=>{};const delayedReload=new Promise<void>(resolve=>{releaseReload=resolve;});
 page.on('request',request=>{if(new URL(request.url()).pathname==='/api/mobile/auth/refresh')refreshes++;});
 await page.route('**/api/mobile/fleet*',async route=>{if(holdReload&&route.request().method()==='GET'&&new URL(route.request().url()).pathname==='/api/mobile/fleet'){reloadObserved=true;await delayedReload;}await route.continue();});
 try{
  ownerId=checked(await service.auth.admin.createUser({email,email_confirm:true,app_metadata:{fixture_source:'loadgistic'}})).user.id;evidence();
  checked(await service.from('profiles').update({active:true,role:'DRIVER',drives_truck:true,full_name:ownerName,first_name:'Synthetic',last_name:'Private assignment family'}).eq('id',ownerId));
  providerId=checked(await service.from('provider_profiles').insert({user_id:ownerId,business_name:'Synthetic assignment provider',handle:`native-assignment-${nonce}`}).select('id').single()).id;evidence();
  checked(await service.from('company_pages').insert({provider_profile_id:providerId,published:false}));checked(await service.rpc('accept_content_policy',{actor_user_id:ownerId,policy_version:'2026-10-09'}));
  for(const model of ['Assignment A','Assignment B']){truckIds.push(checked(await service.rpc('create_provider_vehicle',{actor_user_id:ownerId,command:{make:'Isuzu',model,plate:`${nonce}-${model.at(-1)}`,cargo_configuration:'Mini Box Truck',use_basis:'OWNED'}})).id);evidence();}
  checked(await service.rpc('update_fleet_driver_access',{actor_user_id:ownerId,command:{driver_user_id:ownerId,vehicle_id:truckIds[0],can_manage_capacity:true,can_manage_tracking:true}}));
  checkpoint('NORMAL_OTP');await page.goto('/account');await page.getByLabel('Email',{exact:true}).fill(email);const since=Date.now();await page.getByRole('button',{name:'Send code',exact:true}).click();await expect(page.getByLabel('Sign-in code',{exact:true})).toBeVisible();await page.getByLabel('Sign-in code',{exact:true}).fill(await localMailpitNumericCode(email,since,['Your Loadgistic signup code','Your Loadgistic sign-in code']));
  const verified=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/auth/verify'&&response.request().method()==='POST');await page.getByRole('button',{name:'Sign in',exact:true}).last().click();expect((await (await verified).json()).user.currentDrivenVehicleId).toBe(truckIds[0]);await expect(page.getByText('Isuzu Assignment A',{exact:true}).filter({visible:true})).toHaveCount(1);
  checkpoint('ASSIGN_B');const fleetLoaded=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/fleet'&&response.request().method()==='GET');await page.getByRole('tab',{name:'Manage vehicles',exact:true}).click();expect((await fleetLoaded).status()).toBe(200);await expect(page).toHaveURL(/\/account$/);
  await page.getByRole('tab',{name:'Drivers',exact:true}).click();const manageOwner=page.getByRole('button',{name:`Manage driver: ${ownerName}`,exact:true});await manageOwner.click();await expect(page.getByRole('button',{name:'Save assignment and access',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Edit assignment and access',exact:true}).click();
  const labelB=`Isuzu Assignment B · ${nonce}-B`;
  await page.getByRole('button',{name:`Isuzu Assignment A · ${nonce}-A`,exact:true}).click();await page.getByRole('button',{name:labelB,exact:true}).click();
  const selectedBButton=page.getByRole('button',{name:labelB,exact:true});await expect(selectedBButton).toBeVisible();const selectedB=await selectedBButton.elementHandle();expect(selectedB).not.toBeNull();holdReload=true;
  const saved=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/fleet'&&response.request().method()==='POST');await page.getByRole('button',{name:'Save assignment and access',exact:true}).click();const savedResponse=await saved;expect(savedResponse.status()).toBe(200);expect(savedResponse.request().postDataJSON()).toMatchObject({action:'ASSIGN_DRIVER',driverId:ownerId,vehicleId:truckIds[1]});await expect.poll(()=>reloadObserved).toBe(true);
  // The pending read still retains the prior response. It must not remount the
  // editor back to A while the successfully saved B read is on its way.
  // Busy buttons render a spinner instead of their text. The original B node
  // must remain mounted and disabled, rather than waiting for its name to return.
  expect(await selectedB!.evaluate(element=>element.isConnected)).toBe(true);expect(await selectedB!.isDisabled()).toBe(true);await expect(page.getByRole('button',{name:'Edit assignment and access',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:`Isuzu Assignment A · ${nonce}-A`,exact:true})).toHaveCount(0);
  expect(checked(await service.from('driver_vehicle_assignments').select('vehicle_id').eq('driver_user_id',ownerId).eq('active',true))).toEqual([{vehicle_id:truckIds[1]}]);
  const confirmedReload=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/fleet'&&response.request().method()==='GET');releaseReload();holdReload=false;expect((await confirmedReload).status()).toBe(200);await expect(page.getByRole('button',{name:'Edit assignment and access',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Save assignment and access',exact:true})).toHaveCount(0);await expect(page.getByText(labelB,{exact:true})).toBeVisible();await page.getByRole('button',{name:'Edit assignment and access',exact:true}).click();await expect(page.getByRole('button',{name:labelB,exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(checked(await service.from('driver_vehicle_assignments').select('vehicle_id').eq('driver_user_id',ownerId).eq('active',true))).toEqual([{vehicle_id:truckIds[1]}]);
  checkpoint('RETURN_HOME');await page.getByRole('tab',{name:'Home',exact:true}).click();await expect(page).toHaveURL(preview+'/account');await page.screenshot({path:info.outputPath('native-assignment-return-home.png')});await expect(page.getByRole('tab',{name:'Manage vehicles',exact:true})).toHaveAttribute('aria-selected','true');await page.getByRole('tab',{name:'My capacity',exact:true}).click();await expect(page.getByTestId('driver-home-map').filter({visible:true})).toHaveCount(1);await expect(page.getByText('Isuzu Assignment B',{exact:true}).filter({visible:true})).toHaveCount(1);await expect(page.getByText('Isuzu Assignment A',{exact:true}).filter({visible:true})).toHaveCount(0);expect(refreshes).toBe(0);
  await page.screenshot({path:info.outputPath('native-assignment-B-home.png')});complete=true;checkpoint('COMPLETE');
 }catch(error){failed=true;throw error;}finally{
  releaseReload();holdReload=false;
  try{
   cleanupStage='VERIFY_OWNED_SYNTHETIC_SCOPE';evidence();if(ownerId){const identity=checked(await service.auth.admin.getUserById(ownerId)).user;expect(identity.email).toBe(email);expect(identity.app_metadata.fixture_source).toBe('loadgistic');
    expect(checked(await service.from('provider_shipments').select('id').eq('assigned_driver_user_id',ownerId))).toHaveLength(0);expect(checked(await service.from('support_conversations').select('id').eq('customer_user_id',ownerId))).toHaveLength(0);
    if(providerId){expect(checked(await service.from('provider_profiles').select('user_id').eq('id',providerId).single()).user_id).toBe(ownerId);expect(checked(await service.from('drivers').select('id').eq('provider_profile_id',providerId))).toHaveLength(0);expect(checked(await service.from('provider_shipments').select('id').eq('provider_profile_id',providerId))).toHaveLength(0);
     const rows=checked(await service.from('vehicles').select('id').eq('provider_profile_id',providerId)) as Array<{id:string}>;expect(rows.every(row=>truckIds.includes(row.id))).toBe(true);expect(checked(await service.from('verification_requests').select('id').eq('submitted_by',ownerId))).toHaveLength(0);
     cleanupStage='DELETE_OWNED_FLEET';if(truckIds.length)checked(await service.from('driver_vehicle_assignments').delete().in('vehicle_id',truckIds).eq('driver_user_id',ownerId));checked(await service.from('capacities').delete().eq('provider_profile_id',providerId));checked(await auditDeleteVehicles(service,'provider_profile_id',providerId));}
    cleanupStage='DELETE_OWNED_IDENTITY';checked(await service.from('provider_signup_intents').delete().eq('auth_user_id',ownerId));checked(await service.from('audit_logs').delete().eq('actor_user_id',ownerId));checked(await service.auth.admin.deleteUser(ownerId));expect(checked(await service.from('profiles').select('id').eq('id',ownerId))).toHaveLength(0);
   }cleaned=true;cleanupStage='COMPLETE';
  }catch(error){cleanupStage='CLEANUP_NOT_CONFIRMED';if(!failed)throw error;}finally{evidence();await context.close();}
 }
});
