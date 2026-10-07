import test from 'node:test';
import assert from 'node:assert/strict';
import {foregroundCapacityDue, refreshForegroundCapacity} from '../src/location/foreground-capacity.ts';
import {capacityLocation} from '../src/location/privacy.ts';
const now=2_000_000, truck={id:'assigned',canLocate:true,current:{status:'EMPTY'},location:{updatedAt:'',radius:20}};
test('capacity movement refresh requires assigned on-duty driver and ten-minute cadence',()=>{
 assert.equal(foregroundCapacityDue(truck,0,now),true);
 for(const change of [{canLocate:false},{current:null},{current:{status:'OFF_DUTY'}},{current:{status:'UNKNOWN'}},{location:{radius:20,updatedAt:new Date(now-599999).toISOString()}}]) assert.equal(foregroundCapacityDue({...truck,...change},0,now),false);
 assert.equal(foregroundCapacityDue(truck,now-599999,now),false);
 assert.equal(foregroundCapacityDue({...truck,current:{status:'PARTIAL'}},now-600000,now),true);
});
test('fresh authority is checked before GPS; late foreground fixes never submit',async()=>{
 for(const denied of [[],[{...truck,canLocate:false}],[{...truck,current:{status:'OFF_DUTY'}}]]){
  let captures=0,saves=0;
  const result=await refreshForegroundCapacity({vehicleId:truck.id,lastAttempt:0,now,active:()=>true,read:async()=>({vehicles:denied}),capture:async()=>{captures++;},save:async()=>{saves++;}});
  assert.equal(result,'not-due');assert.equal(captures,0);assert.equal(saves,0);
 }
 for(const stopAt of ['read','capture']){
  let active=true,saves=0;
  const result=await refreshForegroundCapacity({vehicleId:truck.id,lastAttempt:0,now,active:()=>active,read:async()=>{if(stopAt==='read')active=false;return {vehicles:[truck]};},capture:async radius=>{active=false;return capacityLocation(9.03,38.74,10,radius);},save:async()=>{saves++;}});
  assert.equal(result,'paused');assert.equal(saves,0);
 }
});
test('movement pipeline transmits only obscured coordinates and preserves capacity fields',async()=>{
 const saves=[];
 for(const [lat,lng] of [[9.03,38.74],[8.54,39.27]]){
  assert.equal(await refreshForegroundCapacity({vehicleId:truck.id,lastAttempt:0,now,active:()=>true,read:async()=>({vehicles:[truck]}),capture:async radius=>capacityLocation(lat,lng,10,radius),save:async body=>saves.push(body)}),'saved');
  assert.deepEqual(saves.at(-1),{action:'LOCATION',vehicleId:truck.id,...capacityLocation(lat,lng,10,20)});
  assert.notEqual(saves.at(-1).approximateLat,lat);assert.notEqual(saves.at(-1).approximateLng,lng);
 }
 assert.notDeepEqual(saves[0],saves[1]);
});
test('permission, capture and server denials do not retry a location mutation',async()=>{
 for(const boundary of ['capture','save']){
  let writes=0;
  await assert.rejects(refreshForegroundCapacity({vehicleId:truck.id,lastAttempt:0,now,active:()=>true,read:async()=>({vehicles:[truck]}),capture:async radius=>{if(boundary==='capture')throw new Error('permission denied');return capacityLocation(9.03,38.74,10,radius);},save:async()=>{writes++;throw new Error('assignment revoked');}}));
  assert.equal(writes,boundary==='capture'?0:1);
 }
});
