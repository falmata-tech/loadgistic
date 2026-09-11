import { NextRequest, NextResponse } from 'next/server.js';
import { mutationOriginAllowed } from '@/lib/origin.js';
import { retiredDemandResponse } from '@/lib/retired-demand';

export async function middleware(request: NextRequest) {
  if (['POST','PUT','PATCH','DELETE'].includes(request.method) && /^\/api\/(shipments|network)(\/|$)/.test(request.nextUrl.pathname)) {
    return retiredDemandResponse();
  }
  if (['POST','PUT','PATCH','DELETE'].includes(request.method)) {
    if (!mutationOriginAllowed(request.headers, request.url)) {
      return NextResponse.json({ ok: false, error: { code: 'INVALID_ORIGIN', message: 'Cross-origin mutation blocked.' } }, { status: 403 });
    }
  }
  const { refreshSupabaseSession } = await import('@/lib/supabase/session-middleware');
  return refreshSupabaseSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
};
