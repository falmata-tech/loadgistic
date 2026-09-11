import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {listLoadgisticSharedCapacity} from '@/lib/private-capacity.js';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:NextRequest){
  const user=await getCurrentUser({allowLimited:true});
  if(!user)return NextResponse.json({error:'Not authorized.'},{status:401});
  const params=new URL(request.url).searchParams;
  const filters={cursor:params.get('cursor')||'',q:params.get('q')||'',provider:params.get('provider')||'',status:params.get('status')||'',geometry:params.get('geometry')||'',vehicleCategory:params.get('vehicleCategory')||'',loadType:params.get('loadType')||'',stopOption:params.get('stopOption')||'',freshness:params.get('freshness')||'',currentAreaPlaceRef:params.get('currentAreaPlaceRef')||'',currentArea:params.get('currentArea')||'',currentAreaRadiusKm:params.get('currentAreaRadiusKm')||'',originPlaceRef:params.get('originPlaceRef')||'',origin:params.get('origin')||'',originRadiusKm:params.get('originRadiusKm')||'',destinationPlaceRef:params.get('destinationPlaceRef')||'',destination:params.get('destination')||'',destinationRadiusKm:params.get('destinationRadiusKm')||'',directionMode:params.get('directionMode')||'',nearLat:params.get('nearLat')||'',nearLng:params.get('nearLng')||'',nearRadiusKm:params.get('nearRadiusKm')||''};
  try{return NextResponse.json(await listLoadgisticSharedCapacity(user,filters),{headers:{'Cache-Control':'private, no-store'}});}
  catch{return NextResponse.json({error:'Not authorized.'},{status:403});}
}
