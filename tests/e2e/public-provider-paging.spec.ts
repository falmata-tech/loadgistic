import {test,expect} from '@playwright/test';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

function localService(){
  nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
  const endpoint=process.env.NEXT_PUBLIC_SUPABASE_URL||'';const url=new URL(endpoint);
  if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='55321')throw new Error('LOCAL_LOADGISTIC_REQUIRED');
  return createClient(endpoint,process.env.SUPABASE_SERVICE_ROLE_KEY||'',{auth:{persistSession:false,autoRefreshToken:false}});
}
function checked(result:any){expect(result.error).toBeNull();return result.data;}
for(const kind of ['independent','company','single'])test(`public ${kind} fleet pages reach every truck with scoped capacity`,async({page}:{page:any},info:any)=>{
  test.setTimeout(150000);const service=localService();const suffix=randomUUID().slice(0,8);const handle=`paging-${suffix}`;
  const count=kind==='independent'?105:kind==='single'?1:13;let actor='';let provider='';let org='';let vehicles:any[]=[];
  const captures=path.resolve('artifacts/public-fleet-paging-2026-09-14');mkdirSync(captures,{recursive:true});
  try{
    actor=checked(await service.auth.admin.createUser({email:`paging-${suffix}@loadgistic.local`,email_confirm:true})).user.id;
    checked(await service.from('profiles').update({active:true,role:kind==='independent'?'DRIVER':'TRANSPORTER',full_name:`Paging${suffix} PRIVATE-LAST-NAME`,phone:'PRIVATE-ACCOUNT-PHONE'}).eq('id',actor));
    if(kind!=='company')provider=checked(await service.from('provider_profiles').insert({user_id:actor,business_name:`Paging ${suffix}`,handle,city:'Addis Ababa'}).select('id').single()).id;
    else{
      org=checked(await service.from('organizations').insert({name:`Paging ${suffix}`,handle,type:'TRANSPORT_COMPANY',city:'Addis Ababa'}).select('id').single()).id;
      checked(await service.from('organization_members').insert({organization_id:org,user_id:actor,membership_role:'OWNER'}));
    }
    const scope=org?{organization_id:org}:{provider_profile_id:provider};
    const region=checked(await service.from('company_pages').select('base_region_code').not('base_region_code','is',null).limit(1).single()).base_region_code;
    checked(await service.from('company_pages').insert({...scope,published:true,base_region_code:region,contact_phone:'+251911111111',show_contact_phone:true,contact_email:'hidden-business@example.invalid',show_contact_email:false,contact_whatsapp:'PRIVATE-WHATSAPP',show_contact_whatsapp:false,contact_website:'https://private-website.invalid',show_contact_website:false}));
    vehicles=checked(await service.from('vehicles').insert(Array.from({length:count+1},(_,index)=>({...scope,platform_number:`PG-${suffix}-${String(index+1).padStart(3,'0')}`,label:'Synthetic paging truck',category:'TRUCK',make:'Test',model:'Paging',cargo_configuration:'Heavy rigid',plate:`PRIVATE-PLATE-${suffix}`,active:index<count}))).select('id,platform_number').order('platform_number'));
    checked(await service.from('profile_routes').insert({...scope,origin:'Regular origin',destination:'Regular destination',geometry:'ROUTE',route_points_json:[{label:'Regular origin',lat:9.03,lng:38.74},{label:'Regular destination',lat:8.75,lng:38.99}]}));
    if(provider){
      const now=Date.now();
      checked(await service.from('capacities').insert(vehicles.filter((_,index)=>index!==104).map((vehicle,index)=>({
        provider_profile_id:provider,vehicle_id:vehicle.id,status:index===103?'OFF_DUTY':'EMPTY',available_percent:index===103?0:100,
        visibility:index===101?'PRIVATE':index===102?'SAVED_PARTNERS':'OPEN',market_status:index===103?'OFF_DUTY':'EMPTY',
        location_area:index===101?'Private hidden area':'Around Addis Ababa',location_updated_at:new Date(now).toISOString(),location_lat:9.03,location_lng:38.74,
        location_precision_km:20,location_source:'DEVICE_OBSCURED',accepts_full_load:true,accepts_partial_load:false,updated_by:actor,
        updated_at:new Date(now-index*1000).toISOString(),expires_at:new Date(now+86400000).toISOString(),availability_geometry:'ROUTE',work_radius_km:30,
        current_route_origin:'Addis Ababa',current_route_destination:'Bishoftu',current_origin_lat:9.03,current_origin_lng:38.74,current_destination_lat:8.75,current_destination_lng:38.99,
        current_route_points_json:[{label:'Addis Ababa',lat:9.03,lng:38.74},{label:'Bishoftu',lat:8.75,lng:38.99}]
      }))));
      checked(await service.from('verification_requests').insert({subject_type:'VEHICLE',subject_id:vehicles[Math.min(99,count-1)].id,verification_type:'VEHICLE_OWNERSHIP',document_name:'Synthetic paging evidence',storage_path:'synthetic-private-paging-proof',original_name:'fixture.txt',mime_type:'text/plain',status:'APPROVED',submitted_by:actor}));
    }
    const pages=Math.ceil(count/12);await page.goto(`/@${handle}`);
    await expect(page.locator('.provider-hero-facts')).toContainText(`${count} active ${count===1?'truck':'trucks'}`);
    const seen=new Set<string>();const cards=page.locator('.provider-truck-card');const nav=page.getByRole('navigation',{name:'Results pages',exact:true});
    const details=page.locator('.provider-fleet-disclosure');
    const information=page.locator('.provider-site-overview-grid');
    const regular=page.locator('.provider-corridor-list');
    await expect(regular).toContainText('Regular origin ↔ Regular destination');
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
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`${kind}-profile-fleet.png`),fullPage:true});

    for(let current=1;current<=pages;current++){
      if(pages>1)await expect(nav).toContainText(`Page ${current} of ${pages} · ${count} results`);
      await expect(regular).toContainText('Regular origin ↔ Regular destination');
      await expect(cards).toHaveCount(Math.min(12,count-(current-1)*12));
      if(provider)await expect(page.locator('.provider-handle')).toContainText('Owner-operator');
      for(const card of await cards.all()){
        const text=await card.innerText();const match=text.match(new RegExp(`PG-${suffix}-\\d{3}`));expect(match).not.toBeNull();
        expect(seen.has(match![0])).toBe(false);seen.add(match![0]);
      }
      if(current<pages){await nav.getByRole('link',{name:'Next page',exact:true}).click();await expect(page).toHaveURL(new RegExp(`/@${handle}\\?truckPage=${current+1}#provider-trucks$`));}
    }
    expect(seen.size).toBe(count);
    const html=await page.content();for(const hidden of [`PRIVATE-PLATE-${suffix}`,'PRIVATE-ACCOUNT-PHONE','PRIVATE-LAST-NAME','PRIVATE-WHATSAPP','private-website.invalid','hidden-business@example.invalid','Private hidden area','synthetic-private-paging-proof'])expect(html.includes(hidden),`Private field appeared in public HTML: ${hidden.replace(suffix,'fixture')}`).toBe(false);
    if(provider&&count>1){
      await expect(page.locator('.provider-fleet-counts')).toContainText('5 signals on this page');
      const finalAvailable=cards.filter({hasText:vehicles[100].platform_number});
      await expect(finalAvailable.getByRole('button',{name:'View capacity on map',exact:true})).toBeVisible();
      await finalAvailable.getByRole('button',{name:'View capacity on map',exact:true}).click();
      await expect(finalAvailable.locator('.leaflet-container')).toBeVisible({timeout:30000});
      await finalAvailable.locator('.leaflet-container').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(captures,`${info.project.name}-last-capacity-map.png`),scale:'css'});
      for(const index of [101,102,103,104])await expect(cards.filter({hasText:vehicles[index].platform_number}).getByRole('link',{name:'Ask about this truck',exact:true})).toBeVisible();
    }
    if(pages>1){
    await nav.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(captures,`${info.project.name}-${kind}-last-page.png`),scale:'css'});
    await expect(nav.getByRole('link',{name:'Next page',exact:true})).toHaveCount(0);
    await nav.getByRole('link',{name:'Previous page',exact:true}).click();await expect(nav).toContainText(`Page ${pages-1} of ${pages}`);
    await page.goBack();await expect(nav).toContainText(`Page ${pages} of ${pages}`);
    for(const invalid of ['-1','1.5','2147483648','2&truckPage=3']){await page.goto(`/@${handle}?truckPage=${invalid}`);await expect(nav).toContainText(`Page 1 of ${pages}`);}
    await page.goto(`/@${handle}?truckPage=2147483647`);await expect(nav).toContainText(`Page ${pages} of ${pages}`);
    }
    checked(await service.from('company_pages').update({published:false}).eq(org?'organization_id':'provider_profile_id',org||provider));
    // The existing streamed layout can send 200 before notFound renders.
    await page.goto(`/@${handle}?truckPage=2`);
    await expect(page.getByRole('heading',{name:'404',exact:true})).toBeVisible();
    await expect(page.locator('.provider-microsite')).toHaveCount(0);
    await expect(cards).toHaveCount(0);
    expect(await page.content()).not.toContain(`PG-${suffix}-`);
  }finally{
    if(actor)checked(await service.from('verification_requests').delete().eq('submitted_by',actor));
    if(actor)checked(await service.from('capacities').delete().eq('updated_by',actor));
    if(org||provider){const column=org?'organization_id':'provider_profile_id';const id=org||provider;
      checked(await service.from('vehicles').delete().eq(column,id));checked(await service.from('company_pages').delete().eq(column,id));
      if(org){checked(await service.from('organization_members').delete().eq('organization_id',org));checked(await service.from('organizations').delete().eq('id',org));}
      if(provider)checked(await service.from('provider_profiles').delete().eq('id',provider));
    }
    if(actor)checked(await service.auth.admin.deleteUser(actor));
  }
});
