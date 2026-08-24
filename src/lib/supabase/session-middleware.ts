import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server.js';
import { getSupabasePublicConfig, usesSupabaseAuth } from './config';

export async function refreshSupabaseSession(request: NextRequest) {
  if (!usesSupabaseAuth()) return NextResponse.next({ request });

  const { url, publishableKey } = getSupabasePublicConfig();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, publishableKey, {
    auth: {
      flowType: 'pkce',
      experimental: { appendPkceFlowIdToRedirects: true }
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      }
    }
  });

  // Do not trust getSession() as authorization evidence. getUser() validates
  // the token with Supabase Auth and refreshes cookie state when needed.
  await supabase.auth.getUser();
  return response;
}
