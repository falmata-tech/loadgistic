import {z} from 'zod';
import {createSupabaseAdminClient} from './supabase-adapter.js';
import {authorityConfirmationSchema,authorityVehicleIdsSchema,providerPublicationSchema,truckAuthoritySchema} from './provider-authority-contract.js';

const errors=['FORBIDDEN','NOT_FOUND','POLICY_REQUIRED','INVALID_PUBLICATION_STATE','PROVIDER_VERIFICATION_REQUIRED','AUTHORITY_SOURCE_NOT_APPROVED',
  'AUTHORITY_SOURCE_MISMATCH','AUTHORITY_ALREADY_CONFIRMED','AUTHORITY_ALREADY_REVOKED','AUTHORITY_REVIEW_NOTE_REQUIRED',
  'AUTHORITY_EXPIRY_REQUIRED','AUTHORITY_EXPIRY_INVALID','AUTHORITY_HOLDER_BASIS_REQUIRED','AUTHORITY_CONTEXT_CHANGED','INVALID_AUTHORITY_FACT'];
function fail(error){const message=String(error?.message||'');throw new Error(errors.find(code=>message.includes(code))||'PROVIDER_AUTHORITY_UNAVAILABLE',{cause:error});}
const id=z.string().uuid();
export async function getProviderPublication(user){
  const {data,error}=await createSupabaseAdminClient().rpc('managed_provider_publication_eligibility',{actor_user_id:id.parse(user.id)});
  if(error)fail(error);return providerPublicationSchema.parse(data);
}
// The caller has already authorized these truck IDs. This helper never expands scope.
export async function getTruckAuthorities(client,vehicleIds){
  const ids=authorityVehicleIdsSchema.parse(vehicleIds);if(!ids.length)return new Map();
  const {data,error}=await client.rpc('provider_vehicle_authority_states',{requested_vehicle_ids:ids});
  if(error)fail(error);
  const rows=z.array(z.object({vehicleId:id,authority:truckAuthoritySchema})).max(100).parse(data);
  const allowed=new Set(ids);if(rows.some(row=>!allowed.has(row.vehicleId)))throw new Error('PROVIDER_AUTHORITY_SCOPE_MISMATCH');
  return new Map(rows.map(row=>[row.vehicleId,row.authority]));
}
export async function setProviderVehiclePublication(user,vehicleId,state){
  const {data,error}=await createSupabaseAdminClient().rpc('set_provider_vehicle_publication',{
    actor_user_id:id.parse(user.id),target_vehicle_id:id.parse(vehicleId),requested_state:z.enum(['LIVE','DRAFT']).parse(state)
  });if(error)fail(error);return z.object({vehicleId:id,state:z.enum(['LIVE','DRAFT'])}).parse(data);
}
export async function confirmProviderVehicleAuthority(user,requestId,input){
  const command=authorityConfirmationSchema.parse(input);
  const {data,error}=await createSupabaseAdminClient().rpc('confirm_provider_vehicle_authority',{
    actor_user_id:id.parse(user.id),request_id:id.parse(requestId),command:{fact_kind:command.factKind,
      holder_basis:command.holderBasis||null,expires_on:command.expiresOn||null,review_note:command.reviewNote,context_revision:command.contextRevision}
  });if(error)fail(error);return id.parse(data);
}
export async function revokeProviderVehicleAuthority(user,authorityReviewId,reason){
  const {error}=await createSupabaseAdminClient().rpc('revoke_provider_vehicle_authority',{
    actor_user_id:id.parse(user.id),authority_review_id:id.parse(authorityReviewId),reason:z.string().trim().min(5).max(500).parse(reason)
  });if(error)fail(error);
}
