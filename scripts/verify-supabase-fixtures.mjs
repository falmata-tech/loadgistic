import { createClient } from '@supabase/supabase-js';

const url=String(process.env.SUPABASE_SEED_URL||'').trim();
const serviceRoleKey=String(process.env.SUPABASE_SEED_SERVICE_ROLE_KEY||'').trim();
const anonKey=String(process.env.SUPABASE_SEED_ANON_KEY||'').trim();
const fixturePassword=String(process.env.SUPABASE_FIXTURE_PASSWORD||'Loadgistic123!');

if(!url||!serviceRoleKey||!anonKey)throw new Error('SUPABASE_FIXTURE_VERIFY_CONFIG_MISSING');
const endpoint=new URL(url);
if(!new Set(['127.0.0.1','localhost','::1']).has(endpoint.hostname)){
  throw new Error('REMOTE_FIXTURE_VERIFY_REFUSED');
}

const service=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
const anon=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false}});
const expectedMinimums={profiles:154,vehicles:143,capacities:143,verification_requests:335,place_catalog:3703};

for(const [table,minimum] of Object.entries(expectedMinimums)){
  const {count,error}=await service.from(table).select('*',{count:'exact',head:true});
  if(error)throw new Error(`SUPABASE_FIXTURE_VERIFY_READ_FAILED:${table}:${error.message}`);
  if((count||0)<minimum)throw new Error(`SUPABASE_FIXTURE_VERIFY_COUNT_FAILED:${table}:${count||0}<${minimum}`);
}

const {data:session,error:loginError}=await anon.auth.signInWithPassword({
  email:'company-driver@loadgistic.local',
  password:fixturePassword
});
if(loginError||!session.user||!session.session?.access_token){
  throw new Error(`SUPABASE_FIXTURE_VERIFY_AUTH_FAILED:${loginError?.message||'missing session'}`);
}
const {data:projection,error:projectionError}=await anon.rpc('current_user_projection');
if(projectionError)throw new Error(`SUPABASE_FIXTURE_VERIFY_IDENTITY_FAILED:${projectionError.message}`);
if(projection?.id!==session.user.id||projection?.role!=='DRIVER'||projection?.driver_kind!=='COMPANY'){
  throw new Error('SUPABASE_FIXTURE_VERIFY_IDENTITY_MISMATCH');
}
if(!projection.workspace_subscription)throw new Error('SUPABASE_FIXTURE_VERIFY_SUBSCRIPTION_MISSING');
await anon.auth.signOut();

const {error:anonymousWriteError}=await anon.from('audit_logs').insert({
  id:'fixture-verification-must-not-write',
  action:'FIXTURE_VERIFY'
});
if(!anonymousWriteError)throw new Error('SUPABASE_FIXTURE_VERIFY_ANON_WRITE_ALLOWED');

const {data:objects,error:storageError}=await service.storage.from('verification').list('demo',{
  search:'verification-document.jpg',limit:10
});
if(storageError)throw new Error(`SUPABASE_FIXTURE_VERIFY_STORAGE_FAILED:${storageError.message}`);
if(!objects?.some(object=>object.name==='verification-document.jpg')){
  throw new Error('SUPABASE_FIXTURE_VERIFY_STORAGE_OBJECT_MISSING');
}

process.stdout.write('Local Supabase fixture verification passed.\n');
