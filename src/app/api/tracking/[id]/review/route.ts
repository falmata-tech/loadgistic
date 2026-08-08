import { NextRequest, NextResponse } from 'next/server.js';
import { revalidatePath } from 'next/cache';
import { getProviderTrackingGrant } from '@/lib/auth';
import { submitProviderReview } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text } from '@/lib/redirects';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const grant=await getProviderTrackingGrant(id);
  if(!grant)return NextResponse.redirect(new URL('/track?error=Enter+the+private+shipment+code+again.',request.url),303);
  const form=await request.formData();
  try{
    submitProviderReview(id,grant.partyRole,Number(text(form,'rating')),text(form,'note'));
    revalidatePath(`/track/${id}`);
    return redirectWith(request,`/track/${id}`,'success','Your review is published.');
  }catch(error){return redirectWith(request,`/track/${id}`,'error',errorMessage(error));}
}
