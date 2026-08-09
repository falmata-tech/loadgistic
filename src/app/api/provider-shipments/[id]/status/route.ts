import { NextRequest, NextResponse } from 'next/server.js';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { saveUpload, updateProviderShipmentStatus } from '@/lib/repository.js';
import { deliverPendingShipmentEmails } from '@/lib/email-delivery';
import { removePrivateUpload } from '@/lib/private-storage.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text } from '@/lib/redirects';

export const runtime='nodejs';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;
  const form=await request.formData();
  let upload:null|{path:string;originalName:string;mimeType:string}=null;
  try{
    const nextStatus=text(form,'nextStatus');
    const file=form.get('proof');
    if(file&&typeof file!=='string'&&file.size){
      if(!['LOADING','UNLOADING','ISSUE'].includes(nextStatus))throw new Error('PROOF_NOT_ALLOWED_FOR_STATUS');
      if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('UNSUPPORTED_FILE_TYPE');
      upload=await saveUpload(file,'tracking-proof');
    }
    const proof=upload?{path:upload.path,originalName:upload.originalName,mimeType:upload.mimeType}:null;
    const result=updateProviderShipmentStatus(user,id,nextStatus,text(form,'note'),proof);
    if(result.status==='COMPLETED')await deliverPendingShipmentEmails(2);
    revalidatePath('/app/provider-shipments');
    revalidatePath(`/app/provider-shipments/${id}`);
    return redirectWith(request,`/app/provider-shipments/${id}`,'success',result.status==='COMPLETED'?'Tracking complete. The customer record is queued for email delivery.':'Tracking status updated.');
  }catch(error){if(upload?.path){try{await removePrivateUpload(upload.path);}catch{}}return redirectWith(request,`/app/provider-shipments/${id}`,'error',errorMessage(error));}
}
