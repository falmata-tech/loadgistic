import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { createSupportAgent } from '@/lib/support.js';
import { errorMessage } from '@/lib/errors';
import { checked, redirectWith, text } from '@/lib/redirects';

export async function POST(request:NextRequest) {
  const user=await getCurrentUser({allowLimited:true});
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const form=await request.formData();
  try {
    await createSupportAgent(user,{
      name:text(form,'name'),
      email:text(form,'email'),
      maxOpenConversations:text(form,'maxOpenConversations'),
      canManageCustomers:checked(form,'canManageCustomers'),
      canManageOperations:checked(form,'canManageOperations'),
      canManageTrust:checked(form,'canManageTrust'),
      canManageBilling:checked(form,'canManageBilling'),
      canManageSupport:checked(form,'canManageSupport')
    });
    return redirectWith(request,'/admin/support','success','Team member created. They can sign in with their email code or Google account.');
  } catch(error) {
    return redirectWith(request,'/admin/support','error',errorMessage(error));
  }
}
