import {createClient} from '@supabase/supabase-js';

const url=String(process.env.SUPABASE_SEED_URL||'').trim();
const serviceRoleKey=String(process.env.SUPABASE_SEED_SERVICE_ROLE_KEY||'').trim();
const anonKey=String(process.env.SUPABASE_SEED_ANON_KEY||'').trim();
if(!url||!serviceRoleKey||!anonKey)throw new Error('SUPABASE_TRACKING_VERIFY_CONFIG_MISSING');
const endpoint=new URL(url);
if(!new Set(['127.0.0.1','localhost','::1']).has(endpoint.hostname))throw new Error('REMOTE_TRACKING_VERIFY_REFUSED');

process.env.NEXT_PUBLIC_SUPABASE_URL=url;
process.env.SUPABASE_SERVICE_ROLE_KEY=serviceRoleKey;
process.env.SESSION_SECRET=process.env.SESSION_SECRET||'provider-tracking-local-verification-secret';

const service=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
const anon=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false}});
const tracking=await import('../src/lib/provider-tracking.js');
const {reviewAccessCode}=await import('../src/lib/security.js');

async function profile(email){
  const {data,error}=await service.from('profiles').select('*').eq('email',email).maybeSingle();
  if(error||!data)throw new Error(`SUPABASE_TRACKING_VERIFY_PROFILE_MISSING:${email}:${error?.message||''}`);
  return data;
}

async function expectCode(promise,pattern){
  await promise.then(
    ()=>{throw new Error(`SUPABASE_TRACKING_VERIFY_EXPECTED_DENIAL:${pattern}`);},
    error=>{if(!pattern.test(String(error?.message||'')))throw error;}
  );
}

const owner=await profile('transporter@loadgistic.local');
const driver=await profile('driver@loadgistic.local');
const companyDriver=await profile('company-driver@loadgistic.local');
const admin=await profile('admin@loadgistic.local');
const beforeDemand=await service.from('shipments').select('id',{count:'exact',head:true});
if(beforeDemand.error)throw new Error(`SUPABASE_TRACKING_VERIFY_DEMAND_COUNT_FAILED:${beforeDemand.error.message}`);

const driverWorkspace=await tracking.getProviderTrackingWorkspace(driver,{limit:10});
if(!driverWorkspace.access?.can_manage_tracking||!driverWorkspace.vehicles?.length)throw new Error('SUPABASE_TRACKING_VERIFY_DRIVER_WORKSPACE_FAILED');
const companyWorkspace=await tracking.getProviderTrackingWorkspace(companyDriver,{limit:10});
if(!companyWorkspace.access?.can_manage_tracking||!companyWorkspace.vehicles?.length)throw new Error('SUPABASE_TRACKING_VERIFY_COMPANY_DRIVER_WORKSPACE_FAILED');
const [{data:origin,error:originError},{data:destination,error:destinationError}]=await Promise.all([
  service.from('place_catalog').select('id').eq('normalized_name','addis ababa').limit(1).maybeSingle(),
  service.from('place_catalog').select('id').eq('normalized_name','adama').limit(1).maybeSingle()
]);
if(originError||destinationError||!origin||!destination)throw new Error('SUPABASE_TRACKING_VERIFY_PLACES_MISSING');

const created=await tracking.createProviderShipment(driver,{
  vehicleId:driverWorkspace.vehicles[0].id,originPlaceRef:origin.id,destinationPlaceRef:destination.id,
  cargoSummary:'Managed Tracking verification cargo',customerEmail:'tracking-owner@example.test',
  additionalRecipientEmails:['tracking-party@example.test'],
  trackingMode:'LOCATION_AND_STATUS'
});
if(!created.id||!/^LG-[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/.test(created.trackingCode))throw new Error('SUPABASE_TRACKING_VERIFY_CREATE_FAILED');
const {data:storedShipment,error:storedError}=await service.from('provider_shipments')
  .select('review_code_hash,shipper_email').eq('id',created.id).maybeSingle();
const {data:storedGrant,error:grantError}=await service.from('shipment_party_grants')
  .select('code_hash').eq('shipment_id',created.id).maybeSingle();
if(storedError||grantError||!storedShipment||!storedGrant)throw new Error('SUPABASE_TRACKING_VERIFY_AGGREGATE_MISSING');
if(storedGrant.code_hash===created.trackingCode||storedShipment.review_code_hash===reviewAccessCode(created.id))throw new Error('SUPABASE_TRACKING_VERIFY_PLAINTEXT_CODE');

const providerDetail=await tracking.getProviderShipment(driver,created.id);
if(providerDetail.tracking_recipients.length!==2
  ||providerDetail.tracking_recipients[0].recipient_role!=='OWNER'
  ||providerDetail.tracking_recipients[1].recipient_role!=='TRACKING_PARTY'){
  throw new Error('SUPABASE_TRACKING_VERIFY_RECIPIENTS_MISSING');
}
const beforeIneligibleChallenges=await service.from('provider_tracking_email_otps').select('id',{count:'exact',head:true});
const beforeIneligibleDeliveries=await service.from('access_email_deliveries').select('id',{count:'exact',head:true}).eq('delivery_kind','TRACKING_OTP');
const ineligible=await tracking.requestProviderTrackingOtp('unknown@example.test',created.trackingCode);
const wrongCode=await tracking.requestProviderTrackingOtp('tracking-owner@example.test','LG-0000-0000-0000-0000');
const afterIneligibleChallenges=await service.from('provider_tracking_email_otps').select('id',{count:'exact',head:true});
const afterIneligibleDeliveries=await service.from('access_email_deliveries').select('id',{count:'exact',head:true}).eq('delivery_kind','TRACKING_OTP');
if(ineligible.deliveryQueued||wrongCode.deliveryQueued
  ||afterIneligibleChallenges.count!==beforeIneligibleChallenges.count
  ||afterIneligibleDeliveries.count!==beforeIneligibleDeliveries.count){
  throw new Error('SUPABASE_TRACKING_VERIFY_INELIGIBLE_OTP_SIDE_EFFECT');
}
const ownerChallenge=await tracking.requestProviderTrackingOtp('tracking-owner@example.test',created.trackingCode);
if(!ownerChallenge.deliveryQueued)throw new Error('SUPABASE_TRACKING_VERIFY_OWNER_OTP_NOT_QUEUED');
const invalidOwnerOtp=ownerChallenge.accessCode==='000000'?'000001':'000000';
await expectCode(tracking.verifyProviderTrackingOtp(
  'tracking-owner@example.test',created.trackingCode,ownerChallenge.challengeId,invalidOwnerOtp
),/TRACKING_ACCESS_DENIED/);
const unlocked=await tracking.verifyProviderTrackingOtp(
  'tracking-owner@example.test',created.trackingCode,ownerChallenge.challengeId,ownerChallenge.accessCode
);
if(unlocked.id!==created.id||unlocked.recipientRole!=='OWNER'||!unlocked.recipientDigest)throw new Error('SUPABASE_TRACKING_VERIFY_UNLOCK_FAILED');
const partyChallenge=await tracking.requestProviderTrackingOtp('tracking-party@example.test',created.trackingCode);
const partyAccess=await tracking.verifyProviderTrackingOtp(
  'tracking-party@example.test',created.trackingCode,partyChallenge.challengeId,partyChallenge.accessCode
);
if(partyAccess.recipientRole!=='TRACKING_PARTY')throw new Error('SUPABASE_TRACKING_VERIFY_PARTY_UNLOCK_FAILED');
let partyGuest=await tracking.getProviderGuestTracking(created.id,partyAccess.recipientDigest);
if(!partyGuest||partyGuest.party_role!=='RECEIVER'||partyGuest.can_review)throw new Error('SUPABASE_TRACKING_VERIFY_PARTY_PROJECTION_FAILED');
await tracking.revokeProviderTrackingRecipient(driver,created.id,providerDetail.tracking_recipients[1].id);
partyGuest=await tracking.getProviderGuestTracking(created.id,partyAccess.recipientDigest);
if(partyGuest!==null)throw new Error('SUPABASE_TRACKING_VERIFY_REVOKED_SESSION_ALLOWED');
const revokedRequest=await tracking.requestProviderTrackingOtp('tracking-party@example.test',created.trackingCode);
if(revokedRequest.deliveryQueued)throw new Error('SUPABASE_TRACKING_VERIFY_REVOKED_OTP_QUEUED');
const {error:anonymousUnlockError}=await anon.rpc('unlock_provider_tracking',{tracking_code_hash:'not-a-valid-digest'});
if(!anonymousUnlockError)throw new Error('SUPABASE_TRACKING_VERIFY_ANONYMOUS_UNLOCK_ALLOWED');

if(await tracking.getProviderShipment(owner,created.id)!==null)throw new Error('SUPABASE_TRACKING_VERIFY_CROSS_PROVIDER_READ');
await expectCode(tracking.updateProviderShipmentStatus(owner,created.id,'TO_PICKUP','',null,{
  locationArea:'Around Addis Ababa, Ethiopia',approximateLat:9.03,approximateLng:38.75,
  locationPrecisionKm:10,locationSource:'DEVICE_OBSCURED'
}),/NOT_FOUND/);
await expectCode(tracking.updateProviderShipmentStatus(driver,created.id,'TO_PICKUP'),/TRACKING_DEVICE_LOCATION_REQUIRED/);

await tracking.updateProviderShipmentStatus(driver,created.id,'TO_PICKUP','Going to pickup',null,{
  locationArea:'Around Addis Ababa, Ethiopia',approximateLat:9.03,approximateLng:38.75,
  locationPrecisionKm:10,locationSource:'DEVICE_OBSCURED'
});
let guest=await tracking.getProviderGuestTracking(created.id,unlocked.recipientDigest);
if(!guest?.current_location||guest.current_location.location_precision_km!==10)throw new Error('SUPABASE_TRACKING_VERIFY_GUEST_LOCATION_MISSING');
if(JSON.stringify(guest).includes('tracking-owner@example.test')||'assigned_driver_user_id' in guest)throw new Error('SUPABASE_TRACKING_VERIFY_GUEST_SECRET_LEAK');
await tracking.updateProviderShipmentStatus(driver,created.id,'LOADING','Loading');
guest=await tracking.getProviderGuestTracking(created.id,unlocked.recipientDigest);
if(guest.current_location!==null)throw new Error('SUPABASE_TRACKING_VERIFY_LOCATION_STATE_LEAK');
await expectCode(tracking.updateProviderShipmentStatus(driver,created.id,'IN_TRANSIT','',{
  path:'supabase://shipment-proof/tracking-proof/test.jpg',originalName:'test.jpg',mimeType:'image/jpeg'
}),/PROOF_NOT_ALLOWED_FOR_STATUS/);
await tracking.updateProviderShipmentStatus(driver,created.id,'IN_TRANSIT','En route',null,{
  locationArea:'Around Adama, Ethiopia',approximateLat:8.54,approximateLng:39.27,
  locationPrecisionKm:20,locationSource:'DEVICE_OBSCURED'
});
const throttled=await tracking.updateProviderShipmentLocation(driver,created.id,{
  locationArea:'Around Adama, Ethiopia',approximateLat:8.55,approximateLng:39.28,
  locationPrecisionKm:20,locationSource:'DEVICE_OBSCURED'
});
if(throttled.reason!=='THROTTLED')throw new Error('SUPABASE_TRACKING_VERIFY_LOCATION_THROTTLE_FAILED');
await tracking.updateProviderShipmentStatus(driver,created.id,'UNLOADING','Unloading');
await tracking.updateProviderShipmentStatus(driver,created.id,'COMPLETED','Complete');

await expectCode(tracking.unlockProviderReview(created.id,created.trackingCode),/REVIEW_NOT_ALLOWED/);
const reviewGrant=await tracking.unlockProviderReview(created.id,reviewAccessCode(created.id));
if(reviewGrant.id!==created.id)throw new Error('SUPABASE_TRACKING_VERIFY_REVIEW_UNLOCK_FAILED');
const reviewId=await tracking.submitProviderReview(created.id,'SHIPPER',3,'Updates could have been clearer.');
await expectCode(tracking.submitProviderReview(created.id,'SHIPPER',5,'Duplicate'),/REVIEW_ALREADY_SUBMITTED/);
await tracking.disputeProviderReview(driver,reviewId,'The timeline shows each operational update.');
const pending=await tracking.listProviderReviewModeration(admin,'PENDING',{page:1,pageSize:100});
if(!pending.items.some(review=>review.id===reviewId&&review.status==='PENDING'))throw new Error('SUPABASE_TRACKING_VERIFY_REVIEW_QUEUE_FAILED');
await tracking.resolveProviderReview(admin,reviewId,'UPHELD','The review is supported by the available record.');

const pendingEmails=await tracking.listPendingEmailDeliveries(100);
if(!pendingEmails.some(delivery=>delivery.shipment_id===created.id&&delivery.delivery_kind==='COMPLETION'))throw new Error('SUPABASE_TRACKING_VERIFY_COMPLETION_EMAIL_MISSING');
const completion=pendingEmails.find(delivery=>delivery.shipment_id===created.id&&delivery.delivery_kind==='COMPLETION');
if(!Array.isArray(completion.events)||completion.events.length<5)throw new Error('SUPABASE_TRACKING_VERIFY_COMPLETION_TIMELINE_MISSING');
if(completion.events.some(event=>Object.keys(event).some(key=>['proof_storage_path','actor_user_id','approximate_lat','approximate_lng'].includes(key))))throw new Error('SUPABASE_TRACKING_VERIFY_COMPLETION_TIMELINE_PRIVATE_DATA');
await tracking.recordEmailDeliveryAttempt(completion.id,{sent:false,error:'LOCAL_VERIFICATION'});
const {data:failedDelivery,error:failedError}=await service.from('email_deliveries')
  .select('status,attempts').eq('id',completion.id).maybeSingle();
if(failedError||failedDelivery?.status!=='FAILED'||failedDelivery.attempts!==1)throw new Error('SUPABASE_TRACKING_VERIFY_EMAIL_RETRY_FAILED');

const {error:expireError}=await service.from('provider_shipments')
  .update({guest_expires_at:'2000-01-01T00:00:00.000Z'}).eq('id',created.id);
if(expireError)throw new Error(`SUPABASE_TRACKING_VERIFY_EXPIRY_SETUP_FAILED:${expireError.message}`);
const cleanup=await tracking.purgeExpiredProviderShipmentGuests(100);
if(!cleanup.shipmentIds.includes(created.id))throw new Error('SUPABASE_TRACKING_VERIFY_CLEANUP_FAILED');
const retained=await tracking.getProviderShipment(driver,created.id);
if(!retained||!/@redacted\.invalid$/.test(retained.shipper_email)||retained.events.length<5||!retained.review)throw new Error('SUPABASE_TRACKING_VERIFY_HISTORY_NOT_RETAINED');
if(retained.email_deliveries.length!==0||retained.tracking_access_code!==null)throw new Error('SUPABASE_TRACKING_VERIFY_GUEST_DATA_RETAINED');
if(await tracking.getProviderGuestTracking(created.id,unlocked.recipientDigest)!==null)throw new Error('SUPABASE_TRACKING_VERIFY_EXPIRED_GUEST_READ');
const retainedRecipients=await service.from('provider_tracking_recipients').select('id',{count:'exact',head:true}).eq('shipment_id',created.id);
const retainedOtps=await service.from('provider_tracking_email_otps').select('id',{count:'exact',head:true}).eq('shipment_id',created.id);
if(retainedRecipients.count!==0||retainedOtps.count!==0)throw new Error('SUPABASE_TRACKING_VERIFY_EXPIRED_RECIPIENT_DATA_RETAINED');

const afterDemand=await service.from('shipments').select('id',{count:'exact',head:true});
if(afterDemand.error||afterDemand.count!==beforeDemand.count)throw new Error('SUPABASE_TRACKING_VERIFY_DEMAND_MUTATED');
process.stdout.write('Supabase provider Tracking recipients, email OTP, revocation, location, review, delivery, and cleanup checks passed.\n');
