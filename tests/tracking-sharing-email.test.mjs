import test from 'node:test';import assert from 'node:assert/strict';
import {deliverPendingShipmentEmails} from '../src/lib/email-delivery.js';
import {providerTrackingRecipientDigest} from '../src/lib/security.js';
const shipment='00000000-0000-4000-8000-000000000001';
const delivery=(id,kind='TRACKING_ACCESS')=>({id,shipment_id:shipment,delivery_kind:kind,recipient_email:`${id}@example.test`,party_role:'RECEIVER',code:'LGX-SYNTHETIC',provider_name:'Synthetic provider',origin:'Origin',destination:'Destination',cargo_summary:'Synthetic cargo',events:[]});
test('a queued invitation rechecks current recipient access before external send; a revoked recipient receives no cargo summary',async()=>{
 const calls=[],sent=[],recorded=[];const result=await deliverPendingShipmentEmails(5,{
  deliveryStatus:()=>({configured:true,provider:'test'}),listDeliveries:async()=>[delivery('revoked'),delivery('active')],
  readTracking:async(id,digest)=>{calls.push({id,digest});return digest===providerTrackingRecipientDigest('active@example.test')?{id}:null;},
  send:async(message,key)=>{sent.push({message,key});},recordAttempt:async(id,result)=>recorded.push({id,result}),
 });
 assert.deepEqual(calls,[{id:shipment,digest:providerTrackingRecipientDigest('revoked@example.test')},{id:shipment,digest:providerTrackingRecipientDigest('active@example.test')}]);assert.equal(sent.length,1);assert.equal(sent[0].message.to,'active@example.test');assert.deepEqual(recorded,[{id:'revoked',result:{sent:false,error:'TRACKING_ACCESS_REVOKED'}},{id:'active',result:{sent:true}}]);assert.equal(result.sent,1);
});
test('a failed authorization recheck fails closed, while established completion-email behavior is preserved',async()=>{
 const sent=[],recorded=[];const result=await deliverPendingShipmentEmails(5,{
  deliveryStatus:()=>({configured:true,provider:'test'}),listDeliveries:async()=>[delivery('unconfirmed'),delivery('completed','COMPLETION')],
  readTracking:async()=>{throw Error('TRANSIENT_LOOKUP_FAILURE');},send:async(message)=>sent.push(message),recordAttempt:async(id,result)=>recorded.push({id,result}),
 });
 assert.equal(sent.length,1);assert.equal(sent[0].to,'completed@example.test');assert.equal(sent[0].subject,'Your Loadgistic delivery record');assert.equal(recorded[0].result.sent,false);assert.equal(result.sent,1);
});
