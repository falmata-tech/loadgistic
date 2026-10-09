import {NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {hasPlatformPermission} from '@/lib/platform-admin.js';
export async function POST(){
 const user=await getCurrentUser({allowLimited:true});
 if(!user||!hasPlatformPermission(user,'BILLING'))return NextResponse.json({error:'Forbidden'},{status:403});
 return NextResponse.json({error:'Platform payment plans are not offered.'},{status:410});
}
