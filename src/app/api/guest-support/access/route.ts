import {NextRequest} from 'next/server.js';
import {setGuestSupportSession} from '@/lib/auth';
import {verifyGuestSupportAccess} from '@/lib/repository.js';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
import {redirectWith,text} from '@/lib/redirects';

export async function POST(request:NextRequest){
  const rate=await checkRateLimit(requestKey(request,'guest-support-access'),8,60_000);
  if(!rate.allowed)return redirectWith(request,'/help','error',`Too many attempts. Try again in ${rate.retryAfterSeconds} seconds.`);
  const form=await request.formData();
  try{const result=await verifyGuestSupportAccess(text(form,'email'),text(form,'code'));await setGuestSupportSession(result.conversationId,result.emailDigest);return redirectWith(request,`/help/${result.conversationId}`,'success','Conversation opened.');}
  catch{return redirectWith(request,'/help','error','That email and recovery code could not be verified.');}
}
