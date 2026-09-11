import {after,NextRequest,NextResponse} from 'next/server.js';
import {deliverTargetedAccessEmail,sharedCapacityOtpRequestResponse} from '@/lib/email-delivery';
import {checkOriginBeforeScopedLimit} from '@/lib/guest-rate-limit.js';
import {requestSharedCapacityOtp} from '@/lib/private-capacity.js';
import {requestKey} from '@/lib/rate-limit';
import {errorMessage} from '@/lib/errors';
import {text} from '@/lib/redirects';

export const runtime='nodejs';

export async function POST(request:NextRequest){
  const rate=await checkOriginBeforeScopedLimit({
    originKey:requestKey(request,'shared-capacity-otp'),originLimit:12,windowMs:10*60_000,scopedLimit:5,
    readScope:async()=>{
      const form=await request.formData();
      const email=text(form,'email');
      return {key:`shared-capacity-otp-email:${email.trim().toLowerCase()}`,value:{email}};
    }
  });
  if(!rate.allowed){
    const minutes=Math.max(1,Math.ceil(rate.retryAfterSeconds/60));
    return NextResponse.json(
      {ok:false,error:`Too many code requests. Try again in about ${minutes} minute${minutes===1?'':'s'}.`},
      {status:429,headers:{'Cache-Control':'no-store','Retry-After':String(rate.retryAfterSeconds)}}
    );
  }
  try{
    const email=rate.scope?.email||'';
    const challenge=await requestSharedCapacityOtp(email);
    if(challenge.deliveryQueued){
      after(async()=>{
        try{
          await deliverTargetedAccessEmail('SHARED_CAPACITY',challenge.challengeId);
        }catch{
          // The committed outbox row remains available to the bounded retry worker.
        }
      });
    }
    return NextResponse.json(sharedCapacityOtpRequestResponse(challenge),{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    return NextResponse.json({ok:false,error:errorMessage(error)},{status:400,headers:{'Cache-Control':'no-store'}});
  }
}
