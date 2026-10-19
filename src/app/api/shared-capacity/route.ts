import {NextRequest,NextResponse} from 'next/server.js';
import {getSharedCapacitySession} from '@/lib/auth';
import {listSharedCapacity} from '@/lib/private-capacity.js';
import {capacityFilterParams} from '@/lib/capacity-filter-values.js';

export const runtime='nodejs';
export const dynamic='force-dynamic';

function filters(params:URLSearchParams){return {
  cursor:params.get('cursor')||'',
  truck:params.get('truck')||'',ownerDocs:params.get('ownerDocs')||'',driverDocs:params.get('driverDocs')||'',truckDocs:params.get('truckDocs')||'',viewport:params.get('viewport')||'',q:params.get('q')||'',provider:params.get('provider')||'',geometry:params.get('geometry')||'',
  truckCityPlaceRef:params.get('truckCityPlaceRef')||'',truckCity:params.get('truckCity')||'',truckLocationRadiusKm:params.get('truckLocationRadiusKm')||'',currentAreaPlaceRef:params.get('currentAreaPlaceRef')||'',currentArea:params.get('currentArea')||'',currentAreaRadiusKm:params.get('currentAreaRadiusKm')||'',
  originPlaceRef:params.get('originPlaceRef')||'',origin:params.get('origin')||'',originRadiusKm:params.get('originRadiusKm')||'',
  destinationPlaceRef:params.get('destinationPlaceRef')||'',destination:params.get('destination')||'',destinationRadiusKm:params.get('destinationRadiusKm')||'',directionMode:params.get('directionMode')||'',
  nearLat:params.get('nearLat')||'',nearLng:params.get('nearLng')||'',nearRadiusKm:params.get('nearRadiusKm')||'',...capacityFilterParams(params)
};}

export async function GET(request:NextRequest){
  const session=await getSharedCapacitySession();
  if(!session)return NextResponse.json({error:'Access required.'},{status:401,headers:{'Cache-Control':'no-store'}});
  const params=new URL(request.url).searchParams;
  let values;try{values=filters(params);}catch{return NextResponse.json({error:'Check your search and vehicle filters.'},{status:400,headers:{'Cache-Control':'private, no-store'}});}
  return NextResponse.json(await listSharedCapacity(session.emailDigest,values),{headers:{'Cache-Control':'private, no-store'}});
}
