import test from 'node:test';
import assert from 'node:assert/strict';
import {processPositionBatch,runBridgeLanes} from '../infra/telematics/bridge-processing.mjs';
const raw=(id)=>({id,deviceId:1,protocol:'gt06',uniqueId:'990000000000001',valid:true,fixTime:'2026-10-15T12:00:00Z',serverTime:'2026-10-15T12:00:01Z',latitude:9.031,longitude:38.748,speed:0,course:0,attributes:{ignition:false}});
test('twenty pending positions share one POST and retain exact per-event identities',async()=>{
 const posts=[],settlements=[];await processPositionBatch(Array.from({length:20},(_,index)=>({id:index+1,payload:raw(index+1)})),async positions=>{
  posts.push(positions);return positions.map(()=>({ok:true,result:{outcome:'ACCEPTED'}}));},async result=>{settlements.push(result);});
 assert.equal(posts.length,1);assert.equal(posts[0].length,20);assert.deepEqual(posts[0].map(row=>row.eventKey),Array.from({length:20},(_,index)=>`position:${index+1}`));
 assert.equal(settlements.filter(row=>row.delivery==='DELIVERED'&&row.code===null).length,20);
});
test('transient batch failures retry unchanged events; permanent partial denials stay per-row',async()=>{
 const rows=[1,2,3].map(id=>({id,payload:raw(id)})),posts=[],first=[],second=[];
 await processPositionBatch(rows,async positions=>{posts.push(positions);throw new Error('NETWORK_TIMEOUT');},async result=>{first.push(result);});
 assert.deepEqual(first.map(row=>row.delivery),['RETRY','RETRY','RETRY']);
 await processPositionBatch(rows,async positions=>{posts.push(positions);return [{ok:false,code:'TELEMETRY_BINDING_DENIED'},{ok:false,code:'TELEMATICS_UNAVAILABLE'},{ok:true,result:{outcome:'DUPLICATE'}}];},async result=>{second.push(result);});
 assert.deepEqual(posts[0],posts[1]);assert.deepEqual(second.map(row=>[row.delivery,row.code,row.outcome]),[
  ['DELIVERED','TELEMETRY_BINDING_DENIED',undefined],['RETRY',null,undefined],['DELIVERED',null,'DUPLICATE']]);
});
test('malformed positions and command snapshots cannot poison another device batch',async()=>{
 const rows=[{id:1,payload:{...raw(1),latitude:NaN}},{id:2,payload:{...raw(2),attributes:{result:'OK'}}},{id:3,payload:raw(3)}],settlements=[],posts=[];
 await processPositionBatch(rows,async positions=>{posts.push(positions);return [{ok:true,result:{outcome:'HISTORICAL'}}];},async result=>{settlements.push(result);});
 assert.deepEqual(posts[0].map(row=>row.eventKey),['position:3']);assert.equal(settlements.filter(row=>row.code==='INVALID_GATEWAY_POSITION').length,2);
 assert.equal(settlements.find(row=>row.id===3).outcome,'HISTORICAL');
});
test('command dispatch and ACK lane continues while telemetry HTTP is blocked by backlog',async()=>{
 let releaseTelemetry,stopped=false,priorityTicks=0;const events=[],blocked=new Promise(resolve=>{releaseTelemetry=resolve;});
 await runBridgeLanes({shouldStop:()=>stopped,onError:()=>assert.fail('Unexpected worker failure'),sleep:async()=>{await Promise.resolve();},
  telemetryCycle:async()=>{events.push('telemetry-start');await blocked;events.push('telemetry-finish');},
  priorityCycle:async()=>{events.push('dispatch');await Promise.resolve();events.push('ACK');
   if(++priorityTicks===3){stopped=true;releaseTelemetry();}}
 });
 assert.ok(events.indexOf('ACK')<events.indexOf('telemetry-finish'));assert.equal(events.filter(event=>event==='dispatch').length,3);
 assert.equal(events.filter(event=>event==='ACK').length,3);assert.ok(events.indexOf('telemetry-start')<events.lastIndexOf('ACK'));
});
