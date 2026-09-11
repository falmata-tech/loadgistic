import { NextRequest, NextResponse } from 'next/server.js';
import { createSupabaseRouteClient } from '@/lib/supabase/route';

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login?success=You+have+been+logged+out', request.url), 303);
  const client=createSupabaseRouteClient(request,response);
  await client.auth.signOut();
  return response;
}
