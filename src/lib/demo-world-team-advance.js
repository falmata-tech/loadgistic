/** Advance one due, database-selected synthetic broker staff permission phase. */
export async function advanceDemoTeam(client,{workerId}={}){
  if(!/^[-a-f0-9]{36}$/.test(String(workerId||'')))throw Error('DEMO_TEAM_WORKER_INVALID');
  const claim=await client.rpc('demo_world_claim_team',{worker_id:workerId});
  if(claim.error||!Array.isArray(claim.data)||claim.data.length>1)throw Error('DEMO_TEAM_CLAIM_INVALID');
  const job=claim.data[0]||null;
  if(job&&(!Number.isSafeInteger(Number(job.job_id))||Number(job.job_id)<1
    ||!/^[1-9]\d*$/.test(String(job.job_id))
    ||!/^[-a-f0-9]{36}$/.test(String(job.lease_token||'')))){
    throw Error('DEMO_TEAM_CLAIM_INVALID');
  }
  let completed=0,replayed=0;
  if(job){
    const result=await client.rpc('demo_world_execute_team',{
      job_id:Number(job.job_id),lease_token:job.lease_token
    });
    if(result.error||!['APPLIED','REPLAYED'].includes(result.data?.result)){
      throw Error('DEMO_TEAM_STEP_FAILED');
    }
    completed=Number(result.data.result==='APPLIED');
    replayed=Number(result.data.result==='REPLAYED');
  }
  const response=await client.rpc('demo_world_team_status');
  const status=response.data;
  if(response.error||!status||typeof status.enabled!=='boolean'
    ||typeof status.target_bound!=='boolean'
    ||!Number.isSafeInteger(status.pending_count)||status.pending_count<0
    ||!Number.isSafeInteger(status.exhausted_count)||status.exhausted_count<0
    ||status.last_completed_phase!==null
      &&!['CAPACITY_OFF','CAPACITY_ON'].includes(status.last_completed_phase)){
    throw Error('DEMO_TEAM_STATUS_INVALID');
  }
  return {
    team_accepted:Number(Boolean(job)),team_completed:completed,
    team_replayed:replayed,team_enabled:status.enabled,
    team_target_bound:status.target_bound,
    team_pending_count:status.pending_count,
    team_exhausted_count:status.exhausted_count,
    team_last_completed_phase:status.last_completed_phase
  };
}
