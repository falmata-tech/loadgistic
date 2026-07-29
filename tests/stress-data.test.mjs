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
  assert.equal(integrity.tables,29);
  assert.ok(integrity.totalRows>8_000);
  assert.equal(report.foreignKeyViolations.length,0);
  assert.ok(Object.values(report.counts).every(count=>count>0));
  assert.ok(report.counts.users>=240);
  assert.ok(report.counts.vehicles>=160);
  assert.ok(report.counts.shipments>=520);
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

  const admin=repo.getUserById('user-admin');
  const operations=repo.getAdminOperations(admin);
  assert.ok(operations.counts.users>=240);
  assert.ok(operations.counts.trucks>=160);
  assert.equal(operations.users.length,15);
  assert.equal(operations.vehicles.length,20);
  assert.equal(operations.loads.length,20);
  assert.equal(operations.is_compact,true);
  assert.equal(repo.listApplications(admin,{page:1,pageSize:20}).items.length,20);
  assert.equal(repo.listVerificationRequests(admin,{status:'PENDING',page:1,pageSize:20}).items.length,20);
  assert.equal(repo.listPaymentProofs(admin,{status:'APPROVED',page:1,pageSize:20}).items.length,20);

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
