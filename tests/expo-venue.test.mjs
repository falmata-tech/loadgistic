import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFeaturedDaySchedule,validateFeaturedScheduleConfig} from '../src/lib/expo-broadcast.js';

test('the generated programme includes two sessions and non-presentation breaks',()=>{
  const date='2026-08-09';
  const keys=Array.from({length:12},(_,index)=>`transporter-${index+1}`);
  const initial=buildFeaturedDaySchedule(date,keys);
  const firstProvider=initial.walkthroughs[0];
  const schedule=buildFeaturedDaySchedule(date,keys,{},new Date((Date.parse(firstProvider.starts_at)+Date.parse(firstProvider.ends_at))/2));
  assert.equal(schedule.sessions.length,2);
  assert.equal(schedule.walkthroughs.length,12);
  assert.equal(schedule.walkthroughs.filter(slot=>slot.current).length,1);
  assert.equal(schedule.entries.some(entry=>entry.type==='TRANSITION'),true);
  assert.equal(schedule.entries.some(entry=>entry.type==='SPONSOR_BREAK'),true);
  assert.equal(schedule.entries.some(entry=>entry.type==='INTERMISSION'),true);
  const providerDuration=new Set(schedule.walkthroughs.map(slot=>Date.parse(slot.ends_at)-Date.parse(slot.starts_at)));
  assert.equal(providerDuration.size,1);
});

test('break time never marks a transporter as live',()=>{
  const date='2026-08-09';
  const first=buildFeaturedDaySchedule(date,['one','two','three','four']);
  const transition=first.entries.find(entry=>entry.type==='TRANSITION');
  const schedule=buildFeaturedDaySchedule(date,['one','two','three','four'],{},new Date(Date.parse(transition.starts_at)+1000));
  assert.equal(schedule.active_entry.type,'TRANSITION');
  assert.equal(schedule.walkthroughs.some(slot=>slot.current),false);
});

test('schedule configuration keeps a four-hour intermission inside the 08:00–22:00 envelope',()=>{
  assert.deepEqual(validateFeaturedScheduleConfig({dayStart:'09:00',morningEnd:'12:00',eveningStart:'16:00',dayEnd:'21:00'}).dayStart,'09:00');
  assert.throws(()=>validateFeaturedScheduleConfig({dayStart:'07:00'}),/FEATURED_SCHEDULE_WINDOW_INVALID/);
  assert.throws(()=>validateFeaturedScheduleConfig({morningEnd:'13:00',eveningStart:'16:00'}),/FEATURED_INTERMISSION_INVALID/);
});
