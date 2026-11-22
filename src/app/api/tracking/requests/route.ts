import {trackingSessionHttp} from '@/lib/tracking-sessions/http';
export const runtime='nodejs';
export const POST=(request:Request)=>trackingSessionHttp(request,'REQUEST');
