import {trackingSessionHttp} from '@/lib/tracking-sessions/http';
export const runtime='nodejs';
type Context={params:Promise<{sessionId:string}>};
export async function POST(request:Request,context:Context){return trackingSessionHttp(request,'ISSUE',await context.params);}
export async function DELETE(request:Request,context:Context){return trackingSessionHttp(request,'REVOKE',await context.params);}
