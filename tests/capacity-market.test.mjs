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
  assert.ok(db.prepare('SELECT COUNT(*) n FROM next_trips WHERE published=1').get().n>=30);
  assert.ok(db.prepare('SELECT COUNT(*) n FROM profile_routes').get().n>=40);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM recurring_service_areas').get().n,30);
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
  assert.equal(all.some(item=>item.status==='PARTIAL'&&item.availability_geometry!=='ROUTE'),false);
  for(const item of all.filter(item=>item.availability_geometry==='ROUTE')){
    assert.ok(item.current_route_origin);
    assert.ok(item.current_route_destination);
    assert.ok(Number.isFinite(item.current_origin_lat));
    assert.ok(Number.isFinite(item.current_destination_lat));
  }
  assert.ok(all.some(item=>item.next_trip));
  assert.ok(all.some(item=>item.recurring_corridors.some(signal=>signal.geometry==='ROUTE')));
  assert.ok(all.some(item=>item.recurring_corridors.some(signal=>signal.geometry==='RADIUS')));
});

test('provider adds and removes a permanent recurring working area',()=>{
  const owner=repo.findUserByEmail('transporter@loadgistic.local');
  const id=repo.addRecurringCorridor(owner,{geometry:'RADIUS',center:'Jimma, Ethiopia',centerPlaceRef:'builtin:jimma',radiusKm:250});
  const area=repo.listOwnRecurringCorridors(owner).find(signal=>signal.id===id);
  assert.equal(area.geometry,'RADIUS');
  assert.equal(area.place_label,'Jimma, Ethiopia');
  assert.equal(area.radius_km,250);
  repo.removeRecurringCorridor(owner,id);
  assert.equal(repo.listOwnRecurringCorridors(owner).some(signal=>signal.id===id),false);
});

test('public projections expose only provider-selected contacts',()=>{
  const provider=repo.getPublicProvider('blueline-transport');
  assert.ok(provider);
  assert.equal(provider.handle,'blueline-transport');
  assert.ok(Array.isArray(provider.capacities));
  const serialized=JSON.stringify(provider);
  for(const privateKey of ['password_hash','code_hash','shipper_email','receiver_email'])assert.equal(serialized.includes(privateKey),false);
  const hidden=getDb().prepare(`SELECT COALESCE(o.handle,p.handle) handle FROM company_pages cp LEFT JOIN organizations o ON o.id=cp.organization_id LEFT JOIN provider_profiles p ON p.id=cp.provider_profile_id WHERE cp.published=1 AND cp.show_contact_email=0 LIMIT 1`).get();
  if(hidden)assert.equal(repo.getPublicProvider(hidden.handle).contact_email,null);
});

test('anonymous proximity is optional and exact visitor coordinates are not returned',()=>{
  const nearby=repo.listPublicCapacityCursor({nearLat:9.03,nearLng:38.74,nearRadiusKm:20},{pageSize:16});
  assert.ok(nearby.items.length>0);
  assert.equal(JSON.stringify(nearby).includes('nearLat'),false);
  assert.equal(JSON.stringify(nearby).includes('nearLng'),false);
});

test('provider-only signup rejects demand-seeker account types',()=>{
  assert.throws(()=>repo.createBusinessApplication({name:'Demand User',businessName:'Demand Company',email:'demand@example.test',phone:'+251900000001',password:'StrongPass123!',applicationType:'ENTERPRISE_SHIPPER'}),/INVALID_APPLICATION_TYPE/);
  const id=repo.createBusinessApplication({name:'New Operator',businessName:'New Operator Transport',email:'operator@example.test',phone:'+251900000002',password:'StrongPass123!',applicationType:'INDEPENDENT_PROVIDER'});
  assert.ok(id);
  const user=repo.findUserByEmail('operator@example.test');
  assert.equal(user.role,'DRIVER');
  assert.ok(user.provider_profile_id);
});
