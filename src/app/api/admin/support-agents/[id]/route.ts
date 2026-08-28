import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { updateSupportAgent } from '@/lib/support.js';
import { errorMessage } from '@/lib/errors';
import { checked, redirectWith, text } from '@/lib/redirects';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser({allowLimited:true});
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;
  const form=await request.formData();
  try {
    await updateSupportAgent(user,id,{
      active:checked(form,'active'),
      available:checked(form,'available'),
      maxOpenConversations:text(form,'maxOpenConversations'),
      canManageCustomers:checked(form,'canManageCustomers'),
      canManageOperations:checked(form,'canManageOperations'),
      canManageTrust:checked(form,'canManageTrust'),
      canManageBilling:checked(form,'canManageBilling'),
      canManageSupport:checked(form,'canManageSupport')
    });
    return redirectWith(request,'/admin/support','success','Support agent updated.');
  } catch(error) {
    return redirectWith(request,'/admin/support','error',errorMessage(error));
  }
}
