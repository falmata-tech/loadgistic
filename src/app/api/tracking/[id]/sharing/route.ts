import {after} from 'next/server.js';
import {businessBody,businessFailure,businessJson,businessLimit} from '@/lib/business-workspaces/http';
import {trackingSharingId,trackingOwnerVerification,trackingSharingFailure} from '@/lib/tracking-sharing/http';
import {trackingSharingService} from '@/lib/tracking-sharing/server';
import {deliverPendingShipmentEmails} from '@/lib/email-delivery';
export const runtime='nodejs';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context){try{
 const id=trackingSharingId((await context.params).id),proof=await trackingOwnerVerification(request,id);
 return businessJson(await trackingSharingService().owner(id,proof));
}catch(error){return trackingSharingFailure(error)||businessFailure(error);}}
export async function POST(request:Request,context:Context){try{
 const id=trackingSharingId((await context.params).id),proof=await trackingOwnerVerification(request,id);
 await businessLimit(proof.digest,`tracking-sharing:${id}`,20);
 const input=await businessBody(request),result=await trackingSharingService().command(id,proof,input);
 if(input.action==='ADD_VIEWER')after(async()=>{try{await deliverPendingShipmentEmails(5);}catch{/* The committed outbox remains retryable. */}});
 return businessJson(result);
}catch(error){return trackingSharingFailure(error)||businessFailure(error);}}
