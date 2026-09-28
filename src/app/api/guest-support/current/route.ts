import {NextResponse} from 'next/server.js';
import {PUBLIC_SUPPORT_CLOSED_MESSAGE} from '@/lib/support-policy.js';
export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json({ok:false,error:PUBLIC_SUPPORT_CLOSED_MESSAGE},{status:410,headers:{'Cache-Control':'no-store'}});}
