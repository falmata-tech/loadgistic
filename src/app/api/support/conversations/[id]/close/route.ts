import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { closeSupportConversation } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith } from '@/lib/redirects';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser({allowLimited:true});
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;
  try {
    await closeSupportConversation(user,id);
    const path=user.role==='ADMIN'?'/admin/support':user.role==='SUPPORT'?'/support':'/app/support';
    return redirectWith(request,path,'success',user.role==='SUPPORT'||user.role==='ADMIN'?'Conversation closed.':'Chat ended. You can start a new one.');
  } catch(error) {
    const path=user.role==='SUPPORT'||user.role==='ADMIN'?`/support/${id}`:'/app/support';
    return redirectWith(request,path,'error',errorMessage(error));
  }
}
