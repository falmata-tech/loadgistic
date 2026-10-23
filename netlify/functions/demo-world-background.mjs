import {
  createDemoWorldSignature,demoWorldOrigin,demoWorldWorkerEnabled,verifyDemoWorldSignature,
  DEMO_WORLD_ADVANCE_PATH,DEMO_WORLD_BACKGROUND_PATH,DEMO_WORLD_BATCH_LIMIT,
  DEMO_WORLD_SIGNATURE_HEADER,DEMO_WORLD_TIMESTAMP_HEADER
} from '../../src/lib/demo-world-worker-auth.js';

function boundedSummary(value){
  const counts={};
  for(const key of ['accepted','completed','skipped','failed']){
    const count=value?.[key];
    if(!Number.isSafeInteger(count)||count<0||count>DEMO_WORLD_BATCH_LIMIT)throw Error('DEMO_WORLD_SUMMARY_INVALID');
    counts[key]=count;
  }
  if(counts.accepted!==counts.completed+counts.skipped+counts.failed)throw Error('DEMO_WORLD_SUMMARY_INVALID');
  if(typeof value?.database_enabled!=='boolean')throw Error('DEMO_WORLD_HEALTH_INVALID');
  for(const key of ['pending_count','oldest_due_age_seconds','exhausted_count']){
    if(!Number.isSafeInteger(value[key])||value[key]<0)throw Error('DEMO_WORLD_HEALTH_INVALID');
  }
  if(value.oldest_due_age_seconds>604800)throw Error('DEMO_WORLD_HEALTH_INVALID');
  for(const key of ['handover_accepted','handover_completed','handover_pending_count']){
    if(!Number.isSafeInteger(value[key])||value[key]<0)throw Error('DEMO_WORLD_HEALTH_INVALID');
  }
  if(value.handover_accepted>1||value.handover_completed>value.handover_accepted
    ||(value.handover_last_completed_day!==null
      &&!/^\d{4}-\d{2}-\d{2}$/.test(String(value.handover_last_completed_day)))
    ||!/^\d{4}-\d{2}-\d{2}$/.test(String(value.handover_next_scheduled_day))){
    throw Error('DEMO_WORLD_HEALTH_INVALID');
  }
  for(const key of ['business_share_accepted','business_share_completed','business_share_replayed',
    'business_share_pending_count','business_share_exhausted_count']){
    if(!Number.isSafeInteger(value[key])||value[key]<0)throw Error('DEMO_WORLD_HEALTH_INVALID');
  }
  if(value.business_share_accepted>1
    ||value.business_share_completed+value.business_share_replayed>value.business_share_accepted
    ||typeof value.business_share_enabled!=='boolean'
    ||typeof value.business_share_target_bound!=='boolean'
    ||![null,'GRANT','REVOKE'].includes(value.business_share_last_completed_phase)){
    throw Error('DEMO_WORLD_HEALTH_INVALID');
  }
  for(const key of ['profile_accepted','profile_completed','profile_replayed',
    'profile_pending_count','profile_exhausted_count']){
    if(!Number.isSafeInteger(value[key])||value[key]<0)throw Error('DEMO_WORLD_HEALTH_INVALID');
  }
  if(value.profile_accepted>1
    ||value.profile_completed+value.profile_replayed>value.profile_accepted
    ||typeof value.profile_enabled!=='boolean'
    ||typeof value.profile_target_bound!=='boolean'
    ||![null,'SHOW_DEMO','RESTORE'].includes(value.profile_last_completed_phase)){
    throw Error('DEMO_WORLD_HEALTH_INVALID');
  }
  for(const key of ['team_accepted','team_completed','team_replayed',
    'team_pending_count','team_exhausted_count']){
    if(!Number.isSafeInteger(value[key])||value[key]<0)throw Error('DEMO_WORLD_HEALTH_INVALID');
  }
  if(value.team_accepted>1
    ||value.team_completed+value.team_replayed>value.team_accepted
    ||typeof value.team_enabled!=='boolean'
    ||typeof value.team_target_bound!=='boolean'
    ||![null,'CAPACITY_OFF','CAPACITY_ON'].includes(value.team_last_completed_phase)){
    throw Error('DEMO_WORLD_HEALTH_INVALID');
  }
  for(const key of ['duty_accepted','duty_completed','duty_replayed',
    'duty_pending_count','duty_exhausted_count']){
    if(!Number.isSafeInteger(value[key])||value[key]<0)throw Error('DEMO_WORLD_HEALTH_INVALID');
  }
  if(value.duty_accepted>1
    ||value.duty_completed+value.duty_replayed>value.duty_accepted
    ||typeof value.duty_enabled!=='boolean'
    ||![null,'OFF_DUTY','RESTORE'].includes(value.duty_last_completed_phase)){
    throw Error('DEMO_WORLD_HEALTH_INVALID');
  }
  return {
    ...counts,database_enabled:value.database_enabled,
    pending_count:value.pending_count,
    oldest_due_age_seconds:value.oldest_due_age_seconds,
    exhausted_count:value.exhausted_count,
    handover_accepted:value.handover_accepted,
    handover_completed:value.handover_completed,
    handover_pending_count:value.handover_pending_count,
    handover_last_completed_day:value.handover_last_completed_day,
    handover_next_scheduled_day:value.handover_next_scheduled_day,
    business_share_accepted:value.business_share_accepted,
    business_share_completed:value.business_share_completed,
    business_share_replayed:value.business_share_replayed,
    business_share_enabled:value.business_share_enabled,
    business_share_target_bound:value.business_share_target_bound,
    business_share_pending_count:value.business_share_pending_count,
    business_share_exhausted_count:value.business_share_exhausted_count,
    business_share_last_completed_phase:value.business_share_last_completed_phase,
    profile_accepted:value.profile_accepted,
    profile_completed:value.profile_completed,
    profile_replayed:value.profile_replayed,
    profile_enabled:value.profile_enabled,
    profile_target_bound:value.profile_target_bound,
    profile_pending_count:value.profile_pending_count,
    profile_exhausted_count:value.profile_exhausted_count,
    profile_last_completed_phase:value.profile_last_completed_phase,
    team_accepted:value.team_accepted,
    team_completed:value.team_completed,
    team_replayed:value.team_replayed,
    team_enabled:value.team_enabled,
    team_target_bound:value.team_target_bound,
    team_pending_count:value.team_pending_count,
    team_exhausted_count:value.team_exhausted_count,
    team_last_completed_phase:value.team_last_completed_phase,
    duty_accepted:value.duty_accepted,
    duty_completed:value.duty_completed,
    duty_replayed:value.duty_replayed,
    duty_enabled:value.duty_enabled,
    duty_pending_count:value.duty_pending_count,
    duty_exhausted_count:value.duty_exhausted_count,
    duty_last_completed_phase:value.duty_last_completed_phase
  };
}

export async function runDemoWorldBatch({environment=process.env,fetchImpl=fetch,now=Date.now()}={}){
  if(!demoWorldWorkerEnabled(environment))return {enabled:false};
  const target=new URL(DEMO_WORLD_ADVANCE_PATH,demoWorldOrigin(environment));
  const timestamp=String(now);
  const body=JSON.stringify({limit:DEMO_WORLD_BATCH_LIMIT});
  const response=await fetchImpl(target,{
    method:'POST',body,
    redirect:'error',
    headers:{
      'content-type':'application/json',
      [DEMO_WORLD_TIMESTAMP_HEADER]:timestamp,
      [DEMO_WORLD_SIGNATURE_HEADER]:createDemoWorldSignature({timestamp,url:target.href,purpose:'advance',body},environment)
    },
    signal:AbortSignal.timeout(25_000)
  });
  if(!response.ok)throw Error('DEMO_WORLD_BATCH_FAILED');
  return {enabled:true,...boundedSummary(await response.json())};
}

export async function executeDemoWorldBackground(request,{
  environment=process.env,runBatch=runDemoWorldBatch,now=Date.now()
}={}){
  if(!demoWorldWorkerEnabled(environment))return new Response(null,{status:204});
  const authorized=request?.method==='POST'
    &&new URL(request.url).pathname===DEMO_WORLD_BACKGROUND_PATH
    &&verifyDemoWorldSignature({
      timestamp:request.headers.get(DEMO_WORLD_TIMESTAMP_HEADER),
      signature:request.headers.get(DEMO_WORLD_SIGNATURE_HEADER),
      url:request.url,purpose:'dispatch'
    },environment,now);
  if(!authorized){
    console.warn(JSON.stringify({event:'demo-world-background',ok:false,error:'UNAUTHORIZED'}));
    return new Response(null,{status:401});
  }
  try{
    const result=await runBatch({environment,now});
    if(result.enabled){
      const counts=boundedSummary(result);
      console.info(JSON.stringify({event:'demo-world-background',ok:true,...counts}));
    }
  }catch{
    console.error(JSON.stringify({event:'demo-world-background',ok:false,error:'BATCH_FAILED'}));
  }
  return new Response(null,{status:204});
}

export default async function(request){return executeDemoWorldBackground(request);}

export const config={background:true};
