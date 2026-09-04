import { NextRequest, NextResponse } from 'next/server.js';
import { REVIEW_GRANT_COOKIE, TRACKING_IDLE_SECONDS } from '@/lib/auth';
import { unlockProviderReview } from '@/lib/provider-tracking.js';
import { createSessionToken } from '@/lib/security.js';
import { errorMessage } from '@/lib/errors';
import {checkOriginBeforeScopedLimit} from '@/lib/guest-rate-limit.js';
import {requestKey} from '@/lib/rate-limit';
import { redirectUrl, redirectWith, text } from '@/lib/redirects';

export async function POST(request:NextRequest) {
  const rate=await checkOriginBeforeScopedLimit({
    originKey:requestKey(request,'tracking-review-unlock'),originLimit:12,windowMs:10*60_000,scopedLimit:5,
    readScope:async()=>{
      const form=await request.formData();
      const shipmentId=text(form,'shipmentId');
      return {key:`tracking-review-unlock-shipment:${shipmentId}`,value:{form,shipmentId}};
    }
  });
  if(!rate.allowed){
    const returnPath=rate.scope?.shipmentId&&/^(?:pshp-[0-9a-f-]+|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(rate.scope.shipmentId)?`/track/${rate.scope.shipmentId}`:'/track';
    return redirectWith(request,returnPath,'error',`Too many attempts. Try again in ${rate.retryAfterSeconds} seconds.`);
  }
  const {form,shipmentId}=rate.scope||{form:new FormData(),shipmentId:''};
  const returnPath=/^(?:pshp-[0-9a-f-]+|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(shipmentId)?`/track/${shipmentId}`:'/track';
  try{
    const review=await unlockProviderReview(shipmentId,text(form,'reviewCode'));
    const response=NextResponse.redirect(redirectUrl(request,`/track/${review.id}`),303);
    response.cookies.set(REVIEW_GRANT_COOKIE,createSessionToken(`provider-review:${review.id}`,TRACKING_IDLE_SECONDS),{
      httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:TRACKING_IDLE_SECONDS
    });
    return response;
  }catch(error){return redirectWith(request,returnPath,'error',errorMessage(error));}
}
