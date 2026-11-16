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

test('migration224 matches the twenty fast authored phases and bounded upgrade contract',()=>{
 const current=readFileSync(new URL('../supabase/migrations/224_curated_demo_capacity_catalog.sql',import.meta.url),'utf8');
 assert.equal(manifest.mode,'RELATIVE_EPISODES');assert.equal(manifest.scenarios.length,5);
 assert.equal(manifest.scenarios.reduce((n,row)=>n+row.phases.length,0),20);
 assert.match(current,/target\.target_key\|\|'-capacity-episode'/);
 assert.match(current,/cross join generate_series\(0,3\) phase\(value\)/);
 assert.match(current,/command='capacity\.publish_phase'/);
 assert.match(current,/\(array\[100,80,60,30\]\)\[phase\.value\+1\]/);
 assert.match(current,/\(array\[80,60,30,100\]\)\[phase\.value\+1\]/);
 assert.match(current,/step_seconds integer not null default 120 check\(step_seconds=120\)/);
 assert.match(current,/cycle_seconds integer not null default 480 check\(cycle_seconds=480\)/);
 for(const target of manifest.targets.filter(row=>row.mutable)){
  assert.match(current,new RegExp(`when '${target.key}' then ${target.start_offset_seconds}(?:\\s|$)`));
  const scenario=manifest.scenarios.find(row=>row.target_key===target.key);
  assert.equal(scenario.key,`${target.key}-capacity-episode`);assert.equal(scenario.command,'capacity.publish_phase');
  assert.deepEqual(scenario.phases.map(row=>[row.status,row.available_percent]),[['PARTIAL',80],['PARTIAL',60],['PARTIAL',30],['EMPTY',100]]);
 }
 const lookup=current.match(/with target as\(select \* from\(values\n([\s\S]*?)\n \) fixed\(target_key,baseline_route_refs,alternate_route_refs\)/);
 assert.ok(lookup,'private SQL exact route lookup exists');
 const rows=[...lookup[1].matchAll(/\('([^']+)','([^']+)'::jsonb,(?:'([^']+)'::jsonb|null::jsonb)\)/g)]
  .map(([,key,baseline,alternate])=>({key,baseline:JSON.parse(baseline),alternate:alternate?JSON.parse(alternate):null}));
 assert.equal(rows.length,5);
 for(const target of manifest.targets.filter(row=>row.mutable)){
  const row=rows.find(item=>item.key===target.key),capacity=fixture.tables.capacities.find(item=>item.id===target.fixture_capacity_key);
  assert.deepEqual(row.baseline,JSON.parse(capacity.current_route_points_json).map(point=>point.place_ref));
  assert.deepEqual(row.alternate,target.alternate_route_refs||null);
 }
 assert.match(current,/not enabled\s+and activated_at is null and last_dispatch_at is null/);
 assert.match(current,/or exists\(select 1 from public\.demo_world_steps\)/);
 assert.match(current,/or exists\(select 1 from public\.demo_world_receipts\)/);
 assert.match(current,/DEMO_CATALOG_UPGRADE_REVIEW_REQUIRED/);
 assert.match(current,/create unique index demo_world_one_unfinished_target224/);
 assert.match(current,/due_time:=previous\.completed_at\+interval '120 seconds'/);
 assert.match(current,/nominal_time:=control\.catalog_starts_at/);
 assert.match(current,/current_capacity\.id is distinct from job\.expected_capacity_id/);
 assert.match(current,/public\.publish_provider_capacity\(actor_id,command\)/);
 assert.match(current,/new_capacity\.available_percent_reported_driver_id is distinct from driver_id/);
 assert.match(current,/completed_time:=clock_timestamp\(\)/);
 assert.doesNotMatch(current,/due_time[^;]*interval '180 seconds'/);
 // Renaming an internal schedule column must replace every Capacity function
 // that resolves the old field when PL/pgSQL compiles on its next invocation.
 for(const name of ['demo_world_claim_batch','demo_world_execute_capacity_step','demo_world_status']){
  const replacement=current.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`));
  assert.ok(replacement,`${name} is replaced in the rename migration`);
  assert.doesNotMatch(replacement[0],/minute_utc/,`${name} cannot reference the retired field`);
 }
 // Existing authenticated browser roles never receive simulator authority.
 assert.match(sql,/enabled boolean not null default false/);
 assert.match(sql,/grant execute on function public\.demo_world_claim_batch\(uuid,integer\)/);
 assert.match(sql,/public\.demo_world_execute_capacity_step\(bigint,uuid\),public\.demo_world_status\(\) to service_role/);
});
