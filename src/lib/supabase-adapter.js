import { createClient } from '@supabase/supabase-js';

export function createSupabaseAdminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!serviceKey)throw new Error('SUPABASE_NOT_CONFIGURED');
  return createClient(url,serviceKey,{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{'X-Client-Info':'loadgistic-server'}}
  });
}

export function isSupabaseConfigured(){
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
}
