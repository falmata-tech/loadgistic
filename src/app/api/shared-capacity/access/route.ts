import {NextRequest,NextResponse} from 'next/server.js';
import {setSharedCapacitySession} from '@/lib/auth';
import {verifySharedCapacityAccess} from '@/lib/repository.js';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
import {redirectWith,text} from '@/lib/redirects';

export const runtime='nodejs';

export async function POST(request:NextRequest){
  const rate=checkRateLimit(requestKey(request,'shared-capacity-access'),8,60_000);
  const json=request.headers.get('accept')?.includes('application/json');
  if(!rate.allowed)return json?NextResponse.json({ok:false,error:`Too many attempts. Try again in ${rate.retryAfterSeconds} seconds.`},{status:429}):redirectWith(request,'/shared-capacity','error',`Too many attempts. Try again in ${rate.retryAfterSeconds} seconds.`);
  const form=await request.formData();
  try{
    const access=verifySharedCapacityAccess(text(form,'email'),text(form,'code'));
    await setSharedCapacitySession(access.emailDigest);
    return json?NextResponse.json({ok:true}):redirectWith(request,'/shared-capacity','success','Shared capacity unlocked on this browser.');
  }catch{
    return json?NextResponse.json({ok:false,error:'That email and one-time code could not be verified.'},{status:401}):redirectWith(request,'/shared-capacity','error','That email and one-time code could not be verified.');
  }
}
