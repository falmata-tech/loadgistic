import { NextRequest,NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { updateFleetDriverAccess } from '@/lib/fleet.js';
import { checked,redirectWith } from '@/lib/redirects';
import { errorMessage } from '@/lib/errors';
import {fleetReturnPath} from '@/lib/fleet-navigation.js';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;
  const form=await request.formData();
  const returnTo=fleetReturnPath(String(form.get('returnTo')||''),'/app/fleet#driver-access');
  try {
    await updateFleetDriverAccess(user,id,{
      vehicleId:String(form.get('vehicleId')||''),
      canManageCapacity:checked(form,'canManageCapacity'),
      canManageTracking:checked(form,'canManageTracking')
    });
    return redirectWith(request,returnTo,'success','Driver and truck updated.');
  } catch(error) {
    return redirectWith(request,returnTo,'error',errorMessage(error));
  }
}
