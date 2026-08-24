import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const root=path.resolve(import.meta.dirname,'..');
const importer=path.join(root,'scripts','import-supabase-fixtures.mjs');

test('fixture importer refuses a remote Supabase target before making requests',()=>{
  const result=spawnSync(process.execPath,[importer,'--reset-local'],{
    cwd:root,
    env:{...process.env,SUPABASE_SEED_URL:'https://example.supabase.co',SUPABASE_SEED_SERVICE_ROLE_KEY:'not-a-secret'},
    encoding:'utf8'
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/REMOTE_FIXTURE_IMPORT_REFUSED/);
});

test('fixture importer requires an explicit destructive local reset flag',()=>{
  const result=spawnSync(process.execPath,[importer],{
    cwd:root,
    env:{...process.env,SUPABASE_SEED_URL:'http://127.0.0.1:55321',SUPABASE_SEED_SERVICE_ROLE_KEY:'not-a-secret'},
    encoding:'utf8'
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/LOCAL_FIXTURE_RESET_CONFIRMATION_REQUIRED/);
});

test('runtime parity migrations preserve area routes and least-privilege RLS enforcement',()=>{
  const routeConstraint=fs.readFileSync(path.join(root,'supabase','migrations','036_profile_route_geometry_constraint.sql'),'utf8');
  const privileges=fs.readFileSync(path.join(root,'supabase','migrations','035_runtime_role_privileges.sql'),'utf8');
  assert.match(routeConstraint,/geometry\s*=\s*'RADIUS'/);
  assert.match(routeConstraint,/lower\(trim\(origin\)\)\s*<>\s*lower\(trim\(destination\)\)/);
  assert.match(privileges,/revoke all privileges on all tables in schema public from anon/i);
  assert.doesNotMatch(privileges,/grant .* on all tables in schema public to anon/i);
  assert.match(privileges,/PostGIS metadata relations/);
});

test('managed identity projection binds its subject to auth uid and exposes no password material',()=>{
  const identity=fs.readFileSync(path.join(root,'supabase','migrations','037_current_user_identity_projection.sql'),'utf8');
  assert.match(identity,/where profile\.id=auth\.uid\(\)/i);
  assert.match(identity,/revoke all on function public\.current_user_projection\(\) from public,anon/i);
  assert.match(identity,/grant execute on function public\.current_user_projection\(\) to authenticated,service_role/i);
  assert.doesNotMatch(identity,/password|token|secret/i);
});

test('public capacity migration is bounded, server-only, and strips private current geometry',()=>{
  const capacity=fs.readFileSync(path.join(root,'supabase','migrations','038_public_capacity_projection.sql'),'utf8');
  assert.match(capacity,/greatest\(12,least\(coalesce\(requested_page_size,14\),16\)\)/i);
  assert.match(capacity,/case when visibility='OPEN' then location_lat end/i);
  assert.match(capacity,/case when visibility='OPEN' then current_route_points_json else '\[\]'::jsonb end/i);
  assert.match(capacity,/position\(input\.search_text in lower/i);
  assert.match(capacity,/capacity_route_matches\(signal->'route_points'/i);
  assert.match(capacity,/capacity_area_matches\(signal->'area_boundary'/i);
  assert.match(capacity,/revoke all on function public\.public_capacity_page[\s\S]*from public,anon,authenticated/i);
  assert.match(capacity,/grant execute on function public\.public_capacity_page[\s\S]*to service_role/i);
});
