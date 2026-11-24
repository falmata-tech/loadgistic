import test from 'node:test';
import assert from 'node:assert/strict';
import {capacityJourneyInput,capacityJourneyTime,capacityJourneyWindow} from '../src/lib/capacity-journey.js';
import {capacityFilterParams} from '../src/lib/capacity-filter-values.js';
import {capacityDatabaseFilters} from '../src/lib/capacity-viewport.js';

test('optional Ethiopian journey times round-trip through UTC and allow overnight travel',()=>{
 const window=capacityJourneyWindow('2027-02-03 23:30','2027-02-04T01:00');
 assert.deepEqual(window,{start:'2027-02-03T20:30:00.000Z',end:'2027-02-03T22:00:00.000Z'});
 assert.equal(capacityJourneyInput(window.end),'2027-02-04T01:00');
 assert.deepEqual(capacityJourneyWindow('','2027-02-04T01:00'),{start:'',end:window.end});
 assert.throws(()=>capacityJourneyWindow('2027-02-04T02:00','2027-02-04T01:00'),/INVALID_CAPACITY_JOURNEY_RANGE/);
});

test('invalid calendar, date, clock, and offset values are rejected',()=>{
 for(const value of [Infinity,'2027-02-29T10:00','2027-01-01','2027-02-03T24:00','2027-02-03T10:00+14:01','0001-01-01T00:00']){
  assert.throws(()=>capacityJourneyTime(value),/INVALID_CAPACITY_JOURNEY_TIME/,String(value));
 }
 assert.equal(capacityJourneyTime('2028-02-29T10:20'),'2028-02-29T07:20:00.000Z');
});

test('public and private adapters share normalized time filters and reject duplicates',()=>{
 const query=capacityFilterParams(new URLSearchParams({departAfter:'2027-02-03T07:30',arriveBy:'2027-02-03T11:00'}));
 const database=capacityDatabaseFilters(query);
 assert.equal(database.depart_after,'2027-02-03T04:30:00.000Z');
 assert.equal(database.arrive_by,'2027-02-03T08:00:00.000Z');
 assert.equal(Object.hasOwn(capacityDatabaseFilters({}),'depart_after'),false);
 assert.throws(()=>capacityFilterParams(new URLSearchParams('departAfter=a&departAfter=b')),/INVALID_CAPACITY_FILTER/);
 assert.throws(()=>capacityFilterParams(new URLSearchParams({departAfter:'2027-02-03T12:00',arriveBy:'2027-02-03T11:00'})),/INVALID_CAPACITY_FILTER/);
});
