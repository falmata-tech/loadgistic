import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {DEMO_MOTION_COHORT,DEMO_MOTION_FLEET_TARGETS} from '../src/lib/demo-motion-cohort.js';
import {DEMO_MOTION_TARGETS,executeDemoMotion,demoMotionCommand} from '../src/lib/demo-motion-auth.js';
import {DEMO_GPS_COHORT_DEVICES,DEMO_ADMIN_SPARE_DEVICE,assertDemoDevice,assertDemoIdentity} from '../scripts/telematics/demo-manifest.mjs';
import {demoRouteFix} from '../scripts/telematics/demo-motion-runtime.mjs';

const fixture=JSON.parse(readFileSync(new URL('../resources/fixtures/managed-market.json',import.meta.url)));
const migration=readFileSync(new URL('../supabase/migrations/183_demo_gps_fleet_cohort.sql',import.meta.url),'utf8');
function fixtureUuid(value){const bytes=createHash('sha256').update(`loadgistic-fixture:${value}`).digest().subarray(0,16);
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=bytes.toString('hex');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}

test('all eight GPS targets are exact distinct fixture vehicles, drivers, providers and IMEIs',()=>{
 assert.equal(DEMO_MOTION_FLEET_TARGETS.length,8);
 assert.equal(new Set(Object.values(DEMO_MOTION_COHORT).map(row=>row.vehicleId)).size,10);
 assert.equal(new Set(Object.values(DEMO_MOTION_COHORT).map(row=>row.imei)).size,10);
 for(const name of DEMO_MOTION_FLEET_TARGETS){const target=DEMO_MOTION_COHORT[name],vehicle=fixture.tables.vehicles.find(row=>row.id===target.vehicleFixtureKey);
  assert.ok(vehicle);assert.equal(fixtureUuid(vehicle.id),target.vehicleId);
  assert.equal(vehicle.organization_id,target.organizationFixtureKey);
  assert.equal(fixture.tables.memberships.filter(row=>row.organization_id===vehicle.organization_id&&row.membership_role==='OWNER').length,1);
  assert.equal(fixture.tables.driver_vehicle_assignments.filter(row=>row.vehicle_id===vehicle.id&&row.active&&row.driver_user_id===target.driverFixtureKey).length,1);
  assert.equal(DEMO_MOTION_TARGETS[name],target.vehicleId);
  assert.equal(assertDemoDevice(target.imei).protocolDeviceId,target.imei);
  assert.ok(migration.includes(`'${target.vehicleId}'`));assert.ok(migration.includes(`'${target.imei}'`));
  for(const seconds of [0,30,120]){const fix=demoRouteFix(name,seconds);
   assert.ok(Math.abs(fix.latitude-target.latitude)<0.05&&Math.abs(fix.longitude-target.longitude)<0.05);}
 }
 assert.equal(DEMO_GPS_COHORT_DEVICES.length,8);
 assert.equal(assertDemoDevice(DEMO_ADMIN_SPARE_DEVICE.imei),DEMO_ADMIN_SPARE_DEVICE);
 assert.equal([...DEMO_GPS_COHORT_DEVICES].some(device=>device.imei===DEMO_ADMIN_SPARE_DEVICE.imei),false);
 assert.throws(()=>assertDemoDevice('990000000000003'),/DEMO_DEVICE_NOT_ALLOWLISTED/);
});

test('fleet GPS command exposes only the exact vehicle and fixture identity',async()=>{
 const target=DEMO_MOTION_COHORT['fleet-01'],calls=[];
 await executeDemoMotion({action:'CONFIGURE',target:'fleet-01'},async(name,args)=>{calls.push([name,args]);return {};});
 assert.deepEqual(calls,[['configure_demo_motion_target',{target_vehicle_id:target.vehicleId}]]);
 assert.equal(demoMotionCommand.safeParse({action:'CONFIGURE',target:'fleet-09'}).success,false);
 assert.equal(demoMotionCommand.safeParse({action:'CONFIGURE',target:'fleet-01',vehicleId:target.vehicleId}).success,false);
 assertDemoIdentity({email:'falmatad97+lg-public-fleet-01@gmail.com',app_metadata:{fixture_source:'loadgistic'},
  user_metadata:{fixture_key:target.ownerFixtureKey}},target.ownerFixtureKey);
 assertDemoIdentity({email:'falmatad97+lg-public-fleet-driver-014@gmail.com',app_metadata:{fixture_source:'loadgistic'},
  user_metadata:{fixture_key:target.driverFixtureKey}},target.driverFixtureKey);
 assert.throws(()=>assertDemoIdentity({email:'falmatad97+lg-public-fleet-01@gmail.com',app_metadata:{fixture_source:'customer'},
  user_metadata:{fixture_key:target.ownerFixtureKey}},target.ownerFixtureKey),/DEMO_IDENTITY_NOT_ALLOWLISTED/);
});

test('larger runner cohort requires an explicit local opt-in',()=>{
 const script="import {motionTargetNames} from './scripts/telematics/demo-motion-runtime.mjs';console.log(motionTargetNames.length)";
 const base=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',env:{...process.env,LOADGISTIC_DEMO_GPS_COHORT:'false'}});
 const optIn=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',env:{...process.env,LOADGISTIC_DEMO_GPS_COHORT:'true'}});
 assert.equal(base.status,0);assert.equal(base.stdout.trim(),'2');
 assert.equal(optIn.status,0);assert.equal(optIn.stdout.trim(),'10');
});

test('the opted-in runner reserves and stops all eight fleet GPS targets through the narrow command port',async()=>{
 const previous=process.env.LOADGISTIC_DEMO_GPS_COHORT;process.env.LOADGISTIC_DEMO_GPS_COHORT='true';
 try{
  const {runDemoMotion,motionTargetNames}=await import('../scripts/telematics/demo-motion-runtime.mjs?gps-cohort-test');
  assert.equal(motionTargetNames.length,10);
  const leaseId='11111111-1111-4111-8111-111111111111',calls=[];let clock=1000;
  const request=async command=>{calls.push(command);
   if(command.action==='START')return {state:'RUNNING',source:DEMO_MOTION_COHORT[command.target].source,
    epoch:2,leaseId,expiresAt:new Date(100000).toISOString()};
   return command.action==='GPS'?{observedAt:new Date(clock).toISOString()}:{};};
  const result=await runDemoMotion({request,seconds:10,targets:motionTargetNames,staggerMs:0,now:()=>clock,
   sleep:async ms=>{clock+=ms;},simulate:async options=>{await options.beforeReport();return {positions:1};}});
  assert.equal(result.failed,false);
  for(const name of DEMO_MOTION_FLEET_TARGETS){assert.ok(calls.some(command=>command.action==='GPS'&&command.target===name));
   assert.ok(calls.some(command=>command.action==='STOP'&&command.target===name));}
 }finally{if(previous===undefined)delete process.env.LOADGISTIC_DEMO_GPS_COHORT;
  else process.env.LOADGISTIC_DEMO_GPS_COHORT=previous;}
});

test('actual provisioning entrypoint checks all ten targets offline before credentials or writes',()=>{
 const script=new URL('../scripts/telematics/provision-local.mjs',import.meta.url).pathname;
 const run=spawnSync(process.execPath,[script,'--preflight'],{encoding:'utf8',env:{PATH:process.env.PATH||'',LOADGISTIC_DEMO_GPS_COHORT:'true'}});
 assert.equal(run.status,0,run.stderr);
 assert.deepEqual(JSON.parse(run.stdout),{event:'local_telematics_preflight',targetCount:10,wrote:false,network:false});
 const invalid=spawnSync(process.execPath,[script,'--unknown'],{encoding:'utf8',env:{PATH:process.env.PATH||''}});
 assert.notEqual(invalid.status,0);
 assert.match(invalid.stderr,/LOCAL_TELEMATICS_ARGUMENT_REFUSED/);
});
