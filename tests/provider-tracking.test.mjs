import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATABASE_PATH='./data/test-provider-tracking.db';
const file=path.resolve(process.cwd(),process.env.DATABASE_PATH);
for(const suffix of ['', '-wal','-shm'])if(fs.existsSync(file+suffix))fs.rmSync(file+suffix);
const repo=await import('../src/lib/repository.js');
const {getDb}=await import('../src/lib/db.js');

const owner=repo.findUserByEmail('transporter@loadgistic.local');
const selfManaged=repo.findUserByEmail('driver@loadgistic.local');
const companyDriver=repo.findUserByEmail('company-driver@loadgistic.local');
const vehicle=repo.listOwnVehicles(owner)[0];

function create(){
  return repo.createProviderShipment(owner,{vehicleId:vehicle.id,origin:'Addis Ababa, Ethiopia',originPlaceRef:'builtin:addis ababa',destination:'Adama, Ethiopia',destinationPlaceRef:'builtin:adama',cargoSummary:'Workshop machine parts',shipperEmail:'shipper@example.test',receiverEmail:'receiver@example.test',trackingMode:'STATUS_ONLY'});
}

test('provider owner creates separate high-entropy party codes that are stored only as hashes',()=>{
  const created=create();
  assert.notEqual(created.shipperCode,created.receiverCode);
  assert.match(created.shipperCode,/^LG-S-/);
  assert.match(created.receiverCode,/^LG-R-/);
  const database=getDb();
  const serialized=JSON.stringify(database.prepare('SELECT * FROM shipment_party_grants WHERE shipment_id=?').all(created.id));
  assert.equal(serialized.includes(created.shipperCode),false);
  assert.equal(serialized.includes(created.receiverCode),false);
  assert.deepEqual(repo.unlockProviderTracking(created.shipperCode),{id:created.id,partyRole:'SHIPPER'});
  assert.deepEqual(repo.unlockProviderTracking(created.receiverCode),{id:created.id,partyRole:'RECEIVER'});
});

test('company drivers and unrelated providers cannot create or read owner shipment records',()=>{
  assert.throws(()=>repo.createProviderShipment(companyDriver,{vehicleId:vehicle.id}),/FORBIDDEN/);
  const created=create();
  assert.equal(repo.getProviderShipment(selfManaged,created.id),null);
  assert.throws(()=>repo.updateProviderShipmentStatus(selfManaged,created.id,'LOADING'),/NOT_FOUND/);
});

test('provider workflow is explicit and queues one completion email per party',()=>{
  const created=create();
  assert.throws(()=>repo.updateProviderShipmentStatus(owner,created.id,'COMPLETED'),/INVALID_STATUS_TRANSITION/);
  repo.updateProviderShipmentStatus(owner,created.id,'LOADING','Loaded');
  assert.throws(()=>repo.updateProviderShipmentStatus(owner,created.id,'IN_TRANSIT','', {path:'x',originalName:'x.pdf',mimeType:'application/pdf'}),/PROOF_NOT_ALLOWED/);
  repo.updateProviderShipmentStatus(owner,created.id,'IN_TRANSIT');
  repo.updateProviderShipmentStatus(owner,created.id,'UNLOADING','Unloading');
  const complete=repo.updateProviderShipmentStatus(owner,created.id,'COMPLETED');
  assert.ok(complete.guestExpires);
  const shipment=repo.getProviderShipment(owner,created.id);
  assert.deepEqual(shipment.events.map(event=>event.status),['CREATED','LOADING','IN_TRANSIT','UNLOADING','COMPLETED']);
  assert.equal(shipment.email_deliveries.length,2);
  assert.ok(shipment.email_deliveries.every(delivery=>delivery.status==='PENDING'));
  assert.equal(new Set(getDb().prepare('SELECT idempotency_key FROM email_deliveries WHERE shipment_id=?').all(created.id).map(row=>row.idempotency_key)).size,2);
});

test('only the shipper can review and low reviews remain published during dispute',()=>{
  const created=create();
  for(const status of ['LOADING','IN_TRANSIT','UNLOADING','COMPLETED'])repo.updateProviderShipmentStatus(owner,created.id,status);
  assert.throws(()=>repo.submitProviderReview(created.id,'RECEIVER',3,'Not mine'),/REVIEW_NOT_ALLOWED/);
  const reviewId=repo.submitProviderReview(created.id,'SHIPPER',3,'Updates were too slow');
  assert.throws(()=>repo.submitProviderReview(created.id,'SHIPPER',5,'Again'),/REVIEW_ALREADY_SUBMITTED/);
  repo.disputeProviderReview(owner,reviewId,'The timestamps show timely updates.');
  const review=getDb().prepare('SELECT * FROM provider_reviews WHERE id=?').get(reviewId);
  assert.equal(review.status,'PUBLISHED');
  assert.equal(review.dispute_status,'PENDING');
  const profile=repo.getPublicProvider('blueline-transport');
  assert.ok(profile.reviews.some(item=>item.id===reviewId));
});

test('expired guest data is scrubbed while the provider record remains',()=>{
  const created=create();
  for(const status of ['LOADING','IN_TRANSIT','UNLOADING','COMPLETED'])repo.updateProviderShipmentStatus(owner,created.id,status);
  getDb().prepare(`UPDATE provider_shipments SET guest_expires_at='2000-01-01T00:00:00.000Z' WHERE id=?`).run(created.id);
  assert.equal(repo.purgeExpiredProviderShipmentGuests(),1);
  assert.throws(()=>repo.unlockProviderTracking(created.shipperCode),/INVALID_TRACKING_CODE/);
  const record=repo.getProviderShipment(owner,created.id);
  assert.ok(record);
  assert.match(record.shipper_email,/redacted\.invalid$/);
  assert.equal(record.email_deliveries.length,0);
});
