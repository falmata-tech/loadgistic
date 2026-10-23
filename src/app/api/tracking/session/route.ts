import {NextResponse} from 'next/server.js';
import {clearProviderTrackingGrant,getTrackingEmailSession,setTrackingEmailSession} from '@/lib/auth';
import {listTrackingEmailShipments} from '@/lib/provider-tracking.js';

export async function POST(){
 const session=await getTrackingEmailSession();
 if(!session||!(await listTrackingEmailShipments(session.recipientDigest)).total)
  return NextResponse.json({ok:false},{status:401,headers:{'Cache-Control':'no-store'}});
 const renewed=await setTrackingEmailSession(session.recipientDigest,session.startedAt);
 return NextResponse.json({ok:true,...renewed},{headers:{'Cache-Control':'private, no-store'}});
}
export async function DELETE(){
 await clearProviderTrackingGrant();
 return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
