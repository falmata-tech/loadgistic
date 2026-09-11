import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('supabase/migrations/050_managed_workspace_fleet.sql','utf8');

test('managed Fleet projection is bounded, minimized, and service-role-only',()=>{
  assert.match(migration,/greatest\(1,least\(50/);
  assert.match(migration,/actor\.actor_role<>'TRANSPORTER'/);
  assert.match(migration,/not actor\.workspace_access/);
  assert.doesNotMatch(migration,/profile\.email/);
  assert.doesNotMatch(migration,/storage_path/);
  assert.match(migration,/revoke all on function public\.fleet_driver_page\(uuid,integer,integer\) from public,anon,authenticated/);
  assert.match(migration,/grant execute on function public\.fleet_driver_page\(uuid,integer,integer\) to service_role/);
});

test('Fleet assignment and permission changes are one audited transaction',()=>{
  assert.match(migration,/create or replace function public\.update_fleet_driver_access/);
  assert.match(migration,/update public\.driver_vehicle_assignments/);
  assert.match(migration,/insert into public\.driver_permissions/);
  assert.match(migration,/DRIVER_ACCESS_UPDATED/);
  assert.match(migration,/displaced_assignment_count/);
  assert.match(migration,/revoke all on function public\.update_fleet_driver_access\(uuid,jsonb\) from public,anon,authenticated/);
});

test('active workspace and Fleet routes do not import the SQLite repository',()=>{
  for(const file of [
    'src/app/app/layout.tsx','src/app/app/home/page.tsx','src/app/app/menu/page.tsx',
    'src/app/app/more/page.tsx','src/app/app/fleet/page.tsx',
    'src/app/api/fleet/drivers/[id]/permissions/route.ts'
  ]){
    const source=fs.readFileSync(file,'utf8');
    assert.doesNotMatch(source,/lib\/repository\.js/);
  }
});
