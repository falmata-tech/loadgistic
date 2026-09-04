import {randomBytes,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const url=String(process.env.SUPABASE_SEED_URL||'').trim();
const serviceRoleKey=String(process.env.SUPABASE_SEED_SERVICE_ROLE_KEY||'').trim();
const anonKey=String(process.env.SUPABASE_SEED_ANON_KEY||'').trim();
const mailUrl=String(process.env.SUPABASE_SEED_MAIL_URL||'').trim();
if(!url||!serviceRoleKey||!anonKey||!mailUrl)throw new Error('SUPABASE_SIGNUP_VERIFY_CONFIG_MISSING');
const endpoint=new URL(url);
if(!new Set(['127.0.0.1','localhost','::1']).has(endpoint.hostname))throw new Error('REMOTE_SIGNUP_VERIFY_REFUSED');
const mailEndpoint=new URL(mailUrl);
if(!new Set(['127.0.0.1','localhost','::1']).has(mailEndpoint.hostname))throw new Error('REMOTE_SIGNUP_MAIL_VERIFY_REFUSED');

process.env.NEXT_PUBLIC_SUPABASE_URL=url;
process.env.SUPABASE_SERVICE_ROLE_KEY=serviceRoleKey;
process.env.SESSION_SECRET=process.env.SESSION_SECRET||'provider-signup-local-verification-secret';

const service=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
const anon=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false}});
const {prepareManagedProviderSignup,providerSignupIntentDigest}=await import('../src/lib/provider-signup.js');

const otpEmail=`signup-otp-${randomBytes(8).toString('hex')}@loadgistic.local`;
let otpAuthUserId=null;
let applicationId=null;
const authUserIds=new Set();
const organizationIds=new Set();
const intentDigests=new Set();

function verificationToken(){
  const token=randomBytes(32).toString('base64url');
  const digest=providerSignupIntentDigest(token);
  if(!digest)throw new Error('SUPABASE_SIGNUP_VERIFY_TOKEN_FAILED');
  intentDigests.add(digest);
  return {token,digest};
}

async function exactCount(table,configure=query=>query,column='id'){
  const {count,error}=await configure(service.from(table).select(column,{count:'exact',head:true}));
  if(error||count===null)throw new Error(`SUPABASE_SIGNUP_VERIFY_${table.toUpperCase()}_COUNT_FAILED`);
  return count;
}

async function actorSnapshot(actorUserId){
  const [
    {data:profile,error:profileError},applications,providers,members,drivers,permissions,assignments,
    organizations,subscriptions
  ]=await Promise.all([
    service.from('profiles').select('role,active').eq('id',actorUserId).maybeSingle(),
    exactCount('applications',query=>query.eq('user_id',actorUserId)),
    exactCount('provider_profiles',query=>query.eq('user_id',actorUserId)),
    exactCount('organization_members',query=>query.eq('user_id',actorUserId)),
    exactCount('drivers',query=>query.eq('user_id',actorUserId)),
    exactCount('driver_permissions',query=>query.eq('user_id',actorUserId),'user_id'),
    exactCount('driver_vehicle_assignments',query=>query.eq('driver_user_id',actorUserId)),
    exactCount('organizations'),
    exactCount('subscriptions')
  ]);
  if(profileError||!profile)throw new Error('SUPABASE_SIGNUP_VERIFY_PROFILE_SNAPSHOT_FAILED');
  return {
    role:profile.role,active:profile.active,applications,providers,members,drivers,permissions,assignments,
    organizations,subscriptions
  };
}

async function signupEligible(actorUserId){
  const {data,error}=await service.rpc('managed_provider_signup_eligible',{actor_user_id:actorUserId});
  if(error||typeof data!=='boolean')throw new Error('SUPABASE_SIGNUP_VERIFY_ELIGIBILITY_RPC_FAILED');
  return data;
}

async function completeEligibleSignup(actorUserId,digest){
  return service.rpc('complete_eligible_provider_signup',{
    actor_user_id:actorUserId,requested_token_digest:digest
  });
}

async function createConfirmedUser(label,{appMetadata}={}){
  const suffix=randomBytes(8).toString('hex');
  const {data,error}=await service.auth.admin.createUser({
    email:`signup-${label}-${suffix}@loadgistic.local`,
    password:randomBytes(24).toString('base64url'),
    email_confirm:true,
    user_metadata:{full_name:`Signup ${label}`},
    ...(appMetadata?{app_metadata:appMetadata}:{})
  });
  if(error||!data.user)throw new Error(`SUPABASE_SIGNUP_VERIFY_${label.toUpperCase()}_AUTH_CREATE_FAILED`);
  authUserIds.add(data.user.id);
  return data.user.id;
}

async function updateProfile(actorUserId,values,label){
  const {data,error}=await service.from('profiles').update(values).eq('id',actorUserId).select('id').maybeSingle();
  if(error||!data)throw new Error(`SUPABASE_SIGNUP_VERIFY_${label.toUpperCase()}_PROFILE_FAILED`);
}

function uniqueHandle(label){
  return `signup-${label}-${randomBytes(6).toString('hex')}`;
}

async function createOrganization(label){
  const {data,error}=await service.from('organizations').insert({
    id:randomUUID(),name:`Signup ${label}`,handle:uniqueHandle(label),type:'TRANSPORT_COMPANY',verified:false,
    public_visibility:'PRIVATE'
  }).select('id').single();
  if(error||!data)throw new Error(`SUPABASE_SIGNUP_VERIFY_${label.toUpperCase()}_ORGANIZATION_FAILED`);
  organizationIds.add(data.id);
  return data.id;
}

async function activePlan(audience){
  const {data,error}=await service.from('plans').select('id').eq('active',true).eq('audience',audience).order('code').limit(1).maybeSingle();
  if(error||!data)throw new Error(`SUPABASE_SIGNUP_VERIFY_${audience}_PLAN_MISSING`);
  return data.id;
}

async function createSubscription({organizationId=null,providerProfileId=null,audience}){
  const startsAt=new Date();
  const {error}=await service.from('subscriptions').insert({
    id:randomUUID(),organization_id:organizationId,provider_profile_id:providerProfileId,
    plan_id:await activePlan(audience),status:'ACTIVE',billing_model:'FLAT_MONTHLY',
    starts_at:startsAt.toISOString(),ends_at:new Date(startsAt.getTime()+7*86_400_000).toISOString(),updated_at:startsAt.toISOString()
  });
  if(error)throw new Error('SUPABASE_SIGNUP_VERIFY_NEGATIVE_SUBSCRIPTION_FAILED');
}

async function prepareNegativeIntent(label){
  const credentials=verificationToken();
  await prepareManagedProviderSignup({
    name:`Rejected ${label}`,businessName:`Rejected ${label} Transport`,phone:'+251 911 222 334',
    applicationType:'OWNER_OPERATOR',notes:'Local eligibility rejection verification.'
  },credentials.token);
  return credentials.digest;
}

async function assertRejectedSignup(label,actorUserId){
  const digest=await prepareNegativeIntent(label);
  if(await signupEligible(actorUserId)!==false)throw new Error(`SUPABASE_SIGNUP_VERIFY_${label.toUpperCase()}_ELIGIBILITY_ALLOWED`);
  const before=await actorSnapshot(actorUserId);
  const {error}=await completeEligibleSignup(actorUserId,digest);
  if(!error||!/SIGNUP_NOT_AVAILABLE/.test(String(error.message||''))){
    throw new Error(`SUPABASE_SIGNUP_VERIFY_${label.toUpperCase()}_COMPLETION_ALLOWED`);
  }
  const after=await actorSnapshot(actorUserId);
  if(JSON.stringify(after)!==JSON.stringify(before)){
    throw new Error(`SUPABASE_SIGNUP_VERIFY_${label.toUpperCase()}_SIDE_EFFECT`);
  }
}

async function localOtp(emailAddress){
  const {error}=await anon.auth.signInWithOtp({email:emailAddress,options:{shouldCreateUser:true}});
  if(error)throw new Error('SUPABASE_SIGNUP_VERIFY_OTP_REQUEST_FAILED');
  for(let attempt=0;attempt<80;attempt+=1){
    const listResponse=await fetch(new URL('/api/v1/messages',mailEndpoint));
    if(!listResponse.ok)throw new Error('SUPABASE_SIGNUP_VERIFY_MAIL_READ_FAILED');
    const list=await listResponse.json();
    const summary=list.messages?.find(message=>message.To?.some(recipient=>recipient.Address===emailAddress));
    if(summary){
      const messageResponse=await fetch(new URL(`/api/v1/message/${encodeURIComponent(summary.ID)}`,mailEndpoint));
      if(!messageResponse.ok)throw new Error('SUPABASE_SIGNUP_VERIFY_MAIL_READ_FAILED');
      const message=await messageResponse.json();
      const code=String(message.Text||message.HTML||'').match(/\b\d{6}\b/)?.[0];
      if(code)return code;
    }
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error('SUPABASE_SIGNUP_VERIFY_OTP_MISSING');
}

try{
  const code=await localOtp(otpEmail);
  let verification=await anon.auth.verifyOtp({email:otpEmail,token:code,type:'signup'});
  if(verification.error){
    verification=await anon.auth.verifyOtp({email:otpEmail,token:code,type:'email'});
  }
  const {data:verified,error:verifyError}=verification;
  if(verifyError||!verified.user)throw new Error('SUPABASE_SIGNUP_VERIFY_OTP_FAILED');
  otpAuthUserId=verified.user.id;
  authUserIds.add(otpAuthUserId);
  const {data:otpProfile,error:otpProfileError}=await service.from('profiles').select('active,role').eq('id',otpAuthUserId).maybeSingle();
  const {data:confirmed,error:confirmedError}=await service.auth.admin.getUserById(otpAuthUserId);
  if(otpProfileError||!otpProfile||otpProfile.active!==false||otpProfile.role!=='DRIVER'||confirmedError||!confirmed.user?.email_confirmed_at){
    throw new Error('SUPABASE_SIGNUP_VERIFY_OTP_AUTHORITY_FAILED');
  }
  const authorityBefore=await actorSnapshot(otpAuthUserId);
  const {data:forbiddenProfileRows,error:forbiddenProfileError}=await anon.from('profiles').update({
    role:'ADMIN',active:true
  }).eq('id',otpAuthUserId).select('id');
  if(!forbiddenProfileError&&(forbiddenProfileRows?.length||0)>0){
    throw new Error('SUPABASE_SIGNUP_VERIFY_BROWSER_PROFILE_ESCALATION_ALLOWED');
  }
  const authorityAfter=await actorSnapshot(otpAuthUserId);
  if(authorityAfter.role!=='DRIVER'||authorityAfter.active!==false||JSON.stringify(authorityAfter)!==JSON.stringify(authorityBefore)){
    throw new Error('SUPABASE_SIGNUP_VERIFY_BROWSER_PROFILE_ESCALATION_SIDE_EFFECT');
  }
  if(await signupEligible(otpAuthUserId)!==true)throw new Error('SUPABASE_SIGNUP_VERIFY_PRISTINE_BOOTSTRAP_REJECTED');

  const {token, digest:tokenDigest}=verificationToken();
  await prepareManagedProviderSignup({
    name:'Managed Signup Driver',businessName:'Managed Signup Transport',phone:'+251 911 222 333',
    applicationType:'OWNER_OPERATOR',notes:'Local managed signup verification.'
  },token);
  const {data:completed,error:completionError}=await completeEligibleSignup(otpAuthUserId,tokenDigest);
  if(completionError||!completed)throw new Error('SUPABASE_SIGNUP_VERIFY_ELIGIBLE_COMPLETION_FAILED');
  applicationId=completed.applicationId;
  const [{data:profile,error:profileError},{data:provider,error:providerError},{data:application,error:applicationError}]=await Promise.all([
    service.from('profiles').select('active,role,phone').eq('id',otpAuthUserId).maybeSingle(),
    service.from('provider_profiles').select('id,handle').eq('user_id',otpAuthUserId).maybeSingle(),
    service.from('applications').select('id,status,application_type').eq('user_id',otpAuthUserId).maybeSingle()
  ]);
  if(profileError||providerError||applicationError||!profile?.active||profile.role!=='DRIVER'||!provider||application?.status!=='APPROVED'||application.application_type!=='OWNER_OPERATOR'){
    throw new Error('SUPABASE_SIGNUP_VERIFY_WORKSPACE_FAILED');
  }
  const [{data:page,error:pageError},{data:subscription,error:subscriptionError},{data:audit,error:auditError}]=await Promise.all([
    service.from('company_pages').select('published').eq('provider_profile_id',provider.id).maybeSingle(),
    service.from('subscriptions').select('status,starts_at,ends_at').eq('provider_profile_id',provider.id).maybeSingle(),
    service.from('audit_logs').select('action').eq('entity_id',application.id).maybeSingle()
  ]);
  if(pageError||subscriptionError||auditError||page?.published!==false||subscription?.status!=='TRIAL'||audit?.action!=='ACCOUNT_SELF_PROVISIONED'){
    throw new Error('SUPABASE_SIGNUP_VERIFY_AGGREGATE_FAILED');
  }
  const trialDays=(new Date(subscription.ends_at).getTime()-new Date(subscription.starts_at).getTime())/86_400_000;
  if(Math.abs(trialDays-7)>0.001)throw new Error('SUPABASE_SIGNUP_VERIFY_TRIAL_FAILED');
  if(await signupEligible(otpAuthUserId)!==false)throw new Error('SUPABASE_SIGNUP_VERIFY_PROVISIONED_REMAINS_ELIGIBLE');
  const {error:duplicateError}=await completeEligibleSignup(otpAuthUserId,tokenDigest);
  if(!duplicateError||!/SIGNUP_NOT_AVAILABLE/.test(String(duplicateError.message||''))){
    throw new Error('SUPABASE_SIGNUP_VERIFY_DUPLICATE_ALLOWED');
  }

  const inactiveAdminId=await createConfirmedUser('inactive-admin');
  await updateProfile(inactiveAdminId,{role:'ADMIN',active:false},'inactive-admin');
  await assertRejectedSignup('inactive-admin',inactiveAdminId);

  const inactiveSupportId=await createConfirmedUser('inactive-support');
  await updateProfile(inactiveSupportId,{role:'SUPPORT',active:false},'inactive-support');
  const {error:supportError}=await service.from('support_agent_profiles').insert({
    user_id:inactiveSupportId,active:false,available:false
  });
  if(supportError)throw new Error('SUPABASE_SIGNUP_VERIFY_INACTIVE_SUPPORT_ROW_FAILED');
  await assertRejectedSignup('inactive-support',inactiveSupportId);

  const reservedDriverId=await createConfirmedUser('reserved-driver',{
    appMetadata:{role:'SUPPORT',provisioned_by:'loadgistic-admin'}
  });
  await assertRejectedSignup('reserved-driver',reservedDriverId);

  const suspendedFleetId=await createConfirmedUser('suspended-fleet');
  await updateProfile(suspendedFleetId,{role:'TRANSPORTER',active:false},'suspended-fleet');
  const suspendedOrganizationId=await createOrganization('suspended-fleet');
  const {error:fleetMemberError}=await service.from('organization_members').insert({
    id:randomUUID(),user_id:suspendedFleetId,organization_id:suspendedOrganizationId,membership_role:'OWNER'
  });
  if(fleetMemberError)throw new Error('SUPABASE_SIGNUP_VERIFY_SUSPENDED_FLEET_MEMBERSHIP_FAILED');
  await createSubscription({organizationId:suspendedOrganizationId,audience:'TRANSPORTER'});
  await assertRejectedSignup('suspended-fleet',suspendedFleetId);

  const companyDriverId=await createConfirmedUser('company-driver');
  await updateProfile(companyDriverId,{role:'DRIVER',active:false},'company-driver');
  const driverOrganizationId=await createOrganization('company-driver');
  const {error:driverError}=await service.from('drivers').insert({
    id:randomUUID(),organization_id:driverOrganizationId,user_id:companyDriverId,
    name:'Signup Company Driver',active:true
  });
  if(driverError)throw new Error('SUPABASE_SIGNUP_VERIFY_COMPANY_DRIVER_ROW_FAILED');
  await assertRejectedSignup('company-driver',companyDriverId);

  const ownerOperatorId=await createConfirmedUser('owner-operator');
  await updateProfile(ownerOperatorId,{role:'DRIVER',active:false},'owner-operator');
  const {data:ownerProvider,error:ownerProviderError}=await service.from('provider_profiles').insert({
    id:randomUUID(),user_id:ownerOperatorId,business_name:'Existing Owner Operator',
    handle:uniqueHandle('owner-operator'),verified_identity:false,verified_license:false,
    vehicle_documents_verified:false,public_visibility:'PUBLIC'
  }).select('id').single();
  if(ownerProviderError||!ownerProvider)throw new Error('SUPABASE_SIGNUP_VERIFY_OWNER_OPERATOR_PROVIDER_FAILED');
  const {error:ownerApplicationError}=await service.from('applications').insert({
    id:randomUUID(),user_id:ownerOperatorId,business_name:'Existing Owner Operator',
    application_type:'OWNER_OPERATOR',status:'APPROVED',sponsored_free:false
  });
  if(ownerApplicationError)throw new Error('SUPABASE_SIGNUP_VERIFY_OWNER_OPERATOR_APPLICATION_FAILED');
  await createSubscription({providerProfileId:ownerProvider.id,audience:'DRIVER'});
  await assertRejectedSignup('owner-operator',ownerOperatorId);

  const selfManagedId=await createConfirmedUser('self-managed-provider');
  await updateProfile(selfManagedId,{role:'DRIVER',active:false},'self-managed-provider');
  const {data:selfManagedProvider,error:selfManagedProviderError}=await service.from('provider_profiles').insert({
    id:randomUUID(),user_id:selfManagedId,business_name:'Existing Self-Managed Driver',
    handle:uniqueHandle('self-managed-provider'),verified_identity:false,verified_license:false,
    vehicle_documents_verified:false,public_visibility:'PRIVATE'
  }).select('id').single();
  if(selfManagedProviderError||!selfManagedProvider){
    throw new Error('SUPABASE_SIGNUP_VERIFY_SELF_MANAGED_PROVIDER_FAILED');
  }
  const {error:selfManagedApplicationError}=await service.from('applications').insert({
    id:randomUUID(),user_id:selfManagedId,business_name:'Existing Self-Managed Driver',
    application_type:'SELF_MANAGED_DRIVER',status:'APPROVED',sponsored_free:false
  });
  if(selfManagedApplicationError)throw new Error('SUPABASE_SIGNUP_VERIFY_SELF_MANAGED_APPLICATION_FAILED');
  await createSubscription({providerProfileId:selfManagedProvider.id,audience:'DRIVER'});
  await assertRejectedSignup('self-managed-provider',selfManagedId);

  const orphanPermissionsId=await createConfirmedUser('orphan-permissions');
  await updateProfile(orphanPermissionsId,{role:'DRIVER',active:false},'orphan-permissions');
  const {error:permissionsError}=await service.from('driver_permissions').insert({user_id:orphanPermissionsId});
  if(permissionsError)throw new Error('SUPABASE_SIGNUP_VERIFY_ORPHAN_PERMISSIONS_ROW_FAILED');
  const assignmentOrganizationId=await createOrganization('orphan-assignment');
  const assignmentVehicleId=randomUUID();
  const {error:assignmentVehicleError}=await service.from('vehicles').insert({
    id:assignmentVehicleId,organization_id:assignmentOrganizationId,label:'Orphan assignment vehicle',
    category:'MINI_TRUCK',active:true
  });
  if(assignmentVehicleError)throw new Error('SUPABASE_SIGNUP_VERIFY_ORPHAN_ASSIGNMENT_VEHICLE_FAILED');
  const {error:assignmentError}=await service.from('driver_vehicle_assignments').insert({
    id:randomUUID(),driver_user_id:orphanPermissionsId,vehicle_id:assignmentVehicleId,active:true
  });
  if(assignmentError)throw new Error('SUPABASE_SIGNUP_VERIFY_ORPHAN_ASSIGNMENT_ROW_FAILED');
  await assertRejectedSignup('orphan-permissions',orphanPermissionsId);

  const legacyActorId=await createConfirmedUser('legacy-rpc');
  if(await signupEligible(legacyActorId)!==true){
    throw new Error('SUPABASE_SIGNUP_VERIFY_LEGACY_ACTOR_NOT_PRISTINE');
  }
  const legacyDigest=await prepareNegativeIntent('legacy-rpc');
  const {data:legacyIntentBefore,error:legacyIntentBeforeError}=await service.from('provider_signup_intents')
    .select('consumed_at,auth_user_id').eq('token_digest',legacyDigest).maybeSingle();
  if(legacyIntentBeforeError||!legacyIntentBefore||legacyIntentBefore.consumed_at!==null||legacyIntentBefore.auth_user_id!==null){
    throw new Error('SUPABASE_SIGNUP_VERIFY_LEGACY_INTENT_NOT_FRESH');
  }
  const legacyActorBefore=await actorSnapshot(legacyActorId);
  const {error:legacyCompletionError}=await service.rpc('complete_provider_signup',{
    actor_user_id:legacyActorId,requested_token_digest:legacyDigest
  });
  if(!legacyCompletionError||!(legacyCompletionError.code==='42501'||/permission denied/i.test(String(legacyCompletionError.message||'')))){
    throw new Error('SUPABASE_SIGNUP_VERIFY_LEGACY_COMPLETION_NOT_PERMISSION_DENIED');
  }
  const [{data:legacyIntentAfter,error:legacyIntentAfterError},legacyActorAfter]=await Promise.all([
    service.from('provider_signup_intents').select('consumed_at,auth_user_id')
      .eq('token_digest',legacyDigest).maybeSingle(),
    actorSnapshot(legacyActorId)
  ]);
  if(legacyIntentAfterError||!legacyIntentAfter||legacyIntentAfter.consumed_at!==null||legacyIntentAfter.auth_user_id!==null
    ||JSON.stringify(legacyActorAfter)!==JSON.stringify(legacyActorBefore)||await signupEligible(legacyActorId)!==true){
    throw new Error('SUPABASE_SIGNUP_VERIFY_LEGACY_COMPLETION_SIDE_EFFECT');
  }

  const {error:anonymousEligibilityError}=await anon.rpc('managed_provider_signup_eligible',{
    actor_user_id:otpAuthUserId
  });
  if(!anonymousEligibilityError)throw new Error('SUPABASE_SIGNUP_VERIFY_ANONYMOUS_ELIGIBILITY_ALLOWED');
  const {error:anonymousCompletionError}=await anon.rpc('complete_eligible_provider_signup',{
    actor_user_id:otpAuthUserId,requested_token_digest:tokenDigest
  });
  if(!anonymousCompletionError)throw new Error('SUPABASE_SIGNUP_VERIFY_ANONYMOUS_COMPLETION_ALLOWED');
}finally{
  if(applicationId)await service.from('audit_logs').delete().eq('entity_id',applicationId);
  if(intentDigests.size)await service.from('provider_signup_intents').delete().in('token_digest',[...intentDigests]);
  for(const organizationId of organizationIds)await service.from('organizations').delete().eq('id',organizationId);
  for(const authUserId of authUserIds)await service.auth.admin.deleteUser(authUserId);
  if(!otpAuthUserId){
    const {data:users}=await service.auth.admin.listUsers({page:1,perPage:200});
    const orphan=users?.users?.find(candidate=>candidate.email===otpEmail);
    if(orphan)await service.auth.admin.deleteUser(orphan.id);
  }
}

process.stdout.write('Supabase managed provider email OTP, profile-authority denial, authoritative eligibility/completion RPC, pristine bootstrap, rejection matrix, legacy permission denial, atomic workspace, trial, duplicate denial, and browser denial checks passed.\n');
