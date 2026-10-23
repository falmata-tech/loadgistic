import { NextRequest, NextResponse } from 'next/server.js';
import {setTrackingEmailSession} from '@/lib/auth';
import {verifyTrackingEmailSession,listTrackingEmailShipments} from '@/lib/provider-tracking.js';
import {checkOriginBeforeScopedLimit} from '@/lib/guest-rate-limit.js';
import {requestKey} from '@/lib/rate-limit';
import {text} from '@/lib/redirects';

export const runtime='nodejs';

export async function POST(request:NextRequest) {
  const rate=await checkOriginBeforeScopedLimit({
    originKey:requestKey(request,'tracking-unlock'),originLimit:12,windowMs:10*60_000,scopedLimit:5,
    readScope:async()=>{
      const form=await request.formData();
      const email=text(form,'email').trim().toLowerCase();
      return {key:`tracking-unlock-email:${email}`,value:{form,email}};
    }
  });
  if(!rate.allowed)return NextResponse.json(
    {ok:false,error:`Too many attempts. Try again in ${rate.retryAfterSeconds} seconds.`},
    {status:429,headers:{'Cache-Control':'no-store'}}
  );
  try {
    const {form,email}=rate.scope||{form:new FormData(),email:''};
    const shipment=await verifyTrackingEmailSession(email,text(form,'challengeId'),text(form,'code'));
    await setTrackingEmailSession(shipment.recipientDigest);
    const shared=await listTrackingEmailShipments(shipment.recipientDigest);
    return NextResponse.json({ok:true,path:shared.total===1?`/track/${shared.items[0].id}`:'/track'},{headers:{'Cache-Control':'no-store'}});
  } catch {
    return NextResponse.json(
      {ok:false,error:'That email and one-time code could not be verified.'},
      {status:401,headers:{'Cache-Control':'no-store'}}
    );
  }
}
