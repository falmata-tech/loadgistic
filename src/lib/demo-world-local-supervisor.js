import {assertLocalAuthorityFixtureTarget} from '../../scripts/fixture-provider-authority.mjs';

export function localDemoSupervisorConfig(environment){
  const url=assertLocalAuthorityFixtureTarget(environment.SUPABASE_SEED_URL||environment.NEXT_PUBLIC_SUPABASE_URL,
    {nodeEnv:environment.NODE_ENV});
  const key=environment.SUPABASE_SEED_SERVICE_ROLE_KEY||environment.SUPABASE_SERVICE_ROLE_KEY;
  if(typeof key!=='string'||key.length<20)throw Error('DEMO_WORLD_LOCAL_CREDENTIAL_MISSING');
  return {url,key};
}

export function localDemoSupervisorDuration(seconds,intervalSeconds){
  if(!Number.isInteger(seconds)||seconds<5||seconds>3600
    ||!Number.isInteger(intervalSeconds)||intervalSeconds<2||intervalSeconds>300
    ||Math.ceil(seconds/intervalSeconds)>120)throw Error('DEMO_WORLD_LOCAL_DURATION_INVALID');
  return {durationMs:seconds*1000,intervalMs:intervalSeconds*1000};
}

export function localDemoSupervisorProcessAlive(pid,probe=process.kill){
  if(!Number.isSafeInteger(pid)||pid<1)return false;
  try{probe(pid,0);return true;}catch(error){return error?.code==='EPERM';}
}

export function localDemoSupervisorCanRecover(state,spawn,now=Date.now(),probe=process.kill){
  if(!state||!/^[-a-f0-9]{36}$/.test(state.runId||'')
    ||spawn?.runId!==state.runId||localDemoSupervisorProcessAlive(spawn?.pid,probe)
    ||localDemoSupervisorProcessAlive(state.pid,probe))return false;
  if(state.state==='PAUSED'||state.state==='STOPPED')return true;
  const changed=Date.parse(state.updatedAt||state.startedAt);
  return ['STARTING','RUNNING'].includes(state.state)&&Number.isFinite(changed)
    &&now-changed>=15_000;
}

export async function localDemoSupervisorPreflight(client){
  const [capacity,sharing]=await Promise.all([
    client.rpc('demo_world_status'),client.rpc('demo_world_business_share_status')
  ]);
  if(capacity.error||sharing.error||typeof capacity.data?.enabled!=='boolean'
    ||typeof sharing.data?.enabled!=='boolean'
    ||typeof sharing.data?.target_bound!=='boolean')throw Error('DEMO_WORLD_LOCAL_STATUS_UNAVAILABLE');
  if(sharing.data.enabled&&!sharing.data.target_bound)throw Error('DEMO_WORLD_LOCAL_SHARE_UNBOUND');
  if(!capacity.data.enabled&&!sharing.data.enabled)throw Error('DEMO_WORLD_LOCAL_CONTROLS_OFF');
  return {capacityEnabled:capacity.data.enabled,sharingEnabled:sharing.data.enabled};
}

export async function runLocalDemoSupervisor({advance,signal,onTick,seconds,intervalSeconds,
  now=()=>Date.now(),sleep=defaultSleep}){
  const {durationMs,intervalMs}=localDemoSupervisorDuration(seconds,intervalSeconds);
  const deadline=now()+durationMs;
  let ticks=0,completed=0,sharingCompleted=0;
  while(!signal.aborted&&now()<deadline){
    const result=await advance();
    if(!Number.isSafeInteger(result?.completed)||result.completed<0
      ||!Number.isSafeInteger(result?.business_share_completed)||result.business_share_completed<0){
      throw Error('DEMO_WORLD_LOCAL_RESULT_INVALID');
    }
    ticks++;completed+=result.completed;sharingCompleted+=result.business_share_completed;
    await onTick({ticks,completed,sharingCompleted});
    if(signal.aborted||now()>=deadline)break;
    await sleep(Math.min(intervalMs,Math.max(0,deadline-now())),signal);
  }
  return {ticks,completed,sharingCompleted,stopped:signal.aborted};
}

function defaultSleep(ms,signal){
  return new Promise(resolve=>{
    if(signal.aborted||ms<=0){resolve();return;}
    const timer=setTimeout(done,ms);
    function done(){clearTimeout(timer);signal.removeEventListener('abort',done);resolve();}
    signal.addEventListener('abort',done,{once:true});
  });
}
