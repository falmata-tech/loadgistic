import { NextRequest, NextResponse } from 'next/server.js';
import { TRACKING_GRANT_COOKIE, TRACKING_IDLE_SECONDS } from '@/lib/auth';
import { unlockProviderTracking } from '@/lib/repository.js';
import { createSessionToken } from '@/lib/security.js';
import { errorMessage } from '@/lib/errors';
import { redirectUrl, redirectWith, text } from '@/lib/redirects';

export async function POST(request:NextRequest) {
  const form=await request.formData();
  try {
    const shipment=await unlockProviderTracking(text(form,'trackingCode'));
    const response=NextResponse.redirect(redirectUrl(request,`/track/${shipment.id}`),303);
    response.cookies.set(TRACKING_GRANT_COOKIE,createSessionToken(`provider-tracking:${shipment.id}:${shipment.partyRole}`,TRACKING_IDLE_SECONDS),{
      httpOnly:true,
      sameSite:'lax',
      secure:process.env.NODE_ENV==='production',
      path:'/',
      maxAge:TRACKING_IDLE_SECONDS
    });
    return response;
  } catch(error) {
    return redirectWith(request,'/track','error',errorMessage(error));
  }
}
