import {NextResponse} from 'next/server.js';
import {getProviderTrackingGrant} from '@/lib/auth';
import {getProviderGuestTracking} from '@/lib/provider-tracking.js';
import {trackingRefreshState} from '@/lib/tracking-refresh-revision.js';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'};

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
  return NextResponse.json({error:'Tracking access is unavailable.'},{status:404,headers});
 const grant=await getProviderTrackingGrant(id);
 if(!grant)return NextResponse.json({error:'Verify your email again.'},{status:401,headers});
 const shipment=await getProviderGuestTracking(id,grant.recipientDigest);
 if(!shipment)return NextResponse.json({error:'Tracking access changed. Verify your email again.'},{status:401,headers});
 return NextResponse.json(trackingRefreshState(shipment),{headers});
}
