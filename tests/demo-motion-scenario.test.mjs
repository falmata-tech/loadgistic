import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateDemoMotionCatalog,demoMotionScenarioFix,assertDemoMotionReport} from '../src/lib/demo-motion-scenario.mjs';
import {DEMO_MOTION_COHORT} from '../src/lib/demo-motion-cohort.js';
import {executeDemoMotion} from '../src/lib/demo-motion-auth.js';
import {gpsPacket,simulate} from '../scripts/telematics/simulator.mjs';

const catalog=JSON.parse(readFileSync(new URL('../resources/fixtures/demo-road-catalog.json',import.meta.url)));
const distance=(a,b)=>Math.hypot((b.latitude-a.latitude)*111195,(b.longitude-a.longitude)*111195*Math.cos((a.latitude+b.latitude)*Math.PI/360));
const command=(target,at)=>{const fix=demoMotionScenarioFix(target,at);return {action:target==='personal-truck'?'PHONE':'GPS',target,latitude:fix.latitude,longitude:fix.longitude};};

test('only exact reviewed road evidence and explicit stationary/unavailable classifications qualify',()=>{
 assert.equal(validateDemoMotionCatalog(catalog),true);
 assert.deepEqual(Object.values(catalog.courses).map(course=>course.mode).sort(),
  ['ROAD_LEG','ROAD_LEG','ROAD_LEG','ROAD_LEG','ROAD_LEG','ROAD_LEG','ROAD_LEG','STATIONARY','STATIONARY','UNAVAILABLE'].sort());
 for(const change of [copy=>copy.source.sha256='a'.repeat(64),
  copy=>{copy.courses['personal-truck'].coordinates[0][0]+=0.0001;
   copy.courses['personal-truck'].geometry_sha256=createHash('sha256').update(JSON.stringify(copy.courses['personal-truck'].coordinates)).digest('hex');},
  copy=>copy.courses['personal-truck'].purpose='MARKET_JOURNEY',
  copy=>copy.courses['fleet-08'].mode='STATIONARY',
  copy=>copy.courses['fleet-01'].vehicle_id=DEMO_MOTION_COHORT['fleet-02'].vehicleId]){
  const copy=structuredClone(catalog);change(copy);assert.throws(()=>validateDemoMotionCatalog(copy),/DEMO_MOTION_CATALOG_DENIED/);
 }
});

test('road playback follows source segments with dwell/reversal, bounded speed and restart continuity',()=>{
 for(const [target,course] of Object.entries(catalog.courses)){
  if(course.mode==='UNAVAILABLE'){
   assert.throws(()=>demoMotionScenarioFix(target,0),/DEMO_MOTION_SCENARIO_UNAVAILABLE/);continue;
  }
  let moved=false;const phases=new Set();
  for(let seconds=0;seconds<3200;seconds+=1){
   const fix=demoMotionScenarioFix(target,seconds*1000),next=demoMotionScenarioFix(target,(seconds+1)*1000);
   assert.deepEqual(demoMotionScenarioFix(target,seconds*1000),fix,'restart cannot reset progress');
   assert.ok(distance(fix,next)<=5.57,'no teleport at dwell, reverse or cycle boundary');
   assert.ok(fix.course>=0&&fix.course<360);assert.ok([0,20].includes(fix.speedKph));
   if(fix.speedKph===0)assert.equal(fix.course,0);
   phases.add(fix.step);moved||=distance(fix,next)>0.1;
   assert.ok(Math.abs(fix.latitude-DEMO_MOTION_COHORT[target].latitude)<0.035);
   assert.ok(Math.abs(fix.longitude-DEMO_MOTION_COHORT[target].longitude)<0.035);
  }
  if(course.mode==='ROAD_LEG'){
   assert.equal(moved,true);for(const step of ['DWELL_START','OUTBOUND','DWELL_END','RETURNING'])assert.ok(phases.has(step));
   const start=demoMotionScenarioFix(target,0);
   assert.equal(start.longitude,course.coordinates[0][0]);assert.equal(start.latitude,course.coordinates[0][1]);
  }else{assert.equal(moved,false);assert.deepEqual([...phases],['STATIONARY']);}
 }
});

test('server report validation rejects arbitrary in-box and wrong-time road points before storage',()=>{
 const at=90000,target='personal-truck',valid=command(target,at);
 assert.equal(assertDemoMotionReport(valid,{now:at,issuedAt:at}).purpose,'PROTOCOL_LOCAL');
 assert.doesNotThrow(()=>assertDemoMotionReport({...valid,latitude:valid.latitude+1/1800000},{now:at+4000,issuedAt:at}));
 assert.throws(()=>assertDemoMotionReport({...valid,latitude:9.03,longitude:38.76},{now:at,issuedAt:at}),/DEMO_MOTION_REPORT_DENIED/);
 assert.throws(()=>assertDemoMotionReport(command(target,at+60000),{now:at,issuedAt:at}),/DEMO_MOTION_REPORT_DENIED/);
 assert.throws(()=>assertDemoMotionReport(valid,{now:at+5001,issuedAt:at}),/DEMO_MOTION_REPORT_DENIED/);
 assert.throws(()=>assertDemoMotionReport({...valid,target:'company-truck',action:'GPS'},{now:at,issuedAt:at}),/DEMO_MOTION_REPORT_DENIED/);
 assert.throws(()=>assertDemoMotionReport({...valid,action:'GPS'},{now:at,issuedAt:at}),/DEMO_MOTION_REPORT_DENIED/);
});

test('local command port applies the same catalog guard before the narrow database call',async()=>{
 const at=90000,target='personal-truck',fix=command(target,at),calls=[];
 const input={...fix,leaseId:'11111111-1111-4111-8111-111111111111',epoch:3};
 await executeDemoMotion(input,async(name,args)=>{calls.push({name,args});return {recorded:true};},{now:at,issuedAt:at});
 assert.equal(calls.length,1);assert.equal(calls[0].name,'report_demo_phone_location');
 calls.length=0;
 await assert.rejects(executeDemoMotion({...input,...command(target,at+90000)},async()=>{calls.push('INVALID');},{now:at,issuedAt:at}),/DEMO_MOTION_REPORT_DENIED/);
 await assert.rejects(executeDemoMotion({action:'CONFIGURE',target:'fleet-08'},async()=>{calls.push('INVALID');},{now:at}),/DEMO_MOTION_SCENARIO_UNAVAILABLE/);
 assert.deepEqual(calls,[]);
});

test('stationary and moving GT06 packets retain actual catalog speed and heading',()=>{
 const stationary=demoMotionScenarioFix('company-truck',0);
 const idlePacket=gpsPacket(stationary,2,new Date('2026-11-13T12:00:00Z'));
 assert.equal(idlePacket[19],0);assert.equal(idlePacket.readUInt16BE(20)&0x3ff,0);
 const moving=demoMotionScenarioFix('personal-truck',90000);
 assert.equal(moving.speedKph,20);
 const packet=gpsPacket(moving,3,new Date('2026-11-13T12:01:00Z'));
 assert.equal(packet[19],20);assert.equal(packet.readUInt16BE(20)&0x3ff,Math.round(moving.course)%360);
});

test('legacy arbitrary motion flag is refused before opening a protocol socket',async()=>{
 await assert.rejects(simulate({motion:true}),/DEMO_MOTION_SCENARIO_REQUIRED/);
});
