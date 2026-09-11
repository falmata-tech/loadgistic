import {randomBytes,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const url=String(process.env.SUPABASE_SEED_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').trim();
const serviceRoleKey=String(process.env.SUPABASE_SEED_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
const anonKey=String(process.env.SUPABASE_SEED_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'').trim();
if(!url||!serviceRoleKey||!anonKey)throw new Error('SUPABASE_SHARED_VERIFY_CONFIG_MISSING');
const endpoint=new URL(url);
if(!new Set(['127.0.0.1','localhost','::1']).has(endpoint.hostname))throw new Error('REMOTE_SHARED_VERIFY_REFUSED');

process.env.NEXT_PUBLIC_SUPABASE_URL=url;
process.env.SUPABASE_SERVICE_ROLE_KEY=serviceRoleKey;
process.env.SESSION_SECRET=process.env.SESSION_SECRET||'shared-capacity-local-verification-secret';

const service=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
const anon=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false}});
const {
  grantPrivateCapacityAccess,listLoadgisticSharedCapacity,
  listPrivateCapacityNetwork,listSharedCapacity,
  requestSharedCapacityOtp,revokePrivateCapacityAccess,
  setLoadgisticCapacityAccess,verifySharedCapacityAccess
}=await import('../src/lib/private-capacity.js');
const {
  claimAccessEmailDelivery,listPendingAccessEmailDeliveries,purgeExpiredSharedCapacityAccess,
  accessEmailDeliveryIsDeliverable,recordAccessEmailDeliveryAttempt
}=await import('../src/lib/access-email.js');
const {privateContactDigest}=await import('../src/lib/security.js');

async function verifySharedCapacityDeliveryRetention(){
  const suffix=randomUUID().slice(0,12);
  const challengeIds=Array.from({length:12},()=>randomUUID());
  const deliveryIds=Array.from({length:13},()=>randomUUID());
  const [validId,raceId,priorityId,nearExpiryId,expiredId,usedId,supersededId,lockedId,oldFirstId,oldSecondId,activeSentId,activeFailedId]=challengeIds;
  const [validDeliveryId,expiredDeliveryId,usedDeliveryId,supersededDeliveryId,lockedDeliveryId,guestDeliveryId,
    oldFirstDeliveryId,oldSecondDeliveryId,orphanDeliveryId,activeSentDeliveryId,raceDeliveryId,
    priorityDeliveryId,nearExpiryDeliveryId]=deliveryIds;
  const activeFailedDeliveryId=randomUUID();
  const oldGuestDeliveryId=randomUUID();
  const now=Date.now();
  const future=new Date(now+5*60*1000).toISOString();
  const recentPast=new Date(now-60*1000).toISOString();
  const oldFirst='2000-01-01T00:00:00.000Z';
  const oldSecond='2000-01-02T00:00:00.000Z';
  const oldDelivery='2000-01-03T00:00:00.000Z';
  const challengeRows=[
    {id:validId,expires_at:future},
    {id:raceId,expires_at:future},
    {id:priorityId,expires_at:future},
    {id:nearExpiryId,expires_at:new Date(now+20_000).toISOString()},
    {id:expiredId,expires_at:recentPast},
    {id:usedId,expires_at:future,used_at:new Date(now).toISOString()},
    {id:supersededId,expires_at:future,superseded_at:new Date(now).toISOString()},
    {id:lockedId,expires_at:future,attempt_count:5},
    {id:oldFirstId,expires_at:oldFirst,created_at:oldFirst},
    {id:oldSecondId,expires_at:oldSecond,created_at:oldSecond},
    {id:activeSentId,expires_at:future},
    {id:activeFailedId,expires_at:future}
  ].map((row,index)=>({
    recipient_email:`retention-${suffix}-${index}@loadgistic.local`,
    recipient_email_digest:String(index+1).padStart(64,'0'),
    code_digest:String.fromCharCode(97+index).repeat(64),attempt_count:0,
    created_at:new Date(now).toISOString(),...row
  }));
  const deliveryRows=[
    {id:validDeliveryId,entity_id:validId,recipient_email:`valid-${suffix}@loadgistic.local`},
    {id:raceDeliveryId,entity_id:raceId,recipient_email:`race-${suffix}@loadgistic.local`},
    {id:priorityDeliveryId,entity_id:priorityId,recipient_email:`priority-${suffix}@loadgistic.local`},
    {id:nearExpiryDeliveryId,entity_id:nearExpiryId,recipient_email:`near-expiry-${suffix}@loadgistic.local`},
    {id:expiredDeliveryId,entity_id:expiredId,recipient_email:`expired-${suffix}@loadgistic.local`},
    {id:usedDeliveryId,entity_id:usedId,recipient_email:`used-${suffix}@loadgistic.local`},
    {id:supersededDeliveryId,entity_id:supersededId,recipient_email:`superseded-${suffix}@loadgistic.local`},
    {id:lockedDeliveryId,entity_id:lockedId,recipient_email:`locked-${suffix}@loadgistic.local`},
    {id:guestDeliveryId,delivery_kind:'GUEST_SUPPORT',entity_id:randomUUID(),recipient_email:`guest-${suffix}@loadgistic.local`,created_at:new Date(now-60_000).toISOString(),updated_at:new Date(now-60_000).toISOString()},
    {id:oldFirstDeliveryId,entity_id:oldFirstId,recipient_email:`old-first-${suffix}@loadgistic.local`,created_at:oldFirst,updated_at:oldFirst},
    {id:oldSecondDeliveryId,entity_id:oldSecondId,recipient_email:`old-second-${suffix}@loadgistic.local`,created_at:oldSecond,updated_at:oldSecond},
    {id:orphanDeliveryId,entity_id:randomUUID(),recipient_email:`orphan-${suffix}@loadgistic.local`,created_at:oldDelivery,updated_at:oldDelivery},
    {id:activeSentDeliveryId,entity_id:activeSentId,recipient_email:`sent-${suffix}@loadgistic.local`,status:'SENT',attempts:1,created_at:oldDelivery,updated_at:oldDelivery,sent_at:oldDelivery},
    {id:activeFailedDeliveryId,entity_id:activeFailedId,recipient_email:`failed-${suffix}@loadgistic.local`,status:'FAILED',attempts:6,created_at:oldDelivery,updated_at:oldDelivery,next_attempt_at:oldDelivery},
    {id:oldGuestDeliveryId,delivery_kind:'GUEST_SUPPORT',entity_id:randomUUID(),recipient_email:`old-guest-${suffix}@loadgistic.local`,status:'SENT',attempts:1,created_at:oldDelivery,updated_at:oldDelivery,sent_at:oldDelivery}
  ].map(row=>({delivery_kind:'SHARED_CAPACITY',status:'QUEUED',attempts:0,created_at:new Date(now).toISOString(),updated_at:new Date(now).toISOString(),...row}));
  let authUserId;
  try{
    const {error:challengeInsertError}=await service.from('shared_capacity_email_otps').insert(challengeRows);
    if(challengeInsertError)throw new Error(`SUPABASE_SHARED_RETENTION_CHALLENGE_SETUP_FAILED:${challengeInsertError.message}`);
    const {error:deliveryInsertError}=await service.from('access_email_deliveries').insert(deliveryRows);
    if(deliveryInsertError)throw new Error(`SUPABASE_SHARED_RETENTION_DELIVERY_SETUP_FAILED:${deliveryInsertError.message}`);

    const nearExpiryLease=randomUUID();
    const {error:nearExpiryLeaseError}=await service.from('access_email_deliveries').update({
      lease_token:nearExpiryLease,leased_until:new Date(now+90_000).toISOString()
    }).eq('id',nearExpiryDeliveryId);
    if(nearExpiryLeaseError||await accessEmailDeliveryIsDeliverable(nearExpiryDeliveryId,nearExpiryLease)){
      throw new Error('SUPABASE_SHARED_RETENTION_NEAR_EXPIRY_ALLOWED');
    }

    const targeted=await claimAccessEmailDelivery('SHARED_CAPACITY',validId);
    if(targeted?.id!==validDeliveryId||!targeted.lease_token){
      throw new Error('SUPABASE_SHARED_RETENTION_TARGETED_LEASE_MISSING');
    }
    const neighboringTarget=await claimAccessEmailDelivery('SHARED_CAPACITY',expiredId);
    if(neighboringTarget)throw new Error('SUPABASE_SHARED_RETENTION_INVALID_TARGET_LEASED');
    const [raceTarget,firstPending]=await Promise.all([
      claimAccessEmailDelivery('SHARED_CAPACITY',raceId),
      listPendingAccessEmailDeliveries(100)
    ]);
    if(firstPending.length>1)throw new Error('SUPABASE_SHARED_RETENTION_BATCH_LEASED');
    const pending=[...firstPending];
    for(let claim=0;claim<3&&(
      !pending.some(delivery=>delivery.id===priorityDeliveryId)
      ||!pending.some(delivery=>delivery.id===guestDeliveryId)
    );claim+=1){
      const next=await listPendingAccessEmailDeliveries(100);
      if(next.length>1)throw new Error('SUPABASE_SHARED_RETENTION_BATCH_LEASED');
      pending.push(...next);
    }
    const leasedIds=new Set(pending.map(delivery=>delivery.id));
    if(leasedIds.has(validDeliveryId)||!leasedIds.has(guestDeliveryId))throw new Error('SUPABASE_SHARED_RETENTION_TARGET_ISOLATION_FAILED');
    const priorityIndex=pending.findIndex(delivery=>delivery.id===priorityDeliveryId);
    const guestIndex=pending.findIndex(delivery=>delivery.id===guestDeliveryId);
    if(priorityIndex<0||guestIndex<0||priorityIndex>=guestIndex){
      throw new Error('SUPABASE_SHARED_RETENTION_PRIORITY_FAILED');
    }
    const guestLease=pending[guestIndex];
    if(!guestLease?.lease_token||!await accessEmailDeliveryIsDeliverable(guestDeliveryId,guestLease.lease_token)
      ||await accessEmailDeliveryIsDeliverable(guestDeliveryId,randomUUID())){
      throw new Error('SUPABASE_SHARED_RETENTION_GUEST_LEASE_FENCE_FAILED');
    }
    const raceFromGlobal=pending.find(delivery=>delivery.id===raceDeliveryId);
    if(Number(Boolean(raceTarget))+Number(Boolean(raceFromGlobal))!==1){
      throw new Error('SUPABASE_SHARED_RETENTION_CONCURRENT_LEASE_FAILED');
    }
    const raceLease=raceTarget||raceFromGlobal;
    if(!raceLease?.lease_token||!await accessEmailDeliveryIsDeliverable(raceDeliveryId,raceLease.lease_token)){
      throw new Error('SUPABASE_SHARED_RETENTION_CONCURRENT_LEASE_FAILED');
    }
    for(const invalidId of [expiredDeliveryId,usedDeliveryId,supersededDeliveryId,lockedDeliveryId]){
      if(leasedIds.has(invalidId))throw new Error('SUPABASE_SHARED_RETENTION_INVALID_LEASED');
    }
    if(new Date(targeted.challenge_expires_at||0).getTime()!==new Date(future).getTime()){
      throw new Error('SUPABASE_SHARED_RETENTION_EXPIRY_PROJECTION_FAILED');
    }
    if(!await accessEmailDeliveryIsDeliverable(validDeliveryId,targeted.lease_token))throw new Error('SUPABASE_SHARED_RETENTION_DELIVERABLE_RECHECK_FAILED');
    if(await accessEmailDeliveryIsDeliverable(validDeliveryId,randomUUID()))throw new Error('SUPABASE_SHARED_RETENTION_WRONG_LEASE_ALLOWED');
    for(const invalidId of [expiredDeliveryId,usedDeliveryId,supersededDeliveryId,lockedDeliveryId]){
      if(await accessEmailDeliveryIsDeliverable(invalidId,randomUUID()))throw new Error('SUPABASE_SHARED_RETENTION_INVALID_RECHECK');
    }
    if(await recordAccessEmailDeliveryAttempt(validDeliveryId,{leaseToken:randomUUID(),sent:false,error:'TEST_FAILURE'})){
      throw new Error('SUPABASE_SHARED_RETENTION_WRONG_LEASE_RECORDED');
    }
    if(!await recordAccessEmailDeliveryAttempt(validDeliveryId,{leaseToken:targeted.lease_token,sent:false,error:'TEST_FAILURE'})){
      throw new Error('SUPABASE_SHARED_RETENTION_LEASE_RECORD_FAILED');
    }
    const {data:retryRow,error:retryError}=await service.from('access_email_deliveries')
      .select('status,attempts,next_attempt_at,lease_token,leased_until').eq('id',validDeliveryId).maybeSingle();
    const retryAt=new Date(retryRow?.next_attempt_at||0).getTime();
    if(retryError||retryRow?.status!=='FAILED'||retryRow.attempts!==1||retryRow.lease_token||retryRow.leased_until
      ||retryAt<=Date.now()||retryAt>=new Date(future).getTime()-30_000){
      throw new Error('SUPABASE_SHARED_RETENTION_RETRY_WINDOW_FAILED');
    }

    const firstCleanup=await purgeExpiredSharedCapacityAccess(1);
    if(firstCleanup.otpCount!==1||firstCleanup.deliveryCount!==1)throw new Error('SUPABASE_SHARED_RETENTION_BOUNDED_CLEANUP_FAILED');
    const {data:oldAfterFirst,error:oldAfterFirstError}=await service.from('shared_capacity_email_otps')
      .select('id').in('id',[oldFirstId,oldSecondId]);
    if(oldAfterFirstError||oldAfterFirst?.length!==1)throw new Error('SUPABASE_SHARED_RETENTION_BOUNDED_CLEANUP_FAILED');

    const finalCleanup=await purgeExpiredSharedCapacityAccess(100);
    if(finalCleanup.otpCount<1||finalCleanup.deliveryCount<5||finalCleanup.guestDeliveryCount<1)throw new Error('SUPABASE_SHARED_RETENTION_TERMINAL_CLEANUP_FAILED');
    const {data:staleRows,error:staleRowsError}=await service.from('access_email_deliveries').select('id')
      .in('id',[oldFirstDeliveryId,oldSecondDeliveryId,orphanDeliveryId,activeSentDeliveryId,activeFailedDeliveryId]);
    if(staleRowsError||staleRows?.length)throw new Error('SUPABASE_SHARED_RETENTION_DELIVERY_RETAINED');
    const {data:guestRows,error:guestRowsError}=await service.from('access_email_deliveries').select('id')
      .in('id',[guestDeliveryId,oldGuestDeliveryId]);
    if(guestRowsError||guestRows?.length!==1||guestRows[0]?.id!==guestDeliveryId)throw new Error('SUPABASE_SHARED_RETENTION_GUEST_SUPPORT_POLICY_FAILED');

    const deniedOtpRequest={
      challenge_id:randomUUID(),normalized_recipient_email:`denied-${suffix}@loadgistic.local`,
      recipient_digest:'1'.padStart(64,'0'),challenge_code_digest:'f'.repeat(64),
      challenge_expires_at:future
    };
    for(const [name,args] of [
      ['request_shared_capacity_otp',deniedOtpRequest],
      ['claim_access_email_delivery',{requested_kind:'SHARED_CAPACITY',requested_entity_id:validId}],
      ['access_email_delivery_is_deliverable',{delivery_id:validDeliveryId,claimed_lease_token:randomUUID()}],
      ['shared_capacity_delivery_is_deliverable',{delivery_id:validDeliveryId,claimed_lease_token:randomUUID()}],
      ['record_access_email_delivery_attempt',{delivery_id:validDeliveryId,claimed_lease_token:randomUUID(),was_sent:true,failure_message:null}],
      ['shared_capacity_access_cleanup',{requested_limit:1}]
    ]){
      const {error}=await anon.rpc(name,args);
      if(!error)throw new Error(`SUPABASE_SHARED_RETENTION_ANONYMOUS_RPC_ALLOWED:${name}`);
    }
    const authEmail=`retention-auth-${suffix}@loadgistic.local`;
    const authPassword=randomBytes(24).toString('base64url');
    const {data:createdAuth,error:createdAuthError}=await service.auth.admin.createUser({email:authEmail,password:authPassword,email_confirm:true});
    if(createdAuthError||!createdAuth.user)throw new Error('SUPABASE_SHARED_RETENTION_AUTH_SETUP_FAILED');
    authUserId=createdAuth.user.id;
    const authenticated=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false}});
    const {error:signInError}=await authenticated.auth.signInWithPassword({email:authEmail,password:authPassword});
    if(signInError)throw new Error('SUPABASE_SHARED_RETENTION_AUTH_SETUP_FAILED');
    for(const [name,args] of [
      ['request_shared_capacity_otp',deniedOtpRequest],
      ['claim_access_email_delivery',{requested_kind:'SHARED_CAPACITY',requested_entity_id:validId}],
      ['access_email_delivery_is_deliverable',{delivery_id:validDeliveryId,claimed_lease_token:randomUUID()}],
      ['shared_capacity_delivery_is_deliverable',{delivery_id:validDeliveryId,claimed_lease_token:randomUUID()}],
      ['record_access_email_delivery_attempt',{delivery_id:validDeliveryId,claimed_lease_token:randomUUID(),was_sent:true,failure_message:null}],
      ['shared_capacity_access_cleanup',{requested_limit:1}]
    ]){
      const {error}=await authenticated.rpc(name,args);
      if(!error)throw new Error(`SUPABASE_SHARED_RETENTION_AUTHENTICATED_RPC_ALLOWED:${name}`);
    }
    await authenticated.auth.signOut();
  }finally{
    await service.from('access_email_deliveries').delete().in('id',[...deliveryIds,activeFailedDeliveryId,oldGuestDeliveryId]);
    await service.from('shared_capacity_email_otps').delete().in('id',challengeIds);
    if(authUserId)await service.auth.admin.deleteUser(authUserId);
  }
}

await verifySharedCapacityDeliveryRetention();

async function verifyIneligibleSharedCapacityOtp(){
  const recipientEmail=`shared-ineligible-${randomUUID()}@loadgistic.local`;
  const recipientDigest=privateContactDigest(recipientEmail);
  const challenge=await requestSharedCapacityOtp(recipientEmail);
  if(challenge.deliveryQueued||challenge.accessCode){
    throw new Error('SUPABASE_SHARED_INELIGIBLE_OTP_ACCEPTED');
  }
  const [{data:challengeRows,error:challengeError},{data:deliveryRows,error:deliveryError}]=await Promise.all([
    service.from('shared_capacity_email_otps').select('id').eq('recipient_email_digest',recipientDigest),
    service.from('access_email_deliveries').select('id').eq('delivery_kind','SHARED_CAPACITY').eq('entity_id',challenge.challengeId)
  ]);
  if(challengeError||challengeRows?.length){
    throw new Error(`SUPABASE_SHARED_INELIGIBLE_CHALLENGE_WRITTEN:${challengeError?.message||''}`);
  }
  if(deliveryError||deliveryRows?.length){
    throw new Error(`SUPABASE_SHARED_INELIGIBLE_DELIVERY_WRITTEN:${deliveryError?.message||''}`);
  }
}

await verifyIneligibleSharedCapacityOtp();

async function verifyConcurrentSharedCapacityOtpIssuance(owner,vehicleId){
  const recipientEmail=`shared-concurrency-${randomUUID()}@loadgistic.local`;
  const recipientDigest=privateContactDigest(recipientEmail);
  const challengeIds=[];
  let grant;
  try{
    grant=await grantPrivateCapacityAccess(owner,{vehicleId,email:recipientEmail});
    if(!grant?.id||!grant.created)throw new Error('SUPABASE_SHARED_CONCURRENCY_GRANT_FAILED');

    const results=await Promise.allSettled(
      Array.from({length:8},()=>requestSharedCapacityOtp(recipientEmail))
    );
    const challenges=results.filter(result=>result.status==='fulfilled').map(result=>result.value);
    challengeIds.push(...challenges.map(challenge=>challenge.challengeId));
    if(results.some(result=>result.status==='rejected')){
      throw new Error('SUPABASE_SHARED_CONCURRENCY_REQUEST_REJECTED');
    }
    if(challenges.some(challenge=>!challenge.deliveryQueued||!/^\d{6}$/.test(challenge.accessCode))){
      throw new Error('SUPABASE_SHARED_CONCURRENCY_REQUEST_FAILED');
    }

    const {data:rows,error:rowsError}=await service.from('shared_capacity_email_otps')
      .select('id,used_at,superseded_at,expires_at,created_at')
      .eq('recipient_email_digest',recipientDigest)
      .in('id',challengeIds)
      .order('created_at',{ascending:false});
    if(rowsError||rows?.length!==challengeIds.length){
      throw new Error(`SUPABASE_SHARED_CONCURRENCY_CHALLENGE_READ_FAILED:${rowsError?.message||''}`);
    }
    const now=Date.now();
    const current=rows.filter(row=>!row.used_at&&!row.superseded_at&&new Date(row.expires_at).getTime()>now);
    if(current.length!==1)throw new Error('SUPABASE_SHARED_CONCURRENCY_MULTIPLE_CURRENT');
    if(rows[0]?.id!==current[0].id)throw new Error('SUPABASE_SHARED_CONCURRENCY_CURRENT_NOT_NEWEST');

    const {data:deliveries,error:deliveriesError}=await service.from('access_email_deliveries')
      .select('id,entity_id').eq('delivery_kind','SHARED_CAPACITY').in('entity_id',challengeIds);
    if(deliveriesError||deliveries?.length!==challengeIds.length){
      throw new Error(`SUPABASE_SHARED_CONCURRENCY_DELIVERY_READ_FAILED:${deliveriesError?.message||''}`);
    }
    const targetedClaims=await Promise.all(challenges.map(challenge=>
      claimAccessEmailDelivery('SHARED_CAPACITY',challenge.challengeId)
    ));
    const claimed=targetedClaims.filter(Boolean);
    if(claimed.length!==1||claimed[0].entity_id!==current[0].id||!claimed[0].lease_token
      ||!await accessEmailDeliveryIsDeliverable(claimed[0].id,claimed[0].lease_token)){
      throw new Error('SUPABASE_SHARED_CONCURRENCY_MULTIPLE_DELIVERABLE');
    }
  }finally{
    if(challengeIds.length){
      await service.from('access_email_deliveries').delete().eq('delivery_kind','SHARED_CAPACITY').in('entity_id',challengeIds);
      await service.from('shared_capacity_email_otps').delete().in('id',challengeIds);
    }
    if(grant?.id)await revokePrivateCapacityAccess(owner,grant.id).catch(()=>{});
  }
}

const sharedEmail='shared-capacity-verify@loadgistic.local';
const sharedDigest=privateContactDigest(sharedEmail);
const platformDigest=privateContactDigest('loadgistic-platform');
const {data:platformGrants,error:platformGrantError}=await service.from('capacity_access_grants').select('vehicle_id')
  .eq('audience_type','LOADGISTIC').eq('recipient_email_digest',platformDigest).is('revoked_at',null);
if(platformGrantError)throw new Error(`SUPABASE_SHARED_VERIFY_PLATFORM_READ_FAILED:${platformGrantError.message}`);
const alreadyShared=new Set((platformGrants||[]).map(grant=>grant.vehicle_id));
const {data:capacityCandidates,error:capacityError}=await service.from('capacities').select('id,vehicle_id,visibility')
  .not('provider_organization_id','is',null).in('market_status',['EMPTY','PARTIAL'])
  .gt('expires_at',new Date().toISOString()).order('updated_at',{ascending:false}).limit(50);
if(capacityError||!capacityCandidates?.length)throw new Error(`SUPABASE_SHARED_VERIFY_CAPACITY_MISSING:${capacityError?.message||''}`);
const vehicleIds=capacityCandidates.map(candidate=>candidate.vehicle_id);
const {data:vehicles,error:vehicleError}=await service.from('vehicles').select('id,organization_id')
  .in('id',vehicleIds).eq('active',true);
if(vehicleError||!vehicles?.length)throw new Error(`SUPABASE_SHARED_VERIFY_VEHICLE_MISSING:${vehicleError?.message||''}`);
const vehicleById=new Map(vehicles.map(candidate=>[candidate.id,candidate]));
const organizationIds=[...new Set(vehicles.map(candidate=>candidate.organization_id).filter(Boolean))];
const {data:memberships,error:membershipError}=await service.from('organization_members').select('organization_id,user_id')
  .in('organization_id',organizationIds).eq('membership_role','OWNER');
if(membershipError||!memberships?.length)throw new Error(`SUPABASE_SHARED_VERIFY_MEMBERSHIP_MISSING:${membershipError?.message||''}`);
const ownerByOrganization=new Map(memberships.map(candidate=>[candidate.organization_id,candidate.user_id]));
const capacity=capacityCandidates.find(candidate=>{
  const organizationId=vehicleById.get(candidate.vehicle_id)?.organization_id;
  return !alreadyShared.has(candidate.vehicle_id)&&ownerByOrganization.has(organizationId);
});
if(!capacity)throw new Error('SUPABASE_SHARED_VERIFY_ISOLATED_VEHICLE_MISSING');
const vehicle=vehicleById.get(capacity.vehicle_id);
const {data:ownerProfile,error:ownerError}=await service.from('profiles').select('id,role')
  .eq('id',ownerByOrganization.get(vehicle.organization_id)).maybeSingle();
if(ownerError||!ownerProfile)throw new Error(`SUPABASE_SHARED_VERIFY_OWNER_MISSING:${ownerError?.message||''}`);
const owner={...ownerProfile,organization_id:vehicle.organization_id,workspace_subscription:{status:'SPONSORED'}};

await verifyConcurrentSharedCapacityOtpIssuance(owner,vehicle.id);

await service.from('capacity_access_grants').delete().eq('recipient_email_digest',sharedDigest);

const grant=await grantPrivateCapacityAccess(owner,{vehicleId:vehicle.id,email:sharedEmail});
if(!grant?.id||!grant.created)throw new Error('SUPABASE_SHARED_VERIFY_GRANT_FAILED');
const network=await listPrivateCapacityNetwork(owner);
if(!network.some(item=>item.id===vehicle.id&&item.grants.some(candidate=>candidate.id===grant.id)))throw new Error('SUPABASE_SHARED_VERIFY_NETWORK_FAILED');
if(JSON.stringify(network).includes('recipient_email_digest'))throw new Error('SUPABASE_SHARED_VERIFY_DIGEST_LEAK');

const challenge=await requestSharedCapacityOtp(sharedEmail);
if(!challenge.deliveryQueued||!/^\d{6}$/.test(challenge.accessCode))throw new Error('SUPABASE_SHARED_VERIFY_OTP_REQUEST_FAILED');
const {data:storedChallenge,error:challengeError}=await service.from('shared_capacity_email_otps')
  .select('code_digest').eq('id',challenge.challengeId).maybeSingle();
if(challengeError||!storedChallenge||storedChallenge.code_digest===challenge.accessCode)throw new Error('SUPABASE_SHARED_VERIFY_PLAINTEXT_OTP');
const delivery=await claimAccessEmailDelivery('SHARED_CAPACITY',challenge.challengeId);
if(!delivery)throw new Error('SUPABASE_SHARED_VERIFY_DELIVERY_QUEUE_FAILED');
if(!await recordAccessEmailDeliveryAttempt(delivery.id,{leaseToken:delivery.lease_token,sent:true})){
  throw new Error('SUPABASE_SHARED_VERIFY_DELIVERY_RECORD_FAILED');
}
const {data:sentDelivery,error:sentError}=await service.from('access_email_deliveries').select('status,attempts')
  .eq('id',delivery.id).maybeSingle();
if(sentError||sentDelivery?.status!=='SENT'||sentDelivery.attempts!==1)throw new Error('SUPABASE_SHARED_VERIFY_DELIVERY_RECORD_FAILED');

await service.from('capacities').update({visibility:'PRIVATE'}).eq('id',capacity.id);
try{
  const access=await verifySharedCapacityAccess(sharedEmail,challenge.accessCode);
  if(access.emailDigest!==sharedDigest)throw new Error('SUPABASE_SHARED_VERIFY_DIGEST_MISMATCH');
  const shared=await listSharedCapacity(access.emailDigest,{capacityId:capacity.id});
  if(shared.items.length!==1||shared.items[0].current_signal_geometry_visible!==true)throw new Error('SUPABASE_SHARED_VERIFY_PROJECTION_FAILED');
  if(JSON.stringify(shared).includes(sharedEmail)||JSON.stringify(shared).includes(sharedDigest))throw new Error('SUPABASE_SHARED_VERIFY_RECIPIENT_LEAK');
  await verifySharedCapacityAccess(sharedEmail,challenge.accessCode).then(
    ()=>{throw new Error('SUPABASE_SHARED_VERIFY_OTP_REUSED');},
    error=>{if(!/SHARED_CAPACITY_ACCESS_DENIED/.test(String(error?.message)))throw error;}
  );

  const {data:admin,error:adminError}=await service.from('profiles').select('id,role').eq('email','admin@loadgistic.local').maybeSingle();
  if(adminError||!admin)throw new Error(`SUPABASE_SHARED_VERIFY_ADMIN_MISSING:${adminError?.message||''}`);
  await setLoadgisticCapacityAccess(owner,vehicle.id,true);
  const operations=await listLoadgisticSharedCapacity(admin,{capacityId:capacity.id});
  if(operations.items.length!==1)throw new Error('SUPABASE_SHARED_VERIFY_OPERATIONS_PROJECTION_FAILED');
  await setLoadgisticCapacityAccess(owner,vehicle.id,false);

  const {error:anonymousProjectionError}=await anon.rpc('private_capacity_projection',{
    requested_audience:'EMAIL',requested_digest:sharedDigest,actor_user_id:null
  });
  if(!anonymousProjectionError)throw new Error('SUPABASE_SHARED_VERIFY_ANONYMOUS_RPC_ALLOWED');
}finally{
  await service.from('capacities').update({visibility:capacity.visibility}).eq('id',capacity.id);
  await revokePrivateCapacityAccess(owner,grant.id).catch(()=>{});
}

const revoked=await listSharedCapacity(sharedDigest,{capacityId:capacity.id});
if(revoked.items.length!==0)throw new Error('SUPABASE_SHARED_VERIFY_REVOCATION_FAILED');
process.stdout.write('Supabase Shared capacity grant, OTP concurrency, delivery, projection, Operations, and revocation checks passed.\n');
