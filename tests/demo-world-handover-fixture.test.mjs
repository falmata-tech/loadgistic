import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyManagedFixtureMarketPolicy} from '../scripts/fixture-market-policy.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const {tables}=JSON.parse(read('resources/fixtures/managed-market.json'));

test('the ordinary handover vehicle retains its actual Partial fixture instead of a size-based Empty override',()=>{
  const imported=applyManagedFixtureMarketPolicy(tables.capacities,tables.vehicles);
  const area=imported.find(row=>row.vehicle_id==='veh-public-fleet-01-1');
  const route=imported.find(row=>row.vehicle_id==='veh-public-fleet-01-4');
  assert.ok(area&&route);
  assert.equal(area.availability_geometry,'RADIUS');assert.equal(area.status,'EMPTY');
  assert.equal(route.availability_geometry,'ROUTE');
  assert.equal(route.status,'PARTIAL');assert.equal(route.market_status,'PARTIAL');
  const original=tables.capacities.find(row=>row.id===route.id);
  for(const field of ['status','market_status','available_percent','accepts_full_load','accepts_partial_load'])
    assert.deepEqual(route[field],original[field],field);
});

test('held-lane SQL reaches the historical Empty baseline only after proving Partial refusal without changed state',()=>{
  const sql=read('tests/sql/demo-world-atomic-handover.sql');
  const partial=sql.indexOf("failure_code='DEMO_HANDOVER_CAPACITY_REFUSED'");
  const unchanged=sql.indexOf('HANDOVER_PARTIAL_DENIAL_CHANGED_STATE');
  const historical=sql.indexOf("update public.capacities set status='EMPTY',market_status='EMPTY',available_percent=100");
  const held=sql.indexOf("failure_code='DEMO_MANUAL_LANE_HELD'");
  assert.ok(partial>=0&&unchanged>partial&&historical>unchanged&&held>historical);
  assert.match(sql.slice(historical,held),/where id in\(capacity_a,capacity_b\)/);
  assert.match(sql,/HANDOVER_HISTORICAL_BASELINE_MISSING/);
  assert.match(sql,/HANDOVER_MANUAL_DENIAL_LEFT_PARTIAL_STATE/);
  assert.match(sql,/'audit',\(select jsonb_agg/);assert.match(sql,/'featured_days',\(select jsonb_agg/);
  assert.match(sql,/rollback;\s*$/);assert.doesNotMatch(sql,/\bcommit\s*;/i);
  const base=read('supabase/migrations/187_demo_world_atomic_handover.sql');
  assert.ok(base.indexOf("raise exception 'DEMO_HANDOVER_CAPACITY_REFUSED'")<base.indexOf('-- Every command below participates'));
  const hold=read('supabase/migrations/223_demo_manual_lane_hold.sql');
  assert.match(hold,/-- Every command below participates in this function/);
  assert.match(hold,/raise exception ''DEMO_MANUAL_LANE_HELD''/);
});

test('the worker historical replay fixture authors its exact Empty result without changing normal imports',()=>{
  const sql=read('tests/sql/demo-world-handover-worker.sql');
  const historical=sql.indexOf("update public.capacities set status='EMPTY',market_status='EMPTY',available_percent=100");
  const receipt=sql.indexOf('insert into public.demo_world_handover_receipts');
  assert.ok(historical>=0&&receipt>historical);
  assert.match(sql.slice(historical,receipt),/location_source='MANUAL_ADMIN' where id in\(capacity_a,capacity_b\)/);
  assert.match(sql,/HANDOVER_WORKER_MANUAL_LANE_NOT_HELD/);
  assert.match(sql,/HANDOVER_HISTORICAL_JOB_REPLAY_CHANGED_STATE/);
  assert.match(sql,/rollback;\s*$/);assert.doesNotMatch(sql,/\bcommit\s*;/i);
});
