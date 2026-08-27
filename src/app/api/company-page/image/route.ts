import { NextRequest,NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { removeProviderProfileImage,updateProviderProfileImage } from '@/lib/provider-profile.js';
import { redirectWith,text } from '@/lib/redirects';
import { errorMessage } from '@/lib/errors';

export async function POST(request:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const form=await request.formData();
  try{
    if(text(form,'command')==='REMOVE'){
      await removeProviderProfileImage(user);
      return redirectWith(request,'/app/company-page','success','Provider image removed.');
    }
    await updateProviderProfileImage(user,form.get('profileImage'));
    return redirectWith(request,'/app/company-page','success','Provider image updated.');
  }catch(error){return redirectWith(request,'/app/company-page','error',errorMessage(error));}
}
