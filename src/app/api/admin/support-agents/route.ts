import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { createSupportAgent } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text } from '@/lib/redirects';

export async function POST(request:NextRequest) {
  const user=await getCurrentUser({allowLimited:true});
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const form=await request.formData();
  try {
    createSupportAgent(user,{
      name:text(form,'name'),
      email:text(form,'email'),
      password:text(form,'password'),
      maxOpenConversations:text(form,'maxOpenConversations')
    });
    return redirectWith(request,'/admin/support','success','Support agent created.');
  } catch(error) {
    return redirectWith(request,'/admin/support','error',errorMessage(error));
  }
}
