import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
export const runtime='nodejs';
export async function POST(request:NextRequest){
 const user=await getCurrentUser({allowLimited:true});
 if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
 return NextResponse.json({error:'Platform payment plans are not offered.'},{status:410});
}
