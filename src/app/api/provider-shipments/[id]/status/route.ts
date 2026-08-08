import { NextRequest, NextResponse } from 'next/server.js';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { saveUpload, updateProviderShipmentStatus } from '@/lib/repository.js';
import { deliverPendingShipmentEmails } from '@/lib/email-delivery';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text } from '@/lib/redirects';

export const runtime='nodejs';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;
  const form=await request.formData();
  try{
    const nextStatus=text(form,'nextStatus');
    const file=form.get('proof');
    const upload=file&&typeof file!=='string'&&file.size?await saveUpload(file,'provider-shipment-proof'):null;
    const proof=upload?{path:upload.path,originalName:upload.originalName,mimeType:upload.mimeType}:null;
    const result=updateProviderShipmentStatus(user,id,nextStatus,text(form,'note'),proof);
    if(result.status==='COMPLETED')await deliverPendingShipmentEmails(2);
    revalidatePath('/app/provider-shipments');
    revalidatePath(`/app/provider-shipments/${id}`);
    return redirectWith(request,`/app/provider-shipments/${id}`,'success',result.status==='COMPLETED'?'Shipment completed. Customer records are queued for email delivery.':'Shipment status updated.');
  }catch(error){return redirectWith(request,`/app/provider-shipments/${id}`,'error',errorMessage(error));}
}
