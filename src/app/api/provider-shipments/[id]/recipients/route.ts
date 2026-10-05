import {after,NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {addProviderTrackingRecipient,revokeProviderTrackingRecipient} from '@/lib/provider-tracking.js';
import {deliverPendingShipmentEmails} from '@/lib/email-delivery';
import {errorMessage} from '@/lib/errors';
import {redirectWith,text} from '@/lib/redirects';

export const runtime='nodejs';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const json=request.headers.get('accept')?.includes('application/json');
  const user=await getCurrentUser();
  if(!user)return json?NextResponse.json({ok:false,error:'Please log in again to manage Tracking parties.'},{status:401}):NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;
  try{
    const form=await request.formData();
    const action=text(form,'action');
    if(action==='ADD'){
      await addProviderTrackingRecipient(user,id,text(form,'email'));
      after(async()=>{
        try{await deliverPendingShipmentEmails(5);}
        catch{/* The committed invitation remains available to the recovery worker. */}
      });
      if(json)return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
      return redirectWith(request,`/app/provider-shipments/${id}`,'success','Tracking party added and access queued for email.');
    }
    if(action==='REVOKE'){
      await revokeProviderTrackingRecipient(user,id,text(form,'recipientId'));
      if(json)return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
      return redirectWith(request,`/app/provider-shipments/${id}`,'success','Tracking access revoked.');
    }
    throw new Error('INVALID_TRACKING_RECIPIENTS');
  }catch(error){
    if(json)return NextResponse.json({ok:false,error:errorMessage(error)},{status:400,headers:{'Cache-Control':'no-store'}});
    return redirectWith(request,`/app/provider-shipments/${id}`,'error',errorMessage(error));
  }
}
