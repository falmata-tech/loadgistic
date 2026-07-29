import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { setAdminRecordActive } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { checked, redirectWith } from '@/lib/redirects';

export async function POST(request:NextRequest,{params}:{params:Promise<{type:string;id:string}>}) {
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {type,id}=await params;
  const form=await request.formData();
  try{
    setAdminRecordActive(user,type.toUpperCase(),id,checked(form,'active'));
    return redirectWith(request,'/admin/operations','success','Platform record updated.');
  }catch(error){
    return redirectWith(request,'/admin/operations','error',errorMessage(error));
  }
}
