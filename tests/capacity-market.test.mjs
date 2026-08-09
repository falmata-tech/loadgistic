import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATABASE_PATH='./data/test-capacity-market.db';
const file=path.resolve(process.cwd(),process.env.DATABASE_PATH);
for(const suffix of ['', '-wal','-shm'])if(fs.existsSync(file+suffix))fs.rmSync(file+suffix);
const repo=await import('../src/lib/repository.js');
const {getDb}=await import('../src/lib/db.js');

test('deterministic seed presents a busy supply-only market',()=>{
  const db=getDb();
  assert.equal(db.prepare('SELECT COUNT(*) n FROM shipments').get().n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM partner_relationships').get().n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM provider_profiles').get().n,21);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM organizations WHERE type='TRANSPORT_COMPANY'").get().n,9);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM company_pages WHERE published=1').get().n,30);
  assert.equal(db.prepare(`SELECT COUNT(*) n FROM capacities c WHERE c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=c.vehicle_id ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1) AND COALESCE(c.market_status,c.status) IN ('EMPTY','PARTIAL')`).get().n,47);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name IN ('next_trips','recurring_service_areas')").get().n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM profile_routes').get().n,60);
  assert.equal(db.prepare(`SELECT MAX(n) AS maximum FROM (SELECT COUNT(*) AS n FROM profile_routes GROUP BY COALESCE(organization_id,provider_profile_id))`).get().maximum,2);
});

test('public capacity includes varied radius and route signals',()=>{
  const all=[];
  let cursor=null;
  do {
    const page=repo.listPublicCapacityCursor({}, {pageSize:12,cursor});
    for(const item of page.items)assert.equal(all.some(existing=>existing.id===item.id),false);
    all.push(...page.items);
    cursor=page.nextCursor;
  } while(cursor);
  assert.equal(all.length,47);
  assert.ok(all.some(item=>item.status==='EMPTY'));
  assert.ok(all.some(item=>item.status==='PARTIAL'));
  assert.ok(all.some(item=>item.availability_geometry==='RADIUS'));
  assert.ok(all.some(item=>item.availability_geometry==='ROUTE'));
  assert.ok(all.some(item=>item.status==='EMPTY'&&item.availability_geometry==='RADIUS'));
  assert.ok(all.some(item=>item.status==='EMPTY'&&item.availability_geometry==='ROUTE'));
  assert.ok(all.some(item=>item.status==='PARTIAL'&&item.availability_geometry==='RADIUS'));
  assert.ok(all.some(item=>item.status==='PARTIAL'&&item.availability_geometry==='ROUTE'));
  for(const item of all.filter(item=>item.availability_geometry==='ROUTE')){
    assert.ok(item.current_route_origin);
    assert.ok(item.current_route_destination);
    assert.ok(Number.isFinite(item.current_origin_lat));
    assert.ok(Number.isFinite(item.current_destination_lat));
  }
  assert.ok(all.every(item=>item.next_trip===undefined));
  assert.ok(all.every(item=>item.recurring_corridors.length===2));
  assert.ok(all.every(item=>item.recurring_corridors.every(signal=>signal.geometry==='ROUTE')));
});

test('provider may keep no more than two regular corridors',()=>{
  const owner=repo.findUserByEmail('transporter@loadgistic.local');
  const original=repo.listOwnRecurringCorridors(owner);
  assert.equal(original.length,2);
  assert.throws(()=>repo.addRecurringCorridor(owner,{origin:'Jimma, Ethiopia',originPlaceRef:'builtin:jimma',destination:'Hawassa, Ethiopia',destinationPlaceRef:'builtin:hawassa'}),/REGULAR_CORRIDOR_LIMIT/);
  assert.throws(()=>getDb().prepare(`INSERT INTO profile_routes (id,organization_id,provider_profile_id,origin,destination,created_by,created_at) VALUES ('third-direct-corridor',?,NULL,'Jimma, Ethiopia','Hawassa, Ethiopia',?,?)`).run(owner.organization_id,owner.id,new Date().toISOString()),/REGULAR_CORRIDOR_LIMIT/);
  repo.removeRecurringCorridor(owner,original[0].id);
  const id=repo.addRecurringCorridor(owner,{origin:'Jimma, Ethiopia',originPlaceRef:'builtin:jimma',destination:'Hawassa, Ethiopia',destinationPlaceRef:'builtin:hawassa'});
  const corridor=repo.listOwnRecurringCorridors(owner).find(signal=>signal.id===id);
  assert.equal(corridor.geometry,'ROUTE');
  assert.equal(corridor.origin,'Jimma, Ethiopia');
  assert.equal(corridor.destination,'Hawassa, Ethiopia');
  assert.throws(()=>repo.addRecurringCorridor(owner,{origin:'Hawassa, Ethiopia',originPlaceRef:'builtin:hawassa',destination:'Jimma, Ethiopia',destinationPlaceRef:'builtin:jimma'}),/CORRIDOR_ALREADY_EXISTS/);
  assert.equal(repo.listOwnRecurringCorridors(owner).length,2);
  repo.removeRecurringCorridor(owner,id);
  assert.equal(repo.listOwnRecurringCorridors(owner).some(signal=>signal.id===id),false);
});

test('public projections expose only provider-selected contacts',()=>{
  const provider=repo.getPublicProvider('blueline-transport');
  const account=repo.findUserByEmail('transporter@loadgistic.local');
  assert.ok(provider);
  assert.equal(provider.handle,'blueline-transport');
  assert.ok(account.phone);
  assert.ok(provider.contact_phone);
  assert.notEqual(provider.contact_phone,account.phone);
  assert.ok(Array.isArray(provider.capacities));
  const serialized=JSON.stringify(provider);
  for(const privateKey of ['password_hash','code_hash','shipper_email','receiver_email'])assert.equal(serialized.includes(privateKey),false);
  const hidden=getDb().prepare(`SELECT COALESCE(o.handle,p.handle) handle FROM company_pages cp LEFT JOIN organizations o ON o.id=cp.organization_id LEFT JOIN provider_profiles p ON p.id=cp.provider_profile_id WHERE cp.published=1 AND cp.show_contact_email=0 LIMIT 1`).get();
  if(hidden)assert.equal(repo.getPublicProvider(hidden.handle).contact_email,null);
  const hiddenPhone=getDb().prepare(`SELECT COALESCE(o.handle,p.handle) handle FROM company_pages cp LEFT JOIN organizations o ON o.id=cp.organization_id LEFT JOIN provider_profiles p ON p.id=cp.provider_profile_id WHERE cp.published=1 AND cp.show_contact_phone=0 LIMIT 1`).get();
  if(hiddenPhone)assert.equal(repo.getPublicProvider(hiddenPhone.handle).contact_phone,null);
});

test('anonymous proximity is optional and exact visitor coordinates are not returned',()=>{
  const nearby=repo.listPublicCapacityCursor({nearLat:9.03,nearLng:38.74,nearRadiusKm:20},{pageSize:16});
  assert.ok(nearby.items.length>0);
  assert.ok(nearby.items.every(item=>Number.isFinite(item.possible_distance_min_km)&&Number.isFinite(item.possible_distance_max_km)));
  assert.equal(JSON.stringify(nearby).includes('nearLat'),false);
  assert.equal(JSON.stringify(nearby).includes('nearLng'),false);
});

test('Driver location refresh persists an obscured point without changing capacity facts',()=>{
  const driver=repo.findUserByEmail('driver@loadgistic.local');
  const owner=repo.findUserByEmail('transporter@loadgistic.local');
  const vehicle=repo.listOwnVehicles(driver)[0];
  const before=repo.listOwnCapacity(driver).find(item=>item.vehicle_id===vehicle.id);
  const result=repo.refreshCapacityLocation(driver,{vehicleId:vehicle.id,approximateLat:9.11,approximateLng:38.81,locationPrecisionKm:3,locationSource:'DEVICE_OBSCURED'});
  const after=repo.listOwnCapacity(driver).find(item=>item.vehicle_id===vehicle.id);
  assert.equal(after.id,before.id);
  assert.equal(after.status,before.status);
  assert.equal(after.available_percent,before.available_percent);
  assert.equal(after.location_lat,9.11);
  assert.equal(after.location_lng,38.81);
  assert.equal(after.location_precision_km,3);
  assert.equal(after.location_updated_at,result.locationUpdatedAt);
  assert.equal(getDb().prepare("SELECT COUNT(*) n FROM audit_logs WHERE action='CAPACITY_LOCATION_REFRESHED' AND entity_id=?").get(before.id).n,1);
  assert.throws(()=>repo.refreshCapacityLocation(owner,{vehicleId:vehicle.id,approximateLat:9.11,approximateLng:38.81,locationPrecisionKm:3,locationSource:'DEVICE_OBSCURED'}),/DEVICE_LOCATION_DRIVER_ONLY/);
  const companyDriver=repo.findUserByEmail('company-driver@loadgistic.local');
  const assignedVehicle=repo.listOwnVehicles(companyDriver)[0];
  const companyResult=repo.refreshCapacityLocation(companyDriver,{vehicleId:assignedVehicle.id,approximateLat:9.04,approximateLng:38.73,locationPrecisionKm:5,locationSource:'DEVICE_OBSCURED'});
  assert.equal(companyResult.vehicleId,assignedVehicle.id);
});

test('provider-only signup rejects demand-seeker account types',()=>{
  assert.throws(()=>repo.createBusinessApplication({name:'Demand User',businessName:'Demand Company',email:'demand@example.test',phone:'+251900000001',password:'StrongPass123!',applicationType:'ENTERPRISE_SHIPPER'}),/INVALID_APPLICATION_TYPE/);
  const id=repo.createBusinessApplication({name:'New Operator',businessName:'New Operator Transport',email:'operator@example.test',phone:'+251900000002',password:'StrongPass123!',applicationType:'INDEPENDENT_PROVIDER'});
  assert.ok(id);
  const user=repo.findUserByEmail('operator@example.test');
  assert.equal(user.role,'DRIVER');
  assert.ok(user.provider_profile_id);
});
