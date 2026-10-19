import {randomUUID} from 'node:crypto';
import {expect,test} from './browser-test';
import {auditDeleteVehicles,auditFleetDriver,auditFleetProvider,checked,localAuditService} from './audit-helpers';
import {localSupportLogin} from './provider-support-helper';
import {publishProviderCapacity} from '../../src/lib/provider-capacity.js';

test('an Off Duty fleet driver saves a private phone fix before the owner publishes capacity',async({browser},info)=>{
  test.skip(info.project.name!=='desktop-chromium','A desktop Chrome context checks this focused web workflow.');
  test.setTimeout(150_000);
  const db=localAuditService(),owner=await auditFleetProvider(db,'first-phone');
  let vehicleId='',driver:Awaited<ReturnType<typeof auditFleetDriver>>|null=null;
  const context=await browser.newContext({baseURL:info.project.use.baseURL,permissions:['geolocation'],geolocation:{latitude:9.03,longitude:38.76},extraHTTPHeaders:{'x-forwarded-for':'127.0.0.248'}});
  const page=await context.newPage();
  try{
    const vehicle=checked(await db.rpc('create_provider_vehicle',{actor_user_id:owner.id,command:{make:'Isuzu',model:'First fix',plate:`FIX-${randomUUID().slice(0,8)}`,cargo_configuration:'Mini Box Truck',use_basis:'OWNED'}}));
    vehicleId=vehicle.id;
    driver=await auditFleetDriver(db,owner,vehicleId);
    checked(await db.from('driver_permissions').update({can_manage_capacity:false}).eq('user_id',driver.id));
    await localSupportLogin(page,owner.id);
    await page.goto(`/app/fleet/${vehicleId}?view=details`);
    await expect(page.getByRole('button',{name:'Go live',exact:true})).toBeEnabled();
    await page.getByRole('button',{name:'Go live',exact:true}).click();
    expect(checked(await db.from('vehicles').select('publication_status').eq('id',vehicleId).single()).publication_status).toBe('LIVE');

    await localSupportLogin(page,driver.id);
    await page.goto('/app/home');
    await expect(page.getByText('Fleet-managed capacity',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Available',exact:true})).toBeDisabled();
    expect(checked(await db.from('capacities').select('id').eq('vehicle_id',vehicleId).neq('market_status','OFF_DUTY'))).toHaveLength(0);
    await page.getByRole('button',{name:'Edit capacity location',exact:true}).click();
    const editor=page.getByRole('dialog',{name:'Capacity map location',exact:true});
    await expect(editor.getByRole('button',{name:'Use my phone',exact:true})).toHaveAttribute('aria-pressed','true');
    await editor.getByLabel('Shared location accuracy').selectOption('10');
    const save=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/capacity/location'&&response.request().method()==='POST');
    await editor.getByRole('button',{name:'Save location',exact:true}).click();
    expect((await save).status()).toBe(200);
    await expect(editor).toHaveCount(0);
    const fix=checked(await db.from('vehicle_driver_locations').select('driver_user_id,precision_km,latitude,longitude').eq('vehicle_id',vehicleId).single());
    expect(fix).toMatchObject({driver_user_id:driver.id,precision_km:10});
    expect(fix.latitude).not.toBe(9.03);expect(fix.longitude).not.toBe(38.76);
    expect(checked(await db.from('capacities').select('id').eq('vehicle_id',vehicleId).neq('market_status','OFF_DUTY'))).toHaveLength(0);

    const places=await Promise.all(['addis ababa','adama'].map(async name=>checked(await db.from('place_catalog').select('id,name').eq('normalized_name',name).order('population',{ascending:false}).limit(1).single())));
    checked(await db.from('company_pages').update({published:true}).eq('organization_id',owner.organization_id));
    await publishProviderCapacity(owner,{vehicleId,status:'EMPTY',acceptedLoads:'BOTH',availabilityGeometry:'ROUTE',visibility:'OPEN',locationSource:'PRESERVE_DRIVER',currentRoutePlaces:places.map((place:{id:string;name:string})=>({placeRef:place.id,label:place.name}))});
    const published=checked(await db.from('capacities').select('updated_by,market_status,location_lat,location_lng,location_precision_km').eq('vehicle_id',vehicleId).eq('market_status','EMPTY').single());
    expect(published).toMatchObject({updated_by:owner.id,market_status:'EMPTY',location_precision_km:10,location_lat:fix.latitude,location_lng:fix.longitude});
    await page.reload();
    await expect(page.getByRole('button',{name:'Off Duty',exact:true})).toBeEnabled();
  }finally{
    await context.close();
    if(vehicleId){checked(await db.from('capacities').delete().eq('vehicle_id',vehicleId));checked(await db.from('telematics_location_sources').delete().eq('vehicle_id',vehicleId));checked(await db.from('driver_vehicle_assignments').delete().eq('vehicle_id',vehicleId));}
    if(driver){checked(await db.from('drivers').delete().eq('user_id',driver.id));checked(await db.from('organization_members').delete().eq('user_id',driver.id).eq('organization_id',owner.organization_id));checked(await db.from('audit_logs').delete().eq('actor_user_id',driver.id));checked(await db.auth.admin.deleteUser(driver.id));}
    checked(await auditDeleteVehicles(db,'organization_id',owner.organization_id));checked(await db.from('company_pages').delete().eq('organization_id',owner.organization_id));checked(await db.from('organization_members').delete().eq('user_id',owner.id).eq('organization_id',owner.organization_id));checked(await db.from('audit_logs').delete().eq('actor_user_id',owner.id));checked(await db.from('audit_logs').delete().eq('organization_id',owner.organization_id));checked(await db.from('organizations').delete().eq('id',owner.organization_id));checked(await db.auth.admin.deleteUser(owner.id));
  }
});
