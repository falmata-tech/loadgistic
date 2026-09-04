import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFeaturedDaySchedule,validateFeaturedScheduleConfig} from '../src/lib/expo-broadcast.js';

test('the generated programme has one session and bounded non-presentation interludes',()=>{
  const date='2026-08-09';
  const keys=Array.from({length:8},(_,index)=>`truck-${index+1}`);
  const initial=buildFeaturedDaySchedule(date,keys);
  const first=initial.walkthroughs[0];
  const schedule=buildFeaturedDaySchedule(date,keys,{},new Date((Date.parse(first.starts_at)+Date.parse(first.ends_at))/2));
  assert.equal(schedule.sessions.length,1);
  assert.equal(schedule.walkthroughs.filter(slot=>slot.current).length,1);
  assert.equal(schedule.entries.some(entry=>entry.type==='PROGRAMME_BREAK'),true);
  assert.equal(schedule.entries.some(entry=>entry.type==='INTERMISSION'),false);
});

test('programme interludes never mark a truck as live',()=>{
  const date='2026-08-09';
  const initial=buildFeaturedDaySchedule(date,['one','two','three','four']);
  const interlude=initial.entries.find(entry=>entry.type==='PROGRAMME_BREAK');
  const schedule=buildFeaturedDaySchedule(date,['one','two','three','four'],{},new Date(Date.parse(interlude.starts_at)+1000));
  assert.equal(schedule.active_entry.type,'PROGRAMME_BREAK');
  assert.equal(schedule.walkthroughs.some(slot=>slot.current),false);
});

test('schedule configuration fixes the concise morning window and bounds interludes',()=>{
  assert.equal(validateFeaturedScheduleConfig({targetCount:6,sponsorBreakEvery:3,sponsorBreakMinutes:1}).targetCount,6);
  assert.throws(()=>validateFeaturedScheduleConfig({dayStart:'08:00'}),/FEATURED_SCHEDULE_WINDOW_INVALID/);
  assert.throws(()=>validateFeaturedScheduleConfig({sponsorBreakMinutes:3}),/FEATURED_SPONSOR_BREAK_DURATION_INVALID/);
  assert.throws(()=>validateFeaturedScheduleConfig({targetCount:13}),/FEATURED_TARGET_COUNT_INVALID/);
});
