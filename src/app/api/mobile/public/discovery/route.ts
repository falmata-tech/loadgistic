import { nativeDiscovery } from '@/lib/mobile/discovery-server';
export const runtime='nodejs';
export async function GET(request:Request) { return nativeDiscovery(request,false); }
