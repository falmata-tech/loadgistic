import test from 'node:test';
import assert from 'node:assert/strict';
import {FEATURED_PROVIDER_DAY,featuredTruckTypeForDate,featuredTruckWeekForDate,selectBalancedFeaturedTruckRows,selectFeaturedProviderAccountRows} from '../src/lib/featured-trucks.js';

test('the seven-day programme rotates through distinct truck-type themes',()=>{
  const week=featuredTruckWeekForDate('2026-09-07');
  assert.equal(week.length,7);
  assert.equal(new Set(week.map(day=>day.key)).size,7);
  assert.equal(week[0].label,'Mini trucks');
  assert.equal(week[5].label,'Heavy vehicles');
  assert.equal(week[6].label,'Mixed vehicles');
  assert.deepEqual(featuredTruckTypeForDate('2026-09-08').configurations,['Cargo van','Courier car','Courier motorcycle']);
  assert.deepEqual(featuredTruckTypeForDate('2026-09-09').configurations,['Pickup truck','Pickup stake body']);
  assert.deepEqual(featuredTruckTypeForDate('2026-09-12').configurations,[
    'Heavy Rigid Stake Body Truck','Heavy Rigid Stake Body Truck + Trailer','Tractor + Container Trailer',
    'Tractor + Dry Van Trailer','Tractor + Heavy Equipment Trailer'
  ]);
  const sunday=featuredTruckTypeForDate('2026-09-13');
  assert.deepEqual(new Set(sunday.configurations),new Set(week.slice(0,6).flatMap(day=>day.configurations)));
  assert.ok(sunday.configurations.includes('Courier car'));assert.ok(sunday.configurations.includes('Courier motorcycle'));assert.equal(sunday.configurations.length,17);assert.equal(week[1].key,'cargo-vans');assert.equal(week[1].label,'Vans and couriers');
});

test('multi-configuration days demonstrate each heavy configuration before repeating one',()=>{
  const configurations=featuredTruckTypeForDate('2026-09-12').configurations;
  const rows=configurations.flatMap((configuration,index)=>Array.from({length:index===0?5:2},(_,position)=>({vehicle:{cargo_configuration:configuration,id:`${index}-${position}`}})));
  const selected=selectBalancedFeaturedTruckRows(rows,configurations,8);
  assert.deepEqual(selected.slice(0,configurations.length).map(row=>row.vehicle.cargo_configuration),configurations);
  assert.equal(selected.length,8);
});

test('new fixture days feature distinct accounts across vehicle configurations',()=>{
  const rows=[
    {vehicle:{id:'one',cargo_configuration:'Mini Box Truck'},owner:{organization_id:'fleet-a'}},
    {vehicle:{id:'two',cargo_configuration:'Cargo van'},owner:{organization_id:'fleet-a'}},
    {vehicle:{id:'three',cargo_configuration:'Courier motorcycle'},owner:{profile_id:'provider-b'}},
    {vehicle:{id:'four',cargo_configuration:'Pickup truck'},owner:{organization_id:'fleet-c'}}
  ];
  assert.equal(FEATURED_PROVIDER_DAY.label,'Transport Providers');
  assert.deepEqual(selectFeaturedProviderAccountRows(rows,8).map(row=>row.vehicle.id),['one','three','four']);
  assert.equal(selectFeaturedProviderAccountRows(rows,2).length,2);
});
