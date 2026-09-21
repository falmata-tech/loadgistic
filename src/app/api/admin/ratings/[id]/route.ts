import {reviewQueueReturnPath} from '@/lib/review-navigation.js';
import { NextRequest,NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { resolveProviderReview } from '@/lib/provider-tracking.js';
import { redirectWith,text } from '@/lib/redirects';
import { errorMessage } from '@/lib/errors';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;
  const form=await request.formData();
  const returnTo=reviewQueueReturnPath(text(form,'returnTo'),'ratings');
  try {
    await resolveProviderReview(user,id,text(form,'status'),text(form,'reviewNote'));
    return redirectWith(request,returnTo,'success','Rating review completed.');
  } catch(error) {
    return redirectWith(request,returnTo,'error',errorMessage(error));
  }
}
