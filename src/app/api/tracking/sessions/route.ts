import {trackingSessionHttp} from '@/lib/tracking-sessions/http';
export const runtime='nodejs';
export const GET=(request:Request)=>trackingSessionHttp(request,'LIST');
export const POST=(request:Request)=>trackingSessionHttp(request,'CREATE');
