import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {nativeBrokerageIntake,nativeBrokerageCommand,nativeBrokerageSnapshot,nativeBrokerageToken,readNativeBrokerage} from '../src/lib/mobile/brokerage-contract.js';
import {createSessionToken} from '../src/lib/security.js';
const requestId=randomUUID(),secret='a'.repeat(64),data={requestId,secret,name:'Guest',phone:'+251900000001',origin:'Adama',destination:'Dire Dawa'};
test('native brokerage intake binds strict four fields, idempotency id and random credential',()=>{
 const value=nativeBrokerageIntake(data);assert.equal(value.input.requestId,requestId);assert.match(value.digest,/^[a-f0-9]{64}$/);assert.equal(value.input.secret,undefined);
 for(const candidate of [{...data,actorId:requestId},{...data,secret:'short'},{...data,phone:'wrong'},{...data,name:''}])assert.throws(()=>nativeBrokerageIntake(candidate));
 assert.throws(()=>nativeBrokerageCommand({action:'END'}));assert.deepEqual(nativeBrokerageCommand({action:'END',confirm:true}),{action:'END',confirm:true});assert.throws(()=>nativeBrokerageCommand({action:'SEND',messageId:requestId,body:' ',actorId:requestId}));
});
test('native capability rejects cookies, provider/visitor tokens, tampering and expiry',()=>{
 const authority={requestId,digest:'b'.repeat(64),actorId:null},token=nativeBrokerageToken(authority,new Date(Date.now()+60000).toISOString());assert.deepEqual(readNativeBrokerage('Bearer '+token),authority);
 for(const value of ['',token,'Bearer '+token+'.extra','Bearer '+token+'x','Bearer '+createSessionToken(`transport-chat:${requestId}:${authority.digest}`,60),'Bearer '+createSessionToken(`native-brokerage:${requestId}:${authority.digest}`,-1)])assert.equal(readNativeBrokerage(value),null);
});
test('visitor chat projection never copies staff details or another request',()=>{
 const snapshot=nativeBrokerageSnapshot({request:{id:requestId,origin:'A',destination:'B',status:'NEW',followUpNote:'private'},messages:[{id:'message',sequence:1,sender_kind:'BROKER',sender_name:'Agent',body:'Hello',actor_user_id:'private'}],staffDetails:{phone:'private',name:'private'},hasMore:true},requestId);
 assert.equal(JSON.stringify(snapshot).includes('private'),false);assert.equal(snapshot.messages[0].name,'Agent');assert.equal(snapshot.hasOlder,true);assert.throws(()=>nativeBrokerageSnapshot({request:{id:randomUUID()}},requestId));
});
