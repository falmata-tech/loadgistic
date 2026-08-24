import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { setProviderAssignedVehicleDuty } from '@/lib/provider-capacity.js';
import { errorMessage } from '@/lib/errors';
import { checked, redirectWith, text } from '@/lib/redirects';

export async function POST(request:NextRequest) {
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const form=await request.formData();
  try {
    const onDuty=checked(form,'onDuty');
    await setProviderAssignedVehicleDuty(user,text(form,'vehicleId'),onDuty,{
      locationArea:text(form,'locationArea'),
      approximateLat:text(form,'approximateLat'),
      approximateLng:text(form,'approximateLng'),
      locationPrecisionKm:text(form,'locationPrecisionKm'),
      locationSource:text(form,'locationSource')
    });
    return redirectWith(request,'/app/home','success',onDuty?'Truck is On Duty.':'Truck is Off Duty.');
  } catch(error) {
    return redirectWith(request,'/app/home','error',errorMessage(error));
  }
}
