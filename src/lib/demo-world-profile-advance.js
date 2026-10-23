/** Advance one due, database-selected synthetic provider-profile phase. */
export async function advanceDemoProfile(client,{workerId}={}){
  if(!/^[-a-f0-9]{36}$/.test(String(workerId||'')))throw Error('DEMO_PROFILE_WORKER_INVALID');
  const claim=await client.rpc('demo_world_claim_profile',{worker_id:workerId});
  if(claim.error||!Array.isArray(claim.data)||claim.data.length>1)throw Error('DEMO_PROFILE_CLAIM_INVALID');
  const job=claim.data[0]||null;
  if(job&&(!Number.isSafeInteger(Number(job.job_id))||Number(job.job_id)<1
    ||!/^\d+$/.test(String(job.job_id))
    ||!/^[-a-f0-9]{36}$/.test(String(job.lease_token||'')))){
    throw Error('DEMO_PROFILE_CLAIM_INVALID');
  }
  let completed=0,replayed=0;
  if(job){
    const result=await client.rpc('demo_world_execute_profile',{
      job_id:Number(job.job_id),lease_token:job.lease_token
    });
    if(result.error||!['APPLIED','REPLAYED'].includes(result.data?.result)){
      throw Error('DEMO_PROFILE_STEP_FAILED');
    }
    completed=Number(result.data.result==='APPLIED');
    replayed=Number(result.data.result==='REPLAYED');
  }
  const status=await client.rpc('demo_world_profile_status');
  const value=status.data;
  if(status.error||!value||typeof value.enabled!=='boolean'
    ||typeof value.target_bound!=='boolean'
    ||!Number.isSafeInteger(value.pending_count)||value.pending_count<0
    ||!Number.isSafeInteger(value.exhausted_count)||value.exhausted_count<0
    ||value.last_completed_phase!==null
      &&!['SHOW_DEMO','RESTORE'].includes(value.last_completed_phase)){
    throw Error('DEMO_PROFILE_STATUS_INVALID');
  }
  return {
    profile_accepted:Number(Boolean(job)),profile_completed:completed,
    profile_replayed:replayed,profile_enabled:value.enabled,
    profile_target_bound:value.target_bound,
    profile_pending_count:value.pending_count,
    profile_exhausted_count:value.exhausted_count,
    profile_last_completed_phase:value.last_completed_phase
  };
}
