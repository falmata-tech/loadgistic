import { NextRequest, NextResponse } from 'next/server.js';
import { mutationOriginAllowed } from '@/lib/origin.js';

export function middleware(request: NextRequest) {
  if (['POST','PUT','PATCH','DELETE'].includes(request.method) && /^\/api\/(shipments|network)(\/|$)/.test(request.nextUrl.pathname)) {
    return NextResponse.json({ok:false,error:{code:'DEMAND_WORKFLOW_RETIRED',message:'Shipment demand posting is no longer available.'}},{status:410});
  }
  if (['POST','PUT','PATCH','DELETE'].includes(request.method)) {
    if (!mutationOriginAllowed(request.headers, request.url)) {
      return NextResponse.json({ ok: false, error: { code: 'INVALID_ORIGIN', message: 'Cross-origin mutation blocked.' } }, { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ['/api/:path*'] };
