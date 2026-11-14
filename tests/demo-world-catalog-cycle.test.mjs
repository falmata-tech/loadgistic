import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {demoWorldPlanForStep} from '../src/lib/demo-world-planner.mjs';
import {executeDemoCapacityPlan} from '../src/lib/demo-world-executor.mjs';

const fixture=JSON.parse(readFileSync(new URL('../resources/fixtures/managed-market.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../resources/fixtures/demo-world-scenarios.json',import.meta.url)));
test('every authored phase is blocked on the retired legacy writer, rather than qualifying a mocked save',async()=>{
 const activatedAt='2026-11-13T12:00:00.000Z',state={vehicles:manifest.targets.filter(row=>row.mutable).map(row=>({key:row.key,status:'PARTIAL',percent:null}))};
 const before=structuredClone(state);let writes=0,reads=0;
 const client={auth:{get admin(){reads++;throw Error('auth must stay closed');}},
  from(){reads++;throw Error('database must stay closed');},rpc(){writes++;throw Error('publish must stay closed');}};
 let count=0;
 for(const target of manifest.targets.filter(row=>row.mutable))for(let stepIndex=0;stepIndex<4;stepIndex++){
  const previousCompletedAt=stepIndex===0?null:new Date(Date.parse(activatedAt)+(target.start_offset_seconds+(stepIndex-1)*120)*1000+1000).toISOString();
  const plan=demoWorldPlanForStep({manifest,fixture,activatedAt,epoch:1,targetKey:target.key,cycleIndex:0,stepIndex,previousCompletedAt});
  await assert.rejects(executeDemoCapacityPlan({plan,manifest,fixture,client}),{message:'DEMO_WORLD_DIRECT_APPLY_RETIRED'});count++;
 }
 assert.equal(count,20);assert.equal(reads,0);assert.equal(writes,0);assert.deepEqual(state,before);
});
