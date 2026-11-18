import {after} from 'next/server.js';
import {trackingSessionHttp} from '@/lib/tracking-sessions/http';
import {deliverPendingShipmentEmails} from '@/lib/email-delivery';
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{sessionId:string}>}){
 const response=await trackingSessionHttp(request,'APPROVE',await context.params);
 if(response.ok)after(async()=>{try{await deliverPendingShipmentEmails(5);}catch{/* The committed completion and retryable outbox remain intact. */}});
 return response;
}
