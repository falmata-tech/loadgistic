import {createSupabaseAdminClient} from '../supabase-adapter.js';

function signupError(error){
  const message=String(error?.message||'');
  if(/SIGNUP_ALREADY_PROVISIONED/.test(message))return new Error('SIGNUP_ALREADY_PROVISIONED');
  if(/SIGNUP_(?:NOT_AVAILABLE|IDENTITY_REQUIRED|PLAN_UNAVAILABLE)/.test(message))return new Error('SIGNUP_NOT_AVAILABLE');
  return new Error('SUPABASE_PROVIDER_SIGNUP_FAILED',{cause:error});
}

export async function prepareSupabaseProviderSignup(input,tokenDigest,expiresAt){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('prepare_provider_signup_intent',{
    requested_token_digest:tokenDigest,
    requested_full_name:input.name,
    requested_business_name:input.businessName,
    requested_phone:input.phone,
    requested_application_type:input.applicationType,
    requested_notes:input.notes||null,
    requested_expires_at:expiresAt
  });
  if(error||!data)throw signupError(error);
  return {intentId:data,expiresAt};
}

export async function completeSupabaseProviderSignup(authUserId,tokenDigest){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('complete_provider_signup',{
    actor_user_id:String(authUserId||''),requested_token_digest:tokenDigest
  });
  if(error||!data)throw signupError(error);
  return data;
}
