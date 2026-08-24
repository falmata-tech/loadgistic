function usesManagedData(){
  return process.env.DATA_BACKEND==='supabase';
}

async function managed(){
  return import('./provider-tracking/supabase.js');
}

async function legacy(){
  return import('./repository.js');
}

export async function getProviderTrackingWorkspace(user,options={}){
  if(usesManagedData())return (await managed()).getSupabaseProviderTrackingWorkspace(user,options);
  const repository=await legacy();
  const [vehicles,shipments,access]=await Promise.all([
    repository.listOwnVehicles(user),repository.listProviderShipments(user,options),repository.getDriverAccess(user)
  ]);
  return {vehicles,shipments,access};
}

export async function createProviderShipment(user,input){
  if(usesManagedData())return (await managed()).createSupabaseProviderShipment(user,input);
  return (await legacy()).createProviderShipment(user,input);
}

export async function listProviderShipments(user,options={}){
  if(usesManagedData())return (await managed()).listSupabaseProviderShipments(user,options);
  return (await legacy()).listProviderShipments(user,options);
}

export async function getProviderShipment(user,id){
  if(usesManagedData())return (await managed()).getSupabaseProviderShipment(user,id);
  return (await legacy()).getProviderShipment(user,id);
}

export async function updateProviderShipmentStatus(
  user,id,nextStatus,note='',
  proof=/** @type {null|{path:string,originalName:string,mimeType:string}} */(null),
  locationInput=/** @type {any} */(null)
){
  if(usesManagedData())return (await managed()).updateSupabaseProviderShipmentStatus(user,id,nextStatus,note,proof,locationInput);
  return (await legacy()).updateProviderShipmentStatus(user,id,nextStatus,note,proof,locationInput);
}

export async function updateProviderShipmentLocation(user,id,input){
  if(usesManagedData())return (await managed()).updateSupabaseProviderShipmentLocation(user,id,input);
  return (await legacy()).updateProviderShipmentLocation(user,id,input);
}

export async function unlockProviderTracking(code){
  if(usesManagedData())return (await managed()).unlockSupabaseProviderTracking(code);
  return (await legacy()).unlockProviderTracking(code);
}

export async function unlockProviderReview(shipmentId,code){
  if(usesManagedData())return (await managed()).unlockSupabaseProviderReview(shipmentId,code);
  return (await legacy()).unlockProviderReview(shipmentId,code);
}

export async function getProviderGuestTracking(id,partyRole){
  if(usesManagedData())return (await managed()).getSupabaseProviderGuestTracking(id,partyRole);
  return (await legacy()).getProviderGuestTracking(id,partyRole);
}

export async function purgeExpiredProviderShipmentGuests(limit=100){
  if(usesManagedData())return (await managed()).purgeExpiredSupabaseProviderShipmentGuests(limit);
  return (await legacy()).purgeExpiredProviderShipmentGuests();
}

export async function listPendingEmailDeliveries(limit=20){
  if(usesManagedData())return (await managed()).listSupabasePendingProviderTrackingEmails(limit);
  return (await legacy()).listPendingEmailDeliveries(limit);
}

export async function recordEmailDeliveryAttempt(id,result={}){
  if(usesManagedData())return (await managed()).recordSupabaseProviderTrackingEmailAttempt(id,result);
  return (await legacy()).recordEmailDeliveryAttempt(id,result);
}

export async function submitProviderReview(shipmentId,partyRole,rating,note=''){
  if(usesManagedData())return (await managed()).submitSupabaseProviderReview(shipmentId,partyRole,rating,note);
  return (await legacy()).submitProviderReview(shipmentId,partyRole,rating,note);
}

export async function disputeProviderReview(user,reviewId,reason){
  if(usesManagedData())return (await managed()).disputeSupabaseProviderReview(user,reviewId,reason);
  return (await legacy()).disputeProviderReview(user,reviewId,reason);
}

export async function listProviderReviewModeration(user,status='PENDING',options={}){
  if(usesManagedData())return (await managed()).listSupabaseProviderReviewModeration(user,status,options);
  const mapped=status==='UPHELD'?'PUBLISHED':status==='REMOVED'?'DISMISSED':'PENDING';
  return (await legacy()).listRatingModerationQueue(user,mapped,options);
}

export async function resolveProviderReview(user,reviewId,status,note=''){
  if(usesManagedData())return (await managed()).resolveSupabaseProviderReview(user,reviewId,status,note);
  const mapped=status==='UPHELD'?'PUBLISHED':status==='REMOVED'?'DISMISSED':status;
  return (await legacy()).reviewBusinessRating(user,reviewId,mapped,note);
}
