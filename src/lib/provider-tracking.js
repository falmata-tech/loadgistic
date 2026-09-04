import {
  addSupabaseProviderTrackingRecipient,createSupabaseProviderShipment,disputeSupabaseProviderReview,getSupabaseProviderGuestTracking,
  getSupabaseProviderShipment,getSupabaseProviderTrackingWorkspace,listSupabasePendingProviderTrackingEmails,
  listSupabaseProviderReviewModeration,listSupabaseProviderShipments,purgeExpiredSupabaseProviderShipmentGuests,
  purgeExpiredSupabaseProviderTrackingOtps,requestSupabaseProviderTrackingOtp,revokeSupabaseProviderTrackingRecipient,
  recordSupabaseProviderTrackingEmailAttempt,resolveSupabaseProviderReview,submitSupabaseProviderReview,
  unlockSupabaseProviderReview,updateSupabaseProviderShipmentLocation,
  verifySupabaseProviderTrackingOtp,
  updateSupabaseProviderShipmentStatus
} from './provider-tracking/supabase.js';

export async function getProviderTrackingWorkspace(user,options={}){
  return getSupabaseProviderTrackingWorkspace(user,options);
}

export async function createProviderShipment(user,input){
  return createSupabaseProviderShipment(user,input);
}

export async function listProviderShipments(user,options={}){
  return listSupabaseProviderShipments(user,options);
}

export async function getProviderShipment(user,id){
  return getSupabaseProviderShipment(user,id);
}

export async function updateProviderShipmentStatus(
  user,id,nextStatus,note='',
  proof=/** @type {null|{path:string,originalName:string,mimeType:string}} */(null),
  locationInput=/** @type {any} */(null)
){
  return updateSupabaseProviderShipmentStatus(user,id,nextStatus,note,proof,locationInput);
}

export async function updateProviderShipmentLocation(user,id,input){
  return updateSupabaseProviderShipmentLocation(user,id,input);
}

export async function requestProviderTrackingOtp(email,code){
  return requestSupabaseProviderTrackingOtp(email,code);
}

export async function verifyProviderTrackingOtp(email,code,challengeId,otp){
  return verifySupabaseProviderTrackingOtp(email,code,challengeId,otp);
}

export async function unlockProviderReview(shipmentId,code){
  return unlockSupabaseProviderReview(shipmentId,code);
}

export async function getProviderGuestTracking(id,recipientDigest){
  return getSupabaseProviderGuestTracking(id,recipientDigest);
}

export async function addProviderTrackingRecipient(user,shipmentId,email){
  return addSupabaseProviderTrackingRecipient(user,shipmentId,email);
}

export async function revokeProviderTrackingRecipient(user,shipmentId,recipientId){
  return revokeSupabaseProviderTrackingRecipient(user,shipmentId,recipientId);
}

export async function purgeExpiredProviderShipmentGuests(limit=100){
  return purgeExpiredSupabaseProviderShipmentGuests(limit);
}

export async function purgeExpiredProviderTrackingOtps(limit=100){
  return purgeExpiredSupabaseProviderTrackingOtps(limit);
}

export async function listPendingEmailDeliveries(limit=20){
  return listSupabasePendingProviderTrackingEmails(limit);
}

export async function recordEmailDeliveryAttempt(id,result={}){
  return recordSupabaseProviderTrackingEmailAttempt(id,result);
}

export async function submitProviderReview(shipmentId,partyRole,rating,note=''){
  return submitSupabaseProviderReview(shipmentId,partyRole,rating,note);
}

export async function disputeProviderReview(user,reviewId,reason){
  return disputeSupabaseProviderReview(user,reviewId,reason);
}

export async function listProviderReviewModeration(user,status='PENDING',options={}){
  return listSupabaseProviderReviewModeration(user,status,options);
}

export async function resolveProviderReview(user,reviewId,status,note=''){
  return resolveSupabaseProviderReview(user,reviewId,status,note);
}
