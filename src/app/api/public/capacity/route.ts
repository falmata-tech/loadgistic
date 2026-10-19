import { NextRequest, NextResponse } from 'next/server.js';
import { listPublicCapacityCursor } from '@/lib/capacity-market.js';
import {capacityFilterParams} from '@/lib/capacity-filter-values.js';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:NextRequest){
  const params=new URL(request.url).searchParams;
  let selections;try{selections=capacityFilterParams(params);}catch{return NextResponse.json({error:'Check your search and vehicle filters.'},{status:400,headers:{'Cache-Control':'private, no-store'}});}
  const filters={
    truck:params.get('truck')||'',ownerDocs:params.get('ownerDocs')||'',driverDocs:params.get('driverDocs')||'',truckDocs:params.get('truckDocs')||'',viewport:params.get('viewport')||'',q:params.get('q')||'',provider:params.get('provider')||'',geometry:params.get('geometry')||'',
    truckCityPlaceRef:params.get('truckCityPlaceRef')||'',truckCity:params.get('truckCity')||'',truckLocationRadiusKm:params.get('truckLocationRadiusKm')||'',currentAreaPlaceRef:params.get('currentAreaPlaceRef')||'',currentArea:params.get('currentArea')||'',currentAreaRadiusKm:params.get('currentAreaRadiusKm')||'',
    originPlaceRef:params.get('originPlaceRef')||'',origin:params.get('origin')||'',originRadiusKm:params.get('originRadiusKm')||'',
    destinationPlaceRef:params.get('destinationPlaceRef')||'',destination:params.get('destination')||'',destinationRadiusKm:params.get('destinationRadiusKm')||'',directionMode:params.get('directionMode')||'',
    nearLat:params.get('nearLat')||'',nearLng:params.get('nearLng')||'',nearRadiusKm:params.get('nearRadiusKm')||'',...selections
  };
  const result=await listPublicCapacityCursor(filters,{cursor:params.get('cursor')||'',pageSize:14});
  return NextResponse.json(result,{headers:{
    'Cache-Control':'private, no-store, max-age=0',
    'CDN-Cache-Control':'no-store',
    'Netlify-CDN-Cache-Control':'no-store'
  }});
}
