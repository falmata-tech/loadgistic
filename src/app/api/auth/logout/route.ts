import { NextRequest, NextResponse } from 'next/server.js';
import { SESSION_COOKIE } from '@/lib/auth';
import { usesSupabaseAuth } from '@/lib/supabase/config';
import { createSupabaseRouteClient } from '@/lib/supabase/route';

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login?success=You+have+been+logged+out', request.url), 303);
  if(usesSupabaseAuth()){
    const client=createSupabaseRouteClient(request,response);
    await client.auth.signOut();
  }
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
  return response;
}
