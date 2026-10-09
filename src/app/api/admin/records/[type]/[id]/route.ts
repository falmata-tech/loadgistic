import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { moderateAdminRecord, setAdminRecordActive, updateFleetDriverPermissions, hasPlatformPermission } from '@/lib/platform-admin.js';
import { errorMessage } from '@/lib/errors';
import { checked, redirectWith, text } from '@/lib/redirects';

export async function POST(request:NextRequest,{params}:{params:Promise<{type:string;id:string}>}) {
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {type,id}=await params;
  if(['SUBSCRIPTION','SUBSCRIPTIONS','PLAN','PLANS','WORKSPACE_SPONSOR'].includes(type.toUpperCase()))return NextResponse.json({error:hasPlatformPermission(user,'BILLING')?'Platform payment plans are not offered.':'Forbidden'},{status:hasPlatformPermission(user,'BILLING')?410:403});
  const form=await request.formData();
  const requestedReturnTo=text(form,'returnTo');
  const returnTo=requestedReturnTo.startsWith('/admin/operations')?requestedReturnTo:'/admin/operations';
  try{
    const command=text(form,'command');
    if(type.toUpperCase()==='DRIVER_PERMISSIONS')await updateFleetDriverPermissions(user,id,{
      canManageCapacity:checked(form,'canManageCapacity'),
      canManageTracking:checked(form,'canManageTracking')
    });
    else if(command)await moderateAdminRecord(user,type.toUpperCase(),id,command);
    else await setAdminRecordActive(user,type.toUpperCase(),id,checked(form,'active'));
    return redirectWith(request,returnTo,'success','Platform record updated.');
  }catch(error){
    return redirectWith(request,returnTo,'error',errorMessage(error));
  }
}
