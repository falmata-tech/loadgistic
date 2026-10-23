import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { closeSupportConversation } from '@/lib/support.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith } from '@/lib/redirects';
import {supportConversationReturnPath,teamConversationHref} from '@/lib/team-navigation.js';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser({allowLimited:true});
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;
  const returnTo=supportConversationReturnPath(request.nextUrl.searchParams.get('returnTo'),user.role);
  try {
    await closeSupportConversation(user,id);
    const path=user.role==='ADMIN'||user.role==='SUPPORT'?returnTo:'/app/support';
    return redirectWith(request,path,'success',user.role==='SUPPORT'||user.role==='ADMIN'?'Conversation closed.':'Chat ended. You can start a new one.');
  } catch(error) {
    let path='/app/support';
    if(user.role==='SUPPORT'||user.role==='ADMIN'){
      try{path=teamConversationHref('support',id,returnTo);}catch{path=returnTo;}
    }
    return redirectWith(request,path,'error',errorMessage(error));
  }
}
