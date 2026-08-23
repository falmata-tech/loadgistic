import {NextRequest,NextResponse} from 'next/server.js';
import {deliverPendingAccessEmails,localAccessCodeForDevelopment} from '@/lib/email-delivery';
import {requestSharedCapacityOtp} from '@/lib/repository.js';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
import {errorMessage} from '@/lib/errors';
import {text} from '@/lib/redirects';

export const runtime='nodejs';

export async function POST(request:NextRequest){
  const form=await request.formData();
  const email=text(form,'email');
  const originRate=checkRateLimit(requestKey(request,'shared-capacity-otp'),8,10*60_000);
  const emailRate=checkRateLimit(`shared-capacity-otp-email:${email.trim().toLowerCase()}`,3,10*60_000);
  if(!originRate.allowed||!emailRate.allowed){
    return NextResponse.json({ok:false,error:'Wait a few minutes before requesting another code.'},{status:429,headers:{'Cache-Control':'no-store'}});
  }
  try{
    const challenge=await requestSharedCapacityOtp(email);
    const delivery=await deliverPendingAccessEmails();
    const localTestCode=localAccessCodeForDevelopment(challenge,delivery);
    return NextResponse.json(localTestCode
      ?{ok:true,message:'Email delivery is not configured in this local environment. Use the local test code below.',localTestCode}
      :{ok:true,message:'If this email has active capacity shares, a one-time code has been sent.'},
    {headers:{'Cache-Control':'no-store'}});
  }catch(error){
    return NextResponse.json({ok:false,error:errorMessage(error)},{status:400,headers:{'Cache-Control':'no-store'}});
  }
}
