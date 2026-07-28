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
  companyDriver: repo.getUserById('user-company-driver'),
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

test('Load Board discovery does not add an unrelated load to provider Tracking', () => {
  const shipment=createFreight();
  assert.ok(repo.listLoads(users.driver).some(row=>row.id===shipment.id));
  assert.equal(repo.listVisibleShipments(users.driver).some(row=>row.id===shipment.id),false);
  assert.ok(repo.listVisibleShipments(users.shipper).some(row=>row.id===shipment.id));
  const direct=createFreight('DIRECT_TO_PROVIDER','profile:provider-driver');
  assert.ok(repo.listVisibleShipments(users.driver).some(row=>row.id===direct.id));
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

test('fleet owner controls company driver load and capacity authority without reducing self-managed drivers', () => {
  const shipment=createFreight();
  assert.ok(repo.listLoads(users.companyDriver).some(row=>row.id===shipment.id));
  repo.expressInterest(users.companyDriver,shipment.id,'Company driver response');
  const ownerView=repo.getShipmentForUser(users.shipper,shipment.id);
  assert.ok(ownerView.interests.some(interest=>interest.provider_organization_id===users.transporter.organization_id&&interest.created_by===users.companyDriver.id&&interest.created_by_name==='Yonas Alemu'));
  assert.ok(repo.getShipmentForUser(users.transporter,shipment.id));
  const driverCapacityId=repo.publishCapacity(users.companyDriver,{vehicleId:'veh-trans-1',status:'PARTIAL',availablePercent:'60',acceptedLoads:'BOTH',locationArea:'Around Addis Ababa',origin:'Addis Ababa',destination:'Dire Dawa',visibility:'OPEN'});
  assert.equal(dbModule.getDb().prepare('SELECT updated_by FROM capacities WHERE id=?').get(driverCapacityId).updated_by,users.companyDriver.id);
  assert.throws(()=>repo.publishCapacity(users.companyDriver,{vehicleId:'veh-trans-2',status:'EMPTY',acceptedLoads:'FTL',locationArea:'Around Addis Ababa',visibility:'OPEN'}),/INVALID_VEHICLE/);

  repo.updateFleetDriverPermissions(users.transporter,users.companyDriver.id,{
    canBrowseLoadBoard:false,
    canContactBusinesses:false,
    canNegotiateLoads:false,
    canManageCapacity:false
  });
  const restricted=repo.getUserById(users.companyDriver.id);
  assert.equal(repo.listLoads(restricted).length,0);
  assert.equal(repo.getShipmentForUser(restricted,'shp-freight-fixed'),null);
  const db=dbModule.getDb();
  const before=db.prepare('SELECT COUNT(*) AS n FROM shipment_interests').get().n;
  assert.throws(()=>repo.expressInterest(restricted,createFreight().id,'Denied'),/FORBIDDEN/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM shipment_interests').get().n,before);
  assert.throws(()=>repo.publishCapacity(restricted,{vehicleId:'veh-trans-1',status:'EMPTY',acceptedLoads:'FTL',locationArea:'Around Addis Ababa',visibility:'OPEN'}),/FORBIDDEN/);
  assert.throws(()=>repo.publishCapacity(restricted,{vehicleId:'veh-trans-2',status:'EMPTY',acceptedLoads:'FTL',locationArea:'Around Addis Ababa',visibility:'OPEN'}),/FORBIDDEN|INVALID_VEHICLE/);

  const offDutyId=repo.setAssignedVehicleDuty(restricted,'veh-trans-1',false);
  assert.equal(db.prepare('SELECT status FROM capacities WHERE id=?').get(offDutyId).status,'OFF_DUTY');
  const onDutyId=repo.setAssignedVehicleDuty(restricted,'veh-trans-1',true);
  assert.equal(db.prepare('SELECT status FROM capacities WHERE id=?').get(onDutyId).status,'EMPTY');
  assert.throws(()=>repo.setAssignedVehicleDuty(restricted,'veh-trans-2',false),/INVALID_VEHICLE/);
  assert.ok(repo.listLoads(users.driver).length>0);

  repo.updateFleetDriverPermissions(users.transporter,users.companyDriver.id,{
    canBrowseLoadBoard:true,
    canContactBusinesses:true,
    canNegotiateLoads:true,
    canManageCapacity:true
  });
});

test('contact permission hides the designated Business phone and blocks negotiation while retaining load facts', () => {
  repo.updateFleetDriverPermissions(users.transporter,users.companyDriver.id,{
    canBrowseLoadBoard:true,
    canContactBusinesses:false,
    canNegotiateLoads:true,
    canManageCapacity:true
  });
  const restricted=repo.getUserById(users.companyDriver.id);
  const load=repo.listLoads(restricted).find(row=>row.id==='shp-freight-fixed');
  assert.ok(load);
  assert.equal(load.load_contact_phone,null);
  assert.throws(()=>repo.expressInterest(restricted,load.id,'Cannot contact'),/FORBIDDEN/);
  repo.updateFleetDriverPermissions(users.transporter,users.companyDriver.id,{
    canBrowseLoadBoard:true,
    canContactBusinesses:true,
    canNegotiateLoads:true,
    canManageCapacity:true
  });
});

test('application review is admin-only and terminal outcomes are immutable', () => {
  const applicationId = repo.createBusinessApplication({
    name: 'Authorization Applicant',
    businessName: 'Authorization Freight PLC',
    email: `authorization-${Date.now()}@loadgistic.local`,
    phone: '+251 911 700 200',
    password: 'StrongPass123!',
    applicationType: 'TRANSPORT_COMPANY',
    notes: 'Permission test'
  });
  assert.throws(() => repo.reviewApplication(users.shipper, applicationId, 'APPROVED'), /FORBIDDEN/);
  repo.reviewApplication(users.admin, applicationId, 'REJECTED', 'Rejected once');
  assert.throws(() => repo.reviewApplication(users.admin, applicationId, 'APPROVED'), /APPLICATION_ALREADY_REVIEWED/);
});

test('verification submission enforces ownership and admin-only review', () => {
  const upload={path:'/tmp/verification-test.pdf',originalName:'license.pdf',mimeType:'application/pdf'};
  assert.throws(()=>repo.submitVerification(users.driver,{subjectType:'VEHICLE',subjectId:'veh-trans-2',verificationType:'VEHICLE_AUTHORIZATION',documentName:'Owner authority'},upload),/FORBIDDEN/);
  assert.throws(()=>repo.submitVerification(users.companyDriver,{subjectType:'ORGANIZATION',subjectId:users.transporter.organization_id,verificationType:'BUSINESS_LICENSE',documentName:'Fleet license'},upload),/FORBIDDEN/);
  assert.throws(()=>repo.submitVerification(users.companyDriver,{subjectType:'VEHICLE',subjectId:'veh-trans-1',verificationType:'VEHICLE_AUTHORIZATION',documentName:'Vehicle authority'},upload),/FORBIDDEN/);
  const requestId=repo.submitVerification(users.transporter,{subjectType:'VEHICLE',subjectId:'veh-trans-2',verificationType:'VEHICLE_AUTHORIZATION',documentName:'Owner authority'},upload);
  assert.equal(repo.getVerificationFile(users.driver,requestId),null);
  assert.equal(repo.getVerificationFile(users.transporter,requestId).id,requestId);
  assert.throws(()=>repo.reviewVerification(users.shipper,requestId,'APPROVED'),/FORBIDDEN/);
  repo.reviewVerification(users.admin,requestId,'APPROVED','Ownership authority confirmed');
  assert.equal(repo.listVerificationRequests(users.admin).find(row=>row.id===requestId).status,'APPROVED');
  assert.throws(()=>repo.reviewVerification(users.admin,requestId,'REJECTED'),/VERIFICATION_ALREADY_REVIEWED/);
});

test('only completed shipper and receiver Businesses can review each other once', () => {
  const shipment=repo.createShipment(users.shipper,{
    title:'Completed review fixture',serviceMode:'FREIGHT',distributionMode:'DIRECT_TO_PROVIDER',providerRef:'org:org-transporter',
    priceMode:'QUOTE_REQUESTED',origin:'Addis Ababa',destination:'Hawassa',cargoDescription:'Review fixture',loadType:'PTL',
    packageCount:'1',pickupDate:new Date(Date.now()+86_400_000).toISOString().slice(0,10),receiverOrganizationId:users.receiver.organization_id,trackingMode:'STATUS_ONLY'
  });
  assert.throws(()=>repo.submitBusinessReview(users.shipper,shipment.id,'5','Too early'),/REVIEW_NOT_ALLOWED/);
  dbModule.getDb().prepare(`UPDATE shipments SET operational_status='COMPLETED' WHERE id=?`).run(shipment.id);
  const reviewId=repo.submitBusinessReview(users.shipper,shipment.id,'5','Reliable receiving team');
  assert.ok(reviewId);
  assert.throws(()=>repo.submitBusinessReview(users.shipper,shipment.id,'4','Duplicate'),/REVIEW_ALREADY_SUBMITTED/);
  assert.throws(()=>repo.submitBusinessReview(users.transporter,shipment.id,'5','Not a Business party'),/REVIEW_NOT_ALLOWED/);
  repo.submitBusinessReview(users.receiver,shipment.id,'4','Clear load information');
  const shipperProfile=repo.getPublicCompany('blue-nile-trading');
  assert.ok(shipperProfile.review_count>=1);
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
  assert.throws(() => repo.listVerificationRequests(users.shipper), /FORBIDDEN/);
});

test.after(() => {
  dbModule.closeDb();
  for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(file + suffix)) fs.rmSync(file + suffix);
});
