import {businessActorIdentity,businessFailure,businessJson,businessLimit} from '@/lib/business-workspaces/http';
import {trackingSharingId,trackingSharingFailure} from '@/lib/tracking-sharing/http';
import {getBusinessTrackingDetail} from '@/lib/tracking-sharing/server';
import {guestTrackingDetail} from '@/lib/mobile/tracking-contract';
import {accountOwnerVerification} from '@/lib/tracking-sharing/account-owner';
import {getProviderGuestTracking} from '@/lib/provider-tracking.js';
import {TrackingSharingError} from '@/lib/tracking-sharing/domain';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{workspaceId:string;shipmentId:string}>}){try{
 const actor=await businessActorIdentity(request),values=await params,id=trackingSharingId(values.workspaceId),shipment=trackingSharingId(values.shipmentId);
 await businessLimit(actor.id,'tracking-detail',120);
 const result=await getBusinessTrackingDetail(actor.id,id,shipment);
 let visible=result.shipment;
 if(result.isOwner){
  const proof=accountOwnerVerification(actor.email,true),owner=await getProviderGuestTracking(shipment,proof.digest);
  if(!owner||owner.recipient_role!=='OWNER')throw new TrackingSharingError('TRACKING_ACCESS_DENIED');
  visible=owner;
 }
 return businessJson({...guestTrackingDetail(visible),workspaceId:id,isOwner:result.isOwner,
  canViewLocation:result.shipment.can_view_location});
}catch(error){return trackingSharingFailure(error)||businessFailure(error);}}
