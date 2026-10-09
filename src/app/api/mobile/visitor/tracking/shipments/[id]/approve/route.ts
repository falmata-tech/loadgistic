import {z} from 'zod';
import {after} from 'next/server.js';
import {requireVisitor} from '@/lib/mobile/visitor-server';
import {mobileFailure,mobileJson,MobileError} from '@/lib/mobile/server';
import {trackingFailure} from '@/lib/mobile/tracking-server';
import {approveProviderHandover} from '@/lib/provider-tracking.js';
import {deliverPendingShipmentEmails} from '@/lib/email-delivery';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{const session=await requireVisitor(request,'tracking'),id=z.string().uuid().safeParse((await params).id);
  if(!id.success)throw new MobileError(404,'NOT_FOUND','This shipment is not available.');
  const rate=await checkRateLimit(requestKey(request,`tracking-handover:${id.data}`),10,60000);
  if(!rate.allowed)throw new MobileError(429,'PLEASE_WAIT','Please wait and try again.');
  let result;try{result=await approveProviderHandover(id.data,session.digest,session.startedAt);}catch(error){trackingFailure(error);}
  after(async()=>{try{await deliverPendingShipmentEmails(5);}catch{/* Retained outbox is retryable. */}});
  return mobileJson(result);
 }catch(error){return mobileFailure(error);}
}
