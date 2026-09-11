import {NextResponse} from 'next/server.js';
import {clearSharedCapacitySession,getSharedCapacitySession,setSharedCapacitySession} from '@/lib/auth';

export const runtime='nodejs';

export async function POST(){
  const session=await getSharedCapacitySession();
  if(!session)return NextResponse.json({ok:false,error:'Email verification is required.'},{status:401,headers:{'Cache-Control':'no-store'}});
  const renewed=await setSharedCapacitySession(session.emailDigest);
  return NextResponse.json({ok:true,expiresAt:renewed.expiresAt},{headers:{'Cache-Control':'private, no-store'}});
}

export async function DELETE(){
  await clearSharedCapacitySession();
  return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
