import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATABASE_PATH = './data/test-authorization.db';
const file = path.resolve(process.cwd(), process.env.DATABASE_PATH);
for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(file + suffix)) fs.rmSync(file + suffix);

const repo = await import('../src/lib/repository.js');
const dbModule = await import('../src/lib/db.js');

const users = {
  admin: repo.getUserById('user-admin'),
  shipper: repo.getUserById('user-shipper'),
  receiver: repo.getUserById('user-receiver'),
  transporter: repo.getUserById('user-transporter'),
  driver: repo.getUserById('user-driver')
};

function createFreight(distributionMode = 'OPEN_MARKET', providerRef = undefined) {
  return repo.createShipment(users.shipper, {
    title: `Authorization ${distributionMode} ${Date.now()} ${Math.random()}`,
    serviceMode: 'FREIGHT',
    distributionMode,
    providerRef,
    priceMode: 'QUOTE_REQUESTED',
    origin: 'Addis Ababa',
    destination: 'Hawassa',
    cargoDescription: 'Permission contract fixture',
    loadType: 'FTL',
    packageCount: '2',
    pickupDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    trackingMode: 'STATUS_ONLY'
  });
}

test('saved-partner freight is visible only to a related provider', () => {
  assert.ok(repo.getShipmentForUser(users.transporter, 'shp-freight-target'));
  assert.equal(repo.getShipmentForUser(users.driver, 'shp-freight-target'), null);
  assert.ok(repo.listLoads(users.transporter).some(row => row.id === 'shp-freight-target'));
  assert.equal(repo.listLoads(users.driver).some(row => row.id === 'shp-freight-target'), false);
});

test('browse visibility cannot change an unassigned shipment status', () => {
  const shipment = createFreight();
  assert.ok(repo.getShipmentForUser(users.driver, shipment.id));
  assert.throws(() => repo.transitionShipment(users.driver, shipment.id, 'CONTACTED'), /NOT_FOUND|FORBIDDEN/);
  assert.equal(repo.getShipmentForUser(users.shipper, shipment.id).operational_status, 'POSTED');
});

test('browse visibility cannot add an internal shipment note', () => {
  const shipment = createFreight();
  const db = dbModule.getDb();
  const before = db.prepare('SELECT COUNT(*) AS n FROM shipment_notes WHERE shipment_id=?').get(shipment.id).n;
  assert.throws(() => repo.addShipmentNote(users.driver, shipment.id, 'Unauthorized internal note'), /NOT_FOUND/);
  const after = db.prepare('SELECT COUNT(*) AS n FROM shipment_notes WHERE shipment_id=?').get(shipment.id).n;
  assert.equal(after, before);
});

test('browse visibility cannot upload or download private proof', () => {
  const shipment = createFreight();
  const upload = { path: '/tmp/loadgistic-authorization-proof.pdf', originalName: 'proof.pdf', mimeType: 'application/pdf' };
  const proofId = repo.addProof(users.admin, shipment.id, 'LOADING', upload, 'Admin fixture');
  assert.equal(repo.getProofFile(users.driver, proofId), null);
  assert.throws(() => repo.addProof(users.driver, shipment.id, 'ISSUE', upload, 'Unauthorized'), /NOT_FOUND/);
  assert.equal(repo.getProofFile(users.shipper, proofId).id, proofId);
});

test('temporary load proof is limited to one interested provider and expires', async () => {
  const shipment = createFreight();
  repo.expressInterest(users.driver,shipment.id,'Please share load-size proof');
  repo.requestLoadProof(users.driver,shipment.id);
  assert.throws(()=>repo.requestLoadProof(users.transporter,shipment.id),/NOT_FOUND/);
  const ownerView = repo.getShipmentForUser(users.shipper,shipment.id);
  const interest = ownerView.interests.find(row=>row.provider_profile_id===users.driver.provider_profile_id);
  assert.ok(interest.proof_request_id);
  const file = { name:'load-size.png', type:'image/png', size:4, arrayBuffer:async()=>new Uint8Array([1,2,3,4]).buffer };
  const proofId = await repo.shareLoadProof(users.shipper,shipment.id,interest.id,file,'Current pallet quantity');
  const recipientProof = repo.getLoadProofFile(users.driver,proofId);
  assert.equal(recipientProof.id,proofId);
  assert.equal(repo.getLoadProofFile(users.transporter,proofId),null);
  const db = dbModule.getDb();
  db.prepare('UPDATE load_proof_shares SET expires_at=? WHERE id=?').run(new Date(Date.now()-1000).toISOString(),proofId);
  assert.equal(repo.getLoadProofFile(users.driver,proofId),null);
  assert.equal(repo.getLoadProofFile(users.shipper,proofId).id,proofId);
  if(fs.existsSync(recipientProof.file_path))fs.rmSync(recipientProof.file_path);
});

test('direct shipment acceptance is restricted to the addressed provider and sent state', () => {
  const shipment = createFreight('DIRECT_TO_PROVIDER', 'profile:provider-driver');
  assert.throws(() => repo.acceptDirectedShipment(users.transporter, shipment.id), /NOT_FOUND|FORBIDDEN/);
  repo.acceptDirectedShipment(users.driver, shipment.id);
  assert.equal(repo.getShipmentForUser(users.driver, shipment.id).operational_status, 'AGREED');
  assert.throws(() => repo.acceptDirectedShipment(users.driver, shipment.id), /DIRECT_REQUEST_NOT_PENDING/);
});

test('receiver contact is private and required between agreement and assignment', () => {
  const shipment = createFreight('DIRECT_TO_PROVIDER', 'profile:provider-driver');
  repo.acceptDirectedShipment(users.driver,shipment.id);
  assert.throws(() => repo.transitionShipment(users.driver,shipment.id,'ASSIGNED'), /RECEIVER_CONTACT_REQUIRED/);
  assert.throws(() => repo.setReceiverContact(users.receiver,shipment.id,'Hana','+251 911 600 700'), /NOT_FOUND/);
  repo.setReceiverContact(users.shipper,shipment.id,'Hana','+251 911 600 700');
  const partyView = repo.getShipmentForUser(users.driver,shipment.id);
  assert.equal(partyView.receiver_first_name,'Hana');
  assert.equal(partyView.receiver_phone,'+251 911 600 700');
  repo.transitionShipment(users.driver,shipment.id,'ASSIGNED');
  assert.equal(repo.getShipmentForUser(users.shipper,shipment.id).operational_status,'ASSIGNED');
});

test('assigned location tracking is enforced until a Business party reduces it', () => {
  const shipment = repo.createShipment(users.shipper,{
    title:'Tracked direct freight',
    serviceMode:'FREIGHT',
    distributionMode:'DIRECT_TO_PROVIDER',
    providerRef:'profile:provider-driver',
    priceMode:'QUOTE_REQUESTED',
    origin:'Addis Ababa',
    destination:'Hawassa',
    cargoDescription:'Tracked fixture',
    loadType:'FTL',
    packageCount:'2',
    pickupDate:new Date(Date.now()+86_400_000).toISOString().slice(0,10),
    receiverOrganizationId:users.receiver.organization_id,
    trackingMode:'LOCATION_AND_STATUS'
  });
  repo.acceptDirectedShipment(users.driver,shipment.id);
  repo.setReceiverContact(users.shipper,shipment.id,'Hana','+251 911 600 700');
  assert.throws(()=>repo.transitionShipment(users.driver,shipment.id,'ASSIGNED'),/TRACKING_LOCATION_REQUIRED/);
  repo.transitionShipment(users.driver,shipment.id,'ASSIGNED','Driver assigned',{locationArea:'Around Addis Ababa',locationSource:'DEVICE_OBSCURED',approximateLat:'9',approximateLng:'38.5',locationPrecisionKm:'40'});
  assert.throws(()=>repo.setTrackingMode(users.driver,shipment.id,'STATUS_ONLY'),/NOT_FOUND/);
  repo.setTrackingMode(users.receiver,shipment.id,'STATUS_ONLY');
  repo.addTrackingUpdate(users.driver,shipment.id,{note:'Loading completed'});
  const tracked=repo.getShipmentForUser(users.shipper,shipment.id);
  assert.equal(tracked.tracking_mode,'STATUS_ONLY');
  assert.ok(tracked.events.some(event=>event.event_type==='TRACKING_MODE'));
  assert.ok(tracked.events.some(event=>event.location_source==='DEVICE_OBSCURED'&&event.location_precision_km===40));
});

test('marketplace-only views never receive receiver contact', () => {
  const shipment = createFreight();
  const db = dbModule.getDb();
  db.prepare('UPDATE shipments SET receiver_first_name=?,receiver_phone=? WHERE id=?')
    .run('Private receiver','+251 911 999 999',shipment.id);
  const browseView = repo.getShipmentForUser(users.driver,shipment.id);
  assert.equal(browseView.receiver_first_name,null);
  assert.equal(browseView.receiver_phone,null);
});

test('Business load phone is exposed only after explicit opt in', () => {
  const profile = repo.getOwnCompanyPage(users.shipper);
  repo.updateCompanyPage(users.shipper,{...profile,contactPhone:'+251 911 111 111',contactEmail:profile.contact_email,showContactPhoneOnLoads:false});
  assert.equal(repo.listLoads(users.driver).find(row=>row.id==='shp-freight-fixed').load_contact_phone,null);
  repo.updateCompanyPage(users.shipper,{...profile,contactPhone:'+251 911 111 111',contactEmail:profile.contact_email,showContactPhoneOnLoads:true});
  assert.equal(repo.listLoads(users.driver).find(row=>row.id==='shp-freight-fixed').load_contact_phone,'+251 911 111 111');
});

test('application review is admin-only and terminal outcomes are immutable', () => {
  const applicationId = repo.createBusinessApplication({
    name: 'Authorization Applicant',
    businessName: 'Authorization Freight PLC',
    email: `authorization-${Date.now()}@loadgistic.local`,
    password: 'StrongPass123!',
    applicationType: 'TRANSPORT_COMPANY',
    notes: 'Permission test'
  });
  assert.throws(() => repo.reviewApplication(users.shipper, applicationId, 'APPROVED'), /FORBIDDEN/);
  repo.reviewApplication(users.admin, applicationId, 'REJECTED', 'Rejected once');
  assert.throws(() => repo.reviewApplication(users.admin, applicationId, 'APPROVED'), /APPLICATION_ALREADY_REVIEWED/);
});

test('payment review is admin-only and terminal outcomes are immutable', () => {
  const proofId = repo.submitPaymentProof(users.shipper, '1500', `AUTH-${Date.now()}`);
  assert.throws(() => repo.reviewPaymentProof(users.shipper, proofId, 'APPROVED'), /FORBIDDEN/);
  repo.reviewPaymentProof(users.admin, proofId, 'APPROVED');
  assert.throws(() => repo.reviewPaymentProof(users.admin, proofId, 'REJECTED'), /PAYMENT_PROOF_ALREADY_REVIEWED/);
  const proof = repo.listPaymentProofs(users.admin).find(row => row.id === proofId);
  assert.equal(proof.status, 'APPROVED');
});

test('role and tenant checks guard remaining mutation boundaries', () => {
  assert.throws(() => repo.createShipment(users.transporter, {
    serviceMode: 'FREIGHT', distributionMode: 'OPEN_MARKET', priceMode: 'QUOTE_REQUESTED'
  }), /FORBIDDEN/);
  assert.throws(() => repo.publishCapacity(users.driver, { vehicleId: 'veh-trans-1', status: 'EMPTY' }), /INVALID_VEHICLE/);
  assert.throws(() => repo.listApplications(users.shipper), /FORBIDDEN/);
  assert.throws(() => repo.listPaymentProofs(users.shipper), /FORBIDDEN/);
});

test.after(() => {
  dbModule.closeDb();
  for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(file + suffix)) fs.rmSync(file + suffix);
});
