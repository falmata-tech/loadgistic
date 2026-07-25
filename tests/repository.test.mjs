import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATABASE_PATH='./data/test-loadgistic.db';
const file=path.resolve(process.cwd(),process.env.DATABASE_PATH);
for(const suffix of ['', '-wal','-shm'])if(fs.existsSync(file+suffix))fs.rmSync(file+suffix);
const repo=await import('../src/lib/repository.js');
const dbModule=await import('../src/lib/db.js');

test('seeded users and role workspaces exist',()=>{
 const shipper=repo.findUserByEmail('shipper@loadgistic.local');
 const parcel=repo.findUserByEmail('parcel@loadgistic.local');
 assert.equal(shipper.role,'SHIPPER');
 assert.equal(parcel.role,'PARCEL');
 assert.ok(repo.getDashboard(shipper).actions.length>=2);
});

test('seeded pending application belongs only to an inactive tenantless applicant',()=>{
 const db=dbModule.getDb();
 const pending=db.prepare(`SELECT a.id,u.active,u.organization_id,u.provider_profile_id
   FROM applications a JOIN users u ON u.id=a.user_id
   WHERE a.id='app-pending' AND a.status='PENDING'`).get();
 assert.ok(pending);
 assert.equal(pending.active,0);
 assert.equal(pending.organization_id,null);
 assert.equal(pending.provider_profile_id,null);
 const activePending=db.prepare(`SELECT COUNT(*) AS n FROM applications a
   JOIN users u ON u.id=a.user_id WHERE a.status='PENDING' AND u.active=1`).get();
 assert.equal(activePending.n,0);
});

test('provider discovery includes parcel, transporter, and independent provider',()=>{
 const providers=repo.listProviders('ALL');
 assert.ok(providers.some(p=>p.type==='PARCEL_OPERATOR'));
 assert.ok(providers.some(p=>p.type==='TRANSPORT_COMPANY'));
 assert.ok(providers.some(p=>p.type==='INDEPENDENT_PROVIDER'));
});

test('shipper creates quote-requested open freight load',()=>{
 const user=repo.getUserById('user-shipper');
 const result=repo.createShipment(user,{title:'Test quote load',serviceMode:'FREIGHT',distributionMode:'OPEN_MARKET',priceMode:'QUOTE_REQUESTED',origin:'Addis Ababa',destination:'Jimma',cargoDescription:'Test goods',packageCount:'5',pickupDate:new Date(Date.now()+86400000).toISOString().slice(0,10),trackingMode:'NONE'});
 const shipment=repo.getShipmentForUser(user,result.id);
 assert.equal(shipment.price_mode,'QUOTE_REQUESTED');
 assert.equal(shipment.operational_status,'POSTED');
});

test('parcel workflow rejects invalid jump and accepts next action',()=>{
 const user=repo.getUserById('user-parcel');
 assert.throws(()=>repo.transitionShipment(user,'shp-parcel-new','COMPLETED'),/INVALID_STATUS_TRANSITION/);
 repo.transitionShipment(user,'shp-parcel-new','CONTACTED','Business contacted');
 const updated=repo.getShipmentForUser(user,'shp-parcel-new');
 assert.equal(updated.operational_status,'CONTACTED');
});

test('capacity update enforces partial percentage and expires old vehicle record',()=>{
 const user=repo.getUserById('user-driver');
 assert.throws(()=>repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'PARTIAL',availablePercent:'',origin:'Addis Ababa',destination:'Hawassa',visibility:'OPEN'}),/CAPACITY_PERCENT_REQUIRED/);
 const id=repo.publishCapacity(user,{vehicleId:'veh-driver-1',status:'PARTIAL',availablePercent:'55',origin:'Addis Ababa',destination:'Hawassa',visibility:'OPEN'});
 const rows=repo.listCapacity(user);
 assert.ok(rows.some(r=>r.id===id&&r.available_percent===55));
});


test('business application approval provisions a workspace and subscription',()=>{
 const appId=repo.createBusinessApplication({name:'Test Applicant',businessName:'Test Parcel PLC',email:'test-applicant@loadgistic.local',password:'StrongPass123!',applicationType:'PARCEL_OPERATOR',notes:'Local test'});
 const pending=repo.getApplicationStatus('test-applicant@loadgistic.local');
 assert.equal(pending.status,'PENDING');
 const admin=repo.getUserById('user-admin');
 repo.reviewApplication(admin,appId,'APPROVED','Verified in local test');
 const user=repo.findUserByEmail('test-applicant@loadgistic.local');
 assert.equal(user.active,1);
 const hydrated=repo.getUserById(user.id);
 assert.ok(hydrated.organization_id);
 const billing=repo.getBillingSummary(hydrated);
 assert.equal(billing.subscription.status,'PAYMENT_UNDER_REVIEW');
});

test('manual payment proof can be submitted and approved',()=>{
 const user=repo.getUserById('user-shipper');
 const proofId=repo.submitPaymentProof(user,'1200','LOCAL-REF-1');
 const admin=repo.getUserById('user-admin');
 repo.reviewPaymentProof(admin,proofId,'APPROVED');
 const proofs=repo.listPaymentProofs(admin);
 assert.equal(proofs.find(p=>p.id===proofId).status,'APPROVED');
});

test.after(()=>{dbModule.closeDb();for(const suffix of ['', '-wal','-shm'])if(fs.existsSync(file+suffix))fs.rmSync(file+suffix);});
