import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateTransportMessage} from '../src/lib/domain.js';
const messageId='b1773260-2a57-4dc8-9319-e69b57c37a11';
test('transport messages preserve natural text and require bounded idempotency keys',()=>{
 assert.deepEqual(validateTransportMessage({messageId,body:'  Hello\nA second line  '}),{messageId,body:'Hello\nA second line'});
 for(const input of [null,{}, {messageId,body:''},{messageId,body:'x'.repeat(2001)},{messageId:'wrong',body:'Hello'},{messageId,body:'control\u0000text'}])assert.throws(()=>validateTransportMessage(input),/INVALID_TRANSPORT_MESSAGE/);
});
