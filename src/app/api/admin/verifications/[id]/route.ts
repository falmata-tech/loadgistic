import { NextRequest,NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { reviewVerification } from '@/lib/repository.js';
import { redirectWith,text } from '@/lib/redirects';
import { errorMessage } from '@/lib/errors';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;
  const form=await request.formData();
  try {
    await reviewVerification(user,id,text(form,'status'),text(form,'note'));
    return redirectWith(request,'/admin/reviews?tab=documents','success','Verification reviewed.');
  } catch(error) {
    return redirectWith(request,'/admin/reviews?tab=documents','error',errorMessage(error));
  }
}
