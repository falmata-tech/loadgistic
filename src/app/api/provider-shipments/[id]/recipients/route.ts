import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {addProviderTrackingRecipient,revokeProviderTrackingRecipient} from '@/lib/provider-tracking.js';
import {deliverPendingShipmentEmails} from '@/lib/email-delivery';
import {errorMessage} from '@/lib/errors';
import {redirectWith,text} from '@/lib/redirects';

export const runtime='nodejs';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;
  const form=await request.formData();
  try{
    const action=text(form,'action');
    if(action==='ADD'){
      await addProviderTrackingRecipient(user,id,text(form,'email'));
      await deliverPendingShipmentEmails(5);
      return redirectWith(request,`/app/provider-shipments/${id}`,'success','Tracking party added and access queued for email.');
    }
    if(action==='REVOKE'){
      await revokeProviderTrackingRecipient(user,id,text(form,'recipientId'));
      return redirectWith(request,`/app/provider-shipments/${id}`,'success','Tracking access revoked.');
    }
    throw new Error('INVALID_TRACKING_RECIPIENTS');
  }catch(error){
    return redirectWith(request,`/app/provider-shipments/${id}`,'error',errorMessage(error));
  }
}
