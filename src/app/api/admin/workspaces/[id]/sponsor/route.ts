import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { grantSponsoredBusinessAccess } from '@/lib/platform-admin.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith } from '@/lib/redirects';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;
  try{
    await grantSponsoredBusinessAccess(user,id);
    return redirectWith(request,'/admin/operations?view=WORKSPACES','success','Sponsored Business access granted.');
  }catch(error){
    return redirectWith(request,'/admin/operations?view=WORKSPACES','error',errorMessage(error));
  }
}
