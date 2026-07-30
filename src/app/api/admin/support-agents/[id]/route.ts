import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { updateSupportAgent } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { checked, redirectWith, text } from '@/lib/redirects';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser({allowLimited:true});
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;
  const form=await request.formData();
  try {
    updateSupportAgent(user,id,{
      active:checked(form,'active'),
      available:checked(form,'available'),
      maxOpenConversations:text(form,'maxOpenConversations')
    });
    return redirectWith(request,'/admin/support','success','Support agent updated.');
  } catch(error) {
    return redirectWith(request,'/admin/support','error',errorMessage(error));
  }
}
