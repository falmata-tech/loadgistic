import {createSupabaseAdminClient} from '@/lib/supabase-adapter.js';
import {handleDemoWorldAdvance} from '@/lib/demo-world-advance.js';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(request:Request){
  return handleDemoWorldAdvance(request,{clientFactory:createSupabaseAdminClient});
}
