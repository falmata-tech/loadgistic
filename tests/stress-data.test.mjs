import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

process.env.DATABASE_PATH='./data/test-stress-data.db';
const databaseFile=path.resolve(process.cwd(),process.env.DATABASE_PATH);
for(const suffix of ['', '-wal','-shm'])if(fs.existsSync(databaseFile+suffix))fs.rmSync(databaseFile+suffix);

const dbModule=await import('../src/lib/db.js');
const repo=await import('../src/lib/repository.js');
const security=await import('../src/lib/security.js');
const stress=await import('../scripts/lib/stress-data.mjs');

test.after(()=>{
  dbModule.closeDb();
  for(const suffix of ['', '-wal','-shm'])if(fs.existsSync(databaseFile+suffix))fs.rmSync(databaseFile+suffix);
});

test('standard stress dataset covers every table, workflow state, and provider scope',()=>{
  const db=dbModule.resetDb();
  const report=stress.populateStressData(db,{scale:1});
  const integrity=stress.assertStressDataIntegrity(db,report);

  assert.equal(integrity.ok,true);
  assert.equal(integrity.tables,30);
  assert.ok(integrity.totalRows>8_000);
  assert.equal(report.foreignKeyViolations.length,0);
  assert.ok(Object.values(report.counts).every(count=>count>0));
  assert.ok(report.counts.users>=240);
  assert.ok(report.counts.vehicles>=160);
  assert.ok(report.counts.shipments>=520);
  assert.ok(report.counts.service_areas>=100);
  assert.ok(report.counts.shipment_events>=1_800);
  assert.ok(report.counts.verification_requests>=500);

  const generatedBusiness=repo.findUserByEmail('business-001@stress.loadgistic.local');
  const generatedFleet=repo.findUserByEmail('fleet-001@stress.loadgistic.local');
  const generatedDriver=repo.findUserByEmail('driver-001@stress.loadgistic.local');
  assert.ok(security.verifyPassword('Loadgistic123!',generatedBusiness.password_hash));
  assert.equal(generatedBusiness.role,'SHIPPER');
  assert.equal(generatedFleet.role,'TRANSPORTER');
  assert.equal(generatedDriver.role,'DRIVER');

  assert.equal(repo.listOwnVehicles(generatedFleet).length,6);
  assert.equal(repo.listFleetDrivers(generatedFleet).length,3);
  assert.ok(repo.listLoads(generatedDriver).length>10);
  assert.ok(repo.listCapacity(generatedBusiness).length>20);
  assert.ok(repo.listDirectoryProfiles('ALL').length>100);
  const directoryPage=repo.listDirectoryProfiles('ALL',{page:1,pageSize:24});
  assert.equal(directoryPage.items.length,24);
  assert.ok(directoryPage.pageCount>4);
  const loadPageOne=repo.paginateResults(repo.listLoads(generatedDriver),{page:1,pageSize:12});
  const loadPageTwo=repo.paginateResults(repo.listLoads(generatedDriver),{page:2,pageSize:12});
  assert.equal(loadPageOne.items.length,12);
  assert.ok(loadPageTwo.items.length>0&&loadPageTwo.items.length<=12);
  assert.ok(loadPageTwo.total>12);
  assert.equal(loadPageOne.items.some(first=>loadPageTwo.items.some(second=>second.id===first.id)),false);
  const capacityPage=repo.paginateResults(repo.listCapacity(generatedBusiness),{page:2,pageSize:12});
  assert.ok(capacityPage.total>24);
  assert.equal(capacityPage.items.length,12);

  const admin=repo.getUserById('user-admin');
  const operationUsers=repo.getAdminOperations(admin,'',{view:'USERS'});
  const operationTrucks=repo.getAdminOperations(admin,'',{view:'TRUCKS'});
  const operationLoads=repo.getAdminOperations(admin,'',{view:'LOADS'});
  assert.ok(operationUsers.counts.users>=240);
  assert.ok(operationUsers.counts.trucks>=160);
  assert.equal(operationUsers.items.length,20);
  assert.equal(operationTrucks.items.length,20);
  assert.equal(operationLoads.items.length,20);
  assert.ok(operationUsers.pagination.pageCount>10);
  assert.ok(operationLoads.pagination.pageCount>25);
  const usersPageTwo=repo.getAdminOperations(admin,'',{view:'USERS',page:2});
  assert.equal(usersPageTwo.pagination.page,2);
  assert.equal(operationUsers.items.some(first=>usersPageTwo.items.some(second=>second.id===first.id)),false);
  assert.equal(repo.listApplications(admin,{page:1,pageSize:20}).items.length,20);
  assert.equal(repo.listVerificationRequests(admin,{status:'PENDING',page:1,pageSize:20}).items.length,20);
  assert.equal(repo.listPaymentProofs(admin,{status:'APPROVED',page:1,pageSize:20}).items.length,20);
  const stressFleetProfile=repo.getPublicCompany('stress-fleet-001');
  assert.ok(stressFleetProfile.map_areas.length>0);
  assert.ok(stressFleetProfile.map_areas.every(area=>Object.getPrototypeOf(area)===Object.prototype));

  const subject=db.prepare(`SELECT o.handle,o.id FROM organizations o
    JOIN business_reviews r ON r.subject_organization_id=o.id
    GROUP BY o.id HAVING SUM(CASE WHEN r.status<>'PUBLISHED' THEN 1 ELSE 0 END)>0
    LIMIT 1`).get();
  const profile=repo.getPublicCompany(subject.handle);
  const published=db.prepare(`SELECT COUNT(*) AS n FROM business_reviews
    WHERE subject_organization_id=? AND status='PUBLISHED'`).get(subject.id).n;
  const all=db.prepare(`SELECT COUNT(*) AS n FROM business_reviews
    WHERE subject_organization_id=?`).get(subject.id).n;
  assert.equal(profile.review_count,published);
  assert.ok(all>published);
});

test('named stress cohort exercises Connected, Pending, Favorite, Partners, Direct, and hidden visibility',()=>{
  const db=dbModule.getDb();
  const businessOne=repo.findUserByEmail('business-001@stress.loadgistic.local');
  const businessTwo=repo.findUserByEmail('business-002@stress.loadgistic.local');
  const businessThree=repo.findUserByEmail('business-003@stress.loadgistic.local');
  const businessSeven=repo.findUserByEmail('business-007@stress.loadgistic.local');
  const fleetOne=repo.findUserByEmail('fleet-001@stress.loadgistic.local');
  const fleetTwo=repo.findUserByEmail('fleet-002@stress.loadgistic.local');
  const driverOne=repo.findUserByEmail('driver-001@stress.loadgistic.local');
  const driverTwo=repo.findUserByEmail('driver-002@stress.loadgistic.local');

  assert.equal(repo.getNetworkState(businessOne,'org',fleetOne.organization_id).status,'CONNECTED');
  assert.equal(repo.getNetworkState(businessOne,'profile',driverOne.provider_profile_id).status,'CONNECTED');
  const pendingFleet=repo.getNetworkState(businessOne,'org',fleetTwo.organization_id);
  assert.equal(pendingFleet.status,'PENDING');
  assert.equal(pendingFleet.outgoing,true);
  const favoriteDriver=repo.getNetworkState(businessOne,'profile',driverTwo.provider_profile_id);
  assert.equal(favoriteDriver.status,'FAVORITE');
  assert.equal(favoriteDriver.is_favorite,true);

  const fleetNetwork=repo.listNetwork(fleetOne);
  assert.ok(fleetNetwork.connected.some(row=>row.target_id===businessOne.organization_id));
  assert.ok(fleetNetwork.connected.some(row=>row.target_id===businessTwo.organization_id));
  assert.ok(fleetNetwork.requests.some(row=>row.target_id===businessThree.organization_id&&row.incoming));
  assert.ok(fleetNetwork.requests.some(row=>row.name.includes('006')&&row.outgoing));

  const businessOneCapacity=repo.listMarketCapacity(businessOne);
  const businessTwoCapacity=repo.listMarketCapacity(businessTwo);
  const businessThreeCapacity=repo.listMarketCapacity(businessThree);
  const businessSevenCapacity=repo.listMarketCapacity(businessSeven);
  assert.ok(businessOneCapacity.some(row=>row.id==='stress-capacity-latest-0001'&&row.relationshipVisible));
  assert.ok(businessTwoCapacity.some(row=>row.id==='stress-capacity-latest-0001'&&row.relationshipVisible));
  assert.equal(businessThreeCapacity.some(row=>row.id==='stress-capacity-latest-0001'),false);
  assert.equal(businessSevenCapacity.some(row=>row.id==='stress-capacity-latest-0001'),false);
  for(const rows of [businessOneCapacity,businessTwoCapacity,businessThreeCapacity,businessSevenCapacity]){
    assert.equal(rows.some(row=>row.id==='stress-capacity-latest-0002'),false);
    assert.equal(rows.some(row=>row.id==='stress-capacity-latest-0003'),false);
  }
  assert.ok(businessThreeCapacity.some(row=>row.id==='stress-capacity-latest-0004'));

  const fleetOneLoads=repo.listLoads(fleetOne);
  const fleetTwoLoads=repo.listLoads(fleetTwo);
  const driverOneLoads=repo.listLoads(driverOne);
  const driverTwoLoads=repo.listLoads(driverTwo);
  assert.ok(fleetOneLoads.some(load=>load.id==='stress-network-load-partners'));
  assert.ok(driverOneLoads.some(load=>load.id==='stress-network-load-partners'));
  assert.equal(fleetTwoLoads.some(load=>load.id==='stress-network-load-partners'),false);
  assert.equal(driverTwoLoads.some(load=>load.id==='stress-network-load-partners'),false);
  assert.ok(fleetOneLoads.some(load=>load.id==='stress-network-load-direct-fleet'));
  assert.equal(driverOneLoads.some(load=>load.id==='stress-network-load-direct-fleet'),false);
  assert.ok(driverOneLoads.some(load=>load.id==='stress-network-load-direct-driver'));
  assert.equal(fleetOneLoads.some(load=>load.id==='stress-network-load-direct-driver'),false);

  const duplicatePairs=db.prepare(`SELECT COUNT(*) AS n FROM (
    SELECT owner_organization_id,COALESCE(provider_organization_id,''),COALESCE(provider_profile_id,''),COUNT(*) AS pair_count
    FROM partner_relationships
    WHERE id LIKE 'stress-%'
    GROUP BY owner_organization_id,provider_organization_id,provider_profile_id
    HAVING pair_count>1
  )`).get().n;
  assert.equal(duplicatePairs,0);
});

test('stress command refuses production before changing the configured database',()=>{
  const protectedFile=path.resolve(process.cwd(),'data/test-stress-production-denial.db');
  fs.writeFileSync(protectedFile,'leave-this-file-unchanged');
  const result=spawnSync(process.execPath,['scripts/seed-stress-db.mjs'],{
    cwd:process.cwd(),
    env:{...process.env,NODE_ENV:'production',DATABASE_PATH:'./data/test-stress-production-denial.db'},
    encoding:'utf8'
  });
  assert.notEqual(result.status,0);
  assert.match(`${result.stderr}${result.stdout}`,/development-only/i);
  assert.equal(fs.readFileSync(protectedFile,'utf8'),'leave-this-file-unchanged');
  fs.rmSync(protectedFile);
});
