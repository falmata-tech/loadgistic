import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { updateSupportAvailability } from '@/lib/support.js';
import { errorMessage } from '@/lib/errors';
import { checked, redirectWith } from '@/lib/redirects';

export async function POST(request:NextRequest) {
  const user=await getCurrentUser({allowLimited:true});
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const form=await request.formData();
  try {
    await updateSupportAvailability(user,checked(form,'available'));
    return redirectWith(request,'/support','success','Availability updated.');
  } catch(error) {
    return redirectWith(request,'/support','error',errorMessage(error));
  }
}
