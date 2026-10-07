import assert from 'node:assert/strict';
import test from 'node:test';
import {commitPrivateUpload} from '../src/lib/private-upload-commit.js';
import {submitSupabaseVerification} from '../src/lib/verification/supabase.js';
import {submitSupabasePaymentProof} from '../src/lib/billing/supabase.js';
import {updateSupabaseProviderProfileImage} from '../src/lib/provider-profile/supabase.js';

test('a committed reference remains readable after response loss and no write is retried', async () => {
  const storage = new Map([['private-proof', 'proof bytes']]);
  let persisted, calls = 0;
  const lost = new TypeError('fetch failed');
  await assert.rejects(commitPrivateUpload({path:'private-proof'}, async () => {
    calls++; persisted = 'private-proof'; throw lost;
  }, async path => storage.delete(path)), error => error === lost);
  assert.equal(calls, 1);
  assert.equal(storage.get(persisted), 'proof bytes');
});

test('explicit database rejections clean only the new object, including wrapped errors', async () => {
  for (const code of ['P0001','22023','23502','23503','23505','23514','42501']) {
    for (const wrapped of [false,true]) {
      const rejected = Object.assign(new Error('rejected'), {code});
      const error = wrapped ? new Error('application failure',{cause:rejected}) : rejected;
      const removed=[];
      await assert.rejects(commitPrivateUpload({path:'new-proof'},async()=>{throw error;},async path=>{removed.push(path);}),e=>e===error);
      assert.deepEqual(removed,['new-proof']);
    }
  }
});

test('ambiguous errors cannot delete files even if their text resembles a rejection', async () => {
  for (const code of [undefined,'08006','XX000','PGRST000','504']) {
    const error=Object.assign(new Error('FORBIDDEN P0001'),{code});
    await assert.rejects(commitPrivateUpload({path:'retained-proof'},async()=>{throw error;},async()=>assert.fail('must retain')),e=>e===error);
  }
});

test('cleanup failure preserves the original rejection; successful commit leaves the file intact', async () => {
  const rejected=Object.assign(new Error('denied'),{code:'42501'});
  await assert.rejects(commitPrivateUpload({path:'new-proof'},async()=>{throw rejected;},async()=>{throw new Error('storage offline');}),e=>e===rejected);
  const result=await commitPrivateUpload({path:'saved-proof'},async()=>({id:'saved'}),async()=>assert.fail('committed'));
  assert.deepEqual(result,{id:'saved'});
});

test('real upload adapters retain files on lost RPC responses and clean explicit rejections', async () => {
  const keys=['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','UPLOAD_SCANNER_BACKEND'];
  const saved=keys.map(key=>process.env[key]), originalFetch=globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:1';
  process.env.SUPABASE_SERVICE_ROLE_KEY='isolated-test-placeholder';
  process.env.UPLOAD_SCANNER_BACKEND='local';
  const file=new File([Buffer.from('89504e470d0a1a0a','hex')],'test.png',{type:'image/png'});
  try {
    for (const save of [
      ()=>submitSupabaseVerification({id:'actor'},{subjectType:'TRUCK',subjectId:'truck',verificationType:'TRUCK_OWNERSHIP'},file),
      ()=>submitSupabasePaymentProof({id:'actor'},10,'test-reference',file),
      ()=>updateSupabaseProviderProfileImage({id:'actor'},file)
    ]) for (const outcome of ['lost','rejected','success']) {
      const objects=new Map();let referenced,commandCount=0;
      globalThis.fetch=async(input,init)=>{
        const url=new URL(typeof input==='string'?input:input.url);
        const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
        if(url.pathname.startsWith('/storage/v1/object/')) {
          const object=url.pathname.slice('/storage/v1/object/'.length);
          if(init.method==='POST') {objects.set(object,'proof bytes');return json({Key:object});}
          if(init.method==='DELETE') {for(const prefix of JSON.parse(init.body).prefixes)objects.delete(`${object}/${prefix}`);return json([]);}
        }
        if(url.pathname.startsWith('/rest/v1/rpc/')) {
          commandCount++;const body=JSON.parse(init.body);
          if(outcome==='rejected')return new Response(JSON.stringify({code:'P0001',message:'FORBIDDEN'}),{status:400,headers:{'Content-Type':'application/json'}});
          referenced=(body.storage_reference||body.command.storage_path).replace('supabase://','');
          if(outcome==='lost')throw new TypeError('response lost after commit');
          return json({id:'committed'});
        }
        assert.fail('Unexpected request in isolated upload test');
      };
      if(outcome==='success')assert.equal((await save()).id,'committed');
      else await assert.rejects(save);
      assert.equal(commandCount,1,'no automatic mutation retry');
      if(outcome==='rejected')assert.equal(objects.size,0);
      else {assert.equal(objects.size,1);assert.equal(objects.get(referenced),'proof bytes');}
    }
  } finally {
    globalThis.fetch=originalFetch;
    keys.forEach((key,index)=>{if(saved[index]===undefined)delete process.env[key];else process.env[key]=saved[index];});
  }
});
