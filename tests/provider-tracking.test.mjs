import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATABASE_PATH='./data/test-provider-tracking.db';
const file=path.resolve(process.cwd(),process.env.DATABASE_PATH);
for(const suffix of ['', '-wal','-shm'])if(fs.existsSync(file+suffix))fs.rmSync(file+suffix);
const repo=await import('../src/lib/repository.js');
const {getDb}=await import('../src/lib/db.js');
const {reviewAccessCode}=await import('../src/lib/security.js');

const owner=repo.findUserByEmail('transporter@loadgistic.local');
const selfManaged=repo.findUserByEmail('driver@loadgistic.local');
const companyDriver=repo.findUserByEmail('company-driver@loadgistic.local');
const admin=repo.findUserByEmail('admin@loadgistic.local');
const vehicle=repo.listOwnVehicles(owner)[0];

function create(){
  return repo.createProviderShipment(owner,{vehicleId:vehicle.id,origin:'Addis Ababa, Ethiopia',originPlaceRef:'builtin:addis ababa',destination:'Adama, Ethiopia',destinationPlaceRef:'builtin:adama',cargoSummary:'Workshop machine parts',customerEmail:'owner@example.test',trackingMode:'STATUS_ONLY'});
}

test('provider creates one stable customer-owner code while storing only its digest',()=>{
  const created=create();
  assert.match(created.trackingCode,/^LG-[A-F0-9]{4}-[A-F0-9]{4}$/);
  assert.equal(created.trackingPath,'/track');
  const database=getDb();
  const grants=database.prepare('SELECT * FROM shipment_party_grants WHERE shipment_id=?').all(created.id);
  assert.equal(grants.length,1);
  assert.equal(JSON.stringify(grants).includes(created.trackingCode),false);
  assert.deepEqual(repo.unlockProviderTracking(created.trackingCode),{id:created.id,partyRole:'SHIPPER'});
  assert.equal(repo.getProviderShipment(owner,created.id).tracking_access_code,created.trackingCode);
  const access=database.prepare(`SELECT * FROM email_deliveries WHERE shipment_id=? AND delivery_kind='TRACKING_ACCESS'`).all(created.id);
  assert.equal(access.length,1);
  assert.equal(access[0].recipient_email,'owner@example.test');
});

test('assigned company Drivers can start Tracking while unrelated providers remain denied',()=>{
  const assignedVehicle=repo.listOwnVehicles(companyDriver)[0];
  const driverCreated=repo.createProviderShipment(companyDriver,{vehicleId:assignedVehicle.id,origin:'Addis Ababa, Ethiopia',originPlaceRef:'builtin:addis ababa',destination:'Adama, Ethiopia',destinationPlaceRef:'builtin:adama',cargoSummary:'Assigned customer load',customerEmail:'driver-customer@example.test',trackingMode:'STATUS_ONLY'});
  assert.ok(repo.getProviderShipment(companyDriver,driverCreated.id));
  const before=getDb().prepare('SELECT COUNT(*) AS count FROM provider_shipments').get().count;
  const foreignVehicle=repo.listOwnVehicles(selfManaged)[0];
  assert.throws(()=>repo.createProviderShipment(companyDriver,{vehicleId:foreignVehicle.id,origin:'Addis Ababa, Ethiopia',originPlaceRef:'builtin:addis ababa',destination:'Adama, Ethiopia',destinationPlaceRef:'builtin:adama',cargoSummary:'Unauthorized customer load',customerEmail:'blocked@example.test',trackingMode:'STATUS_ONLY'}),/INVALID_VEHICLE|FORBIDDEN/);
  assert.equal(getDb().prepare('SELECT COUNT(*) AS count FROM provider_shipments').get().count,before);
  const created=create();
  assert.equal(repo.getProviderShipment(selfManaged,created.id),null);
  assert.throws(()=>repo.updateProviderShipmentStatus(selfManaged,created.id,'LOADING'),/NOT_FOUND/);
});

test('fleet tracking permission denies company Driver reads and commands without side effects',()=>{
  const assignedVehicle=repo.listOwnVehicles(companyDriver)[0];
  const assigned=repo.createProviderShipment(owner,{vehicleId:assignedVehicle.id,origin:'Addis Ababa, Ethiopia',originPlaceRef:'builtin:addis ababa',destination:'Adama, Ethiopia',destinationPlaceRef:'builtin:adama',cargoSummary:'Fleet-owned assigned load',customerEmail:'fleet-customer@example.test',trackingMode:'STATUS_ONLY'});
  repo.updateFleetDriverPermissions(owner,companyDriver.id,{canManageCapacity:true,canManageTracking:false});
  try{
    assert.equal(repo.getDriverAccess(companyDriver).can_manage_tracking,false);
    assert.equal(repo.getProviderShipment(companyDriver,assigned.id),null);
    assert.equal(repo.listProviderShipments(companyDriver).some(shipment=>shipment.id===assigned.id),false);
    const beforeShipments=getDb().prepare('SELECT COUNT(*) AS count FROM provider_shipments').get().count;
    const beforeEvents=getDb().prepare('SELECT COUNT(*) AS count FROM provider_shipment_events WHERE shipment_id=?').get(assigned.id).count;
    assert.throws(()=>repo.createProviderShipment(companyDriver,{vehicleId:assignedVehicle.id,origin:'Addis Ababa, Ethiopia',originPlaceRef:'builtin:addis ababa',destination:'Adama, Ethiopia',destinationPlaceRef:'builtin:adama',cargoSummary:'Denied Tracking session',customerEmail:'blocked@example.test',trackingMode:'STATUS_ONLY'}),/FORBIDDEN/);
    assert.throws(()=>repo.updateProviderShipmentStatus(companyDriver,assigned.id,'LOADING'),/NOT_FOUND/);
    assert.equal(getDb().prepare('SELECT COUNT(*) AS count FROM provider_shipments').get().count,beforeShipments);
    assert.equal(getDb().prepare('SELECT COUNT(*) AS count FROM provider_shipment_events WHERE shipment_id=?').get(assigned.id).count,beforeEvents);
  }finally{
    repo.updateFleetDriverPermissions(owner,companyDriver.id,{canManageCapacity:true,canManageTracking:true});
  }
});

test('administrator Tracking inventory uses current provider sessions without customer secrets',()=>{
  const created=create();
  const result=repo.getAdminOperations(admin,created.code,{view:'TRACKING'});
  assert.equal(result.view,'TRACKING');
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].id,created.id);
  assert.equal(result.items[0].provider_name,'BlueLine Transport PLC');
  assert.equal(result.items[0].platform_number,vehicle.platform_number);
  assert.equal('shipper_email' in result.items[0],false);
  assert.equal(JSON.stringify(result.items).includes(created.trackingCode),false);
});

test('provider page updates preserve Loadgistic-controlled presentation',()=>{
  const before=repo.getOwnCompanyPage(owner);
  repo.updateCompanyPage(owner,{headline:before.headline,about:before.about,services:before.services,contactPhone:before.contact_phone,contactWhatsapp:before.contact_whatsapp,contactEmail:before.contact_email,contactWebsite:before.contact_website,showContactPhone:Boolean(before.show_contact_phone),showContactWhatsapp:Boolean(before.show_contact_whatsapp),showContactEmail:Boolean(before.show_contact_email),showContactWebsite:Boolean(before.show_contact_website),published:Boolean(before.published),themePrimary:'#000000',themeAccent:'#ffffff',youtubeVideoId:'dQw4w9WgXcQ'});
  const after=repo.getOwnCompanyPage(owner);
  assert.equal(after.theme_primary,before.theme_primary);
  assert.equal(after.theme_accent,before.theme_accent);
  assert.equal(after.youtube_video_id,before.youtube_video_id);
});

test('provider workflow is explicit and queues one owner access email and one completion email',()=>{
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
  assert.deepEqual(shipment.email_deliveries.map(delivery=>delivery.delivery_kind),['TRACKING_ACCESS','COMPLETION']);
  assert.equal(new Set(getDb().prepare('SELECT idempotency_key FROM email_deliveries WHERE shipment_id=?').all(created.id).map(row=>row.idempotency_key)).size,2);
});

test('explicit location consent exposes only assigned Driver approximate location during travel',()=>{
  const driverVehicle=repo.listOwnVehicles(selfManaged)[0];
  const created=repo.createProviderShipment(selfManaged,{vehicleId:driverVehicle.id,origin:'Addis Ababa, Ethiopia',originPlaceRef:'builtin:addis ababa',destination:'Adama, Ethiopia',destinationPlaceRef:'builtin:adama',cargoSummary:'Metal workshop inputs',customerEmail:'location-owner@example.test',trackingMode:'LOCATION_AND_STATUS'});
  const shipment=repo.getProviderShipment(selfManaged,created.id);
  assert.equal(shipment.tracking_mode,'LOCATION_AND_STATUS');
  assert.throws(()=>repo.updateProviderShipmentStatus(owner,created.id,'TO_PICKUP','Going to pickup',null,{locationArea:'Around Addis Ababa, Ethiopia',approximateLat:9.05,approximateLng:38.75,locationPrecisionKm:20,locationSource:'DEVICE_OBSCURED'}),/NOT_FOUND/);
  assert.throws(()=>repo.updateProviderShipmentStatus(selfManaged,created.id,'TO_PICKUP','Going to pickup'),/TRACKING_DEVICE_LOCATION_REQUIRED/);
  repo.updateProviderShipmentStatus(selfManaged,created.id,'TO_PICKUP','Going to pickup',null,{locationArea:'Around Addis Ababa, Ethiopia',approximateLat:9.05,approximateLng:38.75,locationPrecisionKm:20,locationSource:'DEVICE_OBSCURED'});
  const unlocked=repo.unlockProviderTracking(created.trackingCode);
  let guest=repo.getProviderGuestTracking(created.id,unlocked.partyRole);
  assert.equal(guest.operational_status,'TO_PICKUP');
  assert.deepEqual({area:guest.current_location.location_area,lat:guest.current_location.location_lat,lng:guest.current_location.location_lng,precision:guest.current_location.location_precision_km},{area:'Around Addis Ababa, Ethiopia',lat:9.05,lng:38.75,precision:20});
  assert.equal('assigned_driver_user_id' in guest,false);
  repo.updateProviderShipmentStatus(selfManaged,created.id,'LOADING','Loading');
  guest=repo.getProviderGuestTracking(created.id,unlocked.partyRole);
  assert.equal(guest.current_location,null);
  repo.updateProviderShipmentStatus(selfManaged,created.id,'IN_TRANSIT','En route',null,{locationArea:'Around Adama, Ethiopia',approximateLat:8.55,approximateLng:39.27,locationPrecisionKm:10,locationSource:'DEVICE_OBSCURED'});
  guest=repo.getProviderGuestTracking(created.id,unlocked.partyRole);
  assert.equal(guest.current_location.location_area,'Around Adama, Ethiopia');
  assert.deepEqual(guest.events.map(event=>event.status),['CREATED','TO_PICKUP','LOADING','IN_TRANSIT']);
  assert.equal(repo.updateProviderShipmentLocation(selfManaged,created.id,{locationArea:'Around Adama, Ethiopia',approximateLat:8.56,approximateLng:39.28,locationPrecisionKm:10,locationSource:'DEVICE_OBSCURED'}).reason,'THROTTLED');
  repo.updateProviderShipmentStatus(selfManaged,created.id,'UNLOADING','Unloading');
  assert.equal(repo.getProviderGuestTracking(created.id,unlocked.partyRole).current_location,null);
});

test('status-only provider Tracking never accepts or projects Driver location',()=>{
  const created=repo.createProviderShipment(selfManaged,{vehicleId:repo.listOwnVehicles(selfManaged)[0].id,origin:'Addis Ababa, Ethiopia',originPlaceRef:'builtin:addis ababa',destination:'Adama, Ethiopia',destinationPlaceRef:'builtin:adama',cargoSummary:'Status-only cargo',customerEmail:'status-owner@example.test',trackingMode:'STATUS_ONLY'});
  repo.updateProviderShipmentStatus(selfManaged,created.id,'TO_PICKUP','Going to pickup');
  assert.throws(()=>repo.updateProviderShipmentLocation(selfManaged,created.id,{locationArea:'Around Addis Ababa, Ethiopia',approximateLat:9.05,approximateLng:38.75,locationPrecisionKm:20,locationSource:'DEVICE_OBSCURED'}),/TRACKING_LOCATION_NOT_ENABLED/);
  assert.equal(repo.getProviderGuestTracking(created.id,'SHIPPER').current_location,null);
});

test('the customer owner can review and low reviews remain published during dispute',()=>{
  const created=create();
  for(const status of ['LOADING','IN_TRANSIT','UNLOADING','COMPLETED'])repo.updateProviderShipmentStatus(owner,created.id,status);
  assert.throws(()=>repo.unlockProviderReview(created.id,created.trackingCode),/REVIEW_NOT_ALLOWED/);
  assert.deepEqual(repo.unlockProviderReview(created.id,reviewAccessCode(created.id)),{id:created.id});
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
  assert.throws(()=>repo.unlockProviderTracking(created.trackingCode),/INVALID_TRACKING_CODE/);
  const record=repo.getProviderShipment(owner,created.id);
  assert.ok(record);
  assert.match(record.shipper_email,/redacted\.invalid$/);
  assert.equal(record.email_deliveries.length,0);
});
