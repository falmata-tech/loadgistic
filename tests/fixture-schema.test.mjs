import test from 'node:test';
import assert from 'node:assert/strict';
import {readFixtureSchema} from '../scripts/lib/fixture-schema.mjs';

const url='http://127.0.0.1:55321';
const key='synthetic-private-key';

test('fixture schema uses one bounded nonredirecting local GET before import',async()=>{
  let requests=0;
  const definitions={profiles:{type:'object'}};
  const actual=await readFixtureSchema(url,key,{fetchImpl:async(endpoint,options)=>{
    requests++;
    assert.equal(String(endpoint),`${url}/rest/v1/`);
    assert.equal(options.method,'GET');
    assert.equal(options.redirect,'error');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers.authorization,`Bearer ${key}`);
    return Response.json({definitions});
  }});
  assert.equal(requests,1);
  assert.deepEqual(actual,definitions);
  assert.deepEqual(await readFixtureSchema(url,key,{fetchImpl:async()=>Response.json({components:{schemas:definitions}})}),definitions);
});

test('schema errors retain status/code but never body details or retry',async()=>{
  for(const [status,code,expected] of [[500,'PGRST300','PGRST300'],[500,'XX000','XX000'],[403,'42501','42501'],[503,'PGRST002','PGRST002'],[500,key,'UNKNOWN']]){
    let requests=0;
    await assert.rejects(readFixtureSchema(url,key,{fetchImpl:async()=>{
      requests++;
      return Response.json({code,message:key,details:key,hint:key},{status});
    }}),{message:`SUPABASE_SCHEMA_READ_FAILED:${status}:${expected}`});
    assert.equal(requests,1);
  }
});

test('transport, invalid JSON and empty schemas fail without leaking raw errors',async()=>{
  for(const [fetchImpl,message] of [
    [async()=>{throw new Error(key);},'SUPABASE_SCHEMA_READ_FAILED:TRANSPORT'],
    [async()=>new Response(key,{status:500}),'SUPABASE_SCHEMA_READ_FAILED:500:INVALID_JSON_OR_TIMEOUT']
  ]){
    await assert.rejects(readFixtureSchema(url,key,{fetchImpl}),{message});
  }
  for(const body of [null,{}, {definitions:[]},{definitions:{}},{definitions:'invalid'}]){
    await assert.rejects(readFixtureSchema(url,key,{fetchImpl:async()=>Response.json(body)}),{message:'SUPABASE_SCHEMA_INVALID'});
  }
});

test('schema helper rejects remote targets and credentials before sending a key',async()=>{
  for(const target of ['https://example.com','http://127.0.0.1.attacker.test',`${url}/other`,'http://user:password@localhost:55321',`${url}?token=secret`]){
    await assert.rejects(readFixtureSchema(target,key,{fetchImpl:async()=>{assert.fail('No request allowed');}}),{message:'SUPABASE_SCHEMA_TARGET_INVALID'});
  }
});
