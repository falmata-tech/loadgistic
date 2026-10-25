import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HANDOVER_FIXTURE_VEHICLE_IDS} from '../scripts/fixture-market-policy.mjs';

const {tables}=JSON.parse(readFileSync(new URL('../resources/fixtures/managed-market.json',import.meta.url),'utf8'));

test('demo corridor routes belong to real vehicle and driver pairs near their first city',()=>{
  const vehicles=new Map(tables.vehicles.map(vehicle=>[vehicle.id,vehicle]));
  const capacities=new Map(tables.capacities.map(capacity=>[capacity.vehicle_id,capacity]));
  const assigned=new Map(tables.driver_vehicle_assignments.filter(row=>row.active&&!row.released_at).map(row=>[row.vehicle_id,row.driver_user_id]));
  const owners=new Map(tables.provider_profiles.map(profile=>[profile.id,profile.user_id]));
  const pairs=new Set();
  let routes=0;
  for(const signal of tables.profile_routes){
    const vehicle=vehicles.get(signal.assigned_vehicle_id);
    assert.ok(vehicle,`${signal.id} has a vehicle`);
    assert.equal(HANDOVER_FIXTURE_VEHICLE_IDS.has(vehicle.id),false,`${signal.id} would disappear when the demo handover swaps drivers`);
    assert.equal(vehicle.organization_id,signal.organization_id,signal.id);
    assert.equal(vehicle.provider_profile_id,signal.provider_profile_id,signal.id);
    assert.equal(signal.assigned_driver_user_id,assigned.get(vehicle.id)||owners.get(vehicle.provider_profile_id),signal.id);
    const pair=`${vehicle.id}:${signal.assigned_driver_user_id}`;
    assert.equal(pairs.has(pair),false,`${signal.id} duplicates a vehicle/driver`);
    pairs.add(pair);
    const points=JSON.parse(signal.route_points_json);
    if(signal.geometry==='ROUTE'){
      assert.ok(points.length>=2,signal.id);
      routes++;
    }
    const first=signal.geometry==='ROUTE'?points[0]:{lat:signal.area_center_lat,lng:signal.area_center_lng};
    const capacity=capacities.get(vehicle.id);
    assert.ok(capacity,signal.id);
    const approximateKm=Math.hypot((Number(capacity.location_lat)-Number(first.lat))*111,(Number(capacity.location_lng)-Number(first.lng))*111);
    assert.ok(approximateKm<10,`${signal.id} begins near its vehicle`);
  }
  assert.ok(routes>=20,'the demo has many actual corridor routes');
});
