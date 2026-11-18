import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
import {randomBytes, randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';

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
function checked(result){
  if(result.error)throw new Error(result.error.message);
  return result.data;
}
async function rpc(name,input){return checked(await service.rpc(name,input));}

// This verifier exercises global expiry cleanup and retains a synthetic
// shipment until stack teardown. Never run it against a mixed user preview.
let fixtureAccountCount=0;
for(let page=1;;page+=1){
  const {data,error}=await service.auth.admin.listUsers({page,perPage:1000});
  if(error)throw new Error('SUPABASE_TRACKING_VERIFY_FIXTURE_SCOPE_UNAVAILABLE');
  const accounts=data?.users||[];
  if(accounts.some(account=>account.app_metadata?.fixture_source!=='loadgistic')){
    throw new Error('SUPABASE_TRACKING_VERIFY_MIXED_PREVIEW_REFUSED');
  }
  fixtureAccountCount+=accounts.length;
  if(accounts.length<1000)break;
}
if(!fixtureAccountCount)throw new Error('SUPABASE_TRACKING_VERIFY_FIXTURES_MISSING');

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
const [{data:origin,error:originError},{data:destination,error:destinationError},{data:passing,error:passingError}]=await Promise.all([
  service.from('place_catalog').select('id').eq('normalized_name','addis ababa').limit(1).maybeSingle(),
  service.from('place_catalog').select('id').eq('normalized_name','adama').limit(1).maybeSingle(),
  service.from('place_catalog').select('id').eq('normalized_name','dire dawa').limit(1).maybeSingle()
]);
if(originError||destinationError||passingError||!origin||!destination||!passing)throw new Error('SUPABASE_TRACKING_VERIFY_PLACES_MISSING');

const fixtureKey='tracking-managed-'+randomUUID();
const customer=checked(await service.auth.admin.createUser({
  email:fixtureKey+'@example.test',email_confirm:true,
  app_metadata:{fixture_source:'loadgistic',fixture_key:fixtureKey,is_demo:true},
})).user;
checked(await service.from('profiles').update({role:'SHIPPER',active:true,full_name:'Synthetic registered shipper'}).eq('id',customer.id));
await rpc('accept_content_policy',{actor_user_id:customer.id,policy_version:'2026-10-09'});
const shipmentInput={
  vehicleId:driverWorkspace.vehicles[0].id,originPlaceRef:origin.id,destinationPlaceRef:destination.id,passingPlaceRef:passing.id,
  cargoSummary:'Managed Tracking verification cargo',customerEmail:customer.email,
  trackingMode:'LOCATION_AND_STATUS',expectedDeliveryDate:new Date(Date.now()+86400000).toISOString().slice(0,10)
};
await expectCode(tracking.createProviderShipment(driver,{
  ...shipmentInput,additionalRecipientEmails:['tracking-party@example.test']
}),/TRACKING_OWNER_SHARES_ACCESS/);
await expectCode(tracking.createProviderShipment(driver,{...shipmentInput,customerEmail:'unknown-owner@example.test'}),/TRACKING_REGISTERED_OWNER_REQUIRED/);
const created=await tracking.createProviderShipment(driver,shipmentInput);
assert.ok(created.id && created.code);
assert.equal(created.trackingCode,undefined);
const session=await rpc('link_tracking_shipment',{actor_user_id:customer.id,target_shipment_id:created.id,target_workspace_id:null});
assert.equal(session.shipmentId,created.id);
const owned={actor_user_id:customer.id,target_session_id:session.id};
async function issueLink(allowLocation){
  const pair={link_digest:randomBytes(32).toString('hex'),code_digest:randomBytes(32).toString('hex')};
  const link=await rpc('issue_tracking_session_link',{...owned,...pair,command:{expiresInDays:7,allowLocation}});
  return {id:link.id,pair};
}
const shared=await issueLink(true);
const statusOnly=await issueLink(false);
const guest=async link=>rpc('read_tracking_session_link',link.pair);
assert.equal(await rpc('read_tracking_session_link',{link_digest:shared.pair.link_digest,code_digest:statusOnly.pair.code_digest}),null);
assert.ok((await anon.rpc('read_tracking_session_link',shared.pair)).error);
assert.equal((await guest(shared)).sessionId,session.id);
if(await tracking.getProviderShipment(owner,created.id)!==null)throw new Error('SUPABASE_TRACKING_VERIFY_CROSS_PROVIDER_READ');
const beforeCrossProvider=await tracking.getProviderShipment(driver,created.id);
// Device attribution checks the current driver assignment before the older
// shipment lookup. A foreign provider is denied there, without changing data.
await expectCode(tracking.updateProviderShipmentStatus(owner,created.id,'TO_PICKUP','',null,{
  locationArea:'Around Addis Ababa, Ethiopia',approximateLat:9.03,approximateLng:38.75,
  locationPrecisionKm:10,locationSource:'DEVICE_OBSCURED'
}),/^FORBIDDEN$/);
const afterCrossProvider=await tracking.getProviderShipment(driver,created.id);
if(JSON.stringify(afterCrossProvider)!==JSON.stringify(beforeCrossProvider)){
  throw new Error('SUPABASE_TRACKING_VERIFY_CROSS_PROVIDER_MUTATION');
}
await expectCode(tracking.updateProviderShipmentStatus(driver,created.id,'TO_PICKUP'),/TRACKING_DEVICE_LOCATION_REQUIRED/);

await tracking.updateProviderShipmentStatus(driver,created.id,'TO_PICKUP','Going to pickup',null,{
  locationArea:'Around Addis Ababa, Ethiopia',approximateLat:9.03,approximateLng:38.75,
  locationPrecisionKm:10,locationSource:'DEVICE_OBSCURED'
});
const located=(await guest(shared)).shipment;
assert.equal(located.current_location?.location_precision_km,10);
assert.ok(!JSON.stringify(located).includes(customer.email));
assert.equal('assigned_driver_user_id' in located,false);
assert.equal((await guest(statusOnly)).shipment.current_location,null);
await rpc('revoke_tracking_session_link',{...owned,target_link_id:statusOnly.id});
assert.equal(await guest(statusOnly),null);
const proofObject=`tracking-proof/${created.id}/local-verification.jpg`;
const proofBytes=readFileSync('public/vehicle-configurations/cargo-van.jpg');
const {error:proofUploadError}=await service.storage.from('shipment-proof').upload(proofObject,proofBytes,{contentType:'image/jpeg'});
if(proofUploadError)throw new Error('SUPABASE_TRACKING_VERIFY_PROOF_UPLOAD_FAILED');
const proof={path:`supabase://shipment-proof/${proofObject}`,originalName:'local-verification.jpg',mimeType:'image/jpeg'};
await expectCode(tracking.updateProviderShipmentStatus(driver,created.id,'LOADING','Loading'),/TRACKING_HANDOVER_PROOF_REQUIRED/);
await tracking.updateProviderShipmentStatus(driver,created.id,'LOADING','Loading',proof);
const loading=(await rpc('tracking_session_detail',owned)).shipment;
const loadingEvent=loading.events.find(event=>event.status==='LOADING');
assert.ok(loadingEvent?.has_proof);
const fileArgs={...owned,target_event_id:loadingEvent.id};
const proofFile=await rpc('tracking_session_proof_file',fileArgs);
assert.equal(proofFile.storage_path,proof.path);
const downloaded=checked(await service.storage.from('shipment-proof').download(proofObject));
assert.ok(Buffer.from(await downloaded.arrayBuffer()).equals(proofBytes));
assert.equal(await rpc('tracking_session_proof_file',{...fileArgs,actor_user_id:owner.id}),null);
assert.equal(await rpc('tracking_session_proof_file',{...fileArgs,actor_user_id:null}),null);
assert.ok((await guest(shared)).shipment.events.every(event=>!event.has_proof));
await expectCode(tracking.updateProviderShipmentStatus(driver,created.id,'IN_TRANSIT','',{
  path:'supabase://shipment-proof/tracking-proof/test.jpg',originalName:'test.jpg',mimeType:'image/jpeg'
}),/PROOF_NOT_ALLOWED_FOR_STATUS/);
await tracking.updateProviderShipmentStatus(driver,created.id,'IN_TRANSIT','En route',null,{
  locationArea:'Around Adama, Ethiopia',approximateLat:8.54,approximateLng:39.27,
  locationPrecisionKm:10,locationSource:'DEVICE_OBSCURED'
});
await expectCode(tracking.updateProviderShipmentLocation(driver,created.id,{
  locationArea:'Around Adama, Ethiopia',approximateLat:8.55,approximateLng:39.28,
  locationPrecisionKm:20,locationSource:'DEVICE_OBSCURED'
}),/TRACKING_DEVICE_LOCATION_REQUIRED/);
const throttled=await tracking.updateProviderShipmentLocation(driver,created.id,{
  locationArea:'Around Adama, Ethiopia',approximateLat:8.55,approximateLng:39.28,
  locationPrecisionKm:10,locationSource:'DEVICE_OBSCURED'
});
if(throttled.reason!=='THROTTLED')throw new Error('SUPABASE_TRACKING_VERIFY_LOCATION_THROTTLE_FAILED');
await expectCode(tracking.updateProviderShipmentStatus(driver,created.id,'UNLOADING','Unloading'),/TRACKING_HANDOVER_PROOF_REQUIRED/);
await tracking.updateProviderShipmentStatus(driver,created.id,'UNLOADING','Unloading',proof);
await expectCode(tracking.updateProviderShipmentStatus(driver,created.id,'COMPLETED','Complete'),/TRACKING_OWNER_APPROVAL_REQUIRED/);
await expectCode(rpc('approve_tracking_session_handover',{...owned,actor_user_id:driver.id}),/TRACKING_APPROVAL_FORBIDDEN/);
await rpc('approve_tracking_session_handover',owned);
assert.equal((await tracking.getProviderShipment(driver,created.id)).operational_status,'COMPLETED');
assert.equal((await guest(shared)).shipment.current_location,null);
const reviewArgs={...owned,command:{rating:3,note:'Updates could have been clearer.',termsAccepted:true}};
await rpc('review_tracking_session_provider',reviewArgs);
await expectCode(rpc('review_tracking_session_provider',reviewArgs),/REVIEW_NOT_ALLOWED/);
const reviewId=checked(await service.from('provider_reviews').select('id').eq('shipment_id',created.id).single()).id;
await tracking.disputeProviderReview(driver,reviewId,'The timeline shows each operational update.');
const pending=await tracking.listProviderReviewModeration(admin,'PENDING',{page:1,pageSize:100});
if(!pending.items.some(review=>review.id===reviewId&&review.status==='PENDING'))throw new Error('SUPABASE_TRACKING_VERIFY_REVIEW_QUEUE_FAILED');
await tracking.resolveProviderReview(admin,reviewId,'UPHELD','The review is supported by the available record.');

const invitations=await service.from('provider_tracking_email_otps').select('id',{count:'exact',head:true}).eq('shipment_id',created.id);
checked(invitations);assert.equal(invitations.count,0);
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
if(retained.email_deliveries.length!==0||retained.tracking_access_code!=null)throw new Error('SUPABASE_TRACKING_VERIFY_GUEST_DATA_RETAINED');
assert.equal(await guest(shared),null);
const retainedRecipients=await service.from('provider_tracking_recipients').select('id',{count:'exact',head:true}).eq('shipment_id',created.id);
const retainedOtps=await service.from('provider_tracking_email_otps').select('id',{count:'exact',head:true}).eq('shipment_id',created.id);
if(retainedRecipients.count!==0||retainedOtps.count!==0)throw new Error('SUPABASE_TRACKING_VERIFY_EXPIRED_RECIPIENT_DATA_RETAINED');

const afterDemand=await service.from('shipments').select('id',{count:'exact',head:true});
if(afterDemand.error||afterDemand.count!==beforeDemand.count)throw new Error('SUPABASE_TRACKING_VERIFY_DEMAND_MUTATED');
process.stdout.write('Supabase registered-owner Tracking, private link and code, revocation, location, proof, handover, review and expiry checks passed.\n');
// The disposable stack retains proof bytes with its tested history until teardown.
