import {NextResponse} from 'next/server.js';
import {clearSharedCapacitySession} from '@/lib/auth';

export const runtime='nodejs';

export async function POST(){
  return NextResponse.json({ok:false,error:'Sign in to view Shared capacity.'},{status:410,headers:{'Cache-Control':'no-store'}});
}

export async function DELETE(){
  await clearSharedCapacitySession();
  return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
