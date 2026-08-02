import { NextRequest,NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { assignFleetDriverVehicle, updateFleetDriverPermissions } from '@/lib/repository.js';
import { checked,redirectWith } from '@/lib/redirects';
import { errorMessage } from '@/lib/errors';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;
  const form=await request.formData();
  try {
    assignFleetDriverVehicle(user,id,String(form.get('vehicleId')||''));
    updateFleetDriverPermissions(user,id,{
      canBrowseLoadBoard:checked(form,'canBrowseLoadBoard'),
      canContactBusinesses:checked(form,'canContactBusinesses'),
      canNegotiateLoads:checked(form,'canNegotiateLoads'),
      canManageCapacity:checked(form,'canManageCapacity')
    });
    return redirectWith(request,'/app/fleet','success','Driver and truck updated.');
  } catch(error) {
    return redirectWith(request,'/app/fleet','error',errorMessage(error));
  }
}
