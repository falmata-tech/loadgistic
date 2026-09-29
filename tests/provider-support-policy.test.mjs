import test from 'node:test';
import assert from 'node:assert/strict';
import {isTransportSupportMember,canSendSupportMessage} from '../src/lib/support-policy.js';
import {createGuestSupportConversation,sendGuestSupportMessage,createSupportConversation,sendSupportMessage} from '../src/lib/support/supabase.js';
import {sendSupportAttachment} from '../src/lib/support-attachments.js';
test('all provider identities keep member support; customers and guests cannot start it',()=>{
 for(const role of ['TRANSPORTER','DRIVER'])assert.equal(isTransportSupportMember({role}),true);
 for(const role of ['SHIPPER','RECEIVER','SUPPORT','ADMIN',undefined])assert.equal(isTransportSupportMember({role}),false);
 assert.equal(isTransportSupportMember(null),false);
 for(const role of ['TRANSPORTER','DRIVER','SUPPORT','ADMIN'])assert.equal(canSendSupportMessage({role}),true);
});
test('retired public and non-provider commands fail before uploads or network work',async()=>{
 let reads=0;const file={size:10,arrayBuffer(){reads++;throw new Error('UNEXPECTED_UPLOAD');}};
 await assert.rejects(createGuestSupportConversation({},file),/PUBLIC_SUPPORT_CLOSED/);
 await assert.rejects(sendGuestSupportMessage(null,'id','text','digest',file),/PUBLIC_SUPPORT_CLOSED/);
 await assert.rejects(sendGuestSupportMessage({role:'DRIVER'},'id','text',null,file),/PUBLIC_SUPPORT_CLOSED/);
 for(const role of ['SHIPPER','RECEIVER']){
  await assert.rejects(createSupportConversation({role},{}),/FORBIDDEN/);
  await assert.rejects(sendSupportMessage({role},'id','text'),/FORBIDDEN/);
  await assert.rejects(sendSupportAttachment({role},'id','text',file),/FORBIDDEN/);
 }
 assert.equal(reads,0);
});
