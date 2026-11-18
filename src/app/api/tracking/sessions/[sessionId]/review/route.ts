import {trackingSessionHttp} from '@/lib/tracking-sessions/http';
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{sessionId:string}>}){return trackingSessionHttp(request,'REVIEW',await context.params);}
