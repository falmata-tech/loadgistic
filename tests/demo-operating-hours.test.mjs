import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DEMO_OPERATING_CRON,demoOperatingHoursOpen,demoOperatingWindowEnd} from '../src/lib/demo-operating-hours.mjs';
import {config as capacitySchedule,runDemoCapacity} from '../netlify/functions/demo-capacity.mjs';
import {config as motionSchedule,dispatchNetlifyMotion} from '../netlify/functions/demo-motion.mjs';
import {executeNetlifyMotion} from '../netlify/functions/demo-motion-background.mjs';
import {handleNetlifyDemoMotion} from '../src/lib/demo-motion-netlify-http.js';
import {NETLIFY_MOTION_PATH,NETLIFY_MOTION_BACKGROUND,NETLIFY_MOTION_SCHEDULE,signedNetlifyMotion,runNetlifyMotionWindow} from '../src/lib/demo-motion-netlify.mjs';
import {handleDemoCapacityAdvance} from '../src/lib/demo-world-advance.js';
import {createDemoWorldSignature,DEMO_CAPACITY_ADVANCE_PATH,DEMO_WORLD_SIGNATURE_HEADER,DEMO_WORLD_TIMESTAMP_HEADER} from '../src/lib/demo-world-worker-auth.js';

const origin='https://demo-hours.example',site=randomUUID(),secret='a'.repeat(64);
const environment={NODE_ENV:'production',CONTEXT:'production',SITE_ID:site,URL:origin,
 NEXT_PUBLIC_SUPABASE_URL:'https://demo-hours.supabase.co',
 LOADGISTIC_HOSTED_MOTION_ENABLED:'true',LOADGISTIC_HOSTED_MOTION_KILL_SWITCH:'false',
 LOADGISTIC_HOSTED_MOTION_SITE_ID:site,LOADGISTIC_HOSTED_MOTION_SITE_ORIGIN:origin,
 LOADGISTIC_HOSTED_MOTION_SUPABASE_URL:'https://demo-hours.supabase.co',HOSTED_DEMO_MOTION_SECRET:secret,
 LOADGISTIC_DEMO_MOTION_NETLIFY_ENABLED:'true',LOADGISTIC_DEMO_MOTION_NETLIFY_KILL_SWITCH:'false',
 LOADGISTIC_DEMO_WORLD_ENABLED:'true',LOADGISTIC_DEMO_WORLD_KILL_SWITCH:'false',
 LOADGISTIC_DEMO_WORLD_SITE_ID:site,LOADGISTIC_DEMO_WORLD_SITE_ORIGIN:origin,
 LOADGISTIC_DEMO_CAPACITY_NETLIFY_ENABLED:'true',LOADGISTIC_DEMO_CAPACITY_NETLIFY_KILL_SWITCH:'false',
 DEMO_CAPACITY_WORKER_SECRET:'b'.repeat(64)};

test('both native schedules allow exactly two daily hours in Addis Ababa across seasons and weekends',()=>{
 assert.deepEqual(capacitySchedule,motionSchedule);assert.equal(capacitySchedule.schedule,DEMO_OPERATING_CRON);
 assert.equal(DEMO_OPERATING_CRON,'* 6-7 * * *');
 for(const day of ['2026-01-03','2026-07-05','2026-11-15']){
  const midnight=Date.parse(day+'T00:00:00Z'),open=[];
  for(let minute=0;minute<1440;minute++)if(demoOperatingHoursOpen(midnight+minute*60000))open.push(midnight+minute*60000);
  assert.equal(open.length,120);
  const local=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Addis_Ababa',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  assert.equal(local.format(open[0]),'09:00');assert.equal(local.format(open.at(-1)),'10:59');
  assert.equal(demoOperatingWindowEnd(open[0]),Date.parse(day+'T08:00:00Z'));
 }
 for(const value of [NaN,Infinity,-1,Date.parse('2026-11-15T05:59:59.999Z'),Date.parse('2026-11-15T08:00:00Z')]){
  assert.equal(demoOperatingHoursOpen(value),false);assert.equal(demoOperatingWindowEnd(value),null);
 }
 assert.equal(demoOperatingHoursOpen(Date.parse('2026-11-15T07:59:59.999Z')),true);
});

test('fresh signed late or manual invocations cannot open storage or dispatch either simulator outside hours',async()=>{
 let network=0,storage=0;
 const fetchImpl=async()=>{network++;throw Error('UNEXPECTED_NETWORK');},clientFactory=()=>{storage++;throw Error('UNEXPECTED_STORAGE');};
 for(const iso of ['2026-11-15T05:59:59.999Z','2026-11-15T08:00:00Z','2026-11-15T23:00:00Z']){
  const at=Date.parse(iso),body=JSON.stringify({action:'CLAIM',runId:randomUUID()});
  const signed=path=>new Request(origin+path,{method:'POST',body,headers:signedNetlifyMotion({origin,secret},path,body,at)});
  assert.deepEqual(await dispatchNetlifyMotion(new Request(origin+NETLIFY_MOTION_SCHEDULE),{environment,now:()=>at,fetchImpl}),{enabled:false});
  assert.deepEqual(await executeNetlifyMotion(signed(NETLIFY_MOTION_BACKGROUND),{environment,now:()=>at,fetchImpl}),{enabled:false});
  const response=await handleNetlifyDemoMotion(signed(NETLIFY_MOTION_PATH),{environment,now:at,clientFactory});
  assert.equal(response.status,503);assert.equal((await response.json()).code,'DEMO_HOSTED_DISABLED');
  assert.deepEqual(await runDemoCapacity({invocationUrl:origin+'/.netlify/functions/demo-capacity',environment,now:at,fetchImpl}),{enabled:false});
  const capacityBody='{"limit":2}',timestamp=String(at),url=origin+DEMO_CAPACITY_ADVANCE_PATH;
  const capacity=await handleDemoCapacityAdvance(new Request(url,{method:'POST',body:capacityBody,headers:{
   [DEMO_WORLD_TIMESTAMP_HEADER]:timestamp,
   [DEMO_WORLD_SIGNATURE_HEADER]:createDemoWorldSignature({timestamp,url,purpose:'capacity-advance',body:capacityBody},environment)
  }}),{environment,now:at,clientFactory});
  assert.equal(capacity.status,403);assert.equal((await capacity.json()).code,'OUTSIDE_DEMO_HOURS');
 }
 // Still within the HMAC freshness period, but already past closing by the
 // receiving server's clock. An earlier signature cannot extend the window.
 const close=Date.parse('2026-11-15T08:00:00Z'),body=JSON.stringify({action:'CLAIM',runId:randomUUID()});
 const delayed=await handleNetlifyDemoMotion(new Request(origin+NETLIFY_MOTION_PATH,{method:'POST',body,
  headers:signedNetlifyMotion({origin,secret},NETLIFY_MOTION_PATH,body,close-1000)}),{environment,now:close+1000,clientFactory});
 assert.equal(delayed.status,503);
 assert.equal(network,0);assert.equal(storage,0);
});

test('the final motion window never waits past closing time or starts its second due report',async()=>{
 const start=Date.parse('2026-11-15T07:59:55Z');let clock=start,reports=0;
 const result=await runNetlifyMotionWindow({runId:randomUUID(),now:()=>clock,
  sleep:async ms=>{clock+=ms;},client:async input=>{
   if(input.action==='CLAIM')return {claimed:true,expiresAt:new Date(start+55000).toISOString()};
   if(input.action==='PREPARE')return {ready:true,dueAt:new Date(start+1000).toISOString()};
   reports++;assert.ok(clock<Date.parse('2026-11-15T08:00:00Z'));
   return {recorded:true,dueAt:new Date(clock+30000).toISOString()};
  }});
 assert.equal(result.failed,0);assert.equal(result.recorded,10);assert.equal(result.notDue,10);assert.equal(reports,10);
 let calls=0;
 const closed=await runNetlifyMotionWindow({runId:randomUUID(),now:()=>Date.parse('2026-11-15T08:00:00Z'),client:async()=>{calls++;}});
 assert.equal(closed.claimed,false);assert.equal(calls,0);
});
