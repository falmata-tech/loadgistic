import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {checkRateLimit,rateLimitStatus} from '../src/lib/rate-limit.js';

const root=process.cwd();

test('rate limits are always managed and fail closed without shared configuration',async()=>{
  const original={
    NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  try{
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal((await checkRateLimit('managed-unavailable',2,60_000)).allowed,false);
    assert.deepEqual(rateLimitStatus({}),{
      backend:'supabase',configured:false,durable:true
    });
    assert.deepEqual(rateLimitStatus({NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service'}),{
      backend:'supabase',configured:true,durable:true
    });
  }finally{
    for(const [key,value] of Object.entries(original)){
      if(value===undefined)delete process.env[key];else process.env[key]=value;
    }
  }
});

test('shared counter migration is atomic, digest-only, bounded, and service-role-only',()=>{
  const migration=fs.readFileSync(path.join(root,'supabase/migrations/047_shared_rate_limits.sql'),'utf8');
  const adapter=fs.readFileSync(path.join(root,'src/lib/rate-limit.js'),'utf8');
  assert.match(migration,/create table if not exists public\.rate_limit_windows/i);
  assert.match(migration,/key_digest text primary key check \(key_digest ~ '\^\[a-f0-9\]\{64\}\$'\)/i);
  assert.match(migration,/on conflict\(key_digest\) do update/i);
  assert.match(migration,/for update skip locked/i);
  assert.match(migration,/revoke all on function public\.consume_rate_limit\(text,integer,integer\)[\s\S]*from public,anon,authenticated/i);
  assert.match(migration,/grant execute on function public\.consume_rate_limit\(text,integer,integer\)[\s\S]*to service_role/i);
  assert.match(adapter,/privateContactDigest\(`rate-limit:\$\{key\}`\)/);
  assert.match(adapter,/catch\{[\s\S]*allowed:false,retryAfterSeconds:60/);
  assert.doesNotMatch(migration,/email|ip_address|access_code|message_body/i);
});
