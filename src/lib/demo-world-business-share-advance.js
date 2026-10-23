import {randomUUID} from 'node:crypto';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Advance at most one due exact-fixture broker-share step; SQL chooses all identities. */
export async function advanceDemoBusinessShare(client,{workerId=randomUUID()}={}){
 if(!UUID.test(workerId))throw Error('DEMO_BUSINESS_WORKER_INVALID');
 const claimed=await client.rpc('demo_world_claim_business_share',{worker_id:workerId});
 if(claimed.error||!Array.isArray(claimed.data)||claimed.data.length>1)throw Error('DEMO_BUSINESS_CLAIM_FAILED');
 const job=claimed.data[0];
 if(job&&(!Number.isSafeInteger(Number(job.job_id))||Number(job.job_id)<1
  ||!/^\d+$/.test(String(job.job_id))||!UUID.test(String(job.lease_token)))){
  throw Error('DEMO_BUSINESS_CLAIM_INVALID');
 }
 let result=null;
 if(job){
  const executed=await client.rpc('demo_world_execute_business_share',{
   job_id:Number(job.job_id),lease_token:job.lease_token
  });
  if(executed.error||!['APPLIED','REPLAYED'].includes(executed.data?.result)
   ||executed.data.result==='APPLIED'&&!['GRANT','REVOKE'].includes(executed.data.phase)){
   throw Error('DEMO_BUSINESS_STEP_FAILED');
  }
  result=executed.data.result;
 }
 const status=await client.rpc('demo_world_business_share_status');
 const value=status.data;
 if(status.error||typeof value?.enabled!=='boolean'||typeof value.target_bound!=='boolean'
  ||!Number.isSafeInteger(value.pending_count)||value.pending_count<0
  ||!Number.isSafeInteger(value.exhausted_count)||value.exhausted_count<0
  ||![null,'GRANT','REVOKE'].includes(value.last_completed_phase)){
  throw Error('DEMO_BUSINESS_STATUS_INVALID');
 }
 return {business_share_accepted:Number(Boolean(job)),
  business_share_completed:Number(result==='APPLIED'),
  business_share_replayed:Number(result==='REPLAYED'),
  business_share_enabled:value.enabled,
  business_share_target_bound:value.target_bound,
  business_share_pending_count:value.pending_count,
  business_share_exhausted_count:value.exhausted_count,
  business_share_last_completed_phase:value.last_completed_phase};
}
