import {randomUUID} from 'node:crypto';
import {
  DEMO_WORLD_ADVANCE_PATH,
  DEMO_CAPACITY_ADVANCE_PATH,
  DEMO_WORLD_BATCH_LIMIT,
  DEMO_WORLD_SIGNATURE_HEADER,
  DEMO_WORLD_TIMESTAMP_HEADER,
  verifyDemoWorldSignature
} from './demo-world-worker-auth.js';
import {advanceDemoBusinessShare} from './demo-world-business-share-advance.js';
import {advanceDemoProfile} from './demo-world-profile-advance.js';
import {advanceDemoTeam} from './demo-world-team-advance.js';
import {advanceDemoDuty} from './demo-world-duty-advance.js';

const MAX_BODY_BYTES=64;
/** @type {() => import('@supabase/supabase-js').SupabaseClient} */
const unavailableClient=()=>{throw Error('DEMO_WORLD_STORAGE_UNAVAILABLE');};

function rows(result){
  if(result.error||!Array.isArray(result.data))throw Error('DEMO_WORLD_STORAGE_UNAVAILABLE');
  return result.data;
}

function boundedStatus(result){
  const value=result?.data;
  if(result?.error||!value||typeof value.enabled!=='boolean')throw Error('DEMO_WORLD_STATUS_UNAVAILABLE');
  for(const field of ['pending_count','oldest_due_age_seconds','exhausted_count']){
    if(!Number.isSafeInteger(value[field])||value[field]<0)throw Error('DEMO_WORLD_STATUS_INVALID');
  }
  if(value.oldest_due_age_seconds>604800)throw Error('DEMO_WORLD_STATUS_INVALID');
  if(value.catalog_version!==undefined&&(value.catalog_version!==2
    ||!Number.isSafeInteger(value.paused_count)||value.paused_count<0||value.paused_count>5))
    throw Error('DEMO_WORLD_STATUS_INVALID');
  return {
    database_enabled:value.enabled,
    pending_count:value.pending_count,
    oldest_due_age_seconds:value.oldest_due_age_seconds,
    exhausted_count:value.exhausted_count,
    ...(value.catalog_version===2?{catalog_version:2,paused_target_count:value.paused_count}:{})
  };
}

function boundedHandoverStatus(result){
  const value=result?.data;
  if(result?.error||!value||typeof value.enabled!=='boolean'
    ||!Number.isSafeInteger(value.pending_count)||value.pending_count<0
    ||(value.last_completed_day!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(String(value.last_completed_day)))
    ||!/^\d{4}-\d{2}-\d{2}$/.test(String(value.next_scheduled_day))){
    throw Error('DEMO_WORLD_HANDOVER_STATUS_INVALID');
  }
  return {handover_pending_count:value.pending_count,
    handover_last_completed_day:value.last_completed_day,
    handover_next_scheduled_day:value.next_scheduled_day};
}

function pauseReason(error){
  const code=String(error?.message||'').match(/\bDEMO_WORLD_[A-Z_]+\b/)?.[0];
  if(['DEMO_WORLD_ACTOR_REFUSED','DEMO_WORLD_DRIVER_REFUSED','DEMO_WORLD_TARGET_REFUSED'].includes(code))return 'AUTHORITY_CHANGED';
  if(code==='DEMO_WORLD_REAL_DEVICE_TAKEOVER')return 'HUMAN_TAKEOVER';
  if(['DEMO_WORLD_STATE_CHANGED','DEMO_WORLD_PREDECESSOR_CHANGED','DEMO_WORLD_BOOTSTRAP_REFUSED',
    'DEMO_WORLD_PERCENT_STATE_CHANGED','DEMO_WORLD_ROUTE_REFUSED','DEMO_WORLD_SHARING_REFUSED',
    'DEMO_WORLD_GEOMETRY_REFUSED','DEMO_WORLD_LOAD_REFUSED','DEMO_WORLD_CATALOG_REFUSED',
    'DEMO_WORLD_READBACK_DRIFT'].includes(code))return 'STATE_DRIFT';
  return null;
}

/** One due phase per target; a rejected actor never blocks the other claimed actors. */
export async function advanceDemoCapacity(client,{limit=DEMO_WORLD_BATCH_LIMIT,workerId=randomUUID()}={}){
  if(!Number.isInteger(limit)||limit<1||limit>DEMO_WORLD_BATCH_LIMIT
    ||!/^[-a-f0-9]{36}$/.test(workerId))throw Error('DEMO_WORLD_BATCH_INVALID');
  const claimed=rows(await client.rpc('demo_world_claim_batch',{
    worker_id:workerId,batch_size:limit
  }));
  if(claimed.length>limit||claimed.some(step=>!Number.isSafeInteger(Number(step.step_id))
    ||Number(step.step_id)<1||!/^\d+$/.test(String(step.step_id))
    ||!/^[-a-f0-9]{36}$/.test(String(step.lease_token||'')))
    ||new Set(claimed.map(step=>String(step.step_id))).size!==claimed.length){
    throw Error('DEMO_WORLD_CLAIM_INVALID');
  }
  let completed=0,skipped=0,failed=0,paused=0;
  for(const step of claimed){
    try{
      const result=await client.rpc('demo_world_execute_capacity_step',{
        step_id:Number(step.step_id),lease_token:step.lease_token
      });
      if(result.error){
        failed++;
        const reason=pauseReason(result.error);
        if(reason){
          try{
            const saved=await client.rpc('demo_world_pause_step',{
              step_id:Number(step.step_id),lease_token:step.lease_token,reason
            });
            if(!saved.error&&saved.data?.paused===true)paused++;
          }catch{/* A lost pause response cannot justify replaying the mutation. */}
        }
      }else if(result.data?.result==='APPLIED')completed++;
      else if(result.data?.result==='REPLAYED'||result.data?.result==='SKIPPED')skipped++;
      else failed++;
    }catch{
      // Transport failures retain the current lease for bounded expiry/retry.
      failed++;
    }
  }
  return {accepted:claimed.length,completed,skipped,failed,paused,
    ...boundedStatus(await client.rpc('demo_world_status'))};
}

/** The legacy fifteen-minute dispatcher keeps infrequent lanes separate. */
export async function advanceDemoWorld(client,{limit=DEMO_WORLD_BATCH_LIMIT,workerId=randomUUID()}={}){
  if(!Number.isInteger(limit)||limit<1||limit>DEMO_WORLD_BATCH_LIMIT
    ||!/^[-a-f0-9]{36}$/.test(workerId))throw Error('DEMO_WORLD_BATCH_INVALID');
  // The infrequent credential cannot perform fast Capacity writes indirectly.
  const capacity={accepted:0,completed:0,skipped:0,failed:0,paused:0,
    ...boundedStatus(await client.rpc('demo_world_status'))};
  // The historical handover selects new Manual points. Hold it before claim so
  // no attempt/lease/job state changes and independent supported lanes continue.
  // Database source retirement remains the direct-command write boundary.
  const handoverStatus=boundedHandoverStatus(await client.rpc('demo_world_handover_status'));
  const businessShare=await advanceDemoBusinessShare(client,{workerId});
  const profile=await advanceDemoProfile(client,{workerId});
  const team=await advanceDemoTeam(client,{workerId});
  const duty=await advanceDemoDuty(client,{workerId});
  return {...capacity,
    handover_accepted:0,handover_completed:0,
    handover_state:'HELD',handover_hold_reason:'MANUAL_LOCATION_RETIRED',
    ...handoverStatus,...businessShare,...profile,...team,...duty};
}

async function boundedBody(request){
  if(!request.body||Number(request.headers.get('content-length')||0)>MAX_BODY_BYTES){
    throw Error('DEMO_WORLD_REQUEST_INVALID');
  }
  const reader=request.body.getReader(),chunks=[];let length=0;
  try{
    for(;;){
      const part=await reader.read();if(part.done)break;
      length+=part.value.byteLength;
      if(length>MAX_BODY_BYTES){await reader.cancel();throw Error('DEMO_WORLD_REQUEST_INVALID');}
      chunks.push(part.value);
    }
  }finally{reader.releaseLock();}
  return Buffer.concat(chunks).toString('utf8');
}

/** HMAC-gated HTTP adapter; malformed or disabled requests never open the database. */
async function handleAdvance(request,{
  environment=process.env,clientFactory=unavailableClient,now=Date.now()
}={},capacityOnly=false){
  const path=capacityOnly?DEMO_CAPACITY_ADVANCE_PATH:DEMO_WORLD_ADVANCE_PATH;
  if(request?.method!=='POST'||new URL(request.url).pathname!==path){
    return Response.json({ok:false,code:'NOT_FOUND'},{status:404,headers:{'Cache-Control':'no-store'}});
  }
  let body;
  try{body=await boundedBody(request);}catch{
    return Response.json({ok:false,code:'INVALID_REQUEST'},{status:400,headers:{'Cache-Control':'no-store'}});
  }
  if(!verifyDemoWorldSignature({
    timestamp:request.headers.get(DEMO_WORLD_TIMESTAMP_HEADER),
    signature:request.headers.get(DEMO_WORLD_SIGNATURE_HEADER),
    url:request.url,purpose:capacityOnly?'capacity-advance':'advance',body
  },environment,now)){
    return Response.json({ok:false,code:'UNAUTHORIZED'},{status:401,headers:{'Cache-Control':'no-store'}});
  }
  let input;
  try{input=JSON.parse(body);}catch{input=null;}
  if(!input||Object.keys(input).length!==1||(capacityOnly
    ?!Number.isInteger(input.limit)||input.limit<1||input.limit>DEMO_WORLD_BATCH_LIMIT
    :input.limit!==DEMO_WORLD_BATCH_LIMIT)){
    return Response.json({ok:false,code:'INVALID_REQUEST'},{status:400,headers:{'Cache-Control':'no-store'}});
  }
  try{
    const outcome=await (capacityOnly?advanceDemoCapacity:advanceDemoWorld)(clientFactory(),{limit:input.limit});
    if(capacityOnly&&outcome.catalog_version!==2)throw Error('DEMO_WORLD_STATUS_INVALID');
    return Response.json({ok:true,...outcome},{headers:{'Cache-Control':'no-store'}});
  }catch{
    return Response.json({ok:false,code:'DEMO_WORLD_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}

export const handleDemoWorldAdvance=(request,options)=>handleAdvance(request,options,false);
export const handleDemoCapacityAdvance=(request,options)=>handleAdvance(request,options,true);
