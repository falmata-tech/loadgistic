import test from 'node:test';
import assert from 'node:assert/strict';

import {buildFeaturedDaySchedule} from '../src/lib/expo-broadcast.js';

test('automatic schedule fills one 07:30–09:00 programme and shares truck time evenly',()=>{
  const keys=Array.from({length:8},(_,index)=>`truck-${index+1}`);
  const schedule=buildFeaturedDaySchedule('2026-08-10',keys);
  assert.equal(schedule.walkthroughs.length,8);
  assert.equal(schedule.sessions.length,1);
  assert.equal(schedule.sessions[0].time_label,'07:30–09:00');
  assert.equal(schedule.intermission,null);
  assert.equal(schedule.entries.filter(item=>item.type==='PROGRAMME_BREAK').length,3);
  assert.equal(schedule.entries.filter(item=>item.type==='PROGRAMME_BREAK').every(item=>Date.parse(item.ends_at)-Date.parse(item.starts_at)===2*60*1000),true);
  assert.equal(schedule.entries.at(-1).ends_at,schedule.sessions[0].ends_at);
  assert.equal(new Set(schedule.walkthroughs.map(item=>(Date.parse(item.ends_at)-Date.parse(item.starts_at))/60000)).size<=2,true);
});

test('programme never creates more than four two-minute interludes',()=>{
  const schedule=buildFeaturedDaySchedule('2026-08-10',Array.from({length:12},(_,index)=>`truck-${index+1}`));
  assert.equal(schedule.entries.filter(item=>item.type==='PROGRAMME_BREAK').length,4);
  assert.equal(schedule.entries.filter(item=>item.type==='PROGRAMME_BREAK').every(item=>item.time_label&&Date.parse(item.ends_at)-Date.parse(item.starts_at)<=2*60*1000),true);
});

test('manual schedules preserve roster order inside the fixed morning window',()=>{
  const manual=[
    {providerKey:'one',startTime:'07:30',endTime:'08:00'},
    {providerKey:'two',startTime:'08:02',endTime:'09:00'}
  ];
  const schedule=buildFeaturedDaySchedule('2026-08-10',['one','two'],{mode:'MANUAL',manualSchedule:manual});
  assert.deepEqual(schedule.walkthroughs.map(item=>item.provider_key),['one','two']);
  assert.equal(schedule.entries.find(item=>item.type==='PROGRAMME_BREAK').time_label,'08:00–08:02');
  assert.throws(()=>buildFeaturedDaySchedule('2026-08-10',['one','two'],{mode:'MANUAL',manualSchedule:[manual[0],{providerKey:'two',startTime:'07:55',endTime:'08:30'}]}),/FEATURED_MANUAL_SCHEDULE_OVERLAP/);
  assert.throws(()=>buildFeaturedDaySchedule('2026-08-10',['one'],{mode:'MANUAL',manualSchedule:[{providerKey:'one',startTime:'09:00',endTime:'09:10'}]}),/FEATURED_MANUAL_SCHEDULE_OUTSIDE_SESSION/);
});
