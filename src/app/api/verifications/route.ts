import { NextRequest,NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { submitVerification } from '@/lib/verification.js';
import { redirectWith,text } from '@/lib/redirects';
import { errorMessage } from '@/lib/errors';

export const runtime='nodejs';

export async function POST(request:NextRequest) {
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const form=await request.formData();
  try {
    const file=form.get('file');
    await submitVerification(user,{subjectType:text(form,'subjectType'),subjectId:text(form,'subjectId'),verificationType:text(form,'verificationType'),relatedVehicleId:text(form,'relatedVehicleId'),expiresOn:text(form,'expiresOn'),documentName:text(form,'documentName')},file&&typeof file!=='string'?file:null);
    return redirectWith(request,'/app/verification','success','Verification submitted for review.');
  } catch(error) {
    return redirectWith(request,'/app/verification','error',errorMessage(error));
  }
}
