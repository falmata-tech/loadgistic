import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateTransportRequest,validateTransportFollowUp} from '../src/lib/domain.js';
const input={requestId:'5e91d211-c050-4f5d-82b0-812356987321',name:'  Amina  ',origin:'Adama',destination:'Dire Dawa',phone:'+251 (911) 000-001'};
test('callback request needs only route, name and phone and normalizes dialable contact',()=>{
 assert.deepEqual(validateTransportRequest(input),{...input,name:'Amina',phone:'+251911000001'});
 for(const value of [null,{}, {...input,name:''},{...input,origin:' '},{...input,destination:'x'.repeat(161)},{...input,phone:'1---2---3'},{...input,phone:'hello'},{...input,phone:'1234567890123456'},{...input,name:'A\nB'},{...input,requestId:'no'}])assert.throws(()=>validateTransportRequest(value));
});
test('follow-up permits explicit offline status correction and rejects unbounded or stale version shapes',()=>{
 for(const status of ['NEW','CONTACTED','CLOSED'])assert.deepEqual(validateTransportFollowUp({status,note:' Called ',version:2}),{status,note:'Called',version:2});
 for(const value of [{status:'DELIVERED',version:1},{status:'NEW',version:0},{status:'NEW',version:1.5},{status:'NEW',version:1,note:'x'.repeat(1001)}])assert.throws(()=>validateTransportFollowUp(value));
});
