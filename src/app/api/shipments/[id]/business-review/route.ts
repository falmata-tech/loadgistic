import { NextRequest,NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { submitBusinessReview } from '@/lib/repository.js';
import { redirectWith,text } from '@/lib/redirects';
import { errorMessage } from '@/lib/errors';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;
  const form=await request.formData();
  try {
    const review=await submitBusinessReview(user,id,text(form,'rating'),text(form,'note'));
    const message=review.status==='PENDING'
      ? 'Low rating sent privately to Loadgistic for review.'
      : 'Business review published.';
    return redirectWith(request,`/app/shipments/${id}`,'success',message);
  } catch(error) {
    return redirectWith(request,`/app/shipments/${id}`,'error',errorMessage(error));
  }
}
