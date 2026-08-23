import { NextRequest, NextResponse } from 'next/server.js';
import { getProviderTrackingGrant, TRACKING_GRANT_COOKIE, TRACKING_IDLE_SECONDS } from '@/lib/auth';
import { getProviderGuestTracking } from '@/lib/repository.js';
import { createSessionToken } from '@/lib/security.js';
import { text } from '@/lib/redirects';

export async function POST(request:NextRequest) {
  const form=await request.formData();
  const shipmentId=text(form,'shipmentId');
  const grant=await getProviderTrackingGrant(shipmentId);
  if(!grant||!await getProviderGuestTracking(shipmentId,grant.partyRole))return NextResponse.json({ok:false},{status:403});
  const response=NextResponse.json({ok:true});
  response.cookies.set(TRACKING_GRANT_COOKIE,createSessionToken(`provider-tracking:${shipmentId}:${grant.partyRole}`,TRACKING_IDLE_SECONDS),{
    httpOnly:true,
    sameSite:'lax',
    secure:process.env.NODE_ENV==='production',
    path:'/',
    maxAge:TRACKING_IDLE_SECONDS
  });
  return response;
}

export async function DELETE() {
  const response=NextResponse.json({ok:true});
  response.cookies.set(TRACKING_GRANT_COOKIE,'',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0});
  return response;
}
