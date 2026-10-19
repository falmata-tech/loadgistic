import {createSupabaseAdminClient} from './supabase-adapter.js';

const codes=['FORBIDDEN','PRIVACY_GATEWAY_UNAVAILABLE','PRIVACY_JOB_CHANGED','INVALID_TELEMATICS_PRIVACY_INPUT'];
async function rpc(name,args){
 const {data,error}=await createSupabaseAdminClient().rpc(name,args);
 if(error)throw new Error(codes.find(code=>String(error.message).includes(code))||'PRIVACY_GATEWAY_UNAVAILABLE');
 return data;
}
/** Internal ports accept only a digest obtained from the separate privacy HMAC adapter. */
export function authorizePrivacyGatewayRequest(auth){
 return rpc('authorize_telematics_privacy_gateway_request',{gateway_digest:auth.digest,nonce:auth.nonce,body_digest:auth.bodyDigest,issued_at:auth.issuedAt});
}
export function claimGatewayPrivacyJobs(digest){return rpc('claim_telematics_privacy_jobs',{gateway_digest:digest});}
export function completeGatewayPrivacyJob(digest,command){return rpc('complete_telematics_privacy_job',{gateway_digest:digest,command});}
