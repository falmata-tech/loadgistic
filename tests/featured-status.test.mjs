import test from 'node:test';
import assert from 'node:assert/strict';
import {featuredRunState,featuredDayState} from '../src/lib/featured-status.js';
test('Featured distinguishes paused, never-run, failed and stale automation from a fresh successful check',()=>{
 const now=Date.parse('2026-09-24T12:00:00Z'),fresh={checked_at:'2026-09-24T11:55:00Z',outcome:'READY'};
 assert.equal(featuredRunState('AUTO',fresh,now),'READY');
 assert.equal(featuredRunState('MANUAL',fresh,now),'PAUSED');
 assert.equal(featuredRunState('AUTO',{},now),'NOT_RUN');
 assert.equal(featuredRunState('AUTO',{...fresh,outcome:'FAILED'},now),'FAILED');
 assert.equal(featuredRunState('AUTO',{...fresh,checked_at:'2026-09-24T11:00:00Z'},now),'STALE');
 assert.equal(featuredRunState('AUTO',{...fresh,checked_at:'invalid'},now),'STALE');
 assert.equal(featuredRunState('AUTO',{...fresh,checked_at:'2026-09-25T11:00:00Z'},now),'STALE');
});
test('Featured tells protected drafts, broken saved pairs and fair-rotation gaps apart',()=>{
 assert.equal(featuredDayState({status:'DRAFT'},5),'DRAFT');
 assert.equal(featuredDayState({status:'PUBLISHED',invalid:1},5),'NEEDS_REVIEW');
 assert.equal(featuredDayState({status:'PUBLISHED',invalid:0,selected:0},5),'NEEDS_REVIEW');
 assert.equal(featuredDayState({status:'PUBLISHED',invalid:0},5),'PUBLISHED');
 assert.equal(featuredDayState({eligible:0,remaining:0},5),'NO_ELIGIBLE');
 assert.equal(featuredDayState({eligible:3,remaining:0},5),'ROUND_WAIT');
 assert.equal(featuredDayState({eligible:3,remaining:0},0),'NOT_PREPARED');
 assert.equal(featuredDayState({eligible:3,remaining:2},5),'NOT_PREPARED');
});
