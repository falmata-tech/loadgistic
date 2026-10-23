import {NextRequest,NextResponse} from 'next/server.js';
import {getSharedCapacitySession} from '@/lib/auth';
import {searchCapacity} from '@/lib/capacity-search';
import {retiredPlatformCapacityResponse} from '@/lib/retired-brokerage';
import {checkRateLimit} from '@/lib/rate-limit';
import {capacityFilterParams} from '@/lib/capacity-filter-values.js';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store'};
export async function GET(request:NextRequest){
 const params=new URL(request.url).searchParams,privateView=params.get('view')==='private';
 const session=privateView?await getSharedCapacitySession():null;
 if(privateView&&!session)return NextResponse.json({error:'Access required.'},{status:401,headers});
 if(params.get('view')==='loadgistic')return retiredPlatformCapacityResponse();
 let selections;try{selections=capacityFilterParams(params);}catch{return NextResponse.json({error:'Check your search and vehicle filters.'},{status:400,headers});}
 const filters:Record<string,string>={...Object.fromEntries(params),...selections};
 if((filters.q||'').length>120)return NextResponse.json({error:'Search is too long.'},{status:400,headers});
 try{
  const rate=await checkRateLimit(`capacity-search:${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown'}`,120,60000);
  if(!rate.allowed)return NextResponse.json({error:'Please wait a moment.'},{status:429,headers});
  return NextResponse.json(await searchCapacity(filters,{audience:privateView?'EMAIL':'PUBLIC',digest:session?.emailDigest}),{headers});
 }catch{return NextResponse.json({error:'Search is temporarily unavailable. Please try again.'},{status:503,headers});}
}
