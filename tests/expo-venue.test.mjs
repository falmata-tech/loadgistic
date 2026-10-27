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

test('schedule configuration fixes the evening window and bounds interludes',()=>{
  assert.equal(validateFeaturedScheduleConfig({targetCount:6,sponsorBreakCount:3,sponsorBreakMinutes:1}).targetCount,6);
  assert.throws(()=>validateFeaturedScheduleConfig({dayStart:'08:00'}),/FEATURED_SCHEDULE_WINDOW_INVALID/);
  assert.throws(()=>validateFeaturedScheduleConfig({sponsorBreakMinutes:3}),/FEATURED_SPONSOR_BREAK_DURATION_INVALID/);
  assert.throws(()=>validateFeaturedScheduleConfig({sponsorBreakCount:5}),/FEATURED_SPONSOR_BREAK_COUNT_INVALID/);
  assert.throws(()=>validateFeaturedScheduleConfig({targetCount:9}),/FEATURED_TARGET_COUNT_INVALID/);
});

test('eight providers receive at least ten whole minutes within the same-date evening window',()=>{
 const schedule=buildFeaturedDaySchedule('2026-10-26',8);
 assert.equal(schedule.config.dayStart,'22:30');assert.equal(schedule.config.dayEnd,'23:59');
 assert.equal(schedule.entries[0].starts_at,'2026-10-26T19:30:00.000Z');
 assert.equal(schedule.entries.at(-1).ends_at,'2026-10-26T20:59:00.000Z');
 const minutes=slot=>(Date.parse(slot.ends_at)-Date.parse(slot.starts_at))/60000;
 assert.deepEqual(schedule.walkthroughs.map(minutes),[11,10,10,10,10,10,10,10]);
 const pauses=schedule.entries.filter(entry=>entry.type==='PROGRAMME_BREAK');assert.equal(pauses.length,4);assert.deepEqual(pauses.map(minutes),[2,2,2,2]);
 assert.equal(schedule.walkthroughs.reduce((sum,slot)=>sum+minutes(slot),0),81);
 assert.equal(schedule.entries.some(entry=>/morning/i.test(entry.session_label)),false);assert.equal(schedule.sessions[0].label,'Evening programme');
 for(let index=1;index<schedule.entries.length;index++)assert.equal(schedule.entries[index].starts_at,schedule.entries[index-1].ends_at);
});

test('every permitted provider and sponsor count fits without shrinking a provider below ten minutes',()=>{
 for(let count=1;count<=8;count++)for(let sponsorBreakCount=0;sponsorBreakCount<=4;sponsorBreakCount++)for(const sponsorBreakMinutes of [1,2]){
  const schedule=buildFeaturedDaySchedule('2028-02-29',count,{config:{targetCount:count,sponsorBreakCount,sponsorBreakMinutes}});
  assert.equal(schedule.entries[0].starts_at,'2028-02-29T19:30:00.000Z');assert.equal(schedule.entries.at(-1).ends_at,'2028-02-29T20:59:00.000Z');
  assert.ok(schedule.walkthroughs.every(slot=>(Date.parse(slot.ends_at)-Date.parse(slot.starts_at))>=10*60000));
  assert.ok(schedule.entries.filter(entry=>entry.type==='PROGRAMME_BREAK').length<=4);
 }
});

test('evening phase ends at 23:59 EAT and never borrows the next date',()=>{
 for(const [now,phase] of [['2026-10-26T19:29:59Z','scheduled'],['2026-10-26T19:30:00Z','live'],['2026-10-26T20:59:00Z','ended'],['2026-10-26T21:00:00Z','ended']]){
  const schedule=buildFeaturedDaySchedule('2026-10-26',8,{},Date.parse(now));assert.equal(schedule.phase,phase);
  if(phase==='ended')assert.equal(schedule.active_entry,null);
 }
});

test('strict new manual schedules reject short turns, earlier times and midnight before save',()=>{
 const options={mode:'MANUAL',config:{targetCount:2},manualSchedule:[{providerKey:'one',startTime:'22:30',endTime:'22:40'},{providerKey:'two',startTime:'22:40',endTime:'23:59'}]};
 assert.equal(buildFeaturedDaySchedule('2026-10-26',['one','two'],options).walkthroughs.length,2);
 const short={...options,manualSchedule:[{providerKey:'one',startTime:'22:30',endTime:'22:39'},{providerKey:'two',startTime:'22:39',endTime:'23:59'}]};
 assert.throws(()=>buildFeaturedDaySchedule('2026-10-26',['one','two'],short),/FEATURED_MANUAL_SCHEDULE_TOO_SHORT/);
 assert.throws(()=>buildFeaturedDaySchedule('2026-10-26',['one','two'],{...options,manualSchedule:[{providerKey:'one',startTime:'22:29',endTime:'22:40'},options.manualSchedule[1]]}),/FEATURED_MANUAL_SCHEDULE_OUTSIDE_SESSION/);
 assert.throws(()=>buildFeaturedDaySchedule('2026-10-26',['one','two'],{...options,manualSchedule:[options.manualSchedule[0],{providerKey:'two',startTime:'22:40',endTime:'24:00'}]}),/FEATURED_MANUAL_SCHEDULE_INVALID/);
 assert.throws(()=>buildFeaturedDaySchedule('2026-10-26',['one','two'],{...options,manualSchedule:[options.manualSchedule[0],{providerKey:'two',startTime:'22:40',endTime:'00:00'}]}),/FEATURED_MANUAL_SCHEDULE_INVALID/);
});

test('saved morning and legacy programmes retain their recorded times on explicitly compatible reads',()=>{
 const morning={dayStart:'08:30',dayEnd:'12:00',targetCount:3,sponsorBreakCount:4,sponsorBreakMinutes:2};
 const manualSchedule=[{providerKey:'one',startTime:'08:30',endTime:'08:35'},{providerKey:'two',startTime:'08:35',endTime:'11:55'},{providerKey:'three',startTime:'11:55',endTime:'12:00'}];
 const saved=buildFeaturedDaySchedule('2026-08-09',['one','two','three'],{config:morning,mode:'MANUAL',manualSchedule,allowLegacyWindow:true});
 assert.equal(saved.entries[0].starts_at,'2026-08-09T05:30:00.000Z');assert.equal(saved.entries.at(-1).ends_at,'2026-08-09T09:00:00.000Z');assert.equal(saved.mode,'MANUAL');
 assert.equal(saved.walkthroughs[0].ends_at,'2026-08-09T05:35:00.000Z');assert.equal(saved.sessions[0].label,'Morning programme');
 const legacy=buildFeaturedDaySchedule('2026-08-08',12,{config:{dayStart:'07:30',dayEnd:'09:00',targetCount:12,sponsorBreakEvery:2,sponsorBreakMinutes:2},allowLegacyWindow:true});
 assert.equal(legacy.entries[0].starts_at,'2026-08-08T04:30:00.000Z');assert.equal(legacy.entries.at(-1).ends_at,'2026-08-08T06:00:00.000Z');
 assert.throws(()=>buildFeaturedDaySchedule('2026-08-09',['one','two','three'],{config:morning,mode:'MANUAL',manualSchedule}),/FEATURED_SCHEDULE_WINDOW_INVALID/);
});
