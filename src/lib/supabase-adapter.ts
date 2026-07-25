import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cloud adapter boundary. The local MVP uses src/lib/repository.js with Node's
 * built-in SQLite. Production migration replaces repository calls behind the
 * same domain commands with Supabase PostgreSQL RPCs and RLS-protected queries.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('SUPABASE_NOT_CONFIGURED');
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'loadgistic-server' } }
  });
}

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
