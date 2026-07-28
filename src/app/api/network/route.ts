import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { changeNetworkRelationship } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text } from '@/lib/redirects';

function safeReturnPath(value:string) {
  return value.startsWith('/app/') || value.startsWith('/companies/') ? value : '/app/network';
}

export async function POST(request:NextRequest) {
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const form=await request.formData();
  const returnTo=safeReturnPath(text(form,'returnTo'));
  try {
    changeNetworkRelationship(user,{
      targetKind:text(form,'targetKind'),
      targetId:text(form,'targetId'),
      action:text(form,'action')
    });
    return redirectWith(request,returnTo,'success','Network updated.');
  } catch(error) {
    return redirectWith(request,returnTo,'error',errorMessage(error));
  }
}
