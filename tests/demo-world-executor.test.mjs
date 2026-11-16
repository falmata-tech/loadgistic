import test from 'node:test';
import assert from 'node:assert/strict';
import {executeDemoCapacityPlan} from '../src/lib/demo-world-executor.mjs';

const denied={message:'DEMO_WORLD_DIRECT_APPLY_RETIRED'};
test('legacy direct apply refuses before inspecting even a fully privileged caller',async()=>{
 let touched=0;
 const input=new Proxy({}, {get(){touched++;throw Error('private input must not be read');}});
 await assert.rejects(executeDemoCapacityPlan(input),denied);
 assert.equal(touched,0);
});

test('normal, forged and operator-marked identities all remain outside the retired simulator write path',async()=>{
 for(const metadata of [{},{user_metadata:{fixture_source:'loadgistic',is_demo:true}},
  {app_metadata:{fixture_source:'loadgistic'},user_metadata:{fixture_key:'user-driver'}}]){
  const calls=[],state={account:{id:'test-account',...metadata},vehicle:{id:'test-vehicle'},
   capacity:{status:'PARTIAL',available_percent:60},location:{source:'MOBILE',updatedAt:'2026-11-13T12:00:00Z'}};
  const before=structuredClone(state);
  const client={auth:{admin:{listUsers:async()=>{calls.push('auth');return {data:{users:[state.account]},error:null};}}},
   from:()=>{calls.push('read');throw Error('must not open database');},
   rpc:async()=>{calls.push('publish');state.capacity.available_percent=30;return {data:'changed',error:null};}};
  await assert.rejects(executeDemoCapacityPlan({client,plan:{command:'capacity.publish_phase'},state}),denied);
  assert.deepEqual(calls,[]);assert.deepEqual(state,before);
 }
});

test('missing input, old receipts, replay and malformed plans cannot revive a direct writer',async()=>{
 for(const input of [undefined,null,{}, {priorReceipt:{replayed:true}},
  {plan:{command:'capacity.set_status',nextStatus:'EMPTY'}},{plan:{command:'capacity.publish_phase',catalogVersion:2,stepIndex:0}}]){
  await assert.rejects(executeDemoCapacityPlan(input),denied);
 }
});
