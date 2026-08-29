import test from 'node:test';
import assert from 'node:assert/strict';

import {buildFeaturedDaySchedule} from '../src/lib/expo-broadcast.js';

test('automatic schedule shares provider time equally and keeps operational breaks separate',()=>{
  const keys=Array.from({length:15},(_,index)=>`provider-${index+1}`);
  const schedule=buildFeaturedDaySchedule('2026-08-10',keys);
  assert.equal(schedule.walkthroughs.length,15);
  assert.equal(schedule.sessions[0].time_label,'08:00–13:00');
  assert.equal(schedule.sessions[1].time_label,'17:35–22:00');
  assert.equal(Date.parse(schedule.intermission.ends_at)-Date.parse(schedule.intermission.starts_at),4*60*60*1000);
  assert.deepEqual(new Set(schedule.walkthroughs.map(item=>(Date.parse(item.ends_at)-Date.parse(item.starts_at))/60000)),new Set([25]));
  assert.equal(schedule.entries.filter(item=>item.type==='SPONSOR_BREAK').length,4);
  assert.equal(schedule.entries.filter(item=>item.type==='TRANSITION').length,13);
});

test('small automatic rosters shrink toward late morning and late evening',()=>{
  const schedule=buildFeaturedDaySchedule('2026-08-10',['morning-provider','evening-provider']);
  assert.equal(schedule.sessions[0].time_label,'12:30–13:00');
  assert.equal(schedule.sessions[1].time_label,'21:30–22:00');
  assert.equal(schedule.walkthroughs.every(item=>item.time_label.endsWith(item.session==='MORNING'?'13:00':'22:00')),true);
});

test('manual schedules keep roster identity, reject overlap, and never cross the intermission',()=>{
  const manual=[
    {providerKey:'one',startTime:'10:00',endTime:'10:40'},
    {providerKey:'two',startTime:'17:30',endTime:'18:10'}
  ];
  const schedule=buildFeaturedDaySchedule('2026-08-10',['one','two'],{mode:'MANUAL',manualSchedule:manual});
  assert.deepEqual(schedule.walkthroughs.map(item=>item.provider_key),['one','two']);
  assert.throws(()=>buildFeaturedDaySchedule('2026-08-10',['one','two'],{
    mode:'MANUAL',manualSchedule:[manual[0],{providerKey:'two',startTime:'10:30',endTime:'11:00'}]
  }),/FEATURED_MANUAL_SCHEDULE_OVERLAP/);
  assert.throws(()=>buildFeaturedDaySchedule('2026-08-10',['one','two'],{
    mode:'MANUAL',manualSchedule:[manual[0],{providerKey:'two',startTime:'12:50',endTime:'17:10'}]
  }),/FEATURED_MANUAL_SCHEDULE_OUTSIDE_SESSION/);
});
