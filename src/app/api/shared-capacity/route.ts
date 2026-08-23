import {NextRequest,NextResponse} from 'next/server.js';
import {getSharedCapacitySession} from '@/lib/auth';
import {listSharedCapacity} from '@/lib/repository.js';

export const runtime='nodejs';
export const dynamic='force-dynamic';

function filters(params:URLSearchParams){return {
  q:params.get('q')||'',provider:params.get('provider')||'',status:params.get('status')||'',geometry:params.get('geometry')||'',
  vehicleCategory:params.get('vehicleCategory')||'',loadType:params.get('loadType')||'',stopOption:params.get('stopOption')||'',freshness:params.get('freshness')||'',
  currentAreaPlaceRef:params.get('currentAreaPlaceRef')||'',currentArea:params.get('currentArea')||'',currentAreaRadiusKm:params.get('currentAreaRadiusKm')||'',
  originPlaceRef:params.get('originPlaceRef')||'',origin:params.get('origin')||'',originRadiusKm:params.get('originRadiusKm')||'',
  destinationPlaceRef:params.get('destinationPlaceRef')||'',destination:params.get('destination')||'',destinationRadiusKm:params.get('destinationRadiusKm')||'',directionMode:params.get('directionMode')||'',
  nearLat:params.get('nearLat')||'',nearLng:params.get('nearLng')||'',nearRadiusKm:params.get('nearRadiusKm')||''
};}

export async function GET(request:NextRequest){
  const session=await getSharedCapacitySession();
  if(!session)return NextResponse.json({error:'Access required.'},{status:401,headers:{'Cache-Control':'no-store'}});
  const params=new URL(request.url).searchParams;
  return NextResponse.json(listSharedCapacity(session.emailDigest,filters(params)),{headers:{'Cache-Control':'private, no-store'}});
}
