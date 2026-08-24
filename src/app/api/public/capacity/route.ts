import { NextRequest, NextResponse } from 'next/server.js';
import { listPublicCapacityCursor } from '@/lib/capacity-market.js';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:NextRequest){
  const params=new URL(request.url).searchParams;
  const filters={
    q:params.get('q')||'',provider:params.get('provider')||'',status:params.get('status')||'',geometry:params.get('geometry')||'',
    vehicleCategory:params.get('vehicleCategory')||'',loadType:params.get('loadType')||'',
    stopOption:params.get('stopOption')||'',freshness:params.get('freshness')||'',
    currentAreaPlaceRef:params.get('currentAreaPlaceRef')||'',currentArea:params.get('currentArea')||'',currentAreaRadiusKm:params.get('currentAreaRadiusKm')||'',
    originPlaceRef:params.get('originPlaceRef')||'',origin:params.get('origin')||'',originRadiusKm:params.get('originRadiusKm')||'',
    destinationPlaceRef:params.get('destinationPlaceRef')||'',destination:params.get('destination')||'',destinationRadiusKm:params.get('destinationRadiusKm')||'',directionMode:params.get('directionMode')||'',
    nearLat:params.get('nearLat')||'',nearLng:params.get('nearLng')||'',nearRadiusKm:params.get('nearRadiusKm')||''
  };
  const result=await listPublicCapacityCursor(filters,{cursor:params.get('cursor')||'',pageSize:14});
  return NextResponse.json(result,{headers:{'Cache-Control':'public, max-age=15, stale-while-revalidate=45'}});
}
