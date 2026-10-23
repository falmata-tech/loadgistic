import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { createSupportAgent } from '@/lib/support.js';
import {retiredBrokerageResponse} from '@/lib/retired-brokerage';
import { errorMessage } from '@/lib/errors';
import { checked, redirectWith, text } from '@/lib/redirects';

export async function POST(request:NextRequest) {
  const user=await getCurrentUser({allowLimited:true});
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  if(user.role!=='ADMIN')return NextResponse.json({error:'Access denied.'},{status:403});
  const form=await request.formData();
  try {
    if(checked(form,'canManageBrokerage'))return retiredBrokerageResponse();
    await createSupportAgent(user,{
      name:text(form,'name'),
      email:text(form,'email'),
      maxOpenConversations:text(form,'maxOpenConversations'),
      canManageCustomers:checked(form,'canManageCustomers'),
      canManageOperations:checked(form,'canManageOperations'),
      canManageTrust:checked(form,'canManageTrust'),
      canManageBilling:checked(form,'canManageBilling'),
      canManageSupport:checked(form,'canManageSupport'),
      canManageBrokerage:false,
      canManageFeatured:checked(form,'canManageFeatured')
    });
    return redirectWith(request,'/admin/support?tab=team','success','Team member created. They can sign in with their email code.');
  } catch(error) {
    return redirectWith(request,'/admin/support?tab=team','error',errorMessage(error));
  }
}
