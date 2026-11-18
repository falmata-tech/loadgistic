import {trackingSessionHttp} from '@/lib/tracking-sessions/http';
export const runtime='nodejs';
export async function GET(request:Request,context:{params:Promise<{sessionId:string}>}){return trackingSessionHttp(request,'DETAIL',await context.params);}
