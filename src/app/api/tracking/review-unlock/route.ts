import { NextRequest, NextResponse } from 'next/server.js';
import { REVIEW_GRANT_COOKIE, TRACKING_IDLE_SECONDS } from '@/lib/auth';
import { unlockProviderReview } from '@/lib/provider-tracking.js';
import { createSessionToken } from '@/lib/security.js';
import { errorMessage } from '@/lib/errors';
import { redirectUrl, redirectWith, text } from '@/lib/redirects';

export async function POST(request:NextRequest) {
  const form=await request.formData();
  const shipmentId=text(form,'shipmentId');
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
