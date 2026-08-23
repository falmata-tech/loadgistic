import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { sendSupportMessage } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text } from '@/lib/redirects';
import { checkRateLimit, requestKey } from '@/lib/rate-limit';

function returnPath(user:any,id:string) {
  return user.role==='SUPPORT'||user.role==='ADMIN'?`/support/${id}`:`/app/support?conversation=${id}`;
}

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser({allowLimited:true});
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;
  const rate=checkRateLimit(`${requestKey(request,'support-message')}:${user.id}`,20,60_000);
  if(!rate.allowed)return redirectWith(request,returnPath(user,id),'error','Too many messages. Wait a minute and try again.');
  const form=await request.formData();
  try {
    await sendSupportMessage(user,id,text(form,'body'));
    return redirectWith(request,returnPath(user,id),'success','Message sent.');
  } catch(error) {
    return redirectWith(request,returnPath(user,id),'error',errorMessage(error));
  }
}
