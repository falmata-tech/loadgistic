import test from 'node:test';
import assert from 'node:assert/strict';
import {featuredTruckTypeForDate,featuredTruckWeekForDate} from '../src/lib/featured-trucks.js';

test('the seven-day programme rotates through distinct truck-type themes',()=>{
  const week=featuredTruckWeekForDate('2026-09-07');
  assert.equal(week.length,7);
  assert.equal(new Set(week.map(day=>day.key)).size,7);
  assert.equal(week[0].label,'Mini trucks');
  assert.equal(week[6].label,'Heavy trucks with trailers');
  assert.deepEqual(featuredTruckTypeForDate('2026-09-08').configurations,['Cargo van']);
  assert.deepEqual(featuredTruckTypeForDate('2026-09-09').configurations,['Pickup truck','Pickup stake body']);
});
