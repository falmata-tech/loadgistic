/** Preserve the historical Manual-dependent lane while its replacement is reviewed. */
export async function advanceDemoDuty(client,{workerId}={}){
  if(!/^[-a-f0-9]{36}$/.test(String(workerId||'')))throw Error('DEMO_DUTY_WORKER_INVALID');
  // Do not claim, execute, clear or replay jobs, even if an old control is ON.
  // Supported phone/GPS duty behavior needs a separate exact scenario review.
  const status=await client.rpc('demo_world_duty_status');
  const value=status.data;
  if(status.error||!value||typeof value.enabled!=='boolean'
    ||!Number.isSafeInteger(value.pending_count)||value.pending_count<0
    ||!Number.isSafeInteger(value.exhausted_count)||value.exhausted_count<0
    ||![null,'OFF_DUTY','RESTORE'].includes(value.last_completed_phase)){
    throw Error('DEMO_DUTY_STATUS_INVALID');
  }
  return {
    duty_accepted:0,duty_completed:0,duty_replayed:0,
    duty_state:'HELD',duty_hold_reason:'MANUAL_LOCATION_RETIRED',
    duty_enabled:value.enabled,duty_pending_count:value.pending_count,
    duty_exhausted_count:value.exhausted_count,
    duty_last_completed_phase:value.last_completed_phase
  };
}
