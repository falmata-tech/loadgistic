import {privateContactDigest} from './security.js';
import {createSupabaseAdminClient} from './supabase-adapter.js';

function boundedLimit(value){return Math.max(1,Math.min(1000,Math.floor(Number(value)||10)));}
function boundedWindowMs(value){return Math.max(1000,Math.min(86_400_000,Math.floor(Number(value)||60_000)));}

export function rateLimitStatus(environment=process.env){
  return {
    backend:'supabase',
    configured:Boolean(environment.NEXT_PUBLIC_SUPABASE_URL&&environment.SUPABASE_SERVICE_ROLE_KEY),
    durable:true
  };
}

export async function checkRateLimit(key,limit=10,windowMs=60_000){
  const safeLimit=boundedLimit(limit);
  const safeWindowMs=boundedWindowMs(windowMs);
  try{
    const client=createSupabaseAdminClient();
    const {data,error}=await client.rpc('consume_rate_limit',{
      requested_key_digest:privateContactDigest(`rate-limit:${key}`),
      requested_limit:safeLimit,
      requested_window_seconds:Math.ceil(safeWindowMs/1000)
    });
    if(error||!data||typeof data!=='object')throw new Error('RATE_LIMIT_UNAVAILABLE');
    if(typeof data.allowed!=='boolean')throw new Error('RATE_LIMIT_UNAVAILABLE');
    return {
      allowed:data.allowed,
      retryAfterSeconds:data.allowed?0:Math.max(1,Math.min(86_400,Number(data.retry_after_seconds)||60))
    };
  }catch{
    return {allowed:false,retryAfterSeconds:60};
  }
}

export async function purgeExpiredRateLimits(limit=500){
  const safeLimit=Math.max(1,Math.min(1000,Math.floor(Number(limit)||500)));
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('cleanup_rate_limit_windows',{requested_limit:safeLimit});
  if(error)throw new Error('RATE_LIMIT_CLEANUP_FAILED');
  return Math.max(0,Number(data)||0);
}

export function requestKey(request,scope){
  const netlify=request.headers.get('x-nf-client-connection-ip')?.trim();
  const cloudflare=request.headers.get('cf-connecting-ip')?.trim();
  const forwarded=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `${scope}:${netlify||cloudflare||forwarded||request.headers.get('x-real-ip')||'local'}`;
}
