import {after} from 'next/server.js';
import {businessActorIdentity,businessBody,businessFailure,businessJson,businessLimit} from '@/lib/business-workspaces/http';
import {trackingSharingFailure,trackingSharingId} from '@/lib/tracking-sharing/http';
import {getBusinessTrackingDetail,trackingSharingService} from '@/lib/tracking-sharing/server';
import {accountOwnerVerification} from '@/lib/tracking-sharing/account-owner';
import {deliverPendingShipmentEmails} from '@/lib/email-delivery';
export const runtime='nodejs';
type Context={params:Promise<{workspaceId:string;shipmentId:string}>};

async function owner(request:Request,context:Context){
 const actor=await businessActorIdentity(request),{workspaceId,shipmentId}=await context.params;
 const workspace=trackingSharingId(workspaceId),shipment=trackingSharingId(shipmentId);
 const detail=await getBusinessTrackingDetail(actor.id,workspace,shipment);
 return {actor:actor.id,shipment,proof:accountOwnerVerification(actor.email,detail.isOwner)};
}
export async function GET(request:Request,context:Context){try{
 const {shipment,proof}=await owner(request,context);
 return businessJson(await trackingSharingService().owner(shipment,proof));
}catch(error){return trackingSharingFailure(error)||businessFailure(error);}}
export async function POST(request:Request,context:Context){try{
 const {actor,shipment,proof}=await owner(request,context);
 await businessLimit(actor,`tracking-sharing:${shipment}`,20);
 const input=await businessBody(request),result=await trackingSharingService().command(shipment,proof,input);
 if(input.action==='ADD_VIEWER')after(async()=>{try{await deliverPendingShipmentEmails(5);}catch{/* The committed outbox remains retryable. */}});
 return businessJson(result);
}catch(error){return trackingSharingFailure(error)||businessFailure(error);}}
