import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {adminDeviceRegistrationCommand} from '../src/lib/telematics-admin-provision.js';
import {registerPhysicalGatewayDevice,registerAdminSpareGatewayDevice} from '../src/lib/telematics-gateway-registration.js';
import {DEMO_ADMIN_SPARE} from '../src/lib/demo-admin-spare.js';

const gateway={id:randomUUID(),secret:'a'.repeat(64),apiUrl:'http://127.0.0.1:18082/api/',apiToken:'b'.repeat(32)};
const ownerOrganizationId=randomUUID();
const body={mode:'REAL',enrollment:'REGISTER',ownerOrganizationId,imei:'353456789012345',protocol:'gt06',
 protocolDeviceId:'353456789012345',model:'GT06 test hardware',label:'Provider tracker'};
const registration=adminDeviceRegistrationCommand(body,gateway.id,randomUUID());

test('physical intake binds server gateway and rejects client gateway or synthetic claims',()=>{
 assert.equal(registration.gatewayId,gateway.id);assert.equal(registration.synthetic,false);
 assert.equal(registration.modelProfile,'UNVERIFIED');assert.equal(registration.gatewayDeviceId,undefined);
 for(const patch of [{gatewayId:randomUUID()},{gatewayDeviceId:10},{synthetic:true},{modelProfile:'SYNTHETIC_GT06'}])
  assert.throws(()=>adminDeviceRegistrationCommand({...body,...patch},gateway.id,randomUUID()));
 assert.throws(()=>adminDeviceRegistrationCommand(body,gateway.id,gateway.id));
 assert.throws(()=>adminDeviceRegistrationCommand({...body,ownerOrganizationId:undefined},gateway.id,''));
});

test('gateway creates once, verifies readback and reuses only an exact binding',async()=>{
 let device=null,posts=0;
 const prior=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  const target=new URL(url),path=target.pathname;
  assert.equal(options.headers.Authorization,`Bearer ${gateway.apiToken}`);
  if(path.endsWith('/devices')&&options.method==='GET')return Response.json(device?[device]:[]);
  if(path.endsWith('/devices')&&options.method==='POST'){
   posts++;const sent=JSON.parse(options.body);device={...sent,id:41,disabled:false};return Response.json(device,{status:201});
  }
  if(path.endsWith('/devices/41'))return Response.json(device);
  throw Error(`UNEXPECTED_PATH:${path}`);
 };
 try{
  assert.equal(await registerPhysicalGatewayDevice(registration,[gateway]),41);
  assert.equal(await registerPhysicalGatewayDevice(registration,[gateway]),41);
  assert.equal(posts,1);
  device.attributes['loadgistic.synthetic']=true;
  await assert.rejects(()=>registerPhysicalGatewayDevice(registration,[gateway]),/DEVICE_BINDING_CONFLICT/);
  assert.equal(posts,1);
 }finally{globalThis.fetch=prior;}
});

test('ambiguous gateway POST reconciles exact binding and leaves mismatched records untouched',async()=>{
 let device=null,posts=0;
 const prior=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  const target=new URL(url),path=target.pathname;
  if(path.endsWith('/devices')&&options.method==='GET')return Response.json(device?[device]:[]);
  if(path.endsWith('/devices')&&options.method==='POST'){
   posts++;device={...JSON.parse(options.body),id:42,disabled:false};throw Error('TIMEOUT_AFTER_WRITE');
  }
  if(path.endsWith('/devices/42'))return Response.json(device);
  throw Error(`UNEXPECTED_PATH:${path}`);
 };
 try{assert.equal(await registerPhysicalGatewayDevice(registration,[gateway]),42);assert.equal(posts,1);
  device.name='Unexpected reassignment';await assert.rejects(()=>registerPhysicalGatewayDevice(registration,[gateway]),/DEVICE_BINDING_CONFLICT/);
  assert.equal(posts,1);
 }finally{globalThis.fetch=prior;}
});

test('only the server-owned spare Demo identity is registered and exact retries reuse it',async()=>{
 let device=null,posts=0;const prior=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  const target=new URL(url),path=target.pathname;
  if(path.endsWith('/devices')&&options.method==='GET'){
   assert.equal(target.searchParams.get('uniqueId'),DEMO_ADMIN_SPARE.imei);
   return Response.json(device?[device]:[]);
  }
  if(path.endsWith('/devices')&&options.method==='POST'){
   posts++;const sent=JSON.parse(options.body);
   assert.equal(sent.uniqueId,DEMO_ADMIN_SPARE.imei);
   assert.equal(sent.name,DEMO_ADMIN_SPARE.label);
   assert.equal(sent.model,DEMO_ADMIN_SPARE.model);
   assert.equal(sent.attributes['loadgistic.synthetic'],true);
   device={...sent,id:43,disabled:false};return Response.json(device,{status:201});
  }
  if(path.endsWith('/devices/43'))return Response.json(device);
  throw Error(`UNEXPECTED_PATH:${path}`);
 };
 try{
  assert.equal(await registerAdminSpareGatewayDevice(gateway.id,[gateway]),43);
  assert.equal(await registerAdminSpareGatewayDevice(gateway.id,[gateway]),43);
  assert.equal(posts,1);
  device.attributes['loadgistic.imei']='990000000000099';
  await assert.rejects(()=>registerAdminSpareGatewayDevice(gateway.id,[gateway]),/DEVICE_BINDING_CONFLICT/);
  assert.equal(posts,1);
 }finally{globalThis.fetch=prior;}
});
