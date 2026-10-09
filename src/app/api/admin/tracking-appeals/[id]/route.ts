import {z} from 'zod';
import {NextRequest,NextResponse} from 'next/server.js';
import {after} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {resolveProviderTrackingAppeal} from '@/lib/provider-tracking.js';
import {deliverPendingShipmentEmails} from '@/lib/email-delivery';
import {redirectWith,text} from '@/lib/redirects';
import {errorMessage} from '@/lib/errors';
export const runtime='nodejs';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser({allowLimited:true});if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
 try{const id=z.string().uuid().parse((await params).id),form=await request.formData();
  await resolveProviderTrackingAppeal(user,id,text(form,'decision'),text(form,'note'));
  after(async()=>{try{await deliverPendingShipmentEmails(5);}catch{/* Retained outbox is retryable. */}});
  return redirectWith(request,'/admin/operations?view=TRACKING','success','The appeal decision is saved.');
 }catch(error){return redirectWith(request,'/admin/operations?view=TRACKING','error',errorMessage(error));}
}
