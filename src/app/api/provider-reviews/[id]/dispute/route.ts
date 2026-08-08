import { NextRequest, NextResponse } from 'next/server.js';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { disputeProviderReview } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text } from '@/lib/redirects';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;
  const form=await request.formData();
  const shipmentId=text(form,'shipmentId');
  try{
    disputeProviderReview(user,id,text(form,'reason'));
    revalidatePath(`/app/provider-shipments/${shipmentId}`);
    return redirectWith(request,`/app/provider-shipments/${shipmentId}`,'success','Review dispute submitted. The rating remains published while it is reviewed.');
  }catch(error){return redirectWith(request,`/app/provider-shipments/${shipmentId}`,'error',errorMessage(error));}
}
