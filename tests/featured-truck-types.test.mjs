import test from 'node:test';
import assert from 'node:assert/strict';
import {featuredTruckTypeForDate,featuredTruckWeekForDate,selectBalancedFeaturedTruckRows} from '../src/lib/featured-trucks.js';

test('the seven-day programme rotates through distinct truck-type themes',()=>{
  const week=featuredTruckWeekForDate('2026-09-07');
  assert.equal(week.length,7);
  assert.equal(new Set(week.map(day=>day.key)).size,7);
  assert.equal(week[0].label,'Mini trucks');
  assert.equal(week[5].label,'Heavy trucks');
  assert.equal(week[6].label,'Courier cars');
  assert.deepEqual(featuredTruckTypeForDate('2026-09-08').configurations,['Cargo van']);
  assert.deepEqual(featuredTruckTypeForDate('2026-09-09').configurations,['Pickup truck','Pickup stake body']);
  assert.deepEqual(featuredTruckTypeForDate('2026-09-12').configurations,[
    'Heavy Rigid Stake Body Truck','Heavy Rigid Stake Body Truck + Trailer','Tractor + Container Trailer',
    'Tractor + Dry Van Trailer','Tractor + Heavy Equipment Trailer'
  ]);
  assert.deepEqual(featuredTruckTypeForDate('2026-09-13').configurations,['Courier car']);
});

test('multi-configuration days demonstrate each heavy configuration before repeating one',()=>{
  const configurations=featuredTruckTypeForDate('2026-09-12').configurations;
  const rows=configurations.flatMap((configuration,index)=>Array.from({length:index===0?5:2},(_,position)=>({vehicle:{cargo_configuration:configuration,id:`${index}-${position}`}})));
  const selected=selectBalancedFeaturedTruckRows(rows,configurations,8);
  assert.deepEqual(selected.slice(0,configurations.length).map(row=>row.vehicle.cargo_configuration),configurations);
  assert.equal(selected.length,8);
});
