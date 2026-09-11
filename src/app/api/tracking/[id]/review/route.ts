import { NextRequest, NextResponse } from 'next/server.js';
import { revalidatePath } from 'next/cache';
import { getProviderTrackingGrant, hasProviderReviewGrant } from '@/lib/auth';
import {getProviderGuestTracking,submitProviderReview} from '@/lib/provider-tracking.js';
import { errorMessage } from '@/lib/errors';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
import { redirectWith, text } from '@/lib/redirects';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const grant=await getProviderTrackingGrant(id);
  if(!grant)return NextResponse.redirect(new URL('/track?error=Verify+your+approved+email+and+Tracking+code+again.',request.url),303);
  const tracking=await getProviderGuestTracking(id,grant.recipientDigest);
  if(!tracking||tracking.recipient_role!=='OWNER')return redirectWith(request,`/track/${id}`,'error','Only the customer owner may review this transporter.');
  if(!await hasProviderReviewGrant(id))return redirectWith(request,`/track/${id}`,'error','Enter the private review code from the customer owner email.');
  const rate=await checkRateLimit(requestKey(request,`tracking-review-submit:${id}`),5,60*60_000);
  if(!rate.allowed)return redirectWith(request,`/track/${id}`,'error',`Too many attempts. Try again in ${rate.retryAfterSeconds} seconds.`);
  const form=await request.formData();
  try{
    await submitProviderReview(id,'SHIPPER',Number(text(form,'rating')),text(form,'note'));
    revalidatePath(`/track/${id}`);
    return redirectWith(request,`/track/${id}`,'success','Your review is published.');
  }catch(error){return redirectWith(request,`/track/${id}`,'error',errorMessage(error));}
}
