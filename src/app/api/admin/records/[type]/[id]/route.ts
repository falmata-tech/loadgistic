import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { moderateAdminRecord, setAdminRecordActive, updateFleetDriverPermissions } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { checked, redirectWith, text } from '@/lib/redirects';

export async function POST(request:NextRequest,{params}:{params:Promise<{type:string;id:string}>}) {
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {type,id}=await params;
  const form=await request.formData();
  try{
    const command=text(form,'command');
    if(type.toUpperCase()==='DRIVER_PERMISSIONS')await updateFleetDriverPermissions(user,id,{
      canManageCapacity:checked(form,'canManageCapacity'),
      canManageTracking:checked(form,'canManageTracking')
    });
    else if(command)await moderateAdminRecord(user,type.toUpperCase(),id,command);
    else await setAdminRecordActive(user,type.toUpperCase(),id,checked(form,'active'));
    const returnTo=text(form,'returnTo');
    const target=returnTo.startsWith('/admin/operations')?returnTo:'/admin/operations';
    return redirectWith(request,target,'success','Platform record updated.');
  }catch(error){
    return redirectWith(request,'/admin/operations','error',errorMessage(error));
  }
}
