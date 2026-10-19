import {normalizePosition} from './bridge-contract.mjs';
const permanentDenials=new Set(['TELEMETRY_BINDING_DENIED','TELEMETRY_TIME_INVALID','TELEMETRY_EVENT_CONFLICT','DEVICE_OWNER_INVALID','INVALID_TELEMATICS_INPUT']);
/** @typedef {{id:string|number,payload:object}} OutboxRow */
/** @typedef {{id:string|number,delivery:'DELIVERED'|'RETRY',code:string|null,outcome?:string}} RowSettlement */
/**
 * @param {OutboxRow[]} rows
 * @param {(positions:object[])=>Promise<unknown>} sendPositions
 * @param {(settlement:RowSettlement)=>Promise<void>} settle
 */
export async function processPositionBatch(rows,sendPositions,settle){
 if(rows.length>20)throw new Error('BRIDGE_BATCH_TOO_LARGE');
 const ready=[];
 for(const row of rows){try{ready.push({row,position:normalizePosition(row.payload)});}
  catch{await settle({id:row.id,delivery:'DELIVERED',code:'INVALID_GATEWAY_POSITION'});}}
 if(!ready.length)return;
 let outcomes;try{outcomes=await sendPositions(ready.map(item=>item.position));}
 catch{for(const {row} of ready)await settle({id:row.id,delivery:'RETRY',code:null});return;}
 for(let index=0;index<ready.length;index++){
  const {row}=ready[index],outcome=Array.isArray(outcomes)?outcomes[index]:null;
  if(outcome?.ok===true&&['ACCEPTED','HISTORICAL','DUPLICATE'].includes(outcome.result?.outcome))
   await settle({id:row.id,delivery:'DELIVERED',code:null,outcome:outcome.result.outcome});
  else if(outcome?.ok===false&&permanentDenials.has(outcome.code))await settle({id:row.id,delivery:'DELIVERED',code:outcome.code});
  else await settle({id:row.id,delivery:'RETRY',code:null});
 }
}
/** Independent lanes prevent a slow/backlogged telemetry POST from consuming a
 * safety command's TTL. Ports retain durable leasing and idempotent row settlement.
 * @param {{priorityCycle:()=>Promise<void>,telemetryCycle:()=>Promise<void>,shouldStop:()=>boolean,onError:()=>void,sleep?:(milliseconds:number)=>Promise<void>}} ports
 */
export async function runBridgeLanes(ports){
 const sleep=ports.sleep||((milliseconds)=>new Promise(resolve=>setTimeout(resolve,milliseconds)));
 async function lane(cycle,interval){while(!ports.shouldStop()){
  try{await cycle();}catch{ports.onError();}
  if(!ports.shouldStop())await sleep(interval);
 }}
 await Promise.all([lane(ports.priorityCycle,500),lane(ports.telemetryCycle,2000)]);
}
