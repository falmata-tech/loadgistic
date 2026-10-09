import test from 'node:test';
import assert from 'node:assert/strict';
import {nativePushDestination} from '../../../src/lib/native-push-destination.js';

const sourceId='a1b2c3d4-1234-4321-abcd-123456789abc';
const payload=(kind='SUPPORT',event='MESSAGE')=>({app:'loadgistic',eventId:'e5df8dc7-76cc-4c33-a5b4-bb09b221ddbd',kind,sourceId,event});
test('notification events open only the existing authorized phone destinations',()=>{
 for(const kind of ['SUPPORT','BROKERAGE','HANDOVER']){
  for(const event of ['MESSAGE','ASSIGNED','JOINED','ENDED','RESOLVED','APPROVED']){
   const expected=kind==='HANDOVER'?event==='APPROVED'?{pathname:'/shipment-detail',params:{id:sourceId}}:null
    :event==='APPROVED'?null:kind==='SUPPORT'?{pathname:'/support-chat',params:{id:sourceId}}:{pathname:'/arrange-transport'};
   assert.deepEqual(nativePushDestination(payload(kind,event)),expected);
  }
 }
});
test('malformed or injected notification data cannot navigate to a phone or staff screen',()=>{
 const good=payload();
 for(const value of [null,undefined,[],true,'/admin',1,
  {...good,url:'https://attacker.invalid'},{...good,role:'ADMIN'},
  {...good,kind:'ADMIN'},{...good,event:'READ'},{...good,app:'other-app'},
  {...good,eventId:'not-a-uuid'},{...good,sourceId:'../../admin'},
  {...good,sourceId:sourceId+'\n'},{...good,eventId:42},
  {...good,sourceId:null},{...good,event:['MESSAGE']},
  Object.create(good),Object.fromEntries(Object.entries(good).filter(([key])=>key!=='kind'))]){
  assert.equal(nativePushDestination(value),null);
 }
 assert.deepEqual(nativePushDestination({...good,sourceId:sourceId.toUpperCase()}),{pathname:'/support-chat',params:{id:sourceId.toUpperCase()}});
});
