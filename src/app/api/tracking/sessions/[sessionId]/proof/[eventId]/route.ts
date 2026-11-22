import {trackingSessionHttp} from '@/lib/tracking-sessions/http';
export const runtime='nodejs';
export async function GET(request:Request,context:{params:Promise<{sessionId:string;eventId:string}>}){return trackingSessionHttp(request,'PROOF',await context.params);}
