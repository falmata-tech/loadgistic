import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {provisionDeviceSchema,selectLocationSchema,deviceCommandCapability,commandDispatchState,validateTelemetry,approximateTelematicsPosition} from '../src/lib/telematics-contract.js';
import {authenticateGateway,gatewaySignature,loadGatewayConfigurations,verifyGatewayDevice} from '../src/lib/telematics-gateway-auth.js';
import {normalizePosition,signedHeaders,syntheticCommand,correlatedSyntheticResult} from '../infra/telematics/bridge-contract.mjs';
import {crc16X25,gt06Packet,loginPacket,gpsPacket,syntheticReply} from '../scripts/telematics/simulator.mjs';
import {DEMO_DEVICES,assertDemoDevice,assertLoopback,assertDemoIdentity} from '../scripts/telematics/demo-manifest.mjs';
const now=new Date('2026-10-15T12:00:00Z');
const gateway={id:randomUUID(),secret:'a'.repeat(64),apiUrl:'http://127.0.0.1:18082/api/',apiToken:'b'.repeat(64)};
const fix={eventKey:'position:1',gatewayDeviceId:1,protocol:'gt06',protocolDeviceId:'990000000000001',observedAt:now.toISOString(),receivedAt:now.toISOString(),
 valid:true,latitude:9.031,longitude:38.748,speedKph:0,course:0,attributes:{ignition:false,battery:80,alarm:'vibration'}};
test('demo identities require exact source and fixture key plus an authorized mailbox',()=>{
 const owner={email:'falmatad97+transporter@gmail.com',app_metadata:{fixture_source:'loadgistic'},user_metadata:{fixture_key:'user-transporter'}};
 assert.equal(assertDemoIdentity(owner,'user-transporter'),owner);
 for(const invalid of [{...owner,email:'customer@example.com'},{...owner,app_metadata:{}},{...owner,user_metadata:{fixture_key:'unknown'}},{...owner,email:'falmata.dawano@gmail.com'}])
  assert.throws(()=>assertDemoIdentity(invalid,'user-transporter'),/DEMO_IDENTITY_NOT_ALLOWLISTED/);
 assert.equal(assertDemoIdentity({...owner,email:'falmata.dawano@gmail.com',user_metadata:{fixture_key:'user-admin'}},'user-admin').email,'falmata.dawano@gmail.com');
});
test('gateway request binds exact body, gateway, timestamp and nonce',()=>{
 const body=JSON.stringify({action:'POSITION',positions:[fix]}),nonce=randomUUID(),headers=new Headers(signedHeaders(gateway,body,now,nonce));
 const auth=authenticateGateway(headers,body,[gateway],now.getTime());assert.equal(auth.nonce,nonce);assert.equal(auth.config.id,gateway.id);
 assert.throws(()=>authenticateGateway(headers,body+' ',[gateway],now.getTime()),/GATEWAY_UNAVAILABLE/);
 assert.throws(()=>authenticateGateway(headers,body,[gateway],now.getTime()+120001),/GATEWAY_UNAVAILABLE/);
 headers.set('x-telematics-gateway',randomUUID());assert.throws(()=>authenticateGateway(headers,body,[gateway],now.getTime()),/GATEWAY_UNAVAILABLE/);
 assert.notEqual(gatewaySignature(gateway,body,now.toISOString(),nonce),gatewaySignature(gateway,body,now.toISOString(),randomUUID()));
});
test('server gateway destination rejects credential URLs, public cleartext and duplicate keys',()=>{
 assert.equal(loadGatewayConfigurations(JSON.stringify([gateway]))[0].id,gateway.id);
 for(const apiUrl of ['http://example.com/api/','http://secret@127.0.0.1/api/','https://example.com/api/?token=secret'])
  assert.throws(()=>loadGatewayConfigurations(JSON.stringify([{...gateway,apiUrl}])),/GATEWAY_UNAVAILABLE/);
 assert.throws(()=>loadGatewayConfigurations(JSON.stringify([gateway,gateway])),/GATEWAY_UNAVAILABLE/);
});
test('telemetry rejects unknown fields, nonfinite points, old and future replay windows',()=>{
 assert.deepEqual(validateTelemetry(fix,now),fix);
 for(const invalid of [{...fix,latitude:NaN},{...fix,longitude:181},{...fix,speedKph:301},{...fix,attributes:{raw:'secret'}},{...fix,imei:'990000000000001'}])
  assert.throws(()=>validateTelemetry(invalid,now));
 assert.throws(()=>validateTelemetry({...fix,observedAt:'2026-10-15T12:03:00Z'},now),/TELEMETRY_TIME_INVALID/);
 assert.throws(()=>validateTelemetry({...fix,receivedAt:'2026-09-14T12:00:00Z'},now),/TELEMETRY_TIME_INVALID/);
 assert.equal(validateTelemetry({...fix,observedAt:'2026-10-15T11:59:00Z'},now).observedAt,'2026-10-15T11:59:00Z');
});
test('manual source has worldwide validated coordinates and an exclusive owner binding',()=>{
 const base={vehicleId:randomUUID(),source:'MANUAL',expectedRevision:now.toISOString(),precisionKm:20,manualLatitude:51.5,manualLongitude:-0.1};
 assert.equal(selectLocationSchema.parse(base).manualLatitude,51.5);
 assert.throws(()=>selectLocationSchema.parse({...base,source:'GPS'}));assert.throws(()=>selectLocationSchema.parse({...base,manualLatitude:undefined}));
 const provision={ownerOrganizationId:randomUUID(),gatewayId:gateway.id,gatewayDeviceId:1,imei:'990000000000001',protocol:'gt06',protocolDeviceId:'990000000000001',label:'Synthetic'};
 assert.equal(provisionDeviceSchema.parse(provision).modelProfile,'UNVERIFIED');
 assert.throws(()=>provisionDeviceSchema.parse({...provision,ownerProviderProfileId:randomUUID()}));
});
test('normalized bridge drops raw/result identifiers and converts knots to kph',()=>{
 const raw={id:1,deviceId:1,uniqueId:'990000000000001',protocol:'gt06',fixTime:now,serverTime:now,valid:true,latitude:9.031,longitude:38.748,speed:10,course:0,
  attributes:{ignition:false,batteryLevel:80,power:12.3,alarm:'unknown,vibration',raw:'private',driverUniqueId:'private'}};
 const normalized=normalizePosition(raw);assert.equal(normalized.speedKph,18.52);assert.equal(normalized.attributes.alarm,'vibration');
 assert.deepEqual(Object.keys(normalized.attributes).sort(),['alarm','battery','ignition','power']);assert.equal(normalized.eventKey,'position:1');
 for(const result of ['OK',`LOADGISTIC:${randomUUID()}:LOCATE#:ACK`,null,123])
  assert.throws(()=>normalizePosition({...raw,attributes:{...raw.attributes,result}}),/COMMAND_RESULT_NOT_POSITION/);
});
test('public approximation is many to one and never carries private telemetry',()=>{
 const point=approximateTelematicsPosition(9.031,38.748,20);assert.deepEqual(Object.keys(point).sort(),['lat','lng','precisionKm']);
 assert.notDeepEqual([point.lat,point.lng],[9.031,38.748]);assert.deepEqual(point,approximateTelematicsPosition(9.031001,38.748001,20));
 assert.throws(()=>approximateTelematicsPosition(9,38,2));
});
test('real hardware is fail closed and synthetic command templates cannot cut a physical relay',()=>{
 for(const command of ['LOCATE','REBOOT','REPORT_INTERVAL','ENGINE_CUT','ENGINE_RESTORE'])assert.equal(deviceCommandCapability({modelProfile:'UNVERIFIED',synthetic:false},command),false);
 const job={id:randomUUID(),gatewayDeviceId:1,synthetic:true,modelProfile:'SYNTHETIC_GT06',protocol:'gt06',command:'ENGINE_CUT',expiresAt:new Date(now.getTime()+10000).toISOString()};
 const command=syntheticCommand(job,now.getTime());assert.equal(command.attributes.noQueue,true);assert.match(command.attributes.data,/^LOADGISTIC:/);
 assert.doesNotMatch(command.attributes.data,/Relay|DYD|engineStop/i);assert.throws(()=>syntheticCommand({...job,synthetic:false},now.getTime()));
 assert.throws(()=>syntheticCommand(job,now.getTime()+10001));assert.equal(commandDispatchState(200),'DISPATCHED');assert.equal(commandDispatchState(202),'UNKNOWN');
 assert.equal(correlatedSyntheticResult(`${command.attributes.data}:ACK`),job.id);assert.equal(correlatedSyntheticResult('OK'),null);
 assert.equal(correlatedSyntheticResult(`LOADGISTIC:${'-'.repeat(36)}:LOCATE#:ACK`),null);
});
test('simulator is loopback-only with fixed fictional identifiers and valid GT06 packet CRCs',()=>{
 assert.throws(()=>assertDemoDevice('123456789012345'));assert.throws(()=>assertLoopback('https://example.com'));
 assert.equal(crc16X25(Buffer.from('123456789')),0x906e);
 for(const packet of [loginPacket(DEMO_DEVICES[0].imei),gpsPacket(DEMO_DEVICES[0],2,now),gt06Packet(0x13),syntheticReply(`LOADGISTIC:${randomUUID()}:LOCATE#`)]){
  assert.equal(packet.length,packet[2]+5);assert.equal(packet.readUInt16BE(packet.length-4),crc16X25(packet.subarray(2,packet.length-4)));
 }
 const stationary=gpsPacket(DEMO_DEVICES[0],2,now),moving=gpsPacket({...DEMO_DEVICES[0],speedKph:20,ignition:true},2,now);
 assert.equal(stationary[19],0);assert.equal(stationary.readUInt16BE(20)&0x8000,0);
 assert.equal(moving[19],20);assert.equal(moving.readUInt16BE(20)&0x8000,0x8000);
});
test('gateway readback checks exact numeric/protocol/IMEI binding before app provisioning',async()=>{
 const command={gatewayId:gateway.id,gatewayDeviceId:1,protocolDeviceId:'990000000000001',imei:'990000000000001',protocol:'gt06',synthetic:false};
 const original=globalThis.fetch;let current={id:1,uniqueId:command.protocolDeviceId,disabled:false,attributes:{'loadgistic.imei':command.imei,'loadgistic.protocol':'gt06','loadgistic.synthetic':false}};
 globalThis.fetch=async()=>Response.json(current);
 try{assert.equal(await verifyGatewayDevice(command,[gateway]),true);current={...current,id:2};await assert.rejects(()=>verifyGatewayDevice(command,[gateway]),/DEVICE_BINDING_CONFLICT/);
  current={...current,id:1,attributes:{...current.attributes,'loadgistic.synthetic':'false'}};await assert.rejects(()=>verifyGatewayDevice(command,[gateway]),/DEVICE_BINDING_CONFLICT/);
  globalThis.fetch=async()=>new Response('x'.repeat(16385));await assert.rejects(()=>verifyGatewayDevice(command,[gateway]),/GATEWAY_UNAVAILABLE/);
 }
 finally{globalThis.fetch=original;}
});
