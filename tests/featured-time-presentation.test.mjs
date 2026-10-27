import test from 'node:test';
import assert from 'node:assert/strict';
import {featuredClock,featuredRange,featuredRangeLabel} from '../src/lib/featured-time-presentation.js';

test('Featured presents Ethiopia clock times with unambiguous noon, midnight and a 24:00 endpoint',()=>{
 assert.equal(featuredClock('08:30'),'8:30AM');
 assert.equal(featuredClock('12:00'),'12:00PM');
 assert.equal(featuredClock('00:00'),'12:00AM');
 assert.equal(featuredClock('24:00'),'12:00AM');
 assert.equal(featuredRange('08:30','12:00'),'8:30AM–12:00PM EAT');
 assert.equal(featuredRange('22:30','23:59'),'10:30PM–11:59PM EAT');
 assert.equal(featuredRange('23:30','24:00'),'11:30PM–12:00AM EAT');
});

test('Featured ISO display uses Africa/Addis_Ababa regardless of the device or source offset',()=>{
 assert.equal(featuredClock('2026-10-26T05:30:00Z'),'8:30AM');
 assert.equal(featuredClock('2026-10-26T02:30:00-03:00'),'8:30AM');
 assert.equal(featuredRange('2026-10-26T09:00:00Z','2026-10-26T21:00:00Z'),'12:00PM–12:00AM EAT');
});

test('Featured range labels use one EAT suffix and reject unknown zones or malformed clocks',()=>{
 assert.equal(featuredRangeLabel('08:30–12:00'),'8:30AM–12:00PM EAT');
 assert.equal(featuredRangeLabel('08:30–12:00 EAT'),'8:30AM–12:00PM EAT');
 assert.equal(featuredRangeLabel('22:30–23:59'),'10:30PM–11:59PM EAT');
 for(const invalid of ['08:30–12:00 PST','25:00–12:00','24:01–12:00','08:30–'])assert.equal(featuredRangeLabel(invalid),'',invalid);
 assert.equal(featuredClock('2026-10-26T05:30:00'),'','an unzoned ISO time must not inherit the device timezone');
});
