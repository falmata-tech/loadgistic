import {createSupabaseAdminClient} from '@/lib/supabase-adapter.js';
import {handleHostedDemoMotion} from '@/lib/demo-motion-hosted-http.js';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(request:Request){
 return handleHostedDemoMotion(request,{clientFactory:createSupabaseAdminClient});
}
