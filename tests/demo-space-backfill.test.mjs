import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {demoSpaceBackfillPlan,demoSpaceBackfillSql} from '../scripts/prepare-demo-space-backfill.mjs';
import {managedDevFixtureUuid} from '../scripts/prepare-managed-dev-review-fixtures.mjs';
import {pilotUuid} from '../scripts/production-pilot-policy.mjs';

const fixture=JSON.parse(readFileSync(new URL('../resources/fixtures/managed-market.json',import.meta.url)));
const partial=fixture.tables.capacities.filter(row=>(row.market_status||row.status)==='PARTIAL');

test('local repair plans only exact authored Partial fixture records and original report times',()=>{
 const rows=demoSpaceBackfillPlan(fixture);
 assert.equal(rows.length,partial.length);
 for(const [index,seed] of partial.entries()){
  const row=rows[index];
  assert.equal(row.capacity_id,managedDevFixtureUuid(seed.id));
  assert.equal(row.vehicle_id,managedDevFixtureUuid(seed.vehicle_id));
  assert.equal(row.percent,seed.available_percent);
  assert.equal(Date.parse(row.reported_at),Date.parse(seed.available_percent_reported_at));
  assert.equal(row.driver_key,seed.available_percent_reported_driver_id);
  assert.equal(row.reporter_key,seed.available_percent_reported_by);
 }
 assert.match(demoSpaceBackfillSql(rows),/rollback;\s*$/);
});

test('pilot repair uses exact observed record IDs with known fixture vehicles and explicit estimates',()=>{
 const seed=partial.find(row=>row.vehicle_id==='veh-driver-1');
 const observed=[
  {id:pilotUuid('newer-observed-capacity'),vehicleId:pilotUuid(seed.vehicle_id)},
  {id:pilotUuid('published-pilot-only'),vehicleId:pilotUuid('veh-public-owner-09')},
 ];
 const [regular,pilotOnly]=demoSpaceBackfillPlan(fixture,{pilotPublicRows:observed});
 assert.equal(regular.capacity_id,observed[0].id);
 assert.equal(regular.percent,seed.available_percent);
 assert.equal(pilotOnly.capacity_id,observed[1].id);
 assert.equal(pilotOnly.percent,65);
 assert.equal(pilotOnly.driver_key,'user-public-owner-09');
 const sql=demoSpaceBackfillSql([regular,pilotOnly],{requireAll:true});
 assert.match(sql,/DEMO_SPACE_PILOT_SCOPE_DRIFT/);
 assert.match(sql,/enable trigger capacity_reported_space_invalidate/);
});

test('pilot repair refuses unrecognized vehicles, duplicate reports and Empty fixtures without an authored estimate',()=>{
 const observed={id:pilotUuid('observed-capacity'),vehicleId:pilotUuid('unknown-vehicle')};
 assert.throws(()=>demoSpaceBackfillPlan(fixture,{pilotPublicRows:[observed]}),/DEMO_SPACE_PILOT_VEHICLE_UNKNOWN/);
 assert.throws(()=>demoSpaceBackfillPlan(fixture,{pilotPublicRows:[observed,observed]}),/DEMO_SPACE_PILOT_INPUT_INVALID/);
 const empty=fixture.tables.capacities.find(row=>(row.market_status||row.status)==='EMPTY'&&!['veh-public-owner-01','veh-public-owner-09'].includes(row.vehicle_id));
 assert.throws(()=>demoSpaceBackfillPlan(fixture,{pilotPublicRows:[{...observed,vehicleId:pilotUuid(empty.vehicle_id)}]}),/DEMO_SPACE_SEED_INVALID/);
});
