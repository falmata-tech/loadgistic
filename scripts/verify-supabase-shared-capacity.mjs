// Local-only verification that email-only private Capacity cannot be restored
// by a demo fixture import. Account sharing is covered by the SQL contract tests.
import {randomBytes,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const url=String(process.env.SUPABASE_SEED_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').trim();
const serviceRoleKey=String(process.env.SUPABASE_SEED_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
if(!url||!serviceRoleKey)throw new Error('SUPABASE_SHARED_VERIFY_CONFIG_MISSING');
const endpoint=new URL(url);
if(!new Set(['127.0.0.1','localhost','::1']).has(endpoint.hostname))throw new Error('REMOTE_SHARED_VERIFY_REFUSED');
const service=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});

for(const [table,filter,errorCode] of [
  ['capacity_access_grants',{audience_type:'EMAIL'},'RETIRED_EMAIL_GRANTS_PRESENT'],
  ['shared_capacity_email_otps',{},'RETIRED_CAPACITY_CHALLENGES_PRESENT'],
  ['access_email_deliveries',{delivery_kind:'SHARED_CAPACITY'},'RETIRED_CAPACITY_DELIVERIES_PRESENT']
]){
  let request=service.from(table).select('id',{count:'exact',head:true});
  for(const [column,value] of Object.entries(filter))request=request.eq(column,value);
  const {count,error}=await request;
  if(error)throw new Error(`SUPABASE_SHARED_VERIFY_READ_FAILED:${table}`);
  if(count!==0)throw new Error(errorCode);
}

const digest=randomBytes(32).toString('hex');
const {data:issued,error:requestError}=await service.rpc('request_shared_capacity_otp',{
  challenge_id:randomUUID(),normalized_recipient_email:'retired-capacity@example.invalid',
  recipient_digest:digest,challenge_code_digest:randomBytes(32).toString('hex'),
  challenge_expires_at:new Date(Date.now()+300000).toISOString()
});
if(requestError||issued!==false)throw new Error('RETIRED_CAPACITY_OTP_AVAILABLE');
const {data:rows,error:projectionError}=await service.rpc('private_capacity_filtered_page',{
  requested_audience:'EMAIL',requested_digest:digest,actor_user_id:null,
  cursor_updated_at:null,cursor_id:null,requested_page_size:12,query:{}
});
if(projectionError||!Array.isArray(rows)||rows.length!==0)throw new Error('RETIRED_CAPACITY_PROJECTION_AVAILABLE');
process.stdout.write('Email-only private Capacity is retired; no demo grants, challenges or deliveries remain.\n');
