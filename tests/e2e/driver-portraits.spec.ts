import {auditDeleteVehicles} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {test,expect} from './browser-test';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {FEATURED_PROVIDER_DAY} from '../../src/lib/featured-trucks.js';
import {PROVIDER_REGIONS} from '../../src/lib/provider-regions.js';
import {removePrivateUpload} from '../../src/lib/private-storage.js';

function localService(){
  nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
  const endpoint=process.env.NEXT_PUBLIC_SUPABASE_URL||'';const url=new URL(endpoint);
  if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='55321')throw new Error('LOCAL_LOADGISTIC_REQUIRED');
  return createClient(endpoint,process.env.SUPABASE_SERVICE_ROLE_KEY||'',{auth:{persistSession:false,autoRefreshToken:false}});
}
function checked(result:any){expect(result.error).toBeNull();return result.data;}
async function login(page:any,email:string){
  const identity=checked(await localService().from('profiles').select('id').eq('email',email).single());
  await localSupportLogin(page,identity.id);await page.goto('/app/more',{waitUntil:'domcontentloaded'});
  await expect(page).toHaveURL(/\/app\/more(?:\?.*)?$/);await expect(page.locator('.app-main')).toBeVisible();
}
async function openPortrait(page:any){
 await page.getByRole('button',{name:'Change photo',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Driver photo',exact:true}).getByRole('region',{name:'Public Driver photo'})).toBeVisible();
}
async function openBusiness(page:any){
 if(new URL(page.url()).searchParams.get('tab')!=='profile')await page.goto('/app/more?tab=profile');
 const section=page.locator('#business');await expect(section).toBeVisible();
 await section.getByRole('button',{name:'Change photo',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Transporter image',exact:true});
 await expect(dialog.locator('.provider-image-editor')).toBeVisible();return dialog;
}
async function post(page:any,values:Record<string,string>){
  return page.evaluate(async(input:Record<string,string>)=>{
    const body=new FormData();for(const [key,value] of Object.entries(input))body.set(key,value);
    const response=await fetch('/api/account/portrait',{method:'POST',body});
    return {status:response.status,url:response.url};
  },values);
}
for(const kind of ['independent','company'])test(`${kind} Driver controls their public portrait while Featured keeps the provider's separate identity`,async({page,browser}:{page:any;browser:any},info:any)=>{
  test.setTimeout(150000);const service=localService();const suffix=randomUUID().slice(0,8);const ids:string[]=[];
  let actorId='';let orgId='';let providerId='';let vehicleId='';let slotId='';let ownedDay='';let originalSlot:any=null;
  let ownerEmail='';let companyPageId='';let providerImagePath='';let providerPreviewUrl='';
  const visitor=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize()||undefined});
  const publicPage=await visitor.newPage();
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Addis_Ababa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const driverName=`Portrait${suffix}`;
  const dir=path.resolve('artifacts/driver-portraits-2026-09-14');mkdirSync(dir,{recursive:true});
  async function identity(role:string,name:string){
    const email=`portrait-${role.toLowerCase()}-${suffix}@loadgistic.local`;
    const result=checked(await service.auth.admin.createUser({email,password:'Loadgistic123!',email_confirm:true}));
    const id=result.user.id;ids.push(id);
    checked(await service.from('profiles').update({active:true,role,full_name:role==='DRIVER'?`${name} PrivateSurname`:name,phone:'+251900000021'}).eq('id',id));return {id,email};
  }
  try{
    const driver=await identity('DRIVER',driverName);actorId=driver.id;
    let ownerId=actorId;
    const base=checked(await service.from('provider_profiles').select('city,city_place_ref').not('city_place_ref','is',null).limit(1).single());
    const region=checked(await service.from('company_pages').select('base_region_code').not('base_region_code','is',null).limit(1).single()).base_region_code;
    if(kind==='company'){
      const owner=await identity('TRANSPORTER',`Portrait Owner ${suffix}`);ownerId=owner.id;
      ownerEmail=owner.email;
      orgId=checked(await service.from('organizations').insert({name:`Portrait Fleet ${suffix}`,handle:`portrait-${suffix}`,type:'TRANSPORT_COMPANY',city:base.city,city_place_ref:base.city_place_ref}).select('id').single()).id;
      checked(await service.from('organization_members').insert([{user_id:ownerId,organization_id:orgId,membership_role:'OWNER'},{user_id:actorId,organization_id:orgId,membership_role:'DRIVER'}]));
      checked(await service.from('drivers').insert({user_id:actorId,organization_id:orgId,name:driverName,phone:'+251911111111'}));
      await login(page,owner.email);await page.goto('/app/more');
      await expect(page.getByRole('region',{name:'Public Driver photo'})).toHaveCount(0);
      expect((await post(page,{command:'REMOVE',actor_user_id:actorId})).status).toBe(403);
    }else{
      providerId=checked(await service.from('provider_profiles').insert({user_id:actorId,business_name:`Portrait Provider ${suffix}`,handle:`portrait-${suffix}`,city:base.city,city_place_ref:base.city_place_ref}).select('id').single()).id;
    }
    const scope=orgId?{organization_id:orgId}:{provider_profile_id:providerId};
    companyPageId=checked(await service.from('company_pages').insert({...scope,base_region_code:region,published:kind!=='company',contact_phone:'+251911111111',show_contact_phone:true,headline:kind==='company'?'Regional road freight':'PRIVATE-PERSONAL-HEADLINE',about:kind==='company'?'Road freight across regional routes.':'PRIVATE-PERSONAL-ABOUT',contact_email:`portrait-office-${suffix}@example.invalid`,show_contact_email:true}).select('id').single()).id;
    if(kind==='company'){
      await page.goto('/app/more');let business=await openBusiness(page);
      const providerBytes=await sharp({create:{width:420,height:360,channels:3,background:'#294f87'}}).png().toBuffer();
      await business.locator('#provider-profile-image').setInputFiles({name:'transporter-logo.png',mimeType:'image/png',buffer:providerBytes},{timeout:10000});
      await business.getByRole('button',{name:'Upload image',exact:true}).click({timeout:10000});
      await expect(page.getByRole('status').filter({hasText:'Provider image updated.'})).toBeVisible();business=await openBusiness(page);
      let providerPhoto=business.locator('.provider-image-editor img');await expect(providerPhoto).toBeVisible();
      await expect.poll(()=>providerPhoto.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
      const firstPreview=await providerPhoto.getAttribute('src');expect(firstPreview).toContain('/api/company-page/image?v=');expect(firstPreview).toContain(`preview=${companyPageId}`);
      const ownFirst=await page.context().request.get(firstPreview);expect(ownFirst.status()).toBe(200);expect(ownFirst.headers()['cache-control']).toBe('private, no-store');expect((ownFirst.headers()['vary']||'').split(',').map((value:string)=>value.trim().toLowerCase())).toContain('cookie');
      expect((await visitor.request.get(firstPreview)).status()).toBe(401);
      expect((await visitor.request.get(`/api/public/providers/portrait-${suffix}/image`)).status()).toBe(404);
      const replacement=await sharp({create:{width:480,height:320,channels:3,background:'#713a58'}}).png().toBuffer();
      await business.locator('#provider-profile-image').setInputFiles({name:'transporter-replacement.png',mimeType:'image/png',buffer:replacement},{timeout:10000});
      await business.getByRole('button',{name:'Replace image',exact:true}).click({timeout:10000});
      await expect(page.getByRole('status').filter({hasText:'Provider image updated.'})).toBeVisible();business=await openBusiness(page);providerPhoto=business.locator('.provider-image-editor img');
      await expect.poll(()=>providerPhoto.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
      providerPreviewUrl=(await providerPhoto.getAttribute('src'))!;expect(providerPreviewUrl).not.toBe(firstPreview);
      const ownNext=await page.context().request.get(providerPreviewUrl);expect(ownNext.status()).toBe(200);expect((await ownNext.body()).equals(await ownFirst.body())).toBe(false);
      expect((await visitor.request.get(`/api/public/providers/portrait-${suffix}/image`)).status()).toBe(404);
      await business.locator('.provider-image-editor').screenshot({path:info.outputPath('unpublished-transporter-image.png'),scale:'css'});
      providerImagePath=checked(await service.from('company_pages').select('profile_image_path').eq('id',companyPageId).single()).profile_image_path;
      await business.getByRole('button',{name:'Cancel',exact:true}).click();
      await page.locator('#business').getByRole('button',{name:'Edit profile',exact:true}).click();
      const profile=page.getByRole('dialog',{name:'Transporter profile',exact:true});
      await profile.locator('label.rich-toggle:has(input[name="published"])').click({timeout:10000});
      await expect(profile.locator('input[name="published"]')).toBeChecked();
      await profile.getByRole('button',{name:'Save transporter information',exact:true}).click({timeout:10000});
      await expect(page.locator('.alert.success')).toBeVisible();
      expect((await visitor.request.get(`/api/public/providers/portrait-${suffix}/image`)).status()).toBe(200);
    }
    const theme=FEATURED_PROVIDER_DAY;
    checked(await service.rpc('accept_content_policy',{actor_user_id:ownerId,policy_version:'2026-10-09'}));
    if(!orgId)checked(await service.rpc('set_provider_driving_mode',{actor_user_id:actorId,requested_drives_truck:true}));
    vehicleId=checked(await service.from('vehicles').insert({...scope,label:`Portrait test ${suffix}`,category:'TRUCK',make:'Test',model:'Portrait',cargo_configuration:'Mini Box Truck',plate:`PHOTO-${suffix}`,active:true}).select('id').single()).id;
    checked(await service.rpc('update_fleet_driver_access',{actor_user_id:ownerId,command:{driver_user_id:actorId,vehicle_id:vehicleId,can_manage_capacity:true,can_manage_tracking:true}}));
    checked(await service.rpc('set_provider_vehicle_publication',{actor_user_id:ownerId,target_vehicle_id:vehicleId,requested_state:'LIVE'}));
    // Explicit synthetic eligibility evidence for this test provider only; no real proof is implied.
    const evidence=orgId?['IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS']:['IDENTITY','DRIVER_IDENTITY','VEHICLE_OWNERSHIP'];
    checked(await service.from('verification_requests').insert(evidence.map(verification_type=>({
      subject_type:verification_type==='VEHICLE_OWNERSHIP'?'VEHICLE':orgId?'ORGANIZATION':'PROVIDER_PROFILE',
      subject_id:verification_type==='VEHICLE_OWNERSHIP'?vehicleId:orgId||providerId,verification_type,
      document_name:'Synthetic portrait browser fixture',storage_path:'synthetic-portrait-fixture',original_name:'fixture.txt',mime_type:'text/plain',status:'APPROVED',submitted_by:actorId
    }))));
    let day=checked(await service.from('featured_provider_days').select('id,status').eq('feature_date',date).maybeSingle());
    if(!day){day=checked(await service.from('featured_provider_days').insert({feature_date:date,status:'PUBLISHED',base_place_ref:base.city_place_ref,base_place_label:base.city,expo_group_key:theme.key,expo_group_label:theme.label,target_count:1,schedule_config_json:{dayStart:'08:30',dayEnd:'12:00',targetCount:1,sponsorBreakCount:4,sponsorBreakMinutes:2},created_by:actorId}).select('id,status').single());ownedDay=day.id;}
    expect(day.status).toBe('PUBLISHED');
    const slots=checked(await service.from('featured_provider_slots').select('*').eq('day_id',day.id).order('slot_position'));
    const synthetic={provider_organization_id:orgId||null,provider_profile_id:providerId||null,vehicle_id:vehicleId,driver_user_id:actorId,created_by:actorId};
    // Keep the official eight-showcase limit; temporarily substitute one local
    // fixture slot and restore it in finally instead of appending a ninth.
    if(slots.length>=8){originalSlot=slots.at(-1);slotId=originalSlot.id;checked(await service.from('featured_provider_slots').update(synthetic).eq('id',slotId));}
    else slotId=checked(await service.from('featured_provider_slots').insert({day_id:day.id,slot_position:Math.max(0,...slots.map((p:any)=>p.slot_position))+1,...synthetic}).select('id').single()).id;

    const candidates=checked(await service.rpc('public_featured_provider_candidates',{requested_region_codes:PROVIDER_REGIONS.map(item=>item.code)}));
    const candidate=candidates.find((row:any)=>orgId?row.provider_organization_id===orgId:row.provider_profile_id===providerId);
    expect(candidate,'synthetic provider must be present in the actual Featured projection').toBeTruthy();
    expect(candidate.eligible,'synthetic provider must satisfy the current Featured eligibility contract').toBe(true);

    await login(page,driver.email);await page.goto('/app/more');await openPortrait(page);
    if(kind==='company')expect((await page.context().request.get(providerPreviewUrl)).status()).toBe(403);
    const card=page.getByRole('dialog',{name:'Driver photo',exact:true}).getByRole('region',{name:'Public Driver photo'});await expect(card).toBeVisible();
    await expect(page.getByText('No plan assigned',{exact:true})).toHaveCount(0);
    const imageBytes=await sharp({create:{width:720,height:480,channels:3,background:'#155eef'}}).jpeg().withExif({IFD0:{Artist:'Synthetic private author'}}).toBuffer();
    const input=card.getByLabel('Choose photo');const consent=card.getByLabel('I agree to make this photo public.');
    await input.setInputFiles({name:'private-camera.jpg',mimeType:'image/jpeg',buffer:imageBytes});
    await card.getByRole('button',{name:'Upload Driver photo',exact:true}).click();
    await expect(consent).not.toBeChecked();expect(checked(await service.from('driver_portrait_uploads').select('id').eq('user_id',actorId))).toHaveLength(0);
    await consent.check();await card.getByRole('button',{name:'Upload Driver photo',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'Public Driver photo updated.'})).toBeVisible();await openPortrait(page);
    const photo=card.getByRole('img',{name:'Your public Driver photo'});await expect(photo).toBeVisible();
    await expect.poll(()=>photo.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth)).toBe(512);
    const firstUrl=await photo.getAttribute('src');
    const firstResponse=await visitor.request.get(firstUrl);expect(firstResponse.status()).toBe(200);
    expect(firstResponse.headers()['cache-control']).toBe('no-store');expect(firstResponse.headers()['x-content-type-options']).toBe('nosniff');
    const served=await sharp(await firstResponse.body()).metadata();expect(served.format).toBe('jpeg');expect(served.exif).toBeUndefined();
    const active=checked(await service.from('driver_portrait_uploads').select('id,file_path').eq('user_id',actorId).eq('state','ACTIVE').single());
    const objectPath=active.file_path.split('supabase://provider-profile/')[1];
    const raw=await visitor.request.get(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/provider-profile/${objectPath}`);expect(raw.ok()).toBe(false);
    await publicPage.goto('/featured');
    expect(await publicPage.content()).not.toContain('PrivateSurname');
    const tile=publicPage.locator('.featured-provider-tile').filter({hasText:`@portrait-${suffix}`});
    await expect(tile).toBeVisible();
    const providerPhoto=tile.locator('.featured-card-photo img');
    if(kind==='company')await expect(providerPhoto).toHaveAttribute('src',/\/api\/public\/providers\/portrait-/);
    else{await expect(providerPhoto).toHaveCount(0);await expect(tile.locator('.featured-card-photo svg')).toBeVisible();}
    await card.getByRole('button',{name:'Remove Driver photo',exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(dir,`${info.project.name}-${kind}-account.png`),fullPage:true,scale:'css'});
    await tile.screenshot({path:path.join(dir,`${info.project.name}-${kind}-featured.png`),scale:'css'});
    await publicPage.goto(`/@portrait-${suffix}`);
    await expect(publicPage.getByRole('heading',{name:kind==='company'?`Portrait Fleet ${suffix}`:driverName,exact:true})).toBeVisible();
    const providerIdentity=publicPage.locator('.provider-profile-image');await expect(providerIdentity).toHaveAttribute('data-identity-kind',kind==='company'?'company':'person');
    await expect(publicPage.locator('.public-truck-driver img')).toHaveAttribute('src',firstUrl);
    expect(await publicPage.content()).not.toContain('PrivateSurname');
    if(kind==='company'){
      await expect(providerIdentity.locator('img')).toHaveAttribute('alt',`Portrait Fleet ${suffix} transporter profile`);
      await expect.poll(()=>providerIdentity.locator('img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
      await expect(publicPage.getByText('Road freight across regional routes.',{exact:true})).toBeVisible();
      await expect(publicPage.locator('#provider-contacts').getByRole('link',{name:/Email/})).toHaveAttribute('href',`mailto:portrait-office-${suffix}@example.invalid`);
    }else{
      await expect(providerIdentity.locator('img')).toHaveCount(0);
      for(const hidden of ['PRIVATE-PERSONAL-HEADLINE','PRIVATE-PERSONAL-ABOUT',`portrait-office-${suffix}@example.invalid`])expect(await publicPage.content()).not.toContain(hidden);
    }
    await publicPage.screenshot({path:info.outputPath(`${kind}-public-profile.png`),fullPage:true,scale:'css'});
    await publicPage.goto('/featured');await expect(tile).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    // A forged target is rejected; the current photo and bytes remain available.
    const forged=await post(page,{command:'REMOVE',actor_user_id:randomUUID()});expect(new URL(forged.url).searchParams.get('error')).toContain('not available');
    expect((await visitor.request.get(firstUrl)).status()).toBe(200);
    await page.reload();await openPortrait(page);await input.setInputFiles({name:'broken.jpg',mimeType:'image/jpeg',buffer:Buffer.from('not an image')});await consent.check();
    await card.getByRole('button',{name:'Replace Driver photo',exact:true}).click();
    await expect(page.getByRole('alert').filter({hasText:'valid, still'})).toBeVisible();await openPortrait(page);await expect(photo).toHaveAttribute('src',firstUrl);
    const replacement=await sharp({create:{width:480,height:640,channels:3,background:'#ca962d'}}).png().toBuffer();
    await input.setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:replacement});await consent.check();
    await card.getByRole('button',{name:'Replace Driver photo',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'Public Driver photo updated.'})).toBeVisible();await openPortrait(page);
    const nextUrl=await photo.getAttribute('src');expect(nextUrl).not.toBe(firstUrl);
    expect((await visitor.request.get(firstUrl)).status()).toBe(404);expect((await visitor.request.get(nextUrl)).status()).toBe(200);
    checked(await service.from('profiles').update({active:false}).eq('id',actorId));
    expect((await visitor.request.get(nextUrl)).status()).toBe(404);expect((await post(page,{command:'REMOVE'})).status).toBe(401);
    checked(await service.from('profiles').update({active:true}).eq('id',actorId));
    await page.reload();await openPortrait(page);await card.getByRole('button',{name:'Remove Driver photo',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'Driver photo removed.'})).toBeVisible();await openPortrait(page);await expect(photo).toHaveCount(0);
    expect((await visitor.request.get(nextUrl)).status()).toBe(404);
    await publicPage.reload();await expect(tile).toBeVisible();
    if(kind==='company')await expect(tile.locator('.featured-card-photo img')).toHaveAttribute('src',/\/api\/public\/providers\/portrait-/);
    else await expect(tile.locator('.featured-card-photo img')).toHaveCount(0);
    expect(checked(await service.from('driver_portrait_uploads').select('id').eq('user_id',actorId))).toHaveLength(0);
    if(kind==='company'){
      expect(checked(await service.from('company_pages').select('profile_image_path').eq('id',companyPageId).single()).profile_image_path).toBe(providerImagePath);
      await login(page,ownerEmail);await page.goto('/app/more');const business=await openBusiness(page);
      await business.locator('.provider-image-editor').getByRole('button',{name:'Remove',exact:true}).click({timeout:10000});
      await expect(page.getByRole('status').filter({hasText:'Provider image removed.'})).toBeVisible();
      expect(checked(await service.from('company_pages').select('profile_image_path').eq('id',companyPageId).single()).profile_image_path).toBeNull();
      expect((await page.context().request.get(providerPreviewUrl)).status()).toBe(404);expect((await visitor.request.get(`/api/public/providers/portrait-${suffix}/image`)).status()).toBe(404);
    }
    await page.context().clearCookies();await page.goto('/about');expect((await post(page,{command:'REMOVE'})).status).toBe(401);
  }finally{
    await visitor.close();
    if(originalSlot)checked(await service.from('featured_provider_slots').update(originalSlot).eq('id',slotId));
    else if(slotId)checked(await service.from('featured_provider_slots').delete().eq('id',slotId));
    if(ownedDay)checked(await service.from('featured_provider_days').delete().eq('id',ownedDay));
    if(actorId){
      const uploads=checked(await service.from('driver_portrait_uploads').select('file_path').eq('user_id',actorId));
      for(const row of uploads)await removePrivateUpload(row.file_path);
      checked(await service.from('driver_portrait_uploads').delete().eq('user_id',actorId));
      checked(await service.from('verification_requests').delete().eq('submitted_by',actorId));
    }
    if(vehicleId){
      checked(await service.from('capacities').delete().eq('vehicle_id',vehicleId));
      checked(await service.from('driver_vehicle_assignments').delete().eq('vehicle_id',vehicleId));
      checked(await auditDeleteVehicles(service,'id',vehicleId));
    }
    if(companyPageId){
      const pageImage=checked(await service.from('company_pages').select('profile_image_path').eq('id',companyPageId).maybeSingle());
      if(pageImage?.profile_image_path)await removePrivateUpload(pageImage.profile_image_path);
    }
    if(ids.length)checked(await service.from('audit_logs').delete().in('actor_user_id',ids));
    if(orgId)checked(await service.from('organizations').delete().eq('id',orgId));
    for(const id of ids)checked(await service.auth.admin.deleteUser(id));
  }
});
