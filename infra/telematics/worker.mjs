import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {signedHeaders,syntheticCommand,correlatedSyntheticResult} from './bridge-contract.mjs';
import {processPositionBatch,runBridgeLanes} from './bridge-processing.mjs';
import {commandsEnabled} from './bridge-command-mode.mjs';
const config={id:process.env.GATEWAY_ID,secret:process.env.GATEWAY_SECRET};
const endpoint=new URL(process.env.LOADGISTIC_GATEWAY_URL||''),commandMode=commandsEnabled(process.env.GATEWAY_COMMANDS_ENABLED);
const api=commandMode?new URL(process.env.TRACCAR_API_URL||''):null;
if(!config.id||!config.secret||config.secret.length<32||endpoint.pathname!=='/api/telematics/gateway'
 ||!['https:','http:'].includes(endpoint.protocol)||endpoint.username||endpoint.password||endpoint.search||endpoint.hash
 ||endpoint.protocol==='http:'&&!['127.0.0.1','localhost','host.docker.internal'].includes(endpoint.hostname))throw new Error('GATEWAY_CONFIG_INVALID');
if(commandMode&&(!['https:','http:'].includes(api.protocol)||api.username||api.password||api.search||api.hash
 ||api.protocol==='http:'&&!['127.0.0.1','localhost','traccar','host.docker.internal'].includes(api.hostname)
 ||!process.env.TRACCAR_API_TOKEN||process.env.TRACCAR_API_TOKEN.length<16))throw new Error('GATEWAY_API_CONFIG_INVALID');
const pool=new pg.Pool({connectionString:process.env.GATEWAY_DATABASE_URL,max:3,connectionTimeoutMillis:5000});
let stopping=false,round=0;const counts={accepted:0,historical:0,duplicate:0,denied:0,retried:0,acknowledged:0};
async function application(message){
 const body=JSON.stringify(message),response=await fetch(endpoint,{method:'POST',headers:signedHeaders(config,body),body,redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('INGEST_UNAVAILABLE');
 const value=await response.json();if(value.ok!==true)throw new Error('INGEST_UNAVAILABLE');return value.data;
}
async function leaseRows(results){
 const lease=randomUUID();
 const {rows}=await pool.query(`with ready as(select id from loadgistic_bridge.outbox where delivered_at is null and next_attempt_at<=now()
  and(lease_until is null or lease_until<now()) and((payload->'attributes' ? 'result')=$2)
  order by id for update skip locked limit 20)
  update loadgistic_bridge.outbox o set lease_id=$1,lease_until=now()+interval '30 seconds',attempts=attempts+1 from ready where o.id=ready.id returning o.id,o.payload`,[lease,results]);
 return {lease,rows};
}
async function settle(lease,row,priority=false){
 if(row.delivery==='RETRY'){
  counts.retried++;await pool.query("update loadgistic_bridge.outbox set lease_until=null,next_attempt_at=now()+least($3,power(2,least(attempts,8))) * interval '1 second' where id=$1 and lease_id=$2",[row.id,lease,priority?4:300]);return;
 }
 await pool.query('update loadgistic_bridge.outbox set delivered_at=now(),lease_until=null,denial_code=$3 where id=$1 and lease_id=$2',[row.id,lease,row.code]);
 if(row.code)counts.denied++;else if(row.outcome==='DUPLICATE')counts.duplicate++;else if(row.outcome==='HISTORICAL')counts.historical++;
 else if(row.outcome==='ACCEPTED')counts.accepted++;
}
async function deliverResults(){
 const {lease,rows}=await leaseRows(true),ready=[];
 for(const row of rows){
  const commandId=correlatedSyntheticResult(row.payload.attributes?.result);
  if(!commandId){await settle(lease,{id:row.id,delivery:'DELIVERED',code:'UNCORRELATED_COMMAND_RESULT'},true);continue;}
  const {rows:dispatches}=await pool.query('select * from loadgistic_bridge.dispatches where command_id=$1 and gateway_device_id=$2',[commandId,row.payload.deviceId]);
  if(!dispatches.length){await settle(lease,{id:row.id,delivery:'DELIVERED',code:'UNCORRELATED_COMMAND_RESULT'},true);continue;}
  ready.push({row,job:dispatches[0],commandId});
 }
 if(!ready.length)return;
 let recorded;try{recorded=await application({action:'RESULT',results:ready.map(({row,job,commandId})=>({commandId,leaseId:job.lease_id,state:'ACKNOWLEDGED',correlated:true,eventKey:`position:${row.payload.id}`}))});}
 catch{for(const {row} of ready)await settle(lease,{id:row.id,delivery:'RETRY',code:null},true);return;}
 for(let index=0;index<ready.length;index++){
  const {row,commandId}=ready[index],result=Array.isArray(recorded)?recorded[index]:null;
  if(!result||result.id!==commandId){await settle(lease,{id:row.id,delivery:'RETRY',code:null},true);continue;}
  const state=result.state==='ACKNOWLEDGED'?'ACKNOWLEDGED':'UNKNOWN';
  await pool.query('update loadgistic_bridge.dispatches set state=$2 where command_id=$1',[commandId,state]);
  if(state==='ACKNOWLEDGED')counts.acknowledged++;
  await settle(lease,{id:row.id,delivery:'DELIVERED',code:state==='ACKNOWLEDGED'?null:'COMMAND_RESULT_NOT_CURRENT'},true);
 }
 // Command responses are events only; their copied saved fixes never reach POSITION.
}
async function deliverPositions(){
 const {lease,rows}=await leaseRows(false);
 await processPositionBatch(rows,positions=>application({action:'POSITION',positions}),row=>settle(lease,row));
}
async function dispatch(){
 const jobs=await application({action:'CLAIM_COMMANDS'});
 for(const job of jobs){let state='UNKNOWN';
  const inserted=await pool.query("insert into loadgistic_bridge.dispatches(command_id,lease_id,gateway_device_id,expires_at,state) values($1,$2,$3,$4,'CLAIMED') on conflict do nothing returning command_id",[job.id,job.leaseId,job.gatewayDeviceId,job.expiresAt]);
  if(!inserted.rows.length)continue; // Crash after dispatch is never retried blindly.
  try{
   const body=syntheticCommand(job),response=await fetch(new URL('commands/send',api),{method:'POST',
    headers:{Authorization:`Bearer ${process.env.TRACCAR_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(5000)});
   state=response.status===200?'DISPATCHED':response.status===202?'UNKNOWN':'FAILED';
  }catch{state='UNKNOWN';}
  await pool.query('update loadgistic_bridge.dispatches set state=$2 where command_id=$1',[job.id,state]);
  await application({action:'RESULT',results:[{commandId:job.id,leaseId:job.leaseId,state}]});
 }
}
async function maintenance(){
 await application({action:'PRUNE'});
 await pool.query("delete from loadgistic_bridge.outbox where id in(select id from loadgistic_bridge.outbox where delivered_at<now()-interval '7 days' order by id limit 1000)");
 const {rows}=await pool.query("select count(*)::integer pending,coalesce(extract(epoch from(now()-min(created_at))),0)::integer lag_seconds from loadgistic_bridge.outbox where delivered_at is null");
 console.log(JSON.stringify({event:'gateway_health',...counts,...rows[0]})); // No identifiers, payloads, credentials or raw coordinates.
}
process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
await runBridgeLanes({shouldStop:()=>stopping,
 priorityCycle:async()=>{if(commandMode){await deliverResults();await dispatch();await deliverResults();}},
 telemetryCycle:async()=>{await deliverPositions();if(round++%30===0)await maintenance();},
 onError:()=>console.log(JSON.stringify({event:'gateway_unavailable'}))});
await pool.end();
