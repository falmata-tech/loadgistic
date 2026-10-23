import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { updateSupportAvailability } from '@/lib/support.js';
import { errorMessage } from '@/lib/errors';
import {checked,redirectWith,text} from '@/lib/redirects';
import {teamQueueReturnPath} from '@/lib/team-navigation.js';

export async function POST(request:NextRequest) {
  const user=await getCurrentUser({allowLimited:true});
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const form=await request.formData();
  const returnTo=teamQueueReturnPath(text(form,'returnTo'),'support',user.role);
  try {
    await updateSupportAvailability(user,checked(form,'available'));
    return redirectWith(request,returnTo,'success','Availability updated.');
  } catch(error) {
    return redirectWith(request,returnTo,'error',errorMessage(error));
  }
}
