import {NextRequest,NextResponse} from 'next/server.js';
import {after} from 'next/server.js';
import {getProviderTrackingGrant} from '@/lib/auth';
import {approveProviderHandover} from '@/lib/provider-tracking.js';
import {deliverPendingShipmentEmails} from '@/lib/email-delivery';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
import {redirectWith} from '@/lib/redirects';
import {errorMessage} from '@/lib/errors';
export const runtime='nodejs';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params,grant=await getProviderTrackingGrant(id);
 if(!grant||!grant.startedAt)return NextResponse.redirect(new URL('/track?error=Verify+your+email+again.',request.url),303);
 const rate=await checkRateLimit(requestKey(request,`tracking-handover:${id}`),10,60000);
 if(!rate.allowed)return redirectWith(request,`/track/${id}`,'error','Please wait and try again.');
 try{await approveProviderHandover(id,grant.recipientDigest,grant.startedAt);
  after(async()=>{try{await deliverPendingShipmentEmails(5);}catch{/* Retained outbox is retryable. */}});
  return redirectWith(request,`/track/${id}`,'success','Unloading approved. This shipment is complete.');
 }catch(error){return redirectWith(request,`/track/${id}`,'error',errorMessage(error));}
}
