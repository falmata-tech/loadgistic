import { NextRequest, NextResponse } from 'next/server.js';
import { listPublicCapacityCursor } from '@/lib/repository.js';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:NextRequest){
  const params=new URL(request.url).searchParams;
  const filters={
    q:params.get('q')||'',status:params.get('status')||'',geometry:params.get('geometry')||'',
    originPlaceRef:params.get('originPlaceRef')||'',origin:params.get('origin')||'',originRadiusKm:params.get('originRadiusKm')||'',
    destinationPlaceRef:params.get('destinationPlaceRef')||'',destination:params.get('destination')||'',destinationRadiusKm:params.get('destinationRadiusKm')||'',
    nearLat:params.get('nearLat')||'',nearLng:params.get('nearLng')||'',nearRadiusKm:params.get('nearRadiusKm')||''
  };
  const result=listPublicCapacityCursor(filters,{cursor:params.get('cursor')||'',pageSize:14});
  return NextResponse.json(result,{headers:{'Cache-Control':'public, max-age=15, stale-while-revalidate=45'}});
}
