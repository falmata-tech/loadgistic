import {auditDeleteVehicles} from './audit-helpers';
import {test,expect} from './browser-test';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {chmodSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fictionalOwnershipPdf} from '../../scripts/fixture-provider-authority.mjs';

function localService(cleanupDeadline:()=>number){
  nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
  const endpoint=process.env.NEXT_PUBLIC_SUPABASE_URL||'';const url=new URL(endpoint);
  if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='55321')throw new Error('LOCAL_LOADGISTIC_REQUIRED');
  return createClient(endpoint,process.env.SUPABASE_SERVICE_ROLE_KEY||'',{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{fetch:async(input:Parameters<typeof globalThis.fetch>[0],init?:Parameters<typeof globalThis.fetch>[1])=>{
      const deadline=cleanupDeadline();if(!deadline)return fetch(input,init);
      const remaining=deadline-Date.now();if(remaining<=0)throw new Error('LOCAL_PAGING_CLEANUP_TIMEOUT');
      const signal=AbortSignal.timeout(remaining);
      return fetch(input,{...init,signal:init?.signal?AbortSignal.any([init.signal,signal]):signal});
    }}
  });
}
function checked(result:any){expect(result.error).toBeNull();return result.data;}
function batches<T>(values:T[]):T[][]{return Array.from({length:Math.ceil(values.length/40)},(_,index)=>values.slice(index*40,(index+1)*40));}
for(const kind of ['large','company','single'])test(`public ${kind} fleet pages reach every truck with scoped capacity`,async({page}:{page:any},info:any)=>{
  test.setTimeout(150000);let cleanupDeadline=0;const service=localService(()=>cleanupDeadline);const suffix=randomUUID().slice(0,8);const handle=`paging-${suffix}`;
  const count=kind==='large'?105:kind==='single'?1:13;let actor='';let provider='';let org='';let vehicles:any[]=[];const driverIds:string[]=[];
  const requestIds:string[]=[],reviewIds:string[]=[],invitationIds:string[]=[],proofIds:string[]=[],proofPaths:string[]=[];const driverByTruck=new Map<string,string>();
  let stage='SETUP',failedStage:string|null=null,cleanupStage='NOT_STARTED',cleanupFailedStage:string|null=null,cleanup=false;
  let bodyFailed=false,bodyError:unknown,cleanupFailed=false,cleanupError:unknown;
  const protectedJSON=(name:string,value:unknown)=>{const file=info.outputPath(name);writeFileSync(file,JSON.stringify(value,null,2)+'\n',{mode:0o600});chmodSync(file,0o600);};
  const manifest=()=>{
    const ids={ownerId:actor?[actor]:[],providerIds:provider?[provider]:[],organizationIds:org?[org]:[],vehicleIds:vehicles.map(vehicle=>vehicle.id),driverIds,invitationIds,requestIds,reviewIds,proofIds};
    for(const values of Object.values(ids))for(const id of values)if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new Error('INVALID_OWNED_FIXTURE_ID');
    protectedJSON('paging-owned-fixtures.json',ids);
  };
  const evidence=()=>protectedJSON('paging-evidence.json',{stage,failedStage,cleanupStage,cleanupFailedStage,cleanup,hostedChanges:false,
    ownedCounts:{vehicles:vehicles.length,drivers:driverIds.length,invitations:invitationIds.length,sources:requestIds.length,reviews:reviewIds.length,proofs:proofIds.length}});
  const checkpoint=(next:string)=>{stage=next;evidence();};manifest();evidence();
  const captures=path.resolve('artifacts/public-fleet-paging-2026-09-14');mkdirSync(captures,{recursive:true});
  try{
    checkpoint('CREATE_OWNER');actor=checked(await service.auth.admin.createUser({email:`paging-${suffix}@loadgistic.local`,email_confirm:true})).user.id;manifest();
    checked(await service.from('profiles').update({active:true,role:kind==='single'?'DRIVER':'TRANSPORTER',drives_truck:kind==='single',full_name:`Paging${suffix} PRIVATE-LAST-NAME`,phone:'PRIVATE-ACCOUNT-PHONE'}).eq('id',actor));
    checkpoint('CREATE_PROVIDER_SCOPE');
    if(kind==='single'){provider=checked(await service.from('provider_profiles').insert({user_id:actor,business_name:`Paging ${suffix}`,handle,city:'Addis Ababa',public_visibility:'PUBLIC'}).select('id').single()).id;manifest();}
    else{
      org=checked(await service.from('organizations').insert({name:`Paging ${suffix}`,handle,type:'TRANSPORT_COMPANY',city:'Addis Ababa',public_visibility:'PUBLIC'}).select('id').single()).id;manifest();
      checked(await service.from('organization_members').insert({organization_id:org,user_id:actor,membership_role:'OWNER'}));
    }
    const scope=org?{organization_id:org}:{provider_profile_id:provider};
    checked(await service.rpc('accept_content_policy',{actor_user_id:actor,policy_version:'2026-10-09'}));
    const region=checked(await service.from('company_pages').select('base_region_code').not('base_region_code','is',null).limit(1).single()).base_region_code;
    checked(await service.from('company_pages').insert({...scope,published:true,base_region_code:region,contact_phone:'+251911111111',show_contact_phone:true,contact_email:'hidden-business@example.invalid',show_contact_email:false,contact_whatsapp:'PRIVATE-WHATSAPP',show_contact_whatsapp:false,contact_website:'https://private-website.invalid',show_contact_website:false}));
    checkpoint('CREATE_TRUCKS');vehicles=checked(await service.from('vehicles').insert(Array.from({length:count+1},(_,index)=>({...scope,platform_number:`PG-${suffix}-${String(index+1).padStart(3,'0')}`,label:'Synthetic paging truck',category:'TRUCK',make:'Test',model:'Paging',cargo_configuration:'Heavy rigid',plate:`PRIVATE-PLATE-${suffix}`,active:index<count,use_basis:'OWNED'}))).select('id,platform_number,active').order('platform_number'));manifest();
    const activeVehicles=vehicles.filter(vehicle=>vehicle.active);expect(activeVehicles).toHaveLength(count);
    // Deliberately reviewed fictional evidence qualifies only this owned test
    // workspace. A generic Approved upload must not unlock the other trucks.
    const qualifiedVehicle=activeVehicles[Math.min(99,count-1)];
    checkpoint('QUALIFY_OWN_TRUCK');const proofId=randomUUID(),proofPath=`verification/synthetic-private-paging-proof/${actor}/${proofId}.pdf`;
    // Record the exact intended object before upload so an ambiguous failure is
    // recoverable without searching the bucket or retaining private paths.
    proofIds.push(proofId);proofPaths.push(proofPath);manifest();
    checked(await service.storage.from('verification').upload(proofPath,fictionalOwnershipPdf({owner_user_id:'Synthetic paging provider',vehicle_id:qualifiedVehicle.platform_number}),{contentType:'application/pdf',upsert:false}));
    const sourceId=checked(await service.rpc('submit_managed_verification',{actor_user_id:actor,command:{subject_type:'VEHICLE',subject_id:qualifiedVehicle.id,
      verification_type:'VEHICLE_OWNERSHIP',document_name:'FICTIONAL synthetic paging evidence',storage_path:`supabase://verification/${proofPath}`,original_name:'fictional-ownership.pdf',mime_type:'application/pdf'}}));requestIds.push(sourceId);manifest();
    const reviewer=checked(await service.from('profiles').select('id').eq('role','ADMIN').eq('active',true).limit(1).single());
    checked(await service.rpc('review_managed_verification',{actor_user_id:reviewer.id,request_id:sourceId,review_status:'APPROVED',review_note:'Fictional local paging fixture only.'}));
    expect(checked(await service.rpc('managed_provider_publication_eligibility',{actor_user_id:actor})).qualifyingTruckCount).toBe(0);
    const reviewContext=checked(await service.rpc('managed_provider_authority_review_context',{actor_user_id:reviewer.id,requested_request_ids:[sourceId]}));
    reviewIds.push(checked(await service.rpc('confirm_provider_vehicle_authority',{actor_user_id:reviewer.id,request_id:sourceId,command:{fact_kind:'OWNERSHIP',review_note:'Matched the exact fictional paging provider and truck.',context_revision:reviewContext[0].contextRevision}})));manifest();
    checkpoint('PUBLISH_OWN_TRUCKS');
    for(const vehicle of activeVehicles)checked(await service.rpc('set_provider_vehicle_publication',{actor_user_id:actor,target_vehicle_id:vehicle.id,requested_state:'LIVE'}));
    expect(checked(await service.from('vehicles').select('publication_status').eq('id',vehicles[count].id).single()).publication_status).toBe('DRAFT');
    checked(await service.from('profile_routes').insert({...scope,origin:'Regular origin',destination:'Regular destination',geometry:'ROUTE',route_points_json:[{label:'Regular origin',lat:9.03,lng:38.74},{label:'Regular destination',lat:8.75,lng:38.99}]}));
    checkpoint('ASSIGN_OWN_DRIVERS');if(org){
      for(const vehicle of activeVehicles){
        const email=`paging-driver-${randomUUID()}@example.test`;
        const driver=checked(await service.auth.admin.createUser({email,email_confirm:true})).user.id;driverIds.push(driver);manifest();
        const invitation=checked(await service.rpc('fleet_invite_driver',{actor_user_id:actor,command:{email,name:'Paging driver',phone:'+251900000001'}}));invitationIds.push(invitation);manifest();
        checked(await service.rpc('fleet_accept_invitation',{actor_user_id:driver,invitation_id:invitation}));
        checked(await service.rpc('accept_content_policy',{actor_user_id:driver,policy_version:'2026-10-09'}));
        checked(await service.rpc('update_fleet_driver_access',{actor_user_id:actor,command:{driver_user_id:driver,vehicle_id:vehicle.id,can_manage_capacity:true,can_manage_tracking:true}}));
        driverByTruck.set(vehicle.id,driver);
      }
    }else{
      checked(await service.rpc('update_fleet_driver_access',{actor_user_id:actor,command:{driver_user_id:actor,vehicle_id:activeVehicles[0].id,can_manage_capacity:true,can_manage_tracking:true}}));
      driverByTruck.set(activeVehicles[0].id,actor);
    }
    expect(checked(await service.from('driver_vehicle_assignments').select('id').eq('vehicle_id',vehicles[count].id).eq('active',true))).toHaveLength(0);
    checkpoint('CREATE_SCOPED_SIGNALS');checked(await service.from('vehicle_capacity_sharing').insert(vehicles.map((vehicle,index)=>({vehicle_id:vehicle.id,mode:[101,102].includes(index)?'PRIVATE':'PUBLIC'}))));
    if(kind==='large'||provider){
      const now=Date.now();
      const capacityScope=org?{provider_organization_id:org}:{provider_profile_id:provider};
      // These paging signals are current writes after their explicit assignments;
      // no age-filter scenario or newly assigned pair inherits an older signal.
      checked(await service.from('capacities').insert(activeVehicles.filter((_,index)=>index!==104).map((vehicle,index)=>({
        ...capacityScope,vehicle_id:vehicle.id,status:index===103?'OFF_DUTY':'EMPTY',available_percent:index===103?0:100,
        visibility:index===101?'PRIVATE':index===102?'SAVED_PARTNERS':'OPEN',market_status:index===103?'OFF_DUTY':'EMPTY',
        location_area:index===101?'Private hidden area':'Around Addis Ababa',location_updated_at:new Date(now).toISOString(),location_lat:9.03,location_lng:38.74,
        location_precision_km:20,location_source:'DEVICE_OBSCURED',accepts_full_load:true,accepts_partial_load:false,updated_by:driverByTruck.get(vehicle.id),
        updated_at:new Date(now).toISOString(),expires_at:new Date(now+86400000).toISOString(),availability_geometry:'ROUTE',work_radius_km:30,
        current_route_origin:'Addis Ababa',current_route_destination:'Bishoftu',current_origin_lat:9.03,current_origin_lng:38.74,current_destination_lat:8.75,current_destination_lng:38.99,
        current_route_points_json:[{label:'Addis Ababa',lat:9.03,lng:38.74},{label:'Bishoftu',lat:8.75,lng:38.99}]
      }))));
    }
    checkpoint('PUBLIC_PROFILE');const pages=Math.ceil(count/12);await page.goto(`/@${handle}`);
    await expect(page.locator('.provider-hero-facts')).toContainText(`${count} active ${count===1?'vehicle':'vehicles'}`);
    const seen=new Set<string>();const cards=page.locator('.provider-truck-card');const nav=page.getByRole('navigation',{name:'Results pages',exact:true});
    const details=page.locator('.provider-fleet-disclosure');
    const information=page.locator('.provider-site-overview-grid');
    const regular=page.locator('.provider-corridor-list');
    await expect(regular).toHaveCount(0);
    await expect(page.locator('.provider-services,.provider-microsite-safety')).toHaveCount(0);
    const mapAction=page.getByRole('link',{name:'See vehicles on the map',exact:true});
    await expect(mapAction).toHaveAttribute('href',`/?provider=${handle}`);
    await mapAction.scrollIntoViewIfNeeded();await mapAction.click({trial:true});
    await expect(information).toBeVisible();
    if(count>1){
      await expect(details).not.toHaveAttribute('open','');await expect(cards.first()).not.toBeVisible();await expect(nav).not.toBeVisible();
      await page.screenshot({path:info.outputPath(`${kind}-profile-collapsed.png`),fullPage:true});
      await details.locator(':scope > summary').click();await expect(cards.first()).toBeVisible();
      await details.locator(':scope > summary').click();await expect(cards.first()).not.toBeVisible();
      await details.locator(':scope > summary').focus();await page.keyboard.press('Enter');await expect(cards.first()).toBeVisible();
    }else{
      await expect(details).toHaveCount(0);await expect(cards).toHaveCount(1);await expect(cards.first()).toBeVisible();await expect(nav).toHaveCount(0);
    }
    const ownerSections=await page.locator('.provider-site-overview-grid,.provider-site-lower-grid').evaluateAll((nodes:Element[])=>nodes.map(node=>node.getBoundingClientRect().bottom+scrollY));
    const fleetTop=await page.locator('#provider-trucks').evaluate((node:Element)=>node.getBoundingClientRect().top+scrollY);
    expect(ownerSections.every((bottom:number)=>bottom<=fleetTop)).toBe(true);
    expect(await mapAction.evaluate((node:Element)=>node.getBoundingClientRect().bottom+scrollY)).toBeLessThanOrEqual(fleetTop);
    const preservedLegacy=checked(await service.from('profile_routes').select('origin').eq(org?'organization_id':'provider_profile_id',org||provider));
    expect(preservedLegacy).toEqual([{origin:'Regular origin'}]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`${kind}-profile-fleet.png`),fullPage:true});

    for(let current=1;current<=pages;current++){
      checkpoint(`PAGE_${current}`);
      if(pages>1)await expect(nav).toContainText(`Page ${current} of ${pages} · ${count} results`);
      await expect(regular).toHaveCount(0);
      await expect(page.locator('.provider-services,.provider-microsite-safety')).toHaveCount(0);
      await expect(mapAction).toHaveAttribute('href',`/?provider=${handle}`);
      await expect(cards).toHaveCount(Math.min(12,count-(current-1)*12));
      await expect(page.locator('.provider-handle')).toContainText('Transport Provider');
      for(const card of await cards.all()){
        const text=await card.innerText();const match=text.match(new RegExp(`PG-${suffix}-\\d{3}`));expect(match).not.toBeNull();
        expect(seen.has(match![0])).toBe(false);seen.add(match![0]);
      }
      if(current<pages){await nav.getByRole('link',{name:'Next page',exact:true}).click();await expect(page).toHaveURL(new RegExp(`/@${handle}\\?truckPage=${current+1}#provider-trucks$`));}
    }
    expect(seen.size).toBe(count);
    await expect(page.locator('.provider-truck-card').filter({hasText:'Regular origin'})).toHaveCount(0);
    checkpoint('PUBLIC_PRIVACY');const html=await page.content();for(const hidden of [`PRIVATE-PLATE-${suffix}`,'PRIVATE-ACCOUNT-PHONE','PRIVATE-LAST-NAME','PRIVATE-WHATSAPP','private-website.invalid','hidden-business@example.invalid','Private hidden area','synthetic-private-paging-proof'])expect(html.includes(hidden),`Private field appeared in public HTML: ${hidden.replace(suffix,'fixture')}`).toBe(false);
    if(kind==='large'){
      await expect(page.locator('.provider-fleet-counts')).toContainText('5 with published capacity');
      const finalAvailable=cards.filter({hasText:vehicles[100].platform_number});
      await expect(finalAvailable.getByRole('button',{name:'View capacity on map',exact:true})).toBeVisible();
      await finalAvailable.getByRole('button',{name:'View capacity on map',exact:true}).click();
      await expect(finalAvailable.locator('.leaflet-container')).toBeVisible({timeout:30000});
      await finalAvailable.locator('.leaflet-container').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(captures,`${info.project.name}-last-capacity-map.png`),scale:'css'});
      for(const index of [101,102,103,104])await expect(cards.filter({hasText:vehicles[index].platform_number}).getByRole('link',{name:'Ask about this vehicle',exact:true})).toBeVisible();
    }
    checkpoint('PAGING_BOUNDARIES');if(pages>1){
    await nav.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(captures,`${info.project.name}-${kind}-last-page.png`),scale:'css'});
    await expect(nav.getByRole('link',{name:'Next page',exact:true})).toHaveCount(0);
    await nav.getByRole('link',{name:'Previous page',exact:true}).click();await expect(nav).toContainText(`Page ${pages-1} of ${pages}`);
    await page.goBack();await expect(nav).toContainText(`Page ${pages} of ${pages}`);
    for(const invalid of ['-1','1.5','2147483648','2&truckPage=3']){await page.goto(`/@${handle}?truckPage=${invalid}`);await expect(nav).toContainText(`Page 1 of ${pages}`);}
    await page.goto(`/@${handle}?truckPage=2147483647`);await expect(nav).toContainText(`Page ${pages} of ${pages}`);
    }
    checkpoint('UNPUBLISHED_DENIAL');checked(await service.from('company_pages').update({published:false}).eq(org?'organization_id':'provider_profile_id',org||provider));
    // The existing streamed layout can send 200 before notFound renders.
    await page.goto(`/@${handle}?truckPage=2`);
    await expect(page.getByRole('heading',{name:'404',exact:true})).toBeVisible();
    await expect(page.locator('.provider-microsite')).toHaveCount(0);
    await expect(cards).toHaveCount(0);
    expect(await page.content()).not.toContain(`PG-${suffix}-`);checkpoint('COMPLETE');
  }catch(error){bodyFailed=true;bodyError=error;failedStage=stage;try{evidence();}catch{/* Preserve the original assertion even if writing evidence fails. */}}
  finally{
    // Extend the runner budget once; every cleanup HTTP request also shares one
    // fixed deadline, including Auth and Storage. Never replace a body failure.
    test.setTimeout(info.timeout+90_000);cleanupDeadline=Date.now()+90_000;
    const cleanupCheckpoint=(next:string)=>{cleanupStage=next;evidence();};
    try{
      cleanupCheckpoint('PRIVATE_PROOFS');for(const batch of batches(proofPaths))checked(await service.storage.from('verification').remove(batch));
      const vehicleIds=vehicles.map(vehicle=>vehicle.id),actorIds=[actor,...driverIds].filter(Boolean);
      const entities=[...new Set([...requestIds,...reviewIds,...vehicleIds,...driverIds,...invitationIds,actor,org||provider].filter(Boolean))];
      cleanupCheckpoint('ENTITY_AUDITS');for(const batch of batches(entities))checked(await service.from('audit_logs').delete().in('entity_id',batch));
      // service_role deliberately cannot DELETE authority facts. Delete only
      // these recorded sources; their FK cascades facts before truck deletion.
      cleanupCheckpoint('OWN_SOURCES_AND_FACTS');for(const batch of batches(requestIds))checked(await service.from('verification_requests').delete().in('id',batch).eq('submitted_by',actor));
      for(const batch of batches(reviewIds))expect(checked(await service.from('provider_vehicle_authority_reviews').select('id').in('id',batch))).toHaveLength(0);
      cleanupCheckpoint('OWN_CAPACITIES');for(const batch of batches(vehicleIds))checked(await service.from('capacities').delete().in('vehicle_id',batch));
      cleanupCheckpoint('OWN_INVITATIONS');for(const batch of batches(invitationIds))checked(await service.from('fleet_driver_invitations').delete().in('id',batch).eq('invited_by',actor));
      cleanupCheckpoint('OWN_TRUCKS');for(const batch of batches(vehicleIds))checked(await auditDeleteVehicles(service,'id',batch));
      cleanupCheckpoint('OWN_PROVIDER_SCOPE');if(org||provider){const column=org?'organization_id':'provider_profile_id';const id=org||provider;
        checked(await service.from('company_pages').delete().eq(column,id));
        if(org){checked(await service.from('organization_members').delete().eq('organization_id',org));checked(await service.from('organizations').delete().eq('id',org));}
        if(provider)checked(await service.from('provider_profiles').delete().eq('id',provider));
      }
      cleanupCheckpoint('ACTOR_AUDITS');for(const batch of batches(actorIds))checked(await service.from('audit_logs').delete().in('actor_user_id',batch));
      cleanupCheckpoint('OWN_AUTH_IDENTITIES');for(const driver of driverIds)checked(await service.auth.admin.deleteUser(driver));
      if(actor)checked(await service.auth.admin.deleteUser(actor));
      cleanupCheckpoint('VERIFY_ABSENCE');for(const [table,ids] of [['vehicles',vehicleIds],['profiles',actorIds],['verification_requests',requestIds],['provider_vehicle_authority_reviews',reviewIds],['fleet_driver_invitations',invitationIds]] as const)
        for(const batch of batches(ids))expect(checked(await service.from(table).select('id').in('id',batch))).toHaveLength(0);
      cleanup=true;cleanupStage='COMPLETE';
    }catch(error){cleanupFailed=true;cleanupError=error;cleanupFailedStage=cleanupStage;}
    try{evidence();}catch(error){if(!cleanupFailed){cleanupFailed=true;cleanupError=error;cleanupFailedStage='EVIDENCE';}}
  }
  if(bodyFailed)throw bodyError;
  if(cleanupFailed)throw cleanupError;
});
