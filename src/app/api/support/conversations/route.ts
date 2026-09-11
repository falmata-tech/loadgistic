import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { createSupportConversation } from '@/lib/support.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text } from '@/lib/redirects';

export async function POST(request:NextRequest) {
  const user=await getCurrentUser({allowLimited:true});
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const form=await request.formData();
  try {
    const id=await createSupportConversation(user,{category:text(form,'category'),body:text(form,'body')});
    return redirectWith(request,`/app/support?conversation=${id}`,'success','Support request sent.');
  } catch(error) {
    return redirectWith(request,'/app/support','error',errorMessage(error));
  }
}
