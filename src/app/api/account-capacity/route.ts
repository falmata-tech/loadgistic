import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {listAccountCapacity} from '@/lib/private-capacity.js';
import {capacityFilterParams} from '@/lib/capacity-filter-values.js';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store'};

export async function GET(request:NextRequest){
 const user=await getCurrentUser({allowLimited:true});
 if(!user||!['TRANSPORTER','DRIVER','CUSTOMER'].includes(user.role))return NextResponse.json({error:'Sign in to view shared capacity.'},{status:401,headers});
 const params=new URL(request.url).searchParams;
 let filters:Record<string,string>;
 try{filters={...Object.fromEntries(params),...capacityFilterParams(params)};}
 catch{return NextResponse.json({error:'Check your search and vehicle filters.'},{status:400,headers});}
 if((filters.q||'').length>120||(filters.cursor||'').length>512)return NextResponse.json({error:'Check your search and vehicle filters.'},{status:400,headers});
 try{return NextResponse.json(await listAccountCapacity(user,filters),{headers});}
 catch{return NextResponse.json({error:'Shared capacity is temporarily unavailable.'},{status:503,headers});}
}
