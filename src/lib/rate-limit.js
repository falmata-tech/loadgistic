import {privateContactDigest} from './security.js';
import {createSupabaseAdminClient} from './supabase-adapter.js';

const globalBuckets=globalThis;
const buckets=globalBuckets.__loadgisticRateLimits||new Map();
globalBuckets.__loadgisticRateLimits=buckets;

function managedRateLimits(environment=process.env){
  return String(environment.DATA_BACKEND||'sqlite').trim().toLowerCase()==='supabase';
}

function boundedLimit(value){return Math.max(1,Math.min(1000,Math.floor(Number(value)||10)));}
function boundedWindowMs(value){return Math.max(1000,Math.min(86_400_000,Math.floor(Number(value)||60_000)));}

export function rateLimitStatus(environment=process.env){
  const managed=managedRateLimits(environment);
  return {
    backend:managed?'supabase':'memory',
    configured:!managed||Boolean(environment.NEXT_PUBLIC_SUPABASE_URL&&environment.SUPABASE_SERVICE_ROLE_KEY),
    durable:managed
  };
}

function checkMemoryRateLimit(key,limit,windowMs){
  const now=Date.now();
  const current=buckets.get(key);
  if(!current||current.resetAt<=now){
    buckets.set(key,{count:1,resetAt:now+windowMs});
    return {allowed:true,retryAfterSeconds:0};
  }
  current.count+=1;
  if(current.count>limit)return {allowed:false,retryAfterSeconds:Math.ceil((current.resetAt-now)/1000)};
  return {allowed:true,retryAfterSeconds:0};
}

export async function checkRateLimit(key,limit=10,windowMs=60_000){
  const safeLimit=boundedLimit(limit);
  const safeWindowMs=boundedWindowMs(windowMs);
  if(!managedRateLimits())return checkMemoryRateLimit(key,safeLimit,safeWindowMs);
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
  if(!managedRateLimits()){
    const now=Date.now();let count=0;
    for(const [key,bucket] of buckets){
      if(count>=safeLimit)break;
      if(bucket.resetAt<=now){buckets.delete(key);count+=1;}
    }
    return count;
  }
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
