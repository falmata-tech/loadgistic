import {NextRequest,NextResponse} from 'next/server.js';
import {getSharedCapacitySession,getCurrentUser} from '@/lib/auth';
import {searchCapacity} from '@/lib/capacity-search';
import {privateContactDigest} from '@/lib/security.js';
import {checkRateLimit} from '@/lib/rate-limit';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store'};
export async function GET(request:NextRequest){
 const params=new URL(request.url).searchParams,privateView=params.get('view')==='private';
 const session=privateView?await getSharedCapacitySession():null;
 if(privateView&&!session)return NextResponse.json({error:'Access required.'},{status:401,headers});
 const staffView=params.get('view')==='loadgistic',user=staffView?await getCurrentUser({allowLimited:true}):null;
 if(staffView&&(!user||!['ADMIN','SUPPORT'].includes(user.role)))return NextResponse.json({error:'Not authorized.'},{status:403,headers});
 const filters=Object.fromEntries(params);
 if((filters.q||'').length>120)return NextResponse.json({error:'Search is too long.'},{status:400,headers});
 try{
  const rate=await checkRateLimit(`capacity-search:${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown'}`,120,60000);
  if(!rate.allowed)return NextResponse.json({error:'Please wait a moment.'},{status:429,headers});
  return NextResponse.json(await searchCapacity(filters,{audience:staffView?'LOADGISTIC':privateView?'EMAIL':'PUBLIC',digest:staffView?privateContactDigest('loadgistic-platform'):session?.emailDigest,actorId:user?.id}),{headers});
 }catch{return NextResponse.json({error:'Search is temporarily unavailable. Please try again.'},{status:503,headers});}
}
