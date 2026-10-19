import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {authenticatePrivacyGateway,loadPrivacyConfigurations,privacySignature} from '../src/lib/telematics-privacy-auth.js';
import {gatewaySignature} from '../src/lib/telematics-gateway-auth.js';
import {assertPrivacyApiIdentity,assertExactPrivacyDevice,parsePrivacyJob,processPrivacyJob,signedPrivacyHeaders} from '../infra/telematics/privacy-contract.mjs';
import {assertPrivacyDemoBinding} from '../scripts/telematics/privacy-simulator.mjs';
const now=Date.parse('2026-10-15T12:00:00Z'),config={id:randomUUID(),secret:'a'.repeat(64)};
const job={id:randomUUID(),purpose:'ERASE',subjectId:randomUUID(),deviceId:randomUUID(),gatewayId:config.id,gatewayDeviceId:3,
 imei:'990000000000003',protocol:'gt06',protocolDeviceId:'990000000000003',bindingDigest:'b'.repeat(64),leaseId:randomUUID(),leaseUntil:new Date(now+60000).toISOString()};
const device={id:3,uniqueId:job.protocolDeviceId,disabled:false,attributes:{'loadgistic.imei':job.imei,'loadgistic.protocol':job.protocol}};
test('restricted Traccar identity has an empty managed-user list and an exact own-user readback',()=>{
 const identity={id:3,administrator:false,readonly:false,deviceReadonly:false,deviceLimit:0,userLimit:0,limitCommands:true};
 assert.equal(assertPrivacyApiIdentity([],identity,3),true);
 // An admin can read the same user, but its nonempty list must still reject the token.
 assert.throws(()=>assertPrivacyApiIdentity([identity],identity,3),/PRIVACY_SCOPE_DENIED/);
 for(const changed of [{...identity,id:4},{...identity,administrator:true},{...identity,deviceReadonly:true},
  {...identity,deviceLimit:-1},{...identity,userLimit:1},{...identity,limitCommands:false},{...identity,readonly:undefined}])
  assert.throws(()=>assertPrivacyApiIdentity([],changed,3),/PRIVACY_SCOPE_DENIED/);
 assert.throws(()=>assertPrivacyApiIdentity([],identity,0),/PRIVACY_SCOPE_DENIED/);
});
function fixture(overrides={}){
 const events=[];let current=structuredClone(device);
 const ports={gatewayId:config.id,now:()=>now,prepare:async()=>{events.push('prepare');return {state:'PREPARED',devicePresent:true};},
  getDevice:async()=>{events.push('read');return structuredClone(current);},disableDevice:async value=>{events.push('disable');current=value;},
  deleteDevice:async()=>{events.push('delete');current=null;},verifyAndPurge:async()=>{events.push('verify');return {state:'VERIFIED'};},
  complete:async value=>{events.push('complete');assert.deepEqual(value,{jobId:job.id,leaseId:job.leaseId,bindingDigest:job.bindingDigest,verified:true});return {id:job.id,state:'VERIFIED'};},...overrides};
 return {ports,events};
}
test('privacy HMAC is isolated from ingest by secret and exact path; body and time remain bound',()=>{
 const body=JSON.stringify({action:'CLAIM'}),nonce=randomUUID(),headers=new Headers(signedPrivacyHeaders(config,body,new Date(now),nonce));
 assert.equal(authenticatePrivacyGateway(headers,body,[config],now).nonce,nonce);
 assert.notEqual(privacySignature(config,body,new Date(now).toISOString(),nonce),gatewaySignature(config,body,new Date(now).toISOString(),nonce));
 for(const configs of [[{...config,secret:'c'.repeat(64)}],[]])assert.throws(()=>authenticatePrivacyGateway(headers,body,configs,now),/PRIVACY_GATEWAY_UNAVAILABLE/);
 assert.throws(()=>authenticatePrivacyGateway(headers,body+' ',[config],now),/PRIVACY_GATEWAY_UNAVAILABLE/);
 assert.throws(()=>authenticatePrivacyGateway(headers,body,[config],now+120001),/PRIVACY_GATEWAY_UNAVAILABLE/);
 assert.throws(()=>loadPrivacyConfigurations(JSON.stringify([config,config])),/PRIVACY_GATEWAY_UNAVAILABLE/);
});
test('privacy rejects cross-gateway, missing exact binding, expired lease and unrecognized protocol',()=>{
 for(const value of [{...job,gatewayId:randomUUID()},{...job,imei:''},{...job,gatewayDeviceId:0},{...job,protocol:'unknown'},
  {...job,leaseUntil:new Date(now).toISOString()},{...job,leaseUntil:new Date(now+62000).toISOString()}])
  assert.throws(()=>parsePrivacyJob(value,config.id,now),/INVALID_PRIVACY_JOB/);
 for(const value of [{...device,id:4},{...device,uniqueId:'other'},{...device,attributes:{}},{...device,disabled:'false'}])
  assert.throws(()=>assertExactPrivacyDevice(job,value),/PRIVACY_BINDING_CHANGED/);
});
test('privacy protocol rehearsal accepts only disposable003 and preserves the two primary device identities',()=>{
 const binding={gatewayId:config.id,gatewayDeviceId:3,imei:'990000000000003',protocolDeviceId:'990000000000003',protocol:'gt06',synthetic:true};
 assert.equal(assertPrivacyDemoBinding(binding),binding);
 for(const value of [{...binding,imei:'990000000000001'},{...binding,imei:'990000000000002'},
  {...binding,synthetic:false},{...binding,protocolDeviceId:'customer'},{...binding,gatewayDeviceId:0}])
  assert.throws(()=>assertPrivacyDemoBinding(value),/PRIVACY_DEMO_BINDING_REFUSED/);
});
test('ERASE disables, rereads exact binding, deletes, verifies durable purge and only then acknowledges',async()=>{
 const {ports,events}=fixture();assert.deepEqual(await processPrivacyJob(job,ports),{purpose:'ERASE',state:'VERIFIED'});
 assert.deepEqual(events,['prepare','read','disable','read','delete','verify','complete']);
});
test('DISABLE retains device/history and never invokes deletion or any engine command',async()=>{
 const {ports,events}=fixture();await processPrivacyJob({...job,purpose:'DISABLE'},ports);
 assert.deepEqual(events,['prepare','read','disable','read','verify','complete']);assert.equal(events.includes('delete'),false);
});
test('binding drift, failed upstream delete or failed absence proof never acknowledges a privacy job',async()=>{
 for(const overrides of [{getDevice:async()=>({...device,uniqueId:'rebound'})},{deleteDevice:async()=>{throw new Error('PRIVACY_UPSTREAM_UNAVAILABLE');}},
  {verifyAndPurge:async()=>{throw new Error('PRIVACY_ABSENCE_UNVERIFIED');}}]){
  const {ports,events}=fixture(overrides);await assert.rejects(()=>processPrivacyJob(job,ports));assert.equal(events.includes('complete'),false);
 }
});
test('a bounded raw-history purge with rows remaining stays pending and never acknowledges',async()=>{
 const {ports,events}=fixture({verifyAndPurge:async()=>{events.push('batch');return {state:'PENDING'};}});
 await assert.rejects(()=>processPrivacyJob(job,ports),/PRIVACY_ABSENCE_UNVERIFIED/);
 assert.equal(events.includes('batch'),true);assert.equal(events.includes('complete'),false);
});
test('ambiguous prior DELETE retries only from durable exact proof and verifies absence before ACK',async()=>{
 const {ports,events}=fixture({prepare:async()=>({state:'PREPARED',devicePresent:false})});await processPrivacyJob(job,ports);
 assert.deepEqual(events,['verify','complete']);
 const disabled=fixture({prepare:async()=>({state:'PREPARED',devicePresent:false})});
 await assert.rejects(()=>processPrivacyJob({...job,purpose:'DISABLE'},disabled.ports),/PRIVACY_DISABLE_UNVERIFIED/);assert.deepEqual(disabled.events,[]);
});
test('durable completed receipt retries application ACK without repeating upstream deletion',async()=>{
 const {ports,events}=fixture({prepare:async()=>({state:'VERIFIED'})});await processPrivacyJob(job,ports);assert.deepEqual(events,['complete']);
});
test('lease expiry during upstream work prevents further mutation and ACK',async()=>{
 let clock=now;const {ports,events}=fixture({now:()=>clock,getDevice:async()=>{clock=now+60001;return device;}});
 await assert.rejects(()=>processPrivacyJob(job,ports),/PRIVACY_LEASE_EXPIRED/);assert.deepEqual(events,['prepare']);
});
test('gateway privacy adapter confines raw erasure and permanent collection retirement to scoped functions',async()=>{
 const sql=await readFile(new URL('../infra/telematics/gateway-privacy.sql',import.meta.url),'utf8');
 assert.doesNotMatch(sql,/update\s+public\.tc_|insert\s+into\s+public\.tc_/i);
 assert.match(sql,/grant execute on function[\s\S]*to loadgistic_janitor/);
 assert.doesNotMatch(sql,/grant\s+(?:select|insert|update|delete|all)\s+[\s\S]*to loadgistic_janitor/i);
 assert.match(sql,/retired_device_ids\(device_id bigint primary key\)/);
 assert.match(sql,/before insert on public\.tc_positions/);assert.match(sql,/before insert on public\.tc_events/);
 assert.match(sql,/TELEMATICS_COLLECTION_RETIRED/);assert.match(sql,/lock table public\.tc_devices in share mode/);
 const prepare=sql.slice(sql.indexOf('function loadgistic_bridge.prepare_privacy_job'),sql.indexOf('function loadgistic_bridge.verify_privacy_job'));
 assert.ok(prepare.indexOf('perform pg_advisory_xact_lock')<prepare.indexOf('lock table public.tc_devices in share mode'),
  'retirement must acquire the same per-device lock before any device-table lock, matching insertion');
 assert.match(sql,/limit \(500-removed_count\)/);assert.match(sql,/where e\.deviceid=target_id/);
 assert.match(sql,/where p\.deviceid=target_id/);assert.match(sql,/privacy_receipts/);
});
