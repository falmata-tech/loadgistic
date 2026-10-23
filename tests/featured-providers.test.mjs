import test from 'node:test';
import assert from 'node:assert/strict';

import {buildFeaturedDaySchedule} from '../src/lib/expo-broadcast.js';

test('automatic schedule fills one 08:30–12:00 programme and shares truck time evenly',()=>{
  const keys=Array.from({length:8},(_,index)=>`truck-${index+1}`);
  const schedule=buildFeaturedDaySchedule('2026-08-10',keys);
  assert.equal(schedule.walkthroughs.length,8);
  assert.equal(schedule.sessions.length,1);
  assert.equal(schedule.sessions[0].time_label,'08:30–12:00');
  assert.equal(schedule.intermission,null);
  assert.equal(schedule.entries.filter(item=>item.type==='PROGRAMME_BREAK').length,4);
  assert.equal(schedule.entries.filter(item=>item.type==='PROGRAMME_BREAK').every(item=>Date.parse(item.ends_at)-Date.parse(item.starts_at)===2*60*1000),true);
  assert.equal(schedule.entries.at(-1).ends_at,schedule.sessions[0].ends_at);
  assert.equal(new Set(schedule.walkthroughs.map(item=>(Date.parse(item.ends_at)-Date.parse(item.starts_at))/60000)).size<=2,true);
});

test('programme never creates more than four two-minute interludes',()=>{
  const schedule=buildFeaturedDaySchedule('2026-08-10',Array.from({length:8},(_,index)=>`truck-${index+1}`));
  assert.equal(schedule.entries.filter(item=>item.type==='PROGRAMME_BREAK').length,4);
  assert.equal(schedule.entries.filter(item=>item.type==='PROGRAMME_BREAK').every(item=>item.time_label&&Date.parse(item.ends_at)-Date.parse(item.starts_at)<=2*60*1000),true);
});

test('random subset size determines slot durations without phantom target entries',()=>{
  for(let count=1;count<=8;count++){
    const keys=Array.from({length:count},(_,index)=>`pair-${index}`);
    const schedule=buildFeaturedDaySchedule('2026-09-21',keys,{config:{targetCount:count}});
    assert.deepEqual(schedule.walkthroughs.map(item=>item.provider_key),keys);
    const minutes=schedule.walkthroughs.map(item=>(Date.parse(item.ends_at)-Date.parse(item.starts_at))/60000);
    assert.ok(Math.max(...minutes)-Math.min(...minutes)<=1);
    assert.equal(schedule.entries[0].starts_at,'2026-09-21T05:30:00.000Z');
    assert.equal(schedule.entries.at(-1).ends_at,'2026-09-21T09:00:00.000Z');
  }
});

test('manual schedules preserve roster order inside the fixed morning window',()=>{
  const manual=[
    {providerKey:'one',startTime:'08:30',endTime:'10:00'},
    {providerKey:'two',startTime:'10:02',endTime:'11:58'}
  ];
  const schedule=buildFeaturedDaySchedule('2026-08-10',['one','two'],{mode:'MANUAL',manualSchedule:manual});
  assert.deepEqual(schedule.walkthroughs.map(item=>item.provider_key),['one','two']);
  assert.equal(schedule.entries.find(item=>item.type==='PROGRAMME_BREAK').time_label,'10:00–10:02');
  assert.throws(()=>buildFeaturedDaySchedule('2026-08-10',['one','two'],{mode:'MANUAL',manualSchedule:[manual[0],{providerKey:'two',startTime:'09:55',endTime:'11:58'}]}),/FEATURED_MANUAL_SCHEDULE_OVERLAP/);
  assert.throws(()=>buildFeaturedDaySchedule('2026-08-10',['one'],{mode:'MANUAL',manualSchedule:[{providerKey:'one',startTime:'12:00',endTime:'12:10'}]}),/FEATURED_MANUAL_SCHEDULE_OUTSIDE_SESSION/);
});


test('new default reserves exactly eight minutes, including a closing mention, and roundtrips to manual',()=>{
 const automatic=buildFeaturedDaySchedule('2026-09-25',8);
 assert.equal(automatic.walkthroughs.reduce((sum,s)=>sum+(Date.parse(s.ends_at)-Date.parse(s.starts_at))/60000,0),202);
 assert.equal(automatic.entries.at(-1).type,'PROGRAMME_BREAK');
 assert.equal(automatic.entries.at(-1).time_label,'11:58–12:00');
 const times=iso=>new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Addis_Ababa',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso));
 const manual=buildFeaturedDaySchedule('2026-09-25',8,{mode:'MANUAL',manualSchedule:automatic.walkthroughs.map(s=>({providerKey:s.provider_key,startTime:times(s.starts_at),endTime:times(s.ends_at)}))});
 assert.deepEqual(manual.entries,automatic.entries);
 for(let i=1;i<automatic.entries.length;i++)assert.equal(automatic.entries[i].starts_at,automatic.entries[i-1].ends_at);
});

test('sparse days keep real pairs and bounded mentions; an empty day has no imaginary programme',()=>{
 for(let count=0;count<=8;count++){
  const schedule=buildFeaturedDaySchedule('2026-09-25',count);
  assert.equal(schedule.walkthroughs.length,count);
  assert.equal(schedule.entries.filter(s=>s.type==='PROGRAMME_BREAK').length,Math.min(4,count));
 }
 assert.throws(()=>buildFeaturedDaySchedule('2026-09-25',9),/FEATURED_TARGET_COUNT_INVALID/);
 assert.equal(buildFeaturedDaySchedule('2026-09-25',8,{config:{sponsorBreakCount:0}}).entries.length,8);
});

test('historical hours require explicit read compatibility; new writes cannot use them',()=>{
 const config={dayStart:'07:30',dayEnd:'09:00',targetCount:8,sponsorBreakEvery:2,sponsorBreakMinutes:2};
 assert.throws(()=>buildFeaturedDaySchedule('2026-09-20',8,{config}),/FEATURED_SCHEDULE_WINDOW_INVALID/);
 const old=buildFeaturedDaySchedule('2026-09-20',8,{config,allowLegacyWindow:true});
 assert.equal(old.display_label,'07:30–09:00');assert.equal(old.entries.filter(s=>s.type==='PROGRAMME_BREAK').length,3);
 assert.equal(old.entries.at(-1).ends_at,'2026-09-20T06:00:00.000Z');
});

test('manual opening/closing gaps count as mentions and cannot hide dead airtime',()=>{
 const build=manualSchedule=>buildFeaturedDaySchedule('2026-09-25',['one'],{mode:'MANUAL',manualSchedule});
 assert.equal(build([{providerKey:'one',startTime:'08:32',endTime:'11:58'}]).entries.length,3);
 assert.throws(()=>build([{providerKey:'one',startTime:'08:33',endTime:'12:00'}]),/FEATURED_MANUAL_BREAK_INVALID/);
 assert.throws(()=>build([{providerKey:'one',startTime:'08:30',endTime:'11:57'}]),/FEATURED_MANUAL_BREAK_INVALID/);
 assert.throws(()=>buildFeaturedDaySchedule('2026-09-25',['a','b','c','d'],{mode:'MANUAL',manualSchedule:[
 {providerKey:'a',startTime:'08:31',endTime:'09:00'},{providerKey:'b',startTime:'09:01',endTime:'10:00'},
 {providerKey:'c',startTime:'10:01',endTime:'11:00'},{providerKey:'d',startTime:'11:01',endTime:'11:59'}]}),/FEATURED_MANUAL_BREAK_INVALID/);
});
