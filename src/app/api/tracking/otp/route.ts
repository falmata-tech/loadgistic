import {after,NextRequest,NextResponse} from 'next/server.js';
import {deliverTargetedAccessEmail,providerTrackingOtpRequestResponse} from '@/lib/email-delivery';
import {checkOriginBeforeScopedLimit} from '@/lib/guest-rate-limit.js';
import {requestTrackingEmailSession} from '@/lib/provider-tracking.js';
import {requestKey} from '@/lib/rate-limit';
import {errorMessage} from '@/lib/errors';
import {text} from '@/lib/redirects';

export const runtime='nodejs';

export async function POST(request:NextRequest){
  const rate=await checkOriginBeforeScopedLimit({
    originKey:requestKey(request,'tracking-otp'),originLimit:10,windowMs:10*60_000,scopedLimit:3,
    readScope:async()=>{
      const form=await request.formData();
      const email=text(form,'email').trim().toLowerCase();
      return {key:`tracking-otp-recipient:${email}`,value:{email}};
    }
  });
  if(!rate.allowed){
    return NextResponse.json(
      {ok:false,error:'Wait a few minutes before requesting another code.'},
      {status:429,headers:{'Cache-Control':'no-store'}}
    );
  }
  try{
    const {email}=rate.scope||{email:''};
    const challenge=await requestTrackingEmailSession(email);
    if(challenge.deliveryQueued){
      after(async()=>{
        try{await deliverTargetedAccessEmail('TRACKING_OTP',challenge.challengeId);}
        catch{/* The committed outbox row remains available to the retry worker. */}
      });
    }
    return NextResponse.json(providerTrackingOtpRequestResponse(challenge),{
      headers:{'Cache-Control':'no-store'}
    });
  }catch(error){
    return NextResponse.json({ok:false,error:errorMessage(error)},
      {status:400,headers:{'Cache-Control':'no-store'}});
  }
}
