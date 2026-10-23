import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { claimSupportConversation } from '@/lib/support.js';
import { errorMessage } from '@/lib/errors';
import {redirectWith,text} from '@/lib/redirects';
import {teamQueuePath,teamQueueReturnPath,teamConversationHref} from '@/lib/team-navigation.js';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser({allowLimited:true});
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;
  const form=/^(multipart\/form-data|application\/x-www-form-urlencoded)(?:;|$)/i.test(request.headers.get('content-type')||'')?await request.formData():new FormData();
  const returnTo=teamQueueReturnPath(text(form,'returnTo')||teamQueuePath('support',user.role,{view:'WAITING'}),'support',user.role);
  try {
    await claimSupportConversation(user,id);
    return redirectWith(request,teamConversationHref('support',id,returnTo),'success','Conversation assigned to you.');
  } catch(error) {
    return redirectWith(request,returnTo,'error',errorMessage(error));
  }
}
