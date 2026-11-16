import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGatewayConfigurations} from '../src/lib/telematics-gateway-auth.js';
import {loadPrivacyConfigurations} from '../src/lib/telematics-privacy-auth.js';

const capacitySecret='c'.repeat(64);
const environment={DEMO_CAPACITY_WORKER_SECRET:capacitySecret};
const gateway={id:'24835d38-c18d-45ed-bcef-4da18c3d4b47',secret:'a'.repeat(64),
 apiUrl:'https://enrollment.example.invalid/api/',apiToken:'b'.repeat(64)};
const privacy={id:gateway.id,secret:'d'.repeat(64)};

test('gateway receiver refuses fast Capacity key as ingest authority or relay bearer',()=>{
 for(const collision of [{...gateway,secret:capacitySecret},{...gateway,apiToken:capacitySecret}]){
  assert.throws(()=>loadGatewayConfigurations(JSON.stringify([collision]),environment),/GATEWAY_UNAVAILABLE/);
  // No unrelated healthy entry may hide an unsafe second configured gateway.
  assert.throws(()=>loadGatewayConfigurations(JSON.stringify([gateway,{...collision,id:'dce6e7c9-f812-4c3c-9958-8d6677a6b3d9'}]),environment),/GATEWAY_UNAVAILABLE/);
 }
 assert.deepEqual(loadGatewayConfigurations(JSON.stringify([gateway]),environment),[gateway]);
});

test('privacy receiver refuses fast Capacity key without disabling distinct privacy credentials',()=>{
 const collision={...privacy,secret:capacitySecret};
 assert.throws(()=>loadPrivacyConfigurations(JSON.stringify([collision]),environment),/PRIVACY_GATEWAY_UNAVAILABLE/);
 assert.throws(()=>loadPrivacyConfigurations(JSON.stringify([privacy,{...collision,id:'dce6e7c9-f812-4c3c-9958-8d6677a6b3d9'}]),environment),/PRIVACY_GATEWAY_UNAVAILABLE/);
 assert.deepEqual(loadPrivacyConfigurations(JSON.stringify([privacy]),environment),[privacy]);
});

test('absent fast configuration preserves existing gateway/privacy inputs and strict validation',()=>{
 for(const environment of [{},{DEMO_CAPACITY_WORKER_SECRET:''}]){
  assert.deepEqual(loadGatewayConfigurations(JSON.stringify([gateway]),environment),[gateway]);
  assert.deepEqual(loadPrivacyConfigurations(JSON.stringify([privacy]),environment),[privacy]);
  assert.deepEqual(loadGatewayConfigurations('',environment),[]);
  assert.deepEqual(loadPrivacyConfigurations('',environment),[]);
  for(const invalid of ['{','{}','[null]']){
   assert.throws(()=>loadGatewayConfigurations(invalid,environment),/GATEWAY_UNAVAILABLE/);
   assert.throws(()=>loadPrivacyConfigurations(invalid,environment),/PRIVACY_GATEWAY_UNAVAILABLE/);
  }
 }
});
