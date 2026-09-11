import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { updateProviderShipmentLocation } from '@/lib/provider-tracking.js';
import { errorMessage } from '@/lib/errors';

export const runtime='nodejs';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Log in to update Tracking.'},{status:401});
  try{
    const {id}=await params;
    const contentType=request.headers.get('content-type')||'';
    const input=contentType.includes('application/json')?await request.json():Object.fromEntries(await request.formData());
    const result=await updateProviderShipmentLocation(user,id,{locationArea:String(input.locationArea||''),approximateLat:String(input.approximateLat||''),approximateLng:String(input.approximateLng||''),locationPrecisionKm:String(input.locationPrecisionKm||''),locationSource:String(input.locationSource||'')});
    return NextResponse.json(result,{headers:{'cache-control':'no-store'}});
  }catch(error){return NextResponse.json({error:errorMessage(error)},{status:400,headers:{'cache-control':'no-store'}});}
}
