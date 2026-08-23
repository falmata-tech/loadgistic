import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { refreshCapacityLocation } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';

export const runtime='nodejs';

export async function POST(request:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Sign in again to refresh this truck location.'},{status:401});
  try{
    const input=await request.json();
    return NextResponse.json(await refreshCapacityLocation(user,{
      vehicleId:String(input.vehicleId||''),
      approximateLat:input.approximateLat,
      approximateLng:input.approximateLng,
      locationPrecisionKm:input.locationPrecisionKm,
      locationSource:'DEVICE_OBSCURED'
    }));
  }catch(error){
    return NextResponse.json({error:errorMessage(error)},{status:400});
  }
}
