import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceDemoBusinessShare} from '../src/lib/demo-world-business-share-advance.js';

const workerId='6b3a1db7-2073-4f86-9b15-4d8a54a7464a';
const leaseToken='d3618e9a-7278-4ff2-9540-7e36f33df994';
const status={enabled:false,target_bound:false,pending_count:0,exhausted_count:0,last_completed_phase:null};

function clientFor({claims=[],execute={result:'APPLIED',phase:'GRANT'},health=status,errors={}}={}){
 const calls=[];
 return {calls,client:{async rpc(name,args){calls.push({name,args});
  return {data:name==='demo_world_claim_business_share'?claims
   :name==='demo_world_execute_business_share'?execute:health,
   error:errors[name]||null};}}};
}

test('disabled scenario is a bounded read-only no-op with no actor or recipient input',async()=>{
 const {client,calls}=clientFor();
 const outcome=await advanceDemoBusinessShare(client,{workerId});
 assert.deepEqual(calls.map(item=>item.name),['demo_world_claim_business_share','demo_world_business_share_status']);
 assert.deepEqual(calls[0].args,{worker_id:workerId});
 assert.equal(outcome.business_share_accepted,0);
 assert.equal(outcome.business_share_target_bound,false);
});

test('one claimed grant or revoke uses only the database-selected job and lease',async()=>{
 for(const phase of ['GRANT','REVOKE']){
  const {client,calls}=clientFor({claims:[{job_id:31,lease_token:leaseToken}],
   execute:{result:'APPLIED',phase},health:{...status,enabled:true,target_bound:true,last_completed_phase:phase}});
  const outcome=await advanceDemoBusinessShare(client,{workerId});
  assert.equal(outcome.business_share_completed,1);
  assert.equal(outcome.business_share_last_completed_phase,phase);
  assert.deepEqual(calls[1],{name:'demo_world_execute_business_share',args:{job_id:31,lease_token:leaseToken}});
  assert.equal(JSON.stringify(calls).includes('vehicle_id'),false);
  assert.equal(JSON.stringify(calls).includes('workspace_id'),false);
 }
});

test('a replay is counted without claiming another business change',async()=>{
 const {client}=clientFor({claims:[{job_id:31,lease_token:leaseToken}],execute:{result:'REPLAYED'},
  health:{...status,enabled:true,target_bound:true,last_completed_phase:'GRANT'}});
 const outcome=await advanceDemoBusinessShare(client,{workerId});
 assert.equal(outcome.business_share_completed,0);
 assert.equal(outcome.business_share_replayed,1);
});

test('bad worker, multiple claims, malformed leases and executor failures stop before later RPCs',async()=>{
 const badWorker=clientFor();
 await assert.rejects(()=>advanceDemoBusinessShare(badWorker.client,{workerId:'not-a-uuid'}),/DEMO_BUSINESS_WORKER_INVALID/);
 assert.equal(badWorker.calls.length,0);
 for(const claims of [[{job_id:1,lease_token:leaseToken},{job_id:2,lease_token:leaseToken}],
  [{job_id:0,lease_token:leaseToken}],[{job_id:1,lease_token:'bad'}]]){
  const {client,calls}=clientFor({claims});
  await assert.rejects(()=>advanceDemoBusinessShare(client,{workerId}));
  assert.equal(calls.length,1);
 }
 const failed=clientFor({claims:[{job_id:1,lease_token:leaseToken}],
  errors:{demo_world_execute_business_share:{message:'secret: account@example.test'}}});
 await assert.rejects(()=>advanceDemoBusinessShare(failed.client,{workerId}),{message:'DEMO_BUSINESS_STEP_FAILED'});
 assert.equal(failed.calls.length,2);
});

test('malformed health is not published as success',async()=>{
 for(const health of [{...status,pending_count:-1},{...status,last_completed_phase:'UNKNOWN'},
  {...status,target_bound:'yes'}]){
  const {client}=clientFor({health});
  await assert.rejects(()=>advanceDemoBusinessShare(client,{workerId}),{message:'DEMO_BUSINESS_STATUS_INVALID'});
 }
});
