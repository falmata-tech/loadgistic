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
const futureRouteDate=new Date(Date.now()+2*86_400_000).toISOString().slice(0,10);

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

test('posted and sent loads stay out of Tracking until agreement', () => {
  const shipment=createFreight();
  assert.ok(repo.listLoads(users.driver).some(row=>row.id===shipment.id));
  assert.equal(repo.listVisibleShipments(users.driver).some(row=>row.id===shipment.id),false);
  assert.equal(repo.listVisibleShipments(users.shipper).some(row=>row.id===shipment.id),false);
  const direct=createFreight('DIRECT_TO_PROVIDER','profile:provider-driver');
  assert.equal(repo.listVisibleShipments(users.driver).some(row=>row.id===direct.id),false);
  repo.acceptDirectedShipment(users.driver,direct.id);
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
  repo.transitionShipment(users.driver,shipment.id,'ASSIGNED','Driver assigned',{locationArea:'Around Addis Ababa',locationSource:'DEVICE_OBSCURED',approximateLat:'9',approximateLng:'38.5',locationPrecisionKm:'20'});
  assert.throws(()=>repo.setTrackingMode(users.driver,shipment.id,'STATUS_ONLY'),/NOT_FOUND/);
  repo.setTrackingMode(users.receiver,shipment.id,'STATUS_ONLY');
  repo.addTrackingUpdate(users.driver,shipment.id,{note:'Loading completed'});
  const tracked=repo.getShipmentForUser(users.shipper,shipment.id);
  assert.equal(tracked.tracking_mode,'STATUS_ONLY');
  assert.ok(tracked.events.some(event=>event.event_type==='TRACKING_MODE'));
  assert.ok(tracked.events.some(event=>event.location_source==='DEVICE_OBSCURED'&&event.location_precision_km===20));
});

test('customer tracking code grants account and non-account parties but denies providers', () => {
  const code=repo.getBusinessTrackingAccessCode(users.shipper,'shp-freight-active');
  assert.match(code,/^LG-[A-F0-9]{4}-[A-F0-9]{4}$/);
  assert.equal(repo.unlockBusinessTracking(users.shipper,code).id,'shp-freight-active');
  assert.equal(repo.unlockBusinessTracking(users.receiver,code).id,'shp-freight-active');
  assert.equal(repo.unlockBusinessTracking(null,code).id,'shp-freight-active');
  assert.throws(()=>repo.unlockBusinessTracking(users.transporter,code),/TRACKING_ACCESS_DENIED/);
  assert.throws(()=>repo.unlockBusinessTracking(users.driver,code),/TRACKING_ACCESS_DENIED/);
  assert.equal(repo.getBusinessTracking(users.transporter,'shp-freight-active'),null);
  assert.ok(repo.getBusinessTracking(null,'shp-freight-active').events.length);
  assert.ok(repo.getBusinessTracking(users.shipper,'shp-freight-active').events.length);
  const stored=dbModule.getDb().prepare('SELECT tracking_code_hash FROM shipments WHERE id=?').get('shp-freight-active');
  assert.notEqual(stored.tracking_code_hash,code);

  const shipperOnly=createFreight();
  const shipperOnlyCode=repo.getBusinessTrackingAccessCode(users.shipper,shipperOnly.id);
  assert.equal(repo.unlockBusinessTracking(null,shipperOnlyCode).id,shipperOnly.id);
});

test('favorites and pending requests do not unlock Partners visibility until accepted', () => {
  const db=dbModule.getDb();
  const partnerCapacityId=repo.publishCapacity(users.driver,{
    vehicleId:'veh-driver-1',
    status:'EMPTY',
    acceptedLoads:'BOTH',
    locationArea:'Around Addis Ababa',
    origin:'Addis Ababa',
    destination:'Hawassa',
    travelDate:futureRouteDate,
    plannedSpaceStatus:'FULL',
    visibility:'SAVED_PARTNERS'
  });
  assert.equal(repo.listMarketCapacity(users.receiver).some(row=>row.id===partnerCapacityId),false);

  repo.changeNetworkRelationship(users.driver,{targetKind:'org',targetId:users.receiver.organization_id,action:'FAVORITE'});
  assert.equal(repo.getNetworkState(users.driver,'org',users.receiver.organization_id).is_favorite,true);
  assert.equal(repo.listMarketCapacity(users.receiver).some(row=>row.id===partnerCapacityId),false);

  repo.changeNetworkRelationship(users.driver,{targetKind:'org',targetId:users.receiver.organization_id,action:'REQUEST'});
  assert.equal(repo.getNetworkState(users.receiver,'profile',users.driver.provider_profile_id).incoming,true);
  assert.equal(repo.listMarketCapacity(users.receiver).some(row=>row.id===partnerCapacityId),false);

  repo.changeNetworkRelationship(users.receiver,{targetKind:'profile',targetId:users.driver.provider_profile_id,action:'ACCEPT'});
  assert.equal(repo.getNetworkState(users.driver,'org',users.receiver.organization_id).status,'CONNECTED');
  assert.ok(repo.listMarketCapacity(users.receiver).some(row=>row.id===partnerCapacityId));
  assert.ok(repo.listNetwork(users.receiver).connected.some(row=>row.target_id===users.driver.provider_profile_id));

  assert.throws(()=>repo.changeNetworkRelationship(users.companyDriver,{targetKind:'org',targetId:users.receiver.organization_id,action:'REQUEST'}),/FORBIDDEN/);
  assert.throws(()=>repo.changeNetworkRelationship(users.shipper,{targetKind:'org',targetId:users.receiver.organization_id,action:'REQUEST'}),/INVALID_NETWORK_TARGET/);
  assert.ok(db.prepare(`SELECT 1 FROM audit_logs WHERE action='NETWORK_CONNECTION_DECIDED'`).get());
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
  const driverCapacityId=repo.publishCapacity(users.companyDriver,{vehicleId:'veh-trans-1',status:'PARTIAL',availablePercent:'60',acceptedLoads:'BOTH',locationArea:'Around Addis Ababa',origin:'Addis Ababa',destination:'Dire Dawa',travelDate:futureRouteDate,plannedSpaceStatus:'PARTIAL',visibility:'OPEN'});
  assert.equal(dbModule.getDb().prepare('SELECT updated_by FROM capacities WHERE id=?').get(driverCapacityId).updated_by,users.companyDriver.id);
  assert.throws(()=>repo.publishCapacity(users.companyDriver,{vehicleId:'veh-trans-2',status:'EMPTY',acceptedLoads:'FTL',locationArea:'Around Addis Ababa',visibility:'OPEN'}),/INVALID_VEHICLE/);
  assert.throws(()=>repo.publishCapacity(users.transporter,{vehicleId:'veh-trans-1',status:'EMPTY',acceptedLoads:'FTL',locationArea:'Around Addis Ababa',locationSource:'DEVICE_OBSCURED',approximateLat:'9',approximateLng:'38.5',locationPrecisionKm:'40',visibility:'OPEN'}),/DEVICE_LOCATION_DRIVER_ONLY/);

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
  const review=repo.submitBusinessReview(users.shipper,shipment.id,'5','Reliable receiving team');
  assert.equal(review.status,'PUBLISHED');
  assert.throws(()=>repo.submitBusinessReview(users.shipper,shipment.id,'4','Duplicate'),/REVIEW_ALREADY_SUBMITTED/);
  assert.throws(()=>repo.submitBusinessReview(users.transporter,shipment.id,'5','Not a Business party'),/REVIEW_NOT_ALLOWED/);
  assert.equal(repo.submitBusinessReview(users.receiver,shipment.id,'4','Clear load information').status,'PUBLISHED');
  const shipperProfile=repo.getPublicCompany('blue-nile-trading');
  assert.ok(shipperProfile.review_count>=1);
});

test('low Business ratings stay private until an administrator publishes them', () => {
  const shipment=repo.createShipment(users.shipper,{
    title:'Low rating moderation fixture',serviceMode:'FREIGHT',distributionMode:'DIRECT_TO_PROVIDER',providerRef:'org:org-transporter',
    priceMode:'QUOTE_REQUESTED',origin:'Addis Ababa',destination:'Adama',cargoDescription:'Moderation fixture',loadType:'PTL',
    pickupDate:new Date(Date.now()+86_400_000).toISOString().slice(0,10),receiverOrganizationId:users.receiver.organization_id,trackingMode:'STATUS_ONLY'
  });
  dbModule.getDb().prepare(`UPDATE shipments SET operational_status='COMPLETED' WHERE id=?`).run(shipment.id);
  assert.throws(()=>repo.submitBusinessReview(users.shipper,shipment.id,'2',''),/LOW_RATING_NOTE_REQUIRED/);
  const before=repo.getPublicCompany('fresh-foods-distribution').review_count;
  const pending=repo.submitBusinessReview(users.shipper,shipment.id,'2','Damaged cartons need investigation');
  assert.equal(pending.status,'PENDING');
  assert.equal(repo.getPublicCompany('fresh-foods-distribution').review_count,before);
  assert.equal(repo.getShipmentForUser(users.receiver,shipment.id).business_reviews.some(review=>review.id===pending.id),false);
  assert.equal(repo.getShipmentForUser(users.shipper,shipment.id).business_reviews.find(review=>review.id===pending.id).status,'PENDING');
  assert.throws(()=>repo.listRatingModerationQueue(users.shipper),/FORBIDDEN/);
  assert.throws(()=>repo.reviewBusinessRating(users.shipper,pending.id,'PUBLISHED','Unauthorized'),/FORBIDDEN/);
  const queued=repo.listRatingModerationQueue(users.admin).find(review=>review.id===pending.id);
  assert.equal(queued.note,'Damaged cartons need investigation');
  assert.equal(Object.hasOwn(queued,'receiver_phone'),false);
  assert.throws(()=>repo.reviewBusinessRating(users.admin,pending.id,'PUBLISHED',''),/RATING_REVIEW_NOTE_REQUIRED/);
  assert.equal(repo.reviewBusinessRating(users.admin,pending.id,'PUBLISHED','Load records and both parties were reviewed.').status,'PUBLISHED');
  assert.equal(repo.getPublicCompany('fresh-foods-distribution').review_count,before+1);
  assert.throws(()=>repo.reviewBusinessRating(users.admin,pending.id,'DISMISSED','Second decision'),/RATING_ALREADY_REVIEWED/);
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
  assert.throws(() => repo.getAdminOperations(users.shipper), /FORBIDDEN/);
  assert.throws(() => repo.setAdminRecordActive(users.shipper,'USER',users.receiver.id,false), /FORBIDDEN/);
});

test('admin activation controls are reversible, audited, and cannot suspend self',()=>{
  const db=dbModule.getDb();
  assert.throws(()=>repo.setAdminRecordActive(users.admin,'USER',users.admin.id,false),/ADMIN_SELF_SUSPENSION_DENIED/);
  repo.setAdminRecordActive(users.admin,'USER',users.receiver.id,false);
  assert.equal(repo.getUserById(users.receiver.id).active,0);
  repo.setAdminRecordActive(users.admin,'USER',users.receiver.id,true);
  assert.equal(repo.getUserById(users.receiver.id).active,1);
  repo.setAdminRecordActive(users.admin,'VEHICLE','veh-trans-2',false);
  assert.equal(db.prepare('SELECT active FROM vehicles WHERE id=?').get('veh-trans-2').active,0);
  assert.equal(repo.listOwnVehicles(users.transporter).some(vehicle=>vehicle.id==='veh-trans-2'),false);
  repo.setAdminRecordActive(users.admin,'VEHICLE','veh-trans-2',true);
  assert.equal(db.prepare('SELECT active FROM vehicles WHERE id=?').get('veh-trans-2').active,1);
  assert.ok(db.prepare(`SELECT 1 FROM audit_logs WHERE action='ADMIN_VEHICLE_STATUS_CHANGED' AND entity_id='veh-trans-2'`).get());
});

test.after(() => {
  dbModule.closeDb();
  for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(file + suffix)) fs.rmSync(file + suffix);
});
