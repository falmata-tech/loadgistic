import {createSessionToken,privateContactDigest,verifySessionToken} from './security.js';
import {normalizePublicAccountIdentity} from './provider-public-identity.js';
import {independentOperatingModel} from './independent-driver.js';
import {normalizePersonalName} from './personal-identity.js';

export const MANAGED_SIGNUP_COOKIE='lg_provider_signup';
export const MANAGED_SIGNUP_MAX_AGE_SECONDS=15*60;
export const MANAGED_SIGNUP_ERROR='We could not create the transporter account. Please try again.';

const ACCOUNT_TYPES=new Set(['TRANSPORT_COMPANY','OWNER_OPERATOR','SELF_MANAGED_DRIVER']);

export function createProviderSignupHandoff(email=''){
  const normalized=String(email||'').trim().toLowerCase();
  if(normalized&&!(normalized.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))){
    throw new Error('INVALID_SIGNUP_EMAIL');
  }
  return createSessionToken(`provider-signup:${normalized||'google'}`,MANAGED_SIGNUP_MAX_AGE_SECONDS);
}

export function readProviderSignupHandoff(token){
  const payload=verifySessionToken(token);
  const match=String(payload?.sub||'').match(/^provider-signup:(google|[^\s@]+@[^\s@]+\.[^\s@]+)$/);
  if(!match)return null;
  return {email:match[1]==='google'?null:match[1],expiresAt:Number(payload.exp)*1000};
}

export function maskedProviderSignupEmail(email){
  const [local,domain]=String(email||'').split('@');
  if(!local||!domain)return '';
  return `${local.slice(0,2)}${local.length>2?'•'.repeat(Math.min(6,local.length-2)):''}@${domain}`;
}

export function providerSignupIntentDigest(token){
  const value=String(token||'').trim();
  if(!/^[A-Za-z0-9_-]{32,128}$/.test(value))return null;
  return privateContactDigest(`provider-signup:${value}`);
}

export function normalizeProviderSignupInput(input={}){
  let identity;try{identity=normalizePublicAccountIdentity(input);}catch(error){return {ok:false,error:error.message==='INVALID_ACCOUNT_HANDLE'?'Use 2–64 lowercase letters, numbers, underscores or hyphens for your handle.':'Enter a public account name and handle.'};}
  const structured=Object.hasOwn(input,'firstName')||Object.hasOwn(input,'lastName');
  const firstName=structured?normalizePersonalName(input.firstName):null;
  const lastName=structured?normalizePersonalName(input.lastName??''):null;
  const name=structured?[firstName,lastName].filter(Boolean).join(' '):String(input.name||'').trim();
  const requestedType=String(input.applicationType||'').trim().toUpperCase();
  const unified=requestedType==='TRANSPORT_PROVIDER';
  if(unified&&(!structured||typeof input.drivesTruck!=='boolean'||(input.businessName!==undefined&&typeof input.businessName!=='string')))return {ok:false,error:'Check your provider details and driving choice.'};
  // Business presentation is optional; legacy persistence anchors stay intact.
  const applicationType=unified?(!identity.accountName&&String(input.businessName||'').trim()?'TRANSPORT_COMPANY':'SELF_MANAGED_DRIVER'):requestedType;
  const businessName=(unified&&identity.accountName?'':String(input.businessName||'').trim())||(structured&&applicationType!=='TRANSPORT_COMPANY'?firstName:'');
  const phone=String(input.phone||'').trim();
  const notes=String(input.notes||'').trim().slice(0,1000);
  if(structured&&(!firstName||typeof input.firstName!=='string'||(input.lastName!==undefined&&typeof input.lastName!=='string')||firstName.length>100||lastName.length>100||name.length>100||/[\x00-\x1f\x7f]/.test(name)))return {ok:false,error:'Enter your first name and optional last or father name.'};
  if(!structured&&(name.length<2||name.length>120))return {ok:false,error:'Enter your full name.'};
  if(businessName.length<(structured&&applicationType!=='TRANSPORT_COMPANY'?1:2)||businessName.length>140)return {ok:false,error:'Enter the transporter name.'};
  if(phone.length<7||phone.length>30||!/^[0-9+() .-]+$/.test(phone)||phone.replace(/\D/g,'').length<7)return {ok:false,error:'Enter a valid callback phone number.'};
  if(!ACCOUNT_TYPES.has(applicationType))return {ok:false,error:'Choose how you operate.'};
  const callback=Object.hasOwn(input,'publicCallbackPhone')?input.publicCallbackPhone:undefined;
  if(callback!==undefined&&(!structured||applicationType==='TRANSPORT_COMPANY'||typeof callback!=='string'||callback.trim().length>32||(callback.trim()!==''&&(!/^[0-9+() .-]+$/.test(callback.trim())||callback.replace(/\D/g,'').length<7))))return {ok:false,error:'Enter a valid public phone number.'};
  return {ok:true,input:{...identity,name,businessName,phone,applicationType:independentOperatingModel(applicationType),notes,...(structured?{firstName,lastName}:{}),...(unified?{drivesTruck:input.drivesTruck}:{}),...(callback!==undefined?{publicCallbackPhone:callback.trim()}:{})}};
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

export async function managedProviderSignupEligible(authUserId){
  const {supabaseProviderSignupEligible}=await import('./provider-signup/supabase.js');
  return supabaseProviderSignupEligible(authUserId);
}
