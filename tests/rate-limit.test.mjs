import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {checkOriginBeforeScopedLimit} from '../src/lib/guest-rate-limit.js';
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

test('an exhausted origin bucket stops payload parsing and does not spend a scoped bucket',async()=>{
  const events=[];
  const result=await checkOriginBeforeScopedLimit({
    originKey:'origin:test',originLimit:12,windowMs:600_000,scopedLimit:5,
    consume:async(key,limit,windowMs)=>{
      events.push({kind:'consume',key,limit,windowMs});
      return {allowed:false,retryAfterSeconds:47};
    },
    readScope:async()=>{
      events.push({kind:'payload'});
      return {key:'email:must-not-be-consumed',value:{email:'guest@example.test'}};
    }
  });
  assert.deepEqual(result,{allowed:false,retryAfterSeconds:47,scope:null});
  assert.deepEqual(events,[{kind:'consume',key:'origin:test',limit:12,windowMs:600_000}]);
});

test('a permitted origin is consumed before request scope and its secondary bucket',async()=>{
  const events=[];
  const responses=[
    {allowed:true,retryAfterSeconds:0},
    {allowed:false,retryAfterSeconds:83}
  ];
  const result=await checkOriginBeforeScopedLimit({
    originKey:'origin:test',originLimit:12,windowMs:600_000,scopedLimit:5,
    consume:async(key,limit,windowMs)=>{
      events.push({kind:'consume',key,limit,windowMs});
      return responses.shift();
    },
    readScope:async()=>{
      events.push({kind:'payload'});
      return {key:'email:guest-digest',value:{email:'guest@example.test'}};
    }
  });
  assert.deepEqual(result,{
    allowed:false,retryAfterSeconds:83,scope:{email:'guest@example.test'}
  });
  assert.deepEqual(events,[
    {kind:'consume',key:'origin:test',limit:12,windowMs:600_000},
    {kind:'payload'},
    {kind:'consume',key:'email:guest-digest',limit:5,windowMs:600_000}
  ]);
});

test('guest code verification and review routes use bounded shared PostgreSQL limits',()=>{
  const otp=fs.readFileSync(path.join(root,'src/app/api/shared-capacity/otp/route.ts'),'utf8');
  const shared=fs.readFileSync(path.join(root,'src/app/api/shared-capacity/access/route.ts'),'utf8');
  const trackingOtp=fs.readFileSync(path.join(root,'src/app/api/tracking/otp/route.ts'),'utf8');
  const tracking=fs.readFileSync(path.join(root,'src/app/api/tracking/unlock/route.ts'),'utf8');
  const reviewUnlock=fs.readFileSync(path.join(root,'src/app/api/tracking/review-unlock/route.ts'),'utf8');
  const reviewSubmit=fs.readFileSync(path.join(root,'src/app/api/tracking/[id]/review/route.ts'),'utf8');
  assert.match(otp,/requestKey\(request,'shared-capacity-otp'\),originLimit:12,windowMs:10\*60_000,scopedLimit:5/);
  assert.match(otp,/Retry-After/);
  assert.match(otp,/shared-capacity-otp-email:\$\{email\.trim\(\)\.toLowerCase\(\)\}/);
  assert.match(shared,/requestKey\(request,'shared-capacity-access'\),originLimit:12,windowMs:10\*60_000,scopedLimit:5/);
  assert.match(shared,/shared-capacity-access-email:\$\{email\}/);
  assert.match(trackingOtp,/requestKey\(request,'tracking-otp'\),originLimit:10,windowMs:10\*60_000,scopedLimit:3/);
  assert.match(trackingOtp,/tracking-otp-recipient:\$\{email\}:\$\{trackingCode\}/);
  assert.match(tracking,/requestKey\(request,'tracking-unlock'\),originLimit:12,windowMs:10\*60_000,scopedLimit:5/);
  assert.match(tracking,/tracking-unlock-email:\$\{email\}/);
  assert.match(reviewUnlock,/requestKey\(request,'tracking-review-unlock'\),originLimit:12,windowMs:10\*60_000,scopedLimit:5/);
  assert.match(reviewUnlock,/tracking-review-unlock-shipment:\$\{shipmentId\}/);
  assert.match(reviewSubmit,/requestKey\(request,`tracking-review-submit:\$\{id\}`\),5,60\*60_000/);
  for(const source of [otp,shared,trackingOtp,tracking,reviewUnlock]){
    assert.ok(source.indexOf('const rate=await checkOriginBeforeScopedLimit')<source.indexOf('request.formData()'));
  }
});
