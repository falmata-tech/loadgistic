import {randomBytes} from 'node:crypto';
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
const {prepareManagedProviderSignup,completeManagedProviderSignup,providerSignupIntentDigest}=await import('../src/lib/provider-signup.js');

const token=randomBytes(32).toString('base64url');
const tokenDigest=providerSignupIntentDigest(token);
const email=`signup-${randomBytes(8).toString('hex')}@loadgistic.local`;
const otpEmail=`signup-otp-${randomBytes(8).toString('hex')}@loadgistic.local`;
let authUserId=null;
let otpAuthUserId=null;
let applicationId=null;

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
  const {data:otpProfile,error:otpProfileError}=await service.from('profiles').select('active,role').eq('id',otpAuthUserId).maybeSingle();
  if(otpProfileError||!otpProfile||otpProfile.active!==false)throw new Error('SUPABASE_SIGNUP_VERIFY_OTP_AUTHORITY_FAILED');

  await prepareManagedProviderSignup({
    name:'Managed Signup Driver',businessName:'Managed Signup Transport',phone:'+251 911 222 333',
    applicationType:'OWNER_OPERATOR',notes:'Local managed signup verification.'
  },token);
  const {data:created,error:createError}=await service.auth.admin.createUser({
    email,password:randomBytes(24).toString('base64url'),email_confirm:true,
    user_metadata:{full_name:'Managed Signup Driver'}
  });
  if(createError||!created.user)throw new Error(`SUPABASE_SIGNUP_VERIFY_AUTH_CREATE_FAILED:${createError?.message||''}`);
  authUserId=created.user.id;
  const {data:bootstrap,error:bootstrapError}=await service.from('profiles').select('active,role').eq('id',authUserId).maybeSingle();
  if(bootstrapError||!bootstrap||bootstrap.active!==false)throw new Error('SUPABASE_SIGNUP_VERIFY_INACTIVE_BOOTSTRAP_FAILED');

  const completed=await completeManagedProviderSignup(authUserId,token);
  applicationId=completed.applicationId;
  const [{data:profile,error:profileError},{data:provider,error:providerError},{data:application,error:applicationError}]=await Promise.all([
    service.from('profiles').select('active,role,phone').eq('id',authUserId).maybeSingle(),
    service.from('provider_profiles').select('id,handle').eq('user_id',authUserId).maybeSingle(),
    service.from('applications').select('id,status,application_type').eq('user_id',authUserId).maybeSingle()
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
  await completeManagedProviderSignup(authUserId,token).then(
    ()=>{throw new Error('SUPABASE_SIGNUP_VERIFY_DUPLICATE_ALLOWED');},
    error=>{if(!/SIGNUP_ALREADY_PROVISIONED|SIGNUP_NOT_AVAILABLE/.test(String(error?.message)))throw error;}
  );
  const {error:anonymousError}=await anon.rpc('complete_provider_signup',{
    actor_user_id:authUserId,requested_token_digest:tokenDigest
  });
  if(!anonymousError)throw new Error('SUPABASE_SIGNUP_VERIFY_ANONYMOUS_RPC_ALLOWED');
}finally{
  if(applicationId)await service.from('audit_logs').delete().eq('entity_id',applicationId);
  if(tokenDigest)await service.from('provider_signup_intents').delete().eq('token_digest',tokenDigest);
  if(authUserId)await service.auth.admin.deleteUser(authUserId);
  if(otpAuthUserId)await service.auth.admin.deleteUser(otpAuthUserId);
  else{
    const {data:users}=await service.auth.admin.listUsers({page:1,perPage:200});
    const orphan=users?.users?.find(candidate=>candidate.email===otpEmail);
    if(orphan)await service.auth.admin.deleteUser(orphan.id);
  }
}

process.stdout.write('Supabase managed provider email OTP, inactive bootstrap, atomic workspace, trial, duplicate denial, and browser denial checks passed.\n');
