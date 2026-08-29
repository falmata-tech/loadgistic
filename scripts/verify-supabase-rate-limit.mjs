import {randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const url=String(process.env.SUPABASE_SEED_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').trim();
const serviceRoleKey=String(process.env.SUPABASE_SEED_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
const anonKey=String(process.env.SUPABASE_SEED_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'').trim();
if(!url||!serviceRoleKey||!anonKey)throw new Error('SUPABASE_RATE_LIMIT_VERIFY_CONFIG_MISSING');
const endpoint=new URL(url);
if(!new Set(['127.0.0.1','localhost','::1']).has(endpoint.hostname))throw new Error('REMOTE_RATE_LIMIT_VERIFY_REFUSED');

process.env.NEXT_PUBLIC_SUPABASE_URL=url;
process.env.SUPABASE_SERVICE_ROLE_KEY=serviceRoleKey;
process.env.SESSION_SECRET=process.env.SESSION_SECRET||'shared-rate-limit-local-verification-secret';

const service=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
const anon=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false}});
const {checkRateLimit,purgeExpiredRateLimits}=await import('../src/lib/rate-limit.js');
const {privateContactDigest}=await import('../src/lib/security.js');

const rawKey=`verify:${randomBytes(8).toString('hex')}:visitor@example.test:192.0.2.10`;
const digest=privateContactDigest(`rate-limit:${rawKey}`);

try{
  const outcomes=await Promise.all(Array.from({length:12},()=>checkRateLimit(rawKey,3,60_000)));
  if(outcomes.filter(outcome=>outcome.allowed).length!==3)throw new Error('SUPABASE_RATE_LIMIT_ATOMICITY_FAILED');
  if(outcomes.filter(outcome=>!outcome.allowed).some(outcome=>outcome.retryAfterSeconds<1)){
    throw new Error('SUPABASE_RATE_LIMIT_RETRY_FAILED');
  }

  const {data:stored,error:storedError}=await service.from('rate_limit_windows')
    .select('key_digest,request_count,reset_at').eq('key_digest',digest).maybeSingle();
  if(storedError||!stored||stored.request_count!==12)throw new Error('SUPABASE_RATE_LIMIT_COUNTER_FAILED');
  if(JSON.stringify(stored).includes('visitor@example.test')||JSON.stringify(stored).includes('192.0.2.10')){
    throw new Error('SUPABASE_RATE_LIMIT_PRIVATE_KEY_STORED');
  }

  const {error:anonymousTableError}=await anon.from('rate_limit_windows').select('key_digest').limit(1);
  if(!anonymousTableError)throw new Error('SUPABASE_RATE_LIMIT_ANONYMOUS_TABLE_ALLOWED');
  const {error:anonymousRpcError}=await anon.rpc('consume_rate_limit',{
    requested_key_digest:digest,requested_limit:3,requested_window_seconds:60
  });
  if(!anonymousRpcError)throw new Error('SUPABASE_RATE_LIMIT_ANONYMOUS_RPC_ALLOWED');

  const {error:expiryError}=await service.from('rate_limit_windows')
    .update({reset_at:new Date(Date.now()-1000).toISOString()}).eq('key_digest',digest);
  if(expiryError)throw new Error('SUPABASE_RATE_LIMIT_EXPIRY_SETUP_FAILED');
  const deleted=await purgeExpiredRateLimits(10);
  if(deleted<1)throw new Error('SUPABASE_RATE_LIMIT_CLEANUP_FAILED');
  const {data:remaining,error:remainingError}=await service.from('rate_limit_windows')
    .select('key_digest').eq('key_digest',digest).maybeSingle();
  if(remainingError||remaining)throw new Error('SUPABASE_RATE_LIMIT_CLEANUP_FAILED');
}finally{
  await service.from('rate_limit_windows').delete().eq('key_digest',digest);
}

process.stdout.write('Supabase shared rate-limit concurrency, privacy, retry, cleanup, and browser-denial checks passed.\n');
