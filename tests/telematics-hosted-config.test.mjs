import test from 'node:test';
import assert from 'node:assert/strict';
import {assertHostedGatewayEnvironment} from '../infra/telematics/hosted-config.mjs';

const good={GPS_INGRESS_BIND_ADDRESS:'127.0.0.1',
 GATEWAY_ID:'00000000-0000-4000-8000-000000000001',SYNTHETIC_GATEWAY_ID:'00000000-0000-4000-8000-000000000002',
 GATEWAY_SECRET:'a'.repeat(64),SYNTHETIC_GATEWAY_SECRET:'b'.repeat(64),
 GATEWAY_DATABASE_PASSWORD:'A'.repeat(32),GATEWAY_BRIDGE_PASSWORD:'B'.repeat(32),
 SYNTHETIC_DATABASE_PASSWORD:'C'.repeat(32),SYNTHETIC_BRIDGE_PASSWORD:'D'.repeat(32),
 LOADGISTIC_GATEWAY_URL:'https://example.invalid/api/telematics/gateway'};
test('offline hosted template preflight checks separate identities and safe destinations',()=>{
 assert.deepEqual(assertHostedGatewayEnvironment(good),{realGateway:true,syntheticGateway:true,commandsEnabled:false});
 for(const patch of [
  {GPS_INGRESS_BIND_ADDRESS:'0.0.0.0'},
  {GPS_INGRESS_BIND_ADDRESS:'example.invalid'},
  {SYNTHETIC_GATEWAY_ID:good.GATEWAY_ID},
  {SYNTHETIC_GATEWAY_SECRET:good.GATEWAY_SECRET},
  {SYNTHETIC_DATABASE_PASSWORD:good.GATEWAY_DATABASE_PASSWORD},
  {SYNTHETIC_BRIDGE_PASSWORD:good.GATEWAY_SECRET},
  {GATEWAY_DATABASE_PASSWORD:'unsafe:password@host'},
  {LOADGISTIC_GATEWAY_URL:'http://example.invalid/api/telematics/gateway'},
  {LOADGISTIC_GATEWAY_URL:'https://example.invalid/api/telematics/gateway?other=1'},
  {LOADGISTIC_GATEWAY_URL:'https://user@example.invalid/api/telematics/gateway'}
 ])assert.throws(()=>assertHostedGatewayEnvironment({...good,...patch}),/HOSTED_GATEWAY_CONFIG_INVALID/);
});
