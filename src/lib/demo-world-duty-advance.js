/** Advance at most one database-selected exact synthetic vehicle duty phase. */
export async function advanceDemoDuty(client,{workerId}={}){
  if(!/^[-a-f0-9]{36}$/.test(String(workerId||'')))throw Error('DEMO_DUTY_WORKER_INVALID');
  const claim=await client.rpc('demo_world_claim_duty',{worker_id:workerId});
  if(claim.error||!Array.isArray(claim.data)||claim.data.length>1)throw Error('DEMO_DUTY_CLAIM_INVALID');
  const job=claim.data[0]||null;
  if(job&&(!Number.isSafeInteger(Number(job.job_id))||Number(job.job_id)<1
    ||!/^[0-9]+$/.test(String(job.job_id))
    ||!/^[-a-f0-9]{36}$/.test(String(job.lease_token||'')))){
    throw Error('DEMO_DUTY_CLAIM_INVALID');
  }
  let completed=0,replayed=0;
  if(job){
    const result=await client.rpc('demo_world_execute_duty',{
      job_id:Number(job.job_id),lease_token:job.lease_token
    });
    if(result.error||!['APPLIED','REPLAYED'].includes(result.data?.result)
      ||!['OFF_DUTY','RESTORE'].includes(result.data?.phase)){
      throw Error('DEMO_DUTY_STEP_FAILED');
    }
    completed=Number(result.data.result==='APPLIED');
    replayed=Number(result.data.result==='REPLAYED');
  }
  const status=await client.rpc('demo_world_duty_status');
  const value=status.data;
  if(status.error||!value||typeof value.enabled!=='boolean'
    ||!Number.isSafeInteger(value.pending_count)||value.pending_count<0
    ||!Number.isSafeInteger(value.exhausted_count)||value.exhausted_count<0
    ||![null,'OFF_DUTY','RESTORE'].includes(value.last_completed_phase)){
    throw Error('DEMO_DUTY_STATUS_INVALID');
  }
  return {
    duty_accepted:Number(Boolean(job)),duty_completed:completed,duty_replayed:replayed,
    duty_enabled:value.enabled,duty_pending_count:value.pending_count,
    duty_exhausted_count:value.exhausted_count,
    duty_last_completed_phase:value.last_completed_phase
  };
}
