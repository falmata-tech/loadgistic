import {after} from 'next/server.js';
import {z} from 'zod';
import {businessActorIdentity,businessBody,businessFailure,businessJson,businessLimit} from '@/lib/business-workspaces/http';
import {trackingSharingFailure,trackingSharingId} from '@/lib/tracking-sharing/http';
import {TrackingSharingError} from '@/lib/tracking-sharing/domain';
import {getBusinessTrackingDetail} from '@/lib/tracking-sharing/server';
import {accountOwnerVerification} from '@/lib/tracking-sharing/account-owner';
import {approveProviderHandover,getProviderGuestTracking,submitTrackingEmailReview} from '@/lib/provider-tracking.js';
import {deliverPendingShipmentEmails} from '@/lib/email-delivery';
export const runtime='nodejs';
const command=z.discriminatedUnion('action',[
 z.object({action:z.literal('APPROVE')}).strict(),
 z.object({action:z.literal('REVIEW'),rating:z.number().int().min(1).max(5),note:z.string().trim().max(1000),termsAccepted:z.literal(true)}).strict()
]);
export async function POST(request:Request,{params}:{params:Promise<{workspaceId:string;shipmentId:string}>}){try{
 const actor=await businessActorIdentity(request),{workspaceId,shipmentId}=await params;
 const workspace=trackingSharingId(workspaceId),shipment=trackingSharingId(shipmentId);
 const detail=await getBusinessTrackingDetail(actor.id,workspace,shipment);
 const proof=accountOwnerVerification(actor.email,detail.isOwner);
 const owner=await getProviderGuestTracking(shipment,proof.digest);
 if(!owner||owner.recipient_role!=='OWNER')throw new TrackingSharingError('TRACKING_ACCESS_DENIED');
 await businessLimit(actor.id,`tracking-owner-action:${shipment}`,10);
 const parsed=command.safeParse(await businessBody(request));
 if(!parsed.success)throw new TrackingSharingError('INVALID_TRACKING_RECIPIENTS');
 if(parsed.data.action==='APPROVE'){
  if(owner.can_approve!==true)throw new TrackingSharingError('TRACKING_APPROVAL_FORBIDDEN');
  await approveProviderHandover(shipment,proof.digest,proof.startedAt);
  after(async()=>{try{await deliverPendingShipmentEmails(5);}catch{/* The committed outbox remains retryable. */}});
 }else{
  if(owner.can_review!==true)throw new TrackingSharingError('TRACKING_APPROVAL_FORBIDDEN');
  await submitTrackingEmailReview(shipment,proof.digest,parsed.data.rating,parsed.data.note);
 }
 return businessJson({ok:true});
}catch(error){return trackingSharingFailure(error)||businessFailure(error);}}
