import {test,expect} from '@playwright/test';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {featuredTruckTypeForDate} from '../../src/lib/featured-trucks.js';
import {removePrivateUpload} from '../../src/lib/private-storage.js';

function localService(){
  nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
  const endpoint=process.env.NEXT_PUBLIC_SUPABASE_URL||'';const url=new URL(endpoint);
  if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='55321')throw new Error('LOCAL_LOADGISTIC_REQUIRED');
  return createClient(endpoint,process.env.SUPABASE_SERVICE_ROLE_KEY||'',{auth:{persistSession:false,autoRefreshToken:false}});
}
function checked(result:any){expect(result.error).toBeNull();return result.data;}
async function login(page:any,email:string){
  await page.context().clearCookies();await page.goto('/login');await page.locator('details.auth-fixture-login>summary').click();
  const form=page.getByTestId('login-form');await form.getByLabel('Email',{exact:true}).fill(email);
  await form.getByLabel('Password').fill('Loadgistic123!');await form.getByRole('button',{name:'Log in',exact:true}).click();
  await expect(page).toHaveURL(/\/app\/home(?:\?.*)?$/);await expect(page.locator('.app-main')).toBeVisible();
}
async function post(page:any,values:Record<string,string>){
  return page.evaluate(async(input:Record<string,string>)=>{
    const body=new FormData();for(const [key,value] of Object.entries(input))body.set(key,value);
    const response=await fetch('/api/account/portrait',{method:'POST',body});
    return {status:response.status,url:response.url};
  },values);
}
for(const kind of ['independent','company'])test(`${kind} Driver controls their public portrait through real Storage and Featured`,async({page,browser}:{page:any;browser:any},info:any)=>{
  test.setTimeout(150000);const service=localService();const suffix=randomUUID().slice(0,8);const ids:string[]=[];
  let actorId='';let orgId='';let providerId='';let vehicleId='';let slotId='';let ownedDay='';
  const visitor=await browser.newContext({baseURL:info.project.use.baseURL,viewport:page.viewportSize()||undefined});
  const publicPage=await visitor.newPage();
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Addis_Ababa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const driverName=`Portrait${suffix}`;
  const dir=path.resolve('artifacts/driver-portraits-2026-09-14');mkdirSync(dir,{recursive:true});
  async function identity(role:string,name:string){
    const email=`portrait-${role.toLowerCase()}-${suffix}@loadgistic.local`;
    const result=checked(await service.auth.admin.createUser({email,password:'Loadgistic123!',email_confirm:true}));
    const id=result.user.id;ids.push(id);
    checked(await service.from('profiles').update({active:true,role,full_name:name,phone:'+251900000021'}).eq('id',id));return {id,email};
  }
  try{
    const driver=await identity('DRIVER',driverName);actorId=driver.id;
    let ownerId=actorId;
    const base=checked(await service.from('provider_profiles').select('city,city_place_ref').not('city_place_ref','is',null).limit(1).single());
    const region=checked(await service.from('company_pages').select('base_region_code').not('base_region_code','is',null).limit(1).single()).base_region_code;
    if(kind==='company'){
      const owner=await identity('TRANSPORTER',`Portrait Owner ${suffix}`);ownerId=owner.id;
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
    checked(await service.from('company_pages').insert({...scope,base_region_code:region,published:true,contact_phone:'+251911111111',show_contact_phone:true}));
    const theme=featuredTruckTypeForDate(date);
    vehicleId=checked(await service.from('vehicles').insert({...scope,label:`Portrait test ${suffix}`,category:'TRUCK',make:'Test',model:'Portrait',cargo_configuration:theme.configurations[0],plate:`PHOTO-${suffix}`,active:true}).select('id').single()).id;
    if(orgId)checked(await service.from('driver_vehicle_assignments').insert({vehicle_id:vehicleId,driver_user_id:actorId,assigned_by:ownerId}));
    // Explicit synthetic eligibility evidence for this test provider only; no real proof is implied.
    const evidence=orgId?['IDENTITY','BUSINESS_LICENSE','BUSINESS_ADDRESS']:['IDENTITY','DRIVER_IDENTITY','VEHICLE_OWNERSHIP'];
    checked(await service.from('verification_requests').insert(evidence.map(verification_type=>({
      subject_type:orgId?'ORGANIZATION':'PROVIDER_PROFILE',subject_id:orgId||providerId,verification_type,
      document_name:'Synthetic portrait browser fixture',storage_path:'synthetic-portrait-fixture',original_name:'fixture.txt',mime_type:'text/plain',status:'APPROVED',submitted_by:actorId
    }))));
    let day=checked(await service.from('featured_provider_days').select('id,status').eq('feature_date',date).maybeSingle());
    if(!day){day=checked(await service.from('featured_provider_days').insert({feature_date:date,status:'PUBLISHED',base_place_ref:base.city_place_ref,base_place_label:base.city,created_by:actorId}).select('id,status').single());ownedDay=day.id;}
    expect(day.status).toBe('PUBLISHED');
    const positions=checked(await service.from('featured_provider_slots').select('slot_position').eq('day_id',day.id));
    slotId=checked(await service.from('featured_provider_slots').insert({day_id:day.id,slot_position:Math.max(0,...positions.map((p:any)=>p.slot_position))+1,
      provider_organization_id:orgId||null,provider_profile_id:providerId||null,vehicle_id:vehicleId,driver_user_id:actorId,created_by:actorId}).select('id').single()).id;

    await login(page,driver.email);await page.goto('/app/more');
    const card=page.getByRole('region',{name:'Public Driver photo'});await expect(card).toBeVisible();
    await expect(page.getByText('No plan assigned',{exact:true})).toBeVisible();
    const imageBytes=await sharp({create:{width:720,height:480,channels:3,background:'#06787c'}}).jpeg().withExif({IFD0:{Artist:'Synthetic private author'}}).toBuffer();
    const input=card.getByLabel('Choose photo');const consent=card.getByLabel('I agree to make this photo public.');
    await input.setInputFiles({name:'private-camera.jpg',mimeType:'image/jpeg',buffer:imageBytes});
    await card.getByRole('button',{name:'Upload Driver photo',exact:true}).click();
    await expect(consent).not.toBeChecked();expect(checked(await service.from('driver_portrait_uploads').select('id').eq('user_id',actorId))).toHaveLength(0);
    await consent.check();await card.getByRole('button',{name:'Upload Driver photo',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'Public Driver photo updated.'})).toBeVisible();
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
    const tile=publicPage.getByRole('button',{name:new RegExp(`^Driver ${driverName},`)});
    await expect(tile).toBeVisible();await expect(tile.locator('.featured-card-photo>img')).toHaveAttribute('src',firstUrl);
    await expect.poll(()=>tile.locator('.featured-card-photo>img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth)).toBe(512);
    await card.getByRole('button',{name:'Remove Driver photo',exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(dir,`${info.project.name}-${kind}-account.png`),fullPage:true,scale:'css'});
    await tile.screenshot({path:path.join(dir,`${info.project.name}-${kind}-featured.png`),scale:'css'});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    // A forged target is rejected; the current photo and bytes remain available.
    const forged=await post(page,{command:'REMOVE',actor_user_id:randomUUID()});expect(new URL(forged.url).searchParams.get('error')).toContain('not available');
    expect((await visitor.request.get(firstUrl)).status()).toBe(200);
    await page.reload();await input.setInputFiles({name:'broken.jpg',mimeType:'image/jpeg',buffer:Buffer.from('not an image')});await consent.check();
    await card.getByRole('button',{name:'Replace Driver photo',exact:true}).click();
    await expect(page.getByRole('alert').filter({hasText:'valid, still'})).toBeVisible();await expect(photo).toHaveAttribute('src',firstUrl);
    const replacement=await sharp({create:{width:480,height:640,channels:3,background:'#ca962d'}}).png().toBuffer();
    await input.setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:replacement});await consent.check();
    await card.getByRole('button',{name:'Replace Driver photo',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'Public Driver photo updated.'})).toBeVisible();
    const nextUrl=await photo.getAttribute('src');expect(nextUrl).not.toBe(firstUrl);
    expect((await visitor.request.get(firstUrl)).status()).toBe(404);expect((await visitor.request.get(nextUrl)).status()).toBe(200);
    checked(await service.from('profiles').update({active:false}).eq('id',actorId));
    expect((await visitor.request.get(nextUrl)).status()).toBe(404);expect((await post(page,{command:'REMOVE'})).status).toBe(401);
    checked(await service.from('profiles').update({active:true}).eq('id',actorId));
    await page.reload();await card.getByRole('button',{name:'Remove Driver photo',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'Driver photo removed.'})).toBeVisible();await expect(photo).toHaveCount(0);
    expect((await visitor.request.get(nextUrl)).status()).toBe(404);
    await publicPage.reload();await expect(tile.locator('.driver-portrait-fallback')).toBeVisible();
    expect(checked(await service.from('driver_portrait_uploads').select('id').eq('user_id',actorId))).toHaveLength(0);
    await page.context().clearCookies();await page.goto('/about');expect((await post(page,{command:'REMOVE'})).status).toBe(401);
  }finally{
    await visitor.close();
    if(slotId)checked(await service.from('featured_provider_slots').delete().eq('id',slotId));
    if(ownedDay)checked(await service.from('featured_provider_days').delete().eq('id',ownedDay));
    if(actorId){
      const uploads=checked(await service.from('driver_portrait_uploads').select('file_path').eq('user_id',actorId));
      for(const row of uploads)await removePrivateUpload(row.file_path);
      checked(await service.from('driver_portrait_uploads').delete().eq('user_id',actorId));
      checked(await service.from('verification_requests').delete().eq('submitted_by',actorId));
    }
    if(vehicleId)checked(await service.from('vehicles').delete().eq('id',vehicleId));
    if(orgId)checked(await service.from('organizations').delete().eq('id',orgId));
    if(ids.length)checked(await service.from('audit_logs').delete().in('actor_user_id',ids));
    for(const id of ids)checked(await service.auth.admin.deleteUser(id));
  }
});
