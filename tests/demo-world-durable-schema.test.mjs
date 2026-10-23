import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const fixture=JSON.parse(readFileSync(new URL('../resources/fixtures/managed-market.json',import.meta.url),'utf8'));
const manifest=JSON.parse(readFileSync(new URL('../resources/fixtures/demo-world-scenarios.json',import.meta.url),'utf8'));
const sql=readFileSync(new URL('../supabase/migrations/185_demo_world_durable_capacity.sql',import.meta.url),'utf8');

function fixtureUuid(key){
 const bytes=createHash('sha256').update(`loadgistic-fixture:${key}`).digest().subarray(0,16);
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=bytes.toString('hex');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

function sqlRows(table){
 const section=sql.match(new RegExp(`insert into public\\.${table} values\\n([\\s\\S]*?);`));
 assert.ok(section,`${table} seed section exists`);
 return [...section[1].matchAll(/\(([^()]+)\)/g)].map(match=>{
  const fields=[];let value='';let quoted=false;
  for(const character of match[1]){
   if(character==="'"){quoted=!quoted;value+=character;}
   else if(character===','&&!quoted){fields.push(value.trim().replace(/^'|'$/g,''));value='';}
   else value+=character;
  }
  fields.push(value.trim().replace(/^'|'$/g,''));
  return fields;
 });
}

test('database simulation targets exactly the mutable synthetic manifest vehicles and owners',()=>{
 const rows=sqlRows('demo_world_targets');
 const mutable=manifest.targets.filter(target=>target.mutable);
 assert.equal(rows.length,mutable.length);
 for(const target of mutable){
  const actor=manifest.actors.find(item=>item.key===target.actor_key);
  const fixtureActor=fixture.tables.users.find(item=>item.id===actor.fixture_user_key);
  const vehicle=fixture.tables.vehicles.find(item=>item.id===target.fixture_vehicle_key);
  const assignment=fixture.tables.driver_vehicle_assignments.find(item=>item.vehicle_id===vehicle.id&&item.active);
  const driver=fixture.tables.users.find(item=>item.id===(assignment?.driver_user_id??fixtureActor.id));
  const row=rows.find(item=>item[0]===target.key);
  assert.ok(row,`database allowlist includes ${target.key}`);
  assert.deepEqual(row.slice(0,8),[
   target.key,fixtureUuid(vehicle.id),vehicle.id,fixtureActor.id,
   fixtureActor.email,fixtureActor.role,driver.id,driver.email
  ]);
  assert.equal(row[8],vehicle.organization_id?fixtureUuid(vehicle.organization_id):'null');
  assert.equal(row[9],vehicle.provider_profile_id?fixtureUuid(vehicle.provider_profile_id):'null');
  assert.equal(row[10],target.baseline_status);
  assert.equal(row[11],target.expected_sharing_mode);
 }
});

test('database slots exactly match the versioned planner and preserve each ordered status chain',()=>{
 const rows=sqlRows('demo_world_schedule').map(row=>[
  row[0],row[1],Number(row[2]),row[3],row[4],row[5],row[6],row[7],
  row[8]==='null'?null:JSON.parse(row[8]),row[9]==='null'?null:JSON.parse(row[9])
 ]);
 const expected=manifest.scenarios.flatMap(scenario=>scenario.transitions.map((transition,index)=>{
  const target=manifest.targets.find(item=>item.key===transition.target_key);
  const capacity=fixture.tables.capacities.find(item=>item.id===target.fixture_capacity_key);
  const baseline=JSON.parse(capacity.current_route_points_json).map(point=>point.place_ref);
  const alternate=target.alternate_route_refs;
  return [transition.target_key,scenario.key,scenario.daily_slots_utc[index],scenario.command,
   scenario.command==='capacity.set_status'?transition.from:'EMPTY',
   scenario.command==='capacity.set_status'?transition.to:'EMPTY',
   scenario.command==='capacity.set_load_preference'?transition.from:'null',
   scenario.command==='capacity.set_load_preference'?transition.to:'null',
   scenario.command==='capacity.set_route'?(transition.from==='BASELINE'?baseline:alternate):null,
   scenario.command==='capacity.set_route'?(transition.to==='BASELINE'?baseline:alternate):null];
 }));
 assert.deepEqual(rows.sort((a,b)=>a[0].localeCompare(b[0])||a[2]-b[2]),
  expected.sort((a,b)=>a[0].localeCompare(b[0])||a[2]-b[2]));
 assert.match(sql,/enabled boolean not null default false/);
 assert.match(sql,/check\(not enabled or activated_at is not null\)/);
 assert.match(sql,/grant execute on function public\.demo_world_claim_batch\(uuid,integer\)/);
 assert.match(sql,/public\.demo_world_execute_capacity_step\(bigint,uuid\),public\.demo_world_status\(\) to service_role/);
});
