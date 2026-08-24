import {privateContactDigest} from './security.js';

export const MANAGED_SIGNUP_COOKIE='lg_provider_signup';
export const MANAGED_SIGNUP_MAX_AGE_SECONDS=15*60;
export const MANAGED_SIGNUP_ERROR='We could not create the transporter account. Please try again.';

const ACCOUNT_TYPES=new Set(['TRANSPORT_COMPANY','OWNER_OPERATOR','SELF_MANAGED_DRIVER']);

export function providerSignupIntentDigest(token){
  const value=String(token||'').trim();
  if(!/^[A-Za-z0-9_-]{32,128}$/.test(value))return null;
  return privateContactDigest(`provider-signup:${value}`);
}

export function normalizeProviderSignupInput(input={}){
  const name=String(input.name||'').trim();
  const businessName=String(input.businessName||'').trim();
  const phone=String(input.phone||'').trim();
  const applicationType=String(input.applicationType||'').trim().toUpperCase();
  const notes=String(input.notes||'').trim().slice(0,1000);
  if(name.length<2||name.length>120)return {ok:false,error:'Enter your full name.'};
  if(businessName.length<2||businessName.length>140)return {ok:false,error:'Enter the transporter name.'};
  if(phone.length<7||phone.length>30||!/^[0-9+() .-]+$/.test(phone))return {ok:false,error:'Enter a valid callback phone number.'};
  if(!ACCOUNT_TYPES.has(applicationType))return {ok:false,error:'Choose how you operate.'};
  return {ok:true,input:{name,businessName,phone,applicationType,notes}};
}

export async function prepareManagedProviderSignup(input,token){
  const digest=providerSignupIntentDigest(token);
  if(!digest)throw new Error('INVALID_SIGNUP_INTENT');
  const {prepareSupabaseProviderSignup}=await import('./provider-signup/supabase.js');
  return prepareSupabaseProviderSignup(input,digest,new Date(Date.now()+MANAGED_SIGNUP_MAX_AGE_SECONDS*1000).toISOString());
}

export async function completeManagedProviderSignup(authUserId,token){
  const digest=providerSignupIntentDigest(token);
  if(!digest)throw new Error('SIGNUP_NOT_AVAILABLE');
  const {completeSupabaseProviderSignup}=await import('./provider-signup/supabase.js');
  return completeSupabaseProviderSignup(authUserId,digest);
}
