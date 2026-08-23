import { NextRequest,NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { assignShipmentVehicle } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith,text } from '@/lib/redirects';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;
  const form=await request.formData();
  try{
    await assignShipmentVehicle(user,id,text(form,'vehicleId'));
    return redirectWith(request,`/app/shipments/${id}`,'success','Truck and driver assigned.');
  }catch(error){
    return redirectWith(request,`/app/shipments/${id}`,'error',errorMessage(error));
  }
}
