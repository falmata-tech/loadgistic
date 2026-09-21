import {reviewQueueReturnPath} from '@/lib/review-navigation.js';
import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { reviewPaymentProof } from '@/lib/billing.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith,text } from '@/lib/redirects';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;
  const form=await request.formData();
  const returnTo=reviewQueueReturnPath(text(form,'returnTo'),'payments');
  try{
    await reviewPaymentProof(user,id,text(form,'status'));
    return redirectWith(request,returnTo,'success','Payment proof reviewed.');
  }catch(error){
    return redirectWith(request,returnTo,'error',errorMessage(error));
  }
}
