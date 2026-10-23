import assert from 'node:assert/strict';
import test from 'node:test';
import {getSupabaseFleetDriverPage} from '../src/lib/fleet/supabase.js';

async function withResponses(responses,run){
 const oldFetch=globalThis.fetch,oldUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const calls=[];process.env.NEXT_PUBLIC_SUPABASE_URL='https://fleet-paging.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-test-key';
 globalThis.fetch=async(_url,init)=>{
  calls.push(JSON.parse(init.body));const response=responses[calls.length-1];assert.ok(response,'No unexpected additional read');
  return new Response(JSON.stringify(response.body),{status:response.status||200,headers:{'Content-Type':'application/json'}});
 };
 try{await run(calls);}finally{
  globalThis.fetch=oldFetch;
  if(oldUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=oldUrl;
  if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;
 }
}
const row={payload:{id:'synthetic-driver',name:'Synthetic',is_owner:false,driver_documents:[],authorization_documents:[]},total_count:21};
test('stale fleet page recovers once with true total and first-page context',async()=>{
 await withResponses([{body:[]},{body:[row]}],async calls=>{
  const result=await getSupabaseFleetDriverPage({id:'bound-owner'},{page:4,pageSize:10,actor_user_id:'forged'});
  assert.equal(result.page,1);assert.equal(result.total,21);assert.equal(result.pageCount,3);assert.equal(result.items[0].id,'synthetic-driver');
  assert.deepEqual(calls,[{actor_user_id:'bound-owner',requested_offset:30,requested_limit:10},{actor_user_id:'bound-owner',requested_offset:0,requested_limit:10}]);
 });
});
test('a real middle fleet page stays in place without another query',async()=>{
 await withResponses([{body:[row]}],async calls=>{
  const result=await getSupabaseFleetDriverPage({id:'owner'},{page:2,pageSize:10});
  assert.equal(result.page,2);assert.equal(result.total,21);assert.equal(calls.length,1);assert.equal(calls[0].requested_offset,10);
 });
});
test('invalid or fractional fleet pages normalize before PostgreSQL',async()=>{
 for(const page of [2.5,-1,Infinity,1_000_001,'not-a-page'])await withResponses([{body:[]}],async calls=>{
  const result=await getSupabaseFleetDriverPage({id:'owner'},{page,pageSize:2.5});
  assert.equal(result.page,1);assert.equal(result.pageSize,10);assert.equal(result.total,0);assert.equal(calls.length,1);
  assert.equal(calls[0].requested_offset,0);assert.equal(calls[0].requested_limit,10);
 });
 await withResponses([{body:[]}],async calls=>{await getSupabaseFleetDriverPage({id:'owner'},{pageSize:1000});assert.equal(calls[0].requested_limit,50);});
});
test('empty fleets do not enter a repeat loop',async()=>{
 await withResponses([{body:[]},{body:[]}],async calls=>{
  const result=await getSupabaseFleetDriverPage({id:'owner'},{page:12});
  assert.equal(result.total,0);assert.equal(result.page,1);assert.equal(result.pageCount,1);assert.equal(calls.length,2);
 });
});
test('foreign or revoked first-read authority fails instead of returning a blank fleet',async()=>{
 await withResponses([{status:403,body:{code:'42501',message:'FORBIDDEN'}}],async calls=>{
  await assert.rejects(()=>getSupabaseFleetDriverPage({id:'foreign'},{page:12}),/FORBIDDEN/);assert.equal(calls.length,1);
 });
});
test('authority revoked between stale-page reads fails on the bounded retry',async()=>{
 await withResponses([{body:[]},{status:403,body:{code:'42501',message:'FORBIDDEN'}}],async calls=>{
  await assert.rejects(()=>getSupabaseFleetDriverPage({id:'revoked'},{page:12}),/FORBIDDEN/);
  assert.equal(calls.length,2);assert.ok(calls.every(call=>call.actor_user_id==='revoked'));
 });
});
test('a fleet outage is never disguised as an empty or recovered page',async()=>{
 await withResponses([{status:503,body:{code:'PGRST000',message:'synthetic backend unavailable'}}],async calls=>{
  await assert.rejects(()=>getSupabaseFleetDriverPage({id:'owner'},{page:12}),/SUPABASE_FLEET_DRIVER_PAGE_FAILED/);assert.equal(calls.length,1);
 });
});
