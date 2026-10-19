import {createSupabaseAdminClient} from '../supabase-adapter.js';

function signupError(error){
  const message=String(error?.message||'');
  if(/ACCOUNT_HANDLE_UNAVAILABLE|INVALID_ACCOUNT_HANDLE|INVALID_PUBLIC_ACCOUNT_NAME/.test(message))return new Error(message.match(/ACCOUNT_HANDLE_UNAVAILABLE|INVALID_ACCOUNT_HANDLE|INVALID_PUBLIC_ACCOUNT_NAME/)[0]);
  if(/SIGNUP_ALREADY_PROVISIONED/.test(message))return new Error('SIGNUP_ALREADY_PROVISIONED');
  if(/SIGNUP_(?:NOT_AVAILABLE|IDENTITY_REQUIRED|PLAN_UNAVAILABLE)/.test(message))return new Error('SIGNUP_NOT_AVAILABLE');
  return new Error('SUPABASE_PROVIDER_SIGNUP_FAILED',{cause:error});
}

export async function prepareSupabaseProviderSignup(input,tokenDigest,expiresAt){
  const client=createSupabaseAdminClient();
  const structured=Object.hasOwn(input,'firstName');
  const args=structured?{requested_token_digest:tokenDigest,requested_expires_at:expiresAt,command:{...(Object.hasOwn(input,'accountName')?{accountName:input.accountName,handle:input.handle}:{}),firstName:input.firstName,lastName:input.lastName,businessName:input.businessName,phone:input.phone,applicationType:input.applicationType,notes:input.notes||'',...(Object.hasOwn(input,'drivesTruck')?{drivesTruck:input.drivesTruck}:{}),...(Object.hasOwn(input,'publicCallbackPhone')?{publicCallbackPhone:input.publicCallbackPhone}:{})}}:{
    requested_token_digest:tokenDigest,
    requested_full_name:input.name,
    requested_business_name:input.businessName,
    requested_phone:input.phone,
    requested_application_type:input.applicationType,
    requested_notes:input.notes||null,
    requested_expires_at:expiresAt
  };
  const {data,error}=await client.rpc(structured?'prepare_provider_signup_identity':'prepare_provider_signup_intent',args);
  if(error||!data)throw signupError(error);
  return {intentId:data,expiresAt};
}

export async function completeSupabaseProviderSignup(authUserId,tokenDigest){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('complete_eligible_provider_signup',{
    actor_user_id:String(authUserId||''),requested_token_digest:tokenDigest
  });
  if(error||!data)throw signupError(error);
  return data;
}

export async function supabaseProviderSignupEligible(authUserId){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('managed_provider_signup_eligible',{
    actor_user_id:String(authUserId||'')
  });
  if(error)throw new Error('SUPABASE_PROVIDER_SIGNUP_ELIGIBILITY_FAILED',{cause:error});
  return data===true;
}
