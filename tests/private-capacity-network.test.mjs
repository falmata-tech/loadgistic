import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATABASE_PATH='./data/test-private-capacity-network.db';
const file=path.resolve(process.cwd(),process.env.DATABASE_PATH);
for(const suffix of ['', '-wal','-shm'])if(fs.existsSync(file+suffix))fs.rmSync(file+suffix);
const repo=await import('../src/lib/repository.js');
const {getDb}=await import('../src/lib/db.js');
const {localAccessCodeForDevelopment}=await import('../src/lib/email-delivery.js');
const {
  SHARED_CAPACITY_IDLE_MS,
  SHARED_CAPACITY_RENEW_AFTER_MS,
  sharedCapacityDeadline,
  sharedCapacitySessionExpired,
  sharedCapacitySessionNeedsRenewal
}=await import('../src/lib/shared-capacity-session.js');

test('Shared capacity uses a 30-minute deliberate-activity idle boundary',()=>{
  const startedAt=1_000_000;
  const expiresAt=startedAt+SHARED_CAPACITY_IDLE_MS;
  assert.equal(SHARED_CAPACITY_IDLE_MS,30*60*1000);
  assert.equal(SHARED_CAPACITY_RENEW_AFTER_MS,60*1000);
  assert.equal(sharedCapacityDeadline(startedAt,expiresAt),expiresAt);
  assert.equal(sharedCapacitySessionExpired(expiresAt-1,startedAt,expiresAt),false);
  assert.equal(sharedCapacitySessionExpired(expiresAt,startedAt,expiresAt),true);
  assert.equal(sharedCapacitySessionNeedsRenewal(startedAt+SHARED_CAPACITY_RENEW_AFTER_MS-1,startedAt),false);
  assert.equal(sharedCapacitySessionNeedsRenewal(startedAt+SHARED_CAPACITY_RENEW_AFTER_MS,startedAt),true);
  assert.equal(sharedCapacityDeadline(startedAt,expiresAt-10_000),expiresAt-10_000);
});

test('local access codes appear only for eligible unconfigured non-production delivery',()=>{
  const challenge={deliveryQueued:true,accessCode:'12345678'};
  assert.equal(localAccessCodeForDevelopment(challenge,{configured:false},'development'),'12345678');
  assert.equal(localAccessCodeForDevelopment(challenge,{configured:false},'production'),null);
  assert.equal(localAccessCodeForDevelopment(challenge,{configured:true},'development'),null);
  assert.equal(localAccessCodeForDevelopment({deliveryQueued:false},{configured:false},'development'),null);
});

test('one email OTP opens every active private truck share and is single-use',()=>{
  const db=getDb();
  const owner=repo.findUserByEmail('transporter@loadgistic.local');
  const candidate=db.prepare(`SELECT c.id,c.vehicle_id FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id
    WHERE v.organization_id=? AND c.id=(SELECT latest.id FROM capacities latest WHERE latest.vehicle_id=v.id ORDER BY latest.updated_at DESC,latest.id DESC LIMIT 1)
    AND COALESCE(c.market_status,c.status) IN ('EMPTY','PARTIAL') LIMIT 1`).get(owner.organization_id);
  assert.ok(candidate);
  const privateRoute=[
    {place_ref:'private:test-origin',label:'Confidential Origin, Ethiopia',lat:9.01,lng:38.72},
    {place_ref:'private:test-destination',label:'Confidential Destination, Ethiopia',lat:9.08,lng:38.83}
  ];
  db.prepare(`UPDATE capacities SET visibility='PRIVATE',availability_geometry='ROUTE',location_area='Confidential Yard',
    current_route_points_json=?,capacity_area_boundary_json='[]' WHERE id=?`).run(JSON.stringify(privateRoute),candidate.id);
  const publicFallback=repo.listPublicCapacityCursor({capacityId:candidate.id},{pageSize:12}).items;
  assert.equal(publicFallback.length,1);
  assert.equal(publicFallback[0].current_signal_geometry_visible,false);
  assert.equal(publicFallback[0].current_signal_visibility,'PRIVATE_NETWORK');
  assert.equal(publicFallback[0].availability_geometry,null);
  assert.equal(publicFallback[0].location_lat,null);
  assert.equal(publicFallback[0].location_update_stage,null);
  assert.equal(publicFallback[0].location_updated_label,null);
  assert.equal(publicFallback[0].location_is_last_reported,null);
  assert.deepEqual(publicFallback[0].current_route_points,[]);
  assert.equal(publicFallback[0].recurring_corridors.length,1);
  assert.equal(repo.listPublicCapacityCursor({q:'Confidential Origin'},{pageSize:12}).items.some(item=>item.id===candidate.id),false);
  assert.equal(repo.listPublicCapacityCursor({nearLat:9.01,nearLng:38.72,nearRadiusKm:5},{pageSize:12}).items.some(item=>item.id===candidate.id),false);
  const grant=repo.grantPrivateCapacityAccess(owner,{vehicleId:candidate.vehicle_id,email:'Buyer@Example.com'});
  assert.equal('access_code' in grant,false);
  const second=db.prepare(`SELECT c.id,c.vehicle_id FROM capacities c JOIN vehicles v ON v.id=c.vehicle_id
    WHERE v.organization_id=? AND v.id<>? AND COALESCE(c.market_status,c.status) IN ('EMPTY','PARTIAL') LIMIT 1`).get(owner.organization_id,candidate.vehicle_id);
  assert.ok(second);
  db.prepare(`UPDATE capacities SET visibility='PRIVATE' WHERE id=?`).run(second.id);
  repo.grantPrivateCapacityAccess(owner,{vehicleId:second.vehicle_id,email:'buyer@example.com'});
  const challenge=repo.requestSharedCapacityOtp('buyer@example.com');
  assert.match(challenge.accessCode,/^\d{8}$/);
  const access=repo.verifySharedCapacityAccess('buyer@example.com',challenge.accessCode);
  const shared=repo.listSharedCapacity(access.emailDigest,{capacityId:candidate.id});
  assert.equal(shared.items.length,1);
  assert.equal(shared.items[0].current_signal_geometry_visible,true);
  assert.deepEqual(shared.items[0].current_route_points.map(point=>point.label),privateRoute.map(point=>point.label));
  assert.equal(repo.listSharedCapacity(access.emailDigest,{}).items.filter(item=>[candidate.vehicle_id,second.vehicle_id].includes(item.vehicle_id)).length,2);
  assert.equal(shared.items[0].location_precision_km,db.prepare('SELECT location_precision_km FROM capacities WHERE id=?').get(candidate.id).location_precision_km);
  assert.ok(shared.items[0].location_updated_label);
  assert.equal(JSON.stringify(shared).includes('recipient_email'),false);
  assert.throws(()=>repo.verifySharedCapacityAccess('buyer@example.com',challenge.accessCode),/SHARED_CAPACITY_ACCESS_DENIED/);
  repo.revokePrivateCapacityAccess(owner,grant.id);
  assert.equal(repo.listSharedCapacity(access.emailDigest,{capacityId:candidate.id}).items.length,0);
});

test('Shared capacity OTP requests do not disclose unknown emails and stop after five failed attempts',()=>{
  const db=getDb();
  const unknown=repo.requestSharedCapacityOtp('unknown-capacity@example.com');
  assert.deepEqual(unknown,{accepted:true,deliveryQueued:false});
  const owner=repo.findUserByEmail('transporter@loadgistic.local');
  const vehicle=db.prepare(`SELECT id FROM vehicles WHERE organization_id=? AND active=1 LIMIT 1`).get(owner.organization_id);
  repo.grantPrivateCapacityAccess(owner,{vehicleId:vehicle.id,email:'attempts@example.com'});
  const challenge=repo.requestSharedCapacityOtp('attempts@example.com');
  for(let attempt=0;attempt<5;attempt+=1)assert.throws(()=>repo.verifySharedCapacityAccess('attempts@example.com','00000000'),/SHARED_CAPACITY_ACCESS_DENIED/);
  assert.throws(()=>repo.verifySharedCapacityAccess('attempts@example.com',challenge.accessCode),/SHARED_CAPACITY_ACCESS_DENIED/);
  assert.equal(db.prepare(`SELECT attempt_count FROM shared_capacity_email_otps WHERE id=?`).get(challenge.challengeId).attempt_count,5);
});

test('fleet owner controls all owned grants while unrelated providers fail closed',()=>{
  const db=getDb();
  const owner=repo.findUserByEmail('transporter@loadgistic.local');
  const other=db.prepare(`SELECT u.* FROM users u WHERE u.role='DRIVER' AND u.provider_profile_id IS NOT NULL LIMIT 1`).get();
  const vehicle=db.prepare(`SELECT id FROM vehicles WHERE organization_id=? AND active=1 LIMIT 1`).get(owner.organization_id);
  const grant=repo.grantPrivateCapacityAccess(owner,{vehicleId:vehicle.id,email:'fleet-contact@example.com'});
  assert.ok(repo.listPrivateCapacityNetwork(owner).flatMap(item=>item.grants).some(item=>item.id===grant.id));
  assert.throws(()=>repo.revokePrivateCapacityAccess(other,grant.id),/(NOT_FOUND|FORBIDDEN)/);
  repo.setLoadgisticCapacityAccess(owner,vehicle.id,true);
  const admin=repo.findUserByEmail('admin@loadgistic.local');
  assert.ok(repo.listLoadgisticSharedCapacity(admin,{}).items.some(item=>item.vehicle_id===vehicle.id));
  repo.setLoadgisticCapacityAccess(owner,vehicle.id,false);
  assert.equal(repo.listLoadgisticSharedCapacity(admin,{}).items.some(item=>item.vehicle_id===vehicle.id),false);
});

test('anonymous Assisted matching creates no load and authorizes only guest or assigned team',()=>{
  const db=getDb();
  assert.throws(()=>repo.createGuestSupportConversation({email:'missing-phone@example.com',body:'I need a local truck.'}),/CALLBACK_PHONE_REQUIRED/);
  const shipmentCount=db.prepare('SELECT COUNT(*) AS n FROM shipments').get().n;
  const created=repo.createGuestSupportConversation({email:'guest-help@example.com',phone:'+251 911 000 111',body:'I need a small truck from Adama to Bishoftu.'});
  assert.match(created.accessCode,/^LG-HELP-/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM shipments').get().n,shipmentCount);
  const recovery=repo.verifyGuestSupportAccess('guest-help@example.com',created.accessCode);
  const guest=repo.getGuestSupportConversationForGuest(created.id,recovery.emailDigest);
  assert.equal(guest.messages.length,1);
  repo.sendGuestSupportMessage(null,created.id,'The cargo is packaged metal fittings.',recovery.emailDigest);
  assert.equal(repo.getGuestSupportConversationForGuest(created.id,recovery.emailDigest).messages.length,2);
  const assigned=db.prepare('SELECT assigned_agent_user_id FROM guest_support_conversations WHERE id=?').get(created.id);
  assert.ok(assigned.assigned_agent_user_id);
  const agent=repo.getUserById(assigned.assigned_agent_user_id);
  repo.sendGuestSupportMessage(agent,created.id,'I am checking nearby private capacity now.');
  assert.equal(repo.getGuestSupportConversationForTeam(agent,created.id).messages.length,3);
  const unrelated=db.prepare(`SELECT * FROM users WHERE role='SUPPORT' AND id<>? LIMIT 1`).get(agent.id);
  if(unrelated)assert.throws(()=>repo.getGuestSupportConversationForTeam(unrelated,created.id),/NOT_FOUND/);
  repo.endGuestSupportConversation(created.id,recovery.emailDigest);
  assert.equal(repo.getGuestSupportConversationForGuest(created.id,recovery.emailDigest).status,'CLOSED');
  assert.throws(()=>repo.sendGuestSupportMessage(null,created.id,'One more note.',recovery.emailDigest),/SUPPORT_CONVERSATION_CLOSED/);
  const restarted=repo.createGuestSupportConversation({email:'guest-help@example.com',phone:'+251 911 000 111',body:'I am starting a separate follow-up chat.'});
  assert.notEqual(restarted.id,created.id);
});

test('private-capacity recovery email delivery stays on the managed queue boundary',()=>{
  const accessFacade=fs.readFileSync(path.resolve(process.cwd(),'src/lib/access-email.js'),'utf8');
  const deliveryWorker=fs.readFileSync(path.resolve(process.cwd(),'src/lib/email-delivery.js'),'utf8');
  const verifier=fs.readFileSync(path.resolve(process.cwd(),'scripts/verify-supabase-shared-capacity.mjs'),'utf8');
  assert.match(accessFacade,/listSupabasePendingAccessEmailDeliveries/);
  assert.match(accessFacade,/recordSupabaseAccessEmailDeliveryAttempt/);
  assert.doesNotMatch(accessFacade,/repository\.js|DATA_BACKEND/);
  assert.match(deliveryWorker,/from '\.\/access-email\.js'/);
  assert.match(verifier,/listPendingAccessEmailDeliveries\(100\)/);
  assert.match(verifier,/recordAccessEmailDeliveryAttempt\(delivery\.id,\{sent:true\}\)/);
  assert.match(verifier,/SUPABASE_SHARED_VERIFY_DELIVERY_QUEUE_FAILED/);
  assert.match(verifier,/SUPABASE_SHARED_VERIFY_DELIVERY_RECORD_FAILED/);
});
