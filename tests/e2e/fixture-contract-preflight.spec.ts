import {test,expect} from './browser-test';
import {auditAssignAndPublishSelfDrivenVehicle,auditDeleteVehicles,auditProvider,checked,localAuditService} from './audit-helpers';
import {createProviderVehicle} from '../../src/lib/fleet.js';
import {publishProviderCapacity} from '../../src/lib/provider-capacity.js';

// Run this small contract before the full browser suite. It detects fixture
// assumptions that unit/SQL tests cannot: a new provider's vehicle starts
// Draft, has no implicit driver, and needs explicit assignment and Go Live.
test('synthetic provider setup follows current driver and publication rules',async({page},info)=>{
 test.skip(info.project.name!=='desktop-chromium','One browser context is enough for the fixture contract.');
 test.setTimeout(90_000);
 const db=localAuditService(),actor=await auditProvider(db,'fixture-preflight');let vehicleId='';
 try{
  const vehicle=await createProviderVehicle(actor,{useBasis:'OWNED',make:'Synthetic',model:'Fixture check',plate:`PREF-${actor.suffix}`,cargoConfiguration:'Pickup truck',trailerInterchangeable:false});
  vehicleId=vehicle.id;
  expect(checked(await db.from('vehicles').select('publication_status').eq('id',vehicleId).single()).publication_status).toBe('DRAFT');
  expect(checked(await db.rpc('capacity_active_driver_id',{target_vehicle_id:vehicleId}))).toBeNull();

  await auditAssignAndPublishSelfDrivenVehicle(db,actor,vehicleId);
  expect(checked(await db.from('vehicles').select('publication_status').eq('id',vehicleId).single()).publication_status).toBe('LIVE');
  checked(await db.from('company_pages').update({published:true,headline:'Synthetic current capacity',about:'Disposable fixture for release checks.'}).eq('provider_profile_id',actor.provider_profile_id));

  const rows=checked(await db.from('place_catalog').select('id,normalized_name').in('normalized_name',['addis ababa','adama']));
  const place=(name:string)=>{const found=rows.find((row:{normalized_name:string})=>row.normalized_name===name);expect(found).toBeTruthy();return found.id;};
  await publishProviderCapacity(actor,{vehicleId,status:'EMPTY',acceptedLoads:'BOTH',availabilityGeometry:'ROUTE',visibility:'OPEN',locationSource:'DEVICE_OBSCURED',approximateLat:9.03,approximateLng:38.76,locationPrecisionKm:10,currentRoutePlaces:[{placeRef:place('addis ababa')},{placeRef:place('adama')}]});
  const saved=checked(await db.from('capacities').select('market_status,vehicle_id').eq('vehicle_id',vehicleId).eq('market_status','EMPTY').single());
  expect(saved).toMatchObject({market_status:'EMPTY',vehicle_id:vehicleId});
  const response=await page.request.get(`/api/public/capacity?provider=${encodeURIComponent(`fixture-preflight-${actor.suffix}`)}&status=EMPTY`);
  expect(response.ok()).toBe(true);
  expect((await response.json()).items.some((item:{vehicle_id:string})=>item.vehicle_id===vehicleId)).toBe(true);
 }finally{
  if(vehicleId){
   const capacities=checked(await db.from('capacities').select('id').eq('vehicle_id',vehicleId));
   const entities=[vehicleId,...capacities.map((row:{id:string})=>row.id)];
   checked(await db.from('audit_logs').delete().in('entity_id',entities));
   checked(await db.from('capacities').delete().eq('vehicle_id',vehicleId));
   checked(await auditDeleteVehicles(db,'id',vehicleId));
  }
  checked(await db.from('audit_logs').delete().eq('actor_user_id',actor.id));
  checked(await db.auth.admin.deleteUser(actor.id));
 }
});
