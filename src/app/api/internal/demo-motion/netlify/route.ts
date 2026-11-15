import {createSupabaseAdminClient} from '@/lib/supabase-adapter.js';
import {handleNetlifyDemoMotion} from '@/lib/demo-motion-netlify-http.js';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){return handleNetlifyDemoMotion(request,{clientFactory:createSupabaseAdminClient});}
