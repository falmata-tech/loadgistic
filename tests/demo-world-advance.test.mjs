import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEMO_WORLD_ADVANCE_PATH,
  DEMO_WORLD_SIGNATURE_HEADER,
  DEMO_WORLD_TIMESTAMP_HEADER,
  createDemoWorldSignature
} from '../src/lib/demo-world-worker-auth.js';
import {advanceDemoWorld,advanceDemoCapacity,handleDemoWorldAdvance} from '../src/lib/demo-world-advance.js';

const origin='https://loadgistic.example';
const url=`${origin}${DEMO_WORLD_ADVANCE_PATH}`;
const environment={
  LOADGISTIC_DEMO_WORLD_ENABLED:'true',LOADGISTIC_DEMO_WORLD_KILL_SWITCH:'false',
  LOADGISTIC_DEMO_WORLD_SITE_ORIGIN:origin,DEMO_WORLD_WORKER_SECRET:'a'.repeat(64),
  LOADGISTIC_DEMO_WORLD_SITE_ID:'1d01c0c0-4554-4747-93b8-34ce3448ab95',
  URL:origin,SITE_ID:'1d01c0c0-4554-4747-93b8-34ce3448ab95',
  SESSION_SECRET:'b'.repeat(64),CONTEXT:'production',NODE_ENV:'production'
};
const body='{"limit":5}';
const disabledProfile={enabled:false,target_bound:false,pending_count:0,
  exhausted_count:0,last_completed_phase:null};
const disabledDuty={enabled:false,pending_count:0,exhausted_count:0,last_completed_phase:null};

function signedRequest({payload=body,env=environment,at=Date.now(),signature}={}){
  const timestamp=String(at);
  return new Request(url,{method:'POST',body:payload,headers:{
    [DEMO_WORLD_TIMESTAMP_HEADER]:timestamp,
    [DEMO_WORLD_SIGNATURE_HEADER]:signature??createDemoWorldSignature({timestamp,url,purpose:'advance',body:payload},environment)
  }});
}

test('the infrequent signed worker reads Capacity health without claiming fast work',async()=>{
  const calls=[];
  const client={rpc:async(name,args)=>{
    calls.push({name,args});
    if(name==='demo_world_claim_batch')return {data:[{step_id:1,lease_token:'11111111-1111-4111-8111-111111111111'}],error:null};
    if(name==='demo_world_claim_handover')return {data:[],error:null};
    if(name==='demo_world_status')return {data:{enabled:true,pending_count:3,oldest_due_age_seconds:420,exhausted_count:0},error:null};
    if(name==='demo_world_handover_status')return {data:{enabled:true,pending_count:0,last_completed_day:null,next_scheduled_day:'2026-10-26'},error:null};
    if(name==='demo_world_claim_business_share')return {data:[],error:null};
    if(name==='demo_world_business_share_status')return {data:{enabled:false,target_bound:false,pending_count:0,exhausted_count:0,last_completed_phase:null},error:null};
    if(name==='demo_world_claim_profile')return {data:[],error:null};
    if(name==='demo_world_profile_status')return {data:disabledProfile,error:null};
    if(name==='demo_world_claim_team')return {data:[],error:null};
    if(name==='demo_world_team_status')return {data:disabledProfile,error:null};
    if(name==='demo_world_claim_duty')return {data:[],error:null};
    if(name==='demo_world_duty_status')return {data:disabledDuty,error:null};
    return {data:{result:'APPLIED'},error:null};
  }};
  const response=await handleDemoWorldAdvance(signedRequest(),{
    environment,clientFactory:()=>client
  });
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{ok:true,accepted:0,completed:0,skipped:0,failed:0,paused:0,
    handover_accepted:0,handover_completed:0,handover_state:'HELD',handover_hold_reason:'MANUAL_LOCATION_RETIRED',database_enabled:true,pending_count:3,
    oldest_due_age_seconds:420,exhausted_count:0,handover_pending_count:0,
    handover_last_completed_day:null,handover_next_scheduled_day:'2026-10-26',
    business_share_accepted:0,business_share_completed:0,business_share_replayed:0,
    business_share_enabled:false,business_share_target_bound:false,
    business_share_pending_count:0,business_share_exhausted_count:0,
    business_share_last_completed_phase:null,
    profile_accepted:0,profile_completed:0,profile_replayed:0,
    profile_enabled:false,profile_target_bound:false,profile_pending_count:0,
    profile_exhausted_count:0,profile_last_completed_phase:null,
    team_accepted:0,team_completed:0,team_replayed:0,
    team_enabled:false,team_target_bound:false,team_pending_count:0,
    team_exhausted_count:0,team_last_completed_phase:null,
    duty_accepted:0,duty_completed:0,duty_replayed:0,duty_state:'HELD',duty_hold_reason:'MANUAL_LOCATION_RETIRED',duty_enabled:false,
    duty_pending_count:0,duty_exhausted_count:0,duty_last_completed_phase:null});
  assert.equal(calls.length,9);
  assert.deepEqual(calls.map(call=>call.name),[
    'demo_world_status','demo_world_handover_status',
    'demo_world_claim_business_share','demo_world_business_share_status',
    'demo_world_claim_profile','demo_world_profile_status',
    'demo_world_claim_team','demo_world_team_status','demo_world_duty_status']);
});

test('infrequent lanes preserve held work without indirect Capacity authority',async()=>{
  const saved={handover:{enabled:true,pending_count:5,last_completed_day:'2026-10-26',next_scheduled_day:'2026-11-09'},
    duty:{enabled:true,pending_count:2,exhausted_count:1,last_completed_phase:'OFF_DUTY'}};
  const before=structuredClone(saved),calls=[];
  const client={rpc:async(name,args)=>{
    calls.push({name,args});
    assert.equal(/(?:claim|execute)_(?:handover|duty)/.test(name),false,'held jobs must stay untouched');
    if(name==='demo_world_claim_batch')return {data:[{step_id:1,lease_token:'11111111-1111-4111-8111-111111111111'}],error:null};
    if(name==='demo_world_execute_capacity_step')return {data:{result:'APPLIED'},error:null};
    if(name==='demo_world_status')return {data:{enabled:true,pending_count:0,oldest_due_age_seconds:0,exhausted_count:0},error:null};
    if(name==='demo_world_handover_status')return {data:saved.handover,error:null};
    if(name==='demo_world_duty_status')return {data:saved.duty,error:null};
    if(['demo_world_claim_business_share','demo_world_claim_profile','demo_world_claim_team'].includes(name))return {data:[],error:null};
    if(['demo_world_business_share_status','demo_world_profile_status','demo_world_team_status'].includes(name))return {data:disabledProfile,error:null};
    throw Error('UNEXPECTED_RPC');
  }};
  const result=await advanceDemoWorld(client);
  assert.equal(result.completed,0);assert.equal(result.accepted,0);assert.equal(result.handover_completed,0);assert.equal(result.handover_accepted,0);
  assert.equal(result.handover_state,'HELD');assert.equal(result.handover_hold_reason,'MANUAL_LOCATION_RETIRED');
  assert.equal(result.handover_pending_count,5);assert.equal(result.duty_pending_count,2);assert.equal(result.duty_exhausted_count,1);
  assert.equal(result.duty_accepted,0);assert.equal(result.duty_completed,0);assert.equal(result.duty_replayed,0);
  assert.equal(result.duty_state,'HELD');assert.equal(result.duty_hold_reason,'MANUAL_LOCATION_RETIRED');
  assert.deepEqual(saved,before);
});

test('due broker sharing runs only the database-chosen grant after other demo work',async()=>{
  const calls=[];
  const client={rpc:async(name,args)=>{
    calls.push({name,args});
    if(name==='demo_world_claim_batch'||name==='demo_world_claim_handover')return {data:[],error:null};
    if(name==='demo_world_status')return {data:{enabled:false,pending_count:0,oldest_due_age_seconds:0,exhausted_count:0},error:null};
    if(name==='demo_world_handover_status')return {data:{enabled:false,pending_count:0,last_completed_day:null,next_scheduled_day:'2026-10-26'},error:null};
    if(name==='demo_world_claim_business_share')return {data:[{job_id:31,lease_token:'33333333-3333-4333-8333-333333333333'}],error:null};
    if(name==='demo_world_execute_business_share')return {data:{result:'APPLIED',phase:'GRANT'},error:null};
    if(name==='demo_world_business_share_status')return {data:{enabled:true,target_bound:true,pending_count:0,exhausted_count:0,last_completed_phase:'GRANT'},error:null};
    if(name==='demo_world_claim_profile')return {data:[],error:null};
    if(name==='demo_world_profile_status')return {data:disabledProfile,error:null};
    if(name==='demo_world_claim_team')return {data:[],error:null};
    if(name==='demo_world_team_status')return {data:disabledProfile,error:null};
    if(name==='demo_world_claim_duty')return {data:[],error:null};
    if(name==='demo_world_duty_status')return {data:disabledDuty,error:null};
    throw Error('UNEXPECTED_RPC');
  }};
  const result=await advanceDemoWorld(client);
  assert.equal(result.business_share_completed,1);
  assert.equal(result.business_share_last_completed_phase,'GRANT');
  assert.deepEqual(calls.map(row=>row.name),[
    'demo_world_status',
    'demo_world_handover_status','demo_world_claim_business_share',
    'demo_world_execute_business_share','demo_world_business_share_status',
    'demo_world_claim_profile','demo_world_profile_status',
    'demo_world_claim_team','demo_world_team_status',
    'demo_world_duty_status']);
  assert.deepEqual(calls[3].args,{job_id:31,lease_token:'33333333-3333-4333-8333-333333333333'});
});

test('due broker staff permission uses only the leased team job',async()=>{
  const calls=[];
  const client={rpc:async(name,args)=>{
    calls.push({name,args});
    if(name==='demo_world_claim_batch'||name==='demo_world_claim_handover'
      ||name==='demo_world_claim_business_share'||name==='demo_world_claim_profile')return {data:[],error:null};
    if(name==='demo_world_status')return {data:{enabled:true,pending_count:0,oldest_due_age_seconds:0,exhausted_count:0},error:null};
    if(name==='demo_world_handover_status')return {data:{enabled:true,pending_count:0,last_completed_day:null,next_scheduled_day:'2026-10-26'},error:null};
    if(name==='demo_world_business_share_status'||name==='demo_world_profile_status')return {data:disabledProfile,error:null};
    if(name==='demo_world_claim_team')return {data:[{job_id:41,lease_token:'44444444-4444-4444-8444-444444444444'}],error:null};
    if(name==='demo_world_execute_team')return {data:{result:'APPLIED',phase:'CAPACITY_OFF'},error:null};
    if(name==='demo_world_team_status')return {data:{...disabledProfile,enabled:true,target_bound:true,last_completed_phase:'CAPACITY_OFF'},error:null};
    if(name==='demo_world_claim_duty')return {data:[],error:null};
    if(name==='demo_world_duty_status')return {data:disabledDuty,error:null};
    throw Error('UNEXPECTED_RPC');
  }};
  const result=await advanceDemoWorld(client);
  assert.equal(result.team_completed,1);
  assert.equal(result.team_last_completed_phase,'CAPACITY_OFF');
  assert.deepEqual(calls.at(-3),{name:'demo_world_execute_team',
    args:{job_id:41,lease_token:'44444444-4444-4444-8444-444444444444'}});
  assert.equal(calls.at(-2).name,'demo_world_team_status');
});

test('disabled, stale, forged and malformed requests cannot open database',async()=>{
  let opened=0;
  const clientFactory=()=>{opened++;throw Error('MUST_NOT_OPEN');};
  const attempts=[
    [signedRequest(),{...environment,LOADGISTIC_DEMO_WORLD_ENABLED:'false'},Date.now()],
    [signedRequest({at:Date.now()-180_000}),environment,Date.now()],
    [signedRequest({signature:'0'.repeat(64)}),environment,Date.now()],
    [signedRequest({payload:'{"limit":100}'}),environment,Date.now()],
    [signedRequest({payload:'{"limit":5,"actor":"anything"}'}),environment,Date.now()]
  ];
  for(const [request,env,now] of attempts){
    const response=await handleDemoWorldAdvance(request,{environment:env,clientFactory,now});
    assert.notEqual(response.status,200);
  }
  assert.equal(opened,0);
});

test('database claim and execution faults remain private and fail closed',async()=>{
  for(const rpc of [
    async()=>({data:null,error:{message:'sensitive detail'}}),
    async name=>name==='demo_world_claim_batch'
      ?{data:[{step_id:1,lease_token:'11111111-1111-4111-8111-111111111111'}],error:null}
      :{data:null,error:{message:'sensitive detail'}},
    async name=>name==='demo_world_claim_batch'
      ?{data:[],error:null}
      :name==='demo_world_claim_handover'?{data:[],error:null}
      :{data:{enabled:true,pending_count:-1,oldest_due_age_seconds:0,exhausted_count:0},error:null}
  ]){
    const response=await handleDemoWorldAdvance(signedRequest(),{
      environment,clientFactory:()=>({rpc})
    });
    assert.equal(response.status,503);
    assert.deepEqual(await response.json(),{ok:false,code:'DEMO_WORLD_UNAVAILABLE'});
  }
});

test('held handover malformed readonly status never reports a healthy batch',async()=>{
  for(const data of [null,{enabled:true,pending_count:-1,last_completed_day:null,next_scheduled_day:'2026-10-26'},
    {enabled:true,pending_count:1,last_completed_day:'forged',next_scheduled_day:'2026-10-26'}]){
    const calls=[];
    await assert.rejects(()=>advanceDemoWorld({rpc:async name=>{
      calls.push(name);
      if(name==='demo_world_claim_batch')return {data:[],error:null};
      if(name==='demo_world_status')return {data:{enabled:true,pending_count:0,oldest_due_age_seconds:0,exhausted_count:0},error:null};
      if(name==='demo_world_handover_status')return {data,error:null};
      throw Error('UNEXPECTED_RPC');
    }}),/DEMO_WORLD_HANDOVER_STATUS_INVALID/);
    assert.equal(calls.some(name=>/claim_handover|execute_handover/.test(name)),false);
  }
});

test('claim rejects excess and malformed database rows before execution',async()=>{
  for(const data of [Array.from({length:6},(_,index)=>({step_id:index+1,lease_token:'11111111-1111-4111-8111-111111111111'})),
    [{step_id:1,lease_token:'bad'}],
    [{step_id:1,lease_token:'11111111-1111-4111-8111-111111111111'},
      {step_id:1,lease_token:'22222222-2222-4222-8222-222222222222'}]]){
    let executed=false;
    await assert.rejects(()=>advanceDemoCapacity({rpc:async name=>{
      if(name==='demo_world_claim_batch')return {data,error:null};
      executed=true;return {data:{result:'APPLIED'},error:null};
    }}),/DEMO_WORLD_CLAIM_INVALID/);
    assert.equal(executed,false);
  }
});
