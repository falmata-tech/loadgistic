import {NextRequest,NextResponse} from 'next/server.js';
import {setSharedCapacitySession} from '@/lib/auth';
import {checkOriginBeforeScopedLimit} from '@/lib/guest-rate-limit.js';
import {verifySharedCapacityAccess} from '@/lib/private-capacity.js';
import {requestKey} from '@/lib/rate-limit';
import {redirectWith,text} from '@/lib/redirects';

export const runtime='nodejs';

export async function POST(request:NextRequest){
  const json=request.headers.get('accept')?.includes('application/json');
  const rate=await checkOriginBeforeScopedLimit({
    originKey:requestKey(request,'shared-capacity-access'),originLimit:12,windowMs:10*60_000,scopedLimit:5,
    readScope:async()=>{
      const form=await request.formData();
      const email=text(form,'email').trim().toLowerCase();
      return {key:`shared-capacity-access-email:${email}`,value:{form,email}};
    }
  });
  if(!rate.allowed){
    const retryAfterSeconds=rate.retryAfterSeconds;
    return json?NextResponse.json({ok:false,error:`Too many attempts. Try again in ${retryAfterSeconds} seconds.`},{status:429}):redirectWith(request,'/shared-capacity','error',`Too many attempts. Try again in ${retryAfterSeconds} seconds.`);
  }
  try{
    const {form,email}=rate.scope||{form:new FormData(),email:''};
    const access=await verifySharedCapacityAccess(email,text(form,'code'));
    await setSharedCapacitySession(access.emailDigest);
    return json?NextResponse.json({ok:true}):redirectWith(request,'/shared-capacity','success','Private capacity unlocked on this browser.');
  }catch{
    return json?NextResponse.json({ok:false,error:'That email and one-time code could not be verified.'},{status:401}):redirectWith(request,'/shared-capacity','error','That email and one-time code could not be verified.');
  }
}
