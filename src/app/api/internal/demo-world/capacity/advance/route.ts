import {createSupabaseAdminClient} from '@/lib/supabase-adapter.js';
import {handleDemoCapacityAdvance} from '@/lib/demo-world-advance.js';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(request:Request){
  return handleDemoCapacityAdvance(request,{clientFactory:createSupabaseAdminClient});
}
