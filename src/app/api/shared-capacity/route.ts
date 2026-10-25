import {NextResponse} from 'next/server.js';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 return NextResponse.json({error:'Sign in to view Shared capacity.'},{status:410,headers:{'Cache-Control':'no-store'}});
}
