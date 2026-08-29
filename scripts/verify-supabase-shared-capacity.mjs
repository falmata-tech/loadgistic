import {createClient} from '@supabase/supabase-js';

const url=String(process.env.SUPABASE_SEED_URL||'').trim();
const serviceRoleKey=String(process.env.SUPABASE_SEED_SERVICE_ROLE_KEY||'').trim();
const anonKey=String(process.env.SUPABASE_SEED_ANON_KEY||'').trim();
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
  listPendingAccessEmailDeliveries,recordAccessEmailDeliveryAttempt
}=await import('../src/lib/access-email.js');
const {privateContactDigest}=await import('../src/lib/security.js');

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

await service.from('capacity_access_grants').delete().eq('recipient_email_digest',sharedDigest);

const grant=await grantPrivateCapacityAccess(owner,{vehicleId:vehicle.id,email:sharedEmail});
if(!grant?.id||!grant.created)throw new Error('SUPABASE_SHARED_VERIFY_GRANT_FAILED');
const network=await listPrivateCapacityNetwork(owner);
if(!network.some(item=>item.id===vehicle.id&&item.grants.some(candidate=>candidate.id===grant.id)))throw new Error('SUPABASE_SHARED_VERIFY_NETWORK_FAILED');
if(JSON.stringify(network).includes('recipient_email_digest'))throw new Error('SUPABASE_SHARED_VERIFY_DIGEST_LEAK');

const challenge=await requestSharedCapacityOtp(sharedEmail);
if(!challenge.deliveryQueued||!/^\d{8}$/.test(challenge.accessCode))throw new Error('SUPABASE_SHARED_VERIFY_OTP_REQUEST_FAILED');
const {data:storedChallenge,error:challengeError}=await service.from('shared_capacity_email_otps')
  .select('code_digest').eq('id',challenge.challengeId).maybeSingle();
if(challengeError||!storedChallenge||storedChallenge.code_digest===challenge.accessCode)throw new Error('SUPABASE_SHARED_VERIFY_PLAINTEXT_OTP');
const pending=await listPendingAccessEmailDeliveries(100);
const delivery=pending.find(candidate=>candidate.entity_id===challenge.challengeId);
if(!delivery)throw new Error('SUPABASE_SHARED_VERIFY_DELIVERY_QUEUE_FAILED');
await recordAccessEmailDeliveryAttempt(delivery.id,{sent:true});
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
process.stdout.write('Supabase Shared capacity grant, OTP, delivery, projection, Operations, and revocation checks passed.\n');
