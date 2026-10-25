import {NextResponse} from 'next/server.js';
export const runtime='nodejs';
export async function POST(){
 return NextResponse.json({ok:false,error:'Sign in to view Shared capacity.'},{status:410,headers:{'Cache-Control':'no-store'}});
}
