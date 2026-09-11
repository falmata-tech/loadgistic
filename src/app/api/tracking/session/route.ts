import { NextRequest, NextResponse } from 'next/server.js';
import {clearProviderTrackingGrant,getProviderTrackingGrant,setProviderTrackingGrant} from '@/lib/auth';
import { getProviderGuestTracking } from '@/lib/provider-tracking.js';
import { text } from '@/lib/redirects';

export async function POST(request:NextRequest) {
  const form=await request.formData();
  const shipmentId=text(form,'shipmentId');
  const grant=await getProviderTrackingGrant(shipmentId);
  if(!grant||!await getProviderGuestTracking(shipmentId,grant.recipientDigest))return NextResponse.json({ok:false},{status:403});
  await setProviderTrackingGrant(shipmentId,grant.recipientDigest);
  return NextResponse.json({ok:true});
}

export async function DELETE() {
  await clearProviderTrackingGrant();
  return NextResponse.json({ok:true});
}
